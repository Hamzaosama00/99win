import type { DatabaseClient } from './firebase-store'

export const DEPOSIT_REQUIRED = 'Complete at least one approved deposit before requesting a withdrawal.'

/** Runs inside the same transaction as the balance hold and withdrawal ledger. */
export async function requireApprovedDeposit(database: Pick<DatabaseClient, 'transaction'>, userId: string) {
  const deposit = await database.transaction.findFirst({
    where: { userId, type: 'DEPOSIT', status: 'APPROVED', amount: { gt: 0 } },
  })
  if (!deposit) throw new Error(DEPOSIT_REQUIRED)
}
