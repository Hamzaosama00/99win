import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

// Compatibility layer for the specific queries used by this application, not
// a general Prisma implementation. Unsupported operations fail explicitly.
// Rows are JSON on the wire; dates are restored at the API boundary.
type Row = Record<string, any>
type Model = 'user' | 'transaction' | 'bet'
export type DatabaseSnapshot = Record<Model, Record<string, Row>>
export interface SnapshotTransport {
  read(): Promise<{ data: DatabaseSnapshot | null; version: string }>
  compareAndSet(version: string, data: DatabaseSnapshot): Promise<boolean>
}
type Query = Record<string, any>
export type DatabaseClient = Pick<PrismaClient, 'user' | 'transaction' | 'bet' | '$transaction'>
type Operation = (data: DatabaseSnapshot) => any
const models: Model[] = ['user', 'transaction', 'bet']
const writes = new Set(['create', 'update', 'updateMany', 'delete', 'deleteMany'])

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true
    if (value && typeof value === 'object') {
      return Object.entries(value).every(([operator, operand]) => {
        if (operator === 'in') return (operand as unknown[]).includes(row[key])
        if (operator === 'gt') return row[key] > (operand as number)
        if (operator === 'gte') return row[key] >= (operand as number)
        throw new Error(`Unsupported Firebase filter: ${operator}`)
      })
    }
    return (row[key] ?? null) === value
  })
}

function project(row: Row, select?: Row): Row {
  const result: Row = {}
  for (const [key, value] of Object.entries(row)) {
    if (select && !select[key]) continue
    result[key] = ['createdAt', 'updatedAt', 'processedAt', 'lastSeenAt', 'sessionRevokedAt'].includes(key) && value
      ? new Date(value) : value
  }
  return result
}

function defaults(model: Model): Row {
  if (model === 'user') return { role: 'USER', status: 'ACTIVE', lastSeenAt: null, sessionRevokedAt: null, balance: 0, totalDeposit: 0, totalWin: 0, totalLoss: 0, cashbackEarned: 0, updatedAt: new Date().toISOString() }
  if (model === 'bet') return { status: 'ACTIVE', cashedOutAt: null, winAmount: null }
  return { status: 'PENDING', method: null, txnId: null, account: null, note: null, processedAt: null }
}

function validate(data: DatabaseSnapshot, model: Model, row: Row) {
  if (model === 'user') {
    if (Object.values(data.user).some((other) => other.id !== row.id && other.phone === row.phone)) {
      throw new Error('This phone number is already registered.')
    }
    if (!Number.isFinite(row.balance) || row.balance < 0) throw new Error('Insufficient balance.')
  } else if (!data.user[row.userId]) {
    throw new Error('User not found.')
  }
  if (model === 'transaction' && row.type === 'DEPOSIT' && row.txnId &&
      Object.values(data.transaction).some((other) => other.id !== row.id && other.type === 'DEPOSIT' && other.txnId === row.txnId)) {
    throw new Error('This Transaction ID has already been submitted.')
  }
  for (const value of Object.values(row)) {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid numeric value.')
  }
}

