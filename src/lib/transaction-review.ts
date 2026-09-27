import type { DatabaseClient } from './firebase-store'
import type { TokenPayload } from './auth'
import { sessionAllowed } from './account-access.ts'
import { cashbackAmount, round2 } from './money.ts'

export async function reviewTransaction(database: DatabaseClient, actor: TokenPayload, id: string, action: string, reason = '', cashbackId?: string) {
  if (!['approve', 'reject', 'reverse'].includes(action)) throw new Error('Invalid action.')
  if (action === 'reverse' && (reason.trim().length < 10 || reason.length > 500)) throw new Error('Enter a reversal reason between 10 and 500 characters.')
  return database.$transaction(async tx => {
    const admin = await tx.user.findUnique({ where: { id: actor.uid } })
    if (!sessionAllowed(admin, actor) || admin?.role !== 'ADMIN') throw new Error('Forbidden')
    const record = await tx.transaction.findUnique({ where: { id } })
    if (!record) throw new Error('Transaction not found.')
    const user = await tx.user.findUnique({ where: { id: record.userId } })
    if (!user) throw new Error('User not found.')
    const now = new Date()

    if (action === 'reverse') {
      if (record.type !== 'DEPOSIT' || record.status !== 'APPROVED') throw new Error('Only an approved deposit can be reversed. Completed payouts cannot be undone here.')
      const expectedCashback = record.cashbackAmount ?? cashbackAmount(record.amount)
      let cashback = await tx.transaction.findFirst({ where: { relatedTransactionId: id, type: 'CASHBACK' } })
      if (!cashback && expectedCashback > 0) {
        if (!cashbackId) throw new Error('This older deposit has no linked cashback. Select its original cashback record before reversing.')
        cashback = await tx.transaction.findUnique({ where: { id: cashbackId } })
      }
      if (expectedCashback > 0 && (!cashback || cashback.userId !== record.userId || cashback.type !== 'CASHBACK' || cashback.status !== 'APPROVED' || Math.abs(cashback.amount - expectedCashback) > .001 || (cashback.relatedTransactionId && cashback.relatedTransactionId !== id))) {
        throw new Error('Cashback record does not match this deposit. Check the original approval records.')
      }
      if (expectedCashback === 0 && cashback) throw new Error('Cashback ledger is inconsistent. Reconcile this record before reversal.')
      const debit = round2(record.amount + expectedCashback)
      if (round2(user.balance) < debit) throw new Error(`Insufficient wallet balance for reversal. Required PKR ${debit.toFixed(2)}; available PKR ${user.balance.toFixed(2)}. No changes were made.`)
      if (round2(user.totalDeposit) < record.amount || round2(user.cashbackEarned) < expectedCashback) throw new Error('Deposit totals are inconsistent. Reconcile this account before reversal.')
      const audit = { reversedAt: now, reversedBy: actor.uid, reversalReason: reason.trim() }
      const updatedUser = await tx.user.update({ where: { id: user.id }, data: {
        balance: round2(user.balance - debit), totalDeposit: round2(user.totalDeposit - record.amount), cashbackEarned: round2(user.cashbackEarned - expectedCashback),
      } })
      await tx.transaction.update({ where: { id }, data: { status: 'REVERSED', ...audit } })
      if (cashback) await tx.transaction.update({ where: { id: cashback.id }, data: { status: 'REVERSED', relatedTransactionId: id, ...audit } })
      const reversal = await tx.transaction.create({ data: { userId: user.id, type: 'REVERSAL', amount: debit, status: 'COMPLETED', relatedTransactionId: id, reviewedBy: actor.uid, note: reason.trim(), processedAt: now } })
      return { kind: 'DEPOSIT_REVERSED', balance: updatedUser.balance, recovered: debit, reversalId: reversal.id }
    }

    if (record.status !== 'PENDING') throw new Error(`Transaction already ${record.status}.`)
    if (!['DEPOSIT', 'WITHDRAW'].includes(record.type)) throw new Error('Unsupported transaction type.')
    if (record.type === 'DEPOSIT' && action === 'approve') {
      const cashback = cashbackAmount(record.amount)
      await tx.user.update({ where: { id: user.id }, data: { balance: { increment: round2(record.amount + cashback) }, totalDeposit: { increment: record.amount }, cashbackEarned: { increment: cashback } } })
      if (cashback > 0) await tx.transaction.create({ data: { userId: user.id, type: 'CASHBACK', amount: cashback, status: 'APPROVED', relatedTransactionId: id, reviewedBy: actor.uid, processedAt: now, note: `Cashback for deposit ${id}` } })
      await tx.transaction.update({ where: { id }, data: { status: 'APPROVED', cashbackAmount: cashback, reviewedBy: actor.uid, processedAt: now } })
      return { kind: 'DEPOSIT_APPROVED' }
    }
    if (record.type === 'WITHDRAW' && action === 'reject') await tx.user.update({ where: { id: user.id }, data: { balance: { increment: record.amount } } })
    await tx.transaction.update({ where: { id }, data: { status: action === 'approve' ? 'COMPLETED' : 'REJECTED', reviewedBy: actor.uid, processedAt: now } })
    return { kind: `${record.type}_${action === 'approve' ? 'APPROVED' : 'REJECTED'}` }
  })
}
