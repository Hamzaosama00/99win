import test from 'node:test'
import assert from 'node:assert/strict'
import { createFirebaseStore, type DatabaseSnapshot, type SnapshotTransport } from '../src/lib/firebase-store.ts'
import { ensureAdmin } from '../src/lib/seed-admin.ts'
import { verifyPassword } from '../src/lib/auth.ts'
import { createFirebaseTransport } from '../src/lib/firebase-transport.ts'

function fixture() {
  let data: DatabaseSnapshot | null = null
  let version = 0
  let conflicts = 0
  const transport: SnapshotTransport = {
    async read() { return { data: structuredClone(data), version: String(version) } },
    async compareAndSet(expected, next) {
      if (expected !== String(version)) { conflicts++; return false }
      data = JSON.parse(JSON.stringify(next))
      version++
      return true
    },
  }
  return { db: createFirebaseStore(transport), inspect: () => ({ data, version, conflicts }) }
}

const userData = { phone: '03123456789', name: 'Test', password: 'existing-hash', balance: 100 }

test('REST transport uses a private bearer token, fresh reads and conditional writes', async () => {
  const calls: RequestInit[] = []
  const responses = [
    new Response('null', { headers: { etag: '"v1"' } }),
    new Response('null', { status: 412 }),
    new Response('{}'),
  ]
  const transport = createFirebaseTransport(async () => 'test-token', async (url, init) => {
    assert.equal(url, 'https://win-84409-default-rtdb.firebaseio.com/99win.json')
    calls.push(init!)
    return responses.shift()!
  })
  assert.deepEqual(await transport.read(), { data: null, version: '"v1"' })
  const data: DatabaseSnapshot = { user: {}, transaction: {}, bet: {} }
  assert.equal(await transport.compareAndSet('"v1"', data), false)
  assert.equal(await transport.compareAndSet('"v2"', data), true)
  assert.equal(new Headers(calls[0].headers).get('Authorization'), 'Bearer test-token')
  assert.equal(new Headers(calls[0].headers).get('X-Firebase-ETag'), 'true')
  assert.equal(calls[0].cache, 'no-store')
  assert.equal(calls[1].method, 'PUT')
  assert.equal(new Headers(calls[1].headers).get('If-Match'), '"v1"')
  assert.equal(calls[1].body, JSON.stringify(data))
})

test('REST errors and missing versions fail closed', async () => {
  const denied = createFirebaseTransport(async () => 'test-token', async () => new Response('private details', { status: 403 }))
  await assert.rejects(denied.read(), /request failed \(403\)/)
  const noVersion = createFirebaseTransport(async () => 'test-token', async () => new Response('null'))
  await assert.rejects(noVersion.read(), /transaction version/)
})

test('admin credentials still work and repeated seeding preserves the hash and balance', async () => {
  const { db } = fixture()
  await Promise.all([ensureAdmin(db), ensureAdmin(db)])
  const admin = await db.user.findUnique({ where: { phone: '03182772524' } })
  assert.ok(admin)
  assert.equal(admin.role, 'ADMIN')
  assert.ok(verifyPassword('hamza112233', admin.password))
  await db.user.update({ where: { id: admin.id }, data: { balance: 45 } })
  await ensureAdmin(db)
  const unchanged = await db.user.findUnique({ where: { id: admin.id } })
  assert.equal(unchanged?.password, admin.password)
  assert.equal(unchanged?.balance, 45)
  assert.equal(await db.user.count(), 1)
})

test('signup creates user and bonus atomically and restores dates', async () => {
  const { db } = fixture()
  const user = await db.user.create({ data: { ...userData, transactions: { create: { type: 'BONUS', amount: 100 } } } })
  assert.equal(user.password, 'existing-hash')
  assert.ok(user.createdAt instanceof Date)
  const transactions = await db.transaction.findMany({ include: { user: { select: { name: true } } } })
  assert.equal(transactions.length, 1)
  assert.equal(transactions[0].userId, user.id)
  assert.deepEqual(transactions[0].user, { name: 'Test' })
  assert.equal(transactions[0].processedAt, null)
})

test('failed interactive transaction rolls back wallet and ledger', async () => {
  const { db } = fixture()
  const user = await db.user.create({ data: userData })
  await assert.rejects(db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { balance: { decrement: 20 } } })
    await tx.transaction.create({ data: { userId: user.id, type: 'WITHDRAW', amount: 20 } })
    throw new Error('rollback')
  }), /rollback/)
  assert.equal((await db.user.findUnique({ where: { id: user.id } }))?.balance, 100)
  assert.equal(await db.transaction.count(), 0)
})