function execute(data: DatabaseSnapshot, model: Model, method: string, args: Query = {}): any {
  const allowed = ['where', 'orderBy', 'take', 'select', 'include', 'data', 'by', '_count', '_sum']
  for (const key of Object.keys(args)) if (!allowed.includes(key)) throw new Error(`Unsupported Firebase query option: ${key}`)
  const table = data[model]
  let rows = Object.values(table).map((row) => ({ ...defaults(model), ...row })).filter((row) => matches(row, args.where))
  if (args.orderBy) {
    const [field, direction] = Object.entries(args.orderBy)[0]
    rows.sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (direction === 'desc' ? -1 : 1))
  }
  if (args.take !== undefined) rows = rows.slice(0, args.take)
  const shape = (row: Row) => {
    const result = project(row, args.select)
    if (args.include) {
      if (Object.keys(args.include).some((key) => key !== 'user')) throw new Error('Unsupported Firebase relation.')
      result.user = project(data.user[row.userId], args.include.user.select)
    }
    return result
  }
  if (method === 'findMany') return rows.map(shape)
  if (method === 'findUnique' || method === 'findFirst') return rows[0] ? shape(rows[0]) : null
  if (method === 'count') return rows.length
  const aggregate = (group: Row[]) => ({
    ...(args._sum ? { _sum: Object.fromEntries(Object.keys(args._sum).map((field) => [field,
      group.some((row) => row[field] != null) ? group.reduce((sum, row) => sum + (row[field] ?? 0), 0) : null])) } : {}),
    ...(args._count ? { _count: Object.fromEntries(Object.keys(args._count).map((field) => [field, group.filter((row) => row[field] != null).length])) } : {}),
  })
  if (method === 'aggregate') return aggregate(rows)
  if (method === 'groupBy') {
    if (JSON.stringify(args.by) !== '["userId"]') throw new Error('Unsupported Firebase grouping.')
    const ids = [...new Set(rows.map((row) => row.userId))]
    return ids.map((userId) => ({ userId, ...aggregate(rows.filter((row) => row.userId === userId)) }))
  }
  if (method === 'create') {
    const { transactions, ...fields } = args.data
    const row = { ...defaults(model), id: randomUUID(), createdAt: new Date().toISOString(), ...JSON.parse(JSON.stringify(fields)) }
    if (table[row.id]) throw new Error('Record already exists.')
    validate(data, model, row)
    table[row.id] = row
    if (transactions) {
      if (model !== 'user' || !transactions.create || Object.keys(transactions).length !== 1) throw new Error('Unsupported nested write.')
      execute(data, 'transaction', 'create', { data: { ...transactions.create, userId: row.id } })
    }
    return shape(row)
  }
  if (method === 'update' || method === 'updateMany') {
    if (method === 'update' && rows.length !== 1) throw new Error('Record not found or update is ambiguous.')
    for (const row of rows) {
      for (const [key, value] of Object.entries(args.data)) {
        if (value === undefined) continue
        if (value && typeof value === 'object' && !(value instanceof Date)) {
          const entries = Object.entries(value)
          if (entries.length !== 1) throw new Error('Unsupported Firebase update.')
          const [operator, operand] = entries[0]
          if (operator === 'increment') row[key] += operand as number
          else if (operator === 'decrement') row[key] -= operand as number
          else throw new Error(`Unsupported Firebase update: ${operator}`)
        } else row[key] = value instanceof Date ? value.toISOString() : value
      }
      if (model === 'user') row.updatedAt = new Date().toISOString()
      validate(data, model, row)
      table[row.id] = row
    }
    return method === 'updateMany' ? { count: rows.length } : shape(rows[0])
  }
  if (method === 'delete' || method === 'deleteMany') {
    if (method === 'delete' && rows.length !== 1) throw new Error('Record not found or deletion is ambiguous.')
    for (const row of rows) {
      if (model === 'user' && [...Object.values(data.bet), ...Object.values(data.transaction)].some((child) => child.userId === row.id)) throw new Error('User still has related records.')
      delete table[row.id]
    }
    return method === 'deleteMany' ? { count: rows.length } : shape(rows[0])
  }
  throw new Error(`Unsupported Firebase operation: ${method}`)
}

// Operations stay lazy so the existing $transaction([op1, op2]) API commits
// once, without starting either write independently.
class PendingOperation implements PromiseLike<any> {
  private promise?: Promise<any>
  constructor(readonly owner: object, readonly run: Operation, private start: () => Promise<any>) {}
  then(resolve?: any, reject?: any): Promise<any> {
    this.promise ??= this.start()
    return this.promise.then(resolve, reject)
  }
  get started() { return Boolean(this.promise) }
}

export function createFirebaseStore(transport: SnapshotTransport): DatabaseClient {
  const owner = {}
  async function transact(run: (snapshot: DatabaseSnapshot) => Promise<any>): Promise<any> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const { data, version } = await transport.read()
      const snapshot: DatabaseSnapshot = { ...data, user: data?.user ?? {}, transaction: data?.transaction ?? {}, bet: data?.bet ?? {} }
      const result = await run(snapshot)
      if (await transport.compareAndSet(version, snapshot)) return result
      await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 30 * (attempt + 1)))
    }
    throw new Error('Database is busy. Please retry.')
  }
  function client(snapshot?: DatabaseSnapshot): any {
    const result: Record<string, any> = {}
    for (const model of models) {
      result[model] = Object.fromEntries(['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy', ...writes].map((method) => [method, (args?: Query) => {
        const run: Operation = (state) => execute(state, model, method, args)
        return new PendingOperation(owner, run, async () => {
          if (snapshot) return run(snapshot)
          if (writes.has(method)) return transact(async (state) => run(state))
          const { data } = await transport.read()
          return run({ ...data, user: data?.user ?? {}, transaction: data?.transaction ?? {}, bet: data?.bet ?? {} })
        })
      }]))
    }
    result.$transaction = (work: any) => transact(async (state) => {
      if (typeof work === 'function') return work(client(state))
      if (!Array.isArray(work) || work.some((op) => !(op instanceof PendingOperation) || op.owner !== owner || op.started)) throw new Error('Transaction requires unexecuted database operations.')
      return work.map((op: PendingOperation) => op.run(state))
    })
    return result
  }
  // Existing route signatures retain their generated model/select result types.
  return client() as DatabaseClient
}