test('array operations are lazy and commit only once', async () => {
  const { db, inspect } = fixture()
  const user = await db.user.create({ data: userData })
  const balance = db.user.update({ where: { id: user.id }, data: { balance: { increment: 5 } } })
  const ledger = db.transaction.create({ data: { userId: user.id, type: 'BONUS', amount: 5 } })
  assert.equal(inspect().version, 1)
  const [updated] = await db.$transaction([balance, ledger])
  assert.equal(updated.balance, 105)
  assert.equal(inspect().version, 2)
})

test('a failed array transaction does not commit its first operation', async () => {
  const { db } = fixture()
  const user = await db.user.create({ data: userData })
  await assert.rejects(db.$transaction([
    db.user.update({ where: { id: user.id }, data: { balance: { decrement: 10 } } }),
    db.transaction.create({ data: { userId: 'missing-user', type: 'WITHDRAW', amount: 10 } }),
  ]), /User not found/)
  assert.equal((await db.user.findUnique({ where: { id: user.id } }))?.balance, 100)
})

test('concurrent bet settlement credits only one payout', async () => {
  const { db } = fixture()
  const user = await db.user.create({ data: userData })
  const bet = await db.bet.create({ data: { userId: user.id, roundId: 1, amount: 10, crashPoint: 2 } })
  const settle = () => db.$transaction([
    db.bet.update({ where: { id: bet.id, status: 'ACTIVE' }, data: { status: 'CASHED_OUT', winAmount: 20 } }),
    db.user.update({ where: { id: user.id }, data: { balance: { increment: 20 } } }),
  ])
  const results = await Promise.allSettled([settle(), settle()])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal((await db.user.findUnique({ where: { id: user.id } }))?.balance, 120)
})

test('concurrent withdrawals retry and cannot overdraw', async () => {
  const { db, inspect } = fixture()
  const user = await db.user.create({ data: userData })
  const withdraw = () => db.$transaction(async (tx) => {
    const result = await tx.user.updateMany({ where: { id: user.id, balance: { gte: 80 } }, data: { balance: { decrement: 80 } } })
    if (!result.count) throw new Error('Insufficient balance')
    return tx.transaction.create({ data: { userId: user.id, type: 'WITHDRAW', amount: 80 } })
  })
  const results = await Promise.allSettled([withdraw(), withdraw()])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal((await db.user.findUnique({ where: { id: user.id } }))?.balance, 20)
  assert.equal(await db.transaction.count(), 1)
  assert.ok(inspect().conflicts > 0)
})

test('concurrent duplicate accounts and deposit references are rejected', async () => {
  const { db } = fixture()
  const users = await Promise.allSettled([db.user.create({ data: userData }), db.user.create({ data: userData })])
  assert.equal(users.filter((user) => user.status === 'fulfilled').length, 1)
  const user = await db.user.findUnique({ where: { phone: userData.phone } })
  const data = { userId: user!.id, type: 'DEPOSIT', txnId: 'receipt-123', amount: 20 }
  const deposits = await Promise.allSettled([db.transaction.create({ data }), db.transaction.create({ data })])
  assert.equal(deposits.filter((deposit) => deposit.status === 'fulfilled').length, 1)
})

test('approval is idempotent under concurrent reviews', async () => {
  const { db } = fixture()
  const user = await db.user.create({ data: userData })
  const deposit = await db.transaction.create({ data: { userId: user.id, type: 'DEPOSIT', amount: 50 } })
  const review = () => db.$transaction(async (tx) => {
    const row = await tx.transaction.findUnique({ where: { id: deposit.id } })
    if (row?.status !== 'PENDING') throw new Error('Already reviewed')
    await tx.user.update({ where: { id: user.id }, data: { balance: { increment: 50 } } })
    return tx.transaction.update({ where: { id: deposit.id }, data: { status: 'APPROVED', processedAt: new Date() } })
  })
  const results = await Promise.allSettled([review(), review()])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal((await db.user.findUnique({ where: { id: user.id } }))?.balance, 150)
})

test('admin queries support filters, sorting, selections, sums and grouping', async () => {
  const { db } = fixture()
  const user = await db.user.create({ data: userData })
  await db.bet.create({ data: { userId: user.id, roundId: 1, amount: 10, crashPoint: 2, status: 'CRASHED' } })
  await db.bet.create({ data: { userId: user.id, roundId: 2, amount: 20, crashPoint: 3, status: 'CASHED_OUT', winAmount: 30 } })
  const rows = await db.bet.findMany({ where: { status: { in: ['CRASHED', 'CASHED_OUT'] } }, orderBy: { roundId: 'desc' }, take: 1, select: { roundId: true } })
  assert.deepEqual(rows, [{ roundId: 2 }])
  const groups = await db.bet.groupBy({ by: ['userId'], _sum: { amount: true, winAmount: true }, _count: { id: true } })
  assert.deepEqual(groups, [{ userId: user.id, _sum: { amount: 30, winAmount: 30 }, _count: { id: 2 } }])
  assert.deepEqual(await db.bet.aggregate({ _sum: { amount: true } }), { _sum: { amount: 30 } })
})
