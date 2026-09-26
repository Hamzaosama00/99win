import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveSession } from '@/lib/session'
import { publicUser } from '@/lib/seed'
import { MIN_WITHDRAW } from '@/lib/money'
import { DEPOSIT_REQUIRED, requireApprovedDeposit } from '@/lib/withdrawal'
import { sessionAllowed } from '@/lib/account-access'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const payload = await getActiveSession(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await requireApprovedDeposit(db, payload.uid)
    return NextResponse.json({ eligible: true })
  } catch (error) {
    if (error instanceof Error && error.message === DEPOSIT_REQUIRED) {
      return NextResponse.json({ eligible: false, reason: DEPOSIT_REQUIRED })
    }
    return NextResponse.json({ error: 'Could not check withdrawal eligibility. Please retry.' }, { status: 503 })
  }
}

/**
 * POST /api/wallet/withdraw
 * Creates a PENDING withdrawal. Balance is HELD immediately (deducted) for
 * liquidity control; admin approval completes it, rejection refunds it.
 * Body: { amount, account, method }
 */
export async function POST(req: Request) {
  const payload = await getActiveSession(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { amount, account, method } = await req.json()
    const amt = Number(amount)

    if (!Number.isFinite(amt) || amt < MIN_WITHDRAW) {
      return NextResponse.json(
        { error: `Minimum withdrawal is PKR ${MIN_WITHDRAW}.` },
        { status: 400 }
      )
    }
    if (!account || !/^[0-9]{10,15}$/.test(String(account))) {
      return NextResponse.json(
        { error: 'Enter a valid Easypaisa account number (10–15 digits).' },
        { status: 400 }
      )
    }

    // The balance check, hold and ledger record commit together, including
    // when two Vercel instances receive withdrawals at the same time.
    const { user2, tx } = await db.$transaction(async (database) => {
      const user = await database.user.findUnique({ where: { id: payload.uid } })
      if (!user || !sessionAllowed(user, payload)) throw new Error('Unauthorized')
      await requireApprovedDeposit(database, user.id)
      if (user.balance < amt) throw new Error('Insufficient balance.')
      const user2 = await database.user.update({
        where: { id: payload.uid },
        data: { balance: { decrement: amt } },
      })
      const tx = await database.transaction.create({
        data: {
          userId: user.id,
          type: 'WITHDRAW',
          amount: amt,
          status: 'PENDING',
          method: method || 'Easypaisa',
          account: String(account),
        },
      })
      return { user2, tx }
    })

    return NextResponse.json({
      transaction: {
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        status: tx.status,
        createdAt: tx.createdAt,
      },
      user: publicUser(user2),
      message: 'Withdrawal requested! Payout after admin approval (usually 10–30 minutes).',
    })
  } catch (e) {
    if (e instanceof Error && e.message === DEPOSIT_REQUIRED) {
      return NextResponse.json({ error: e.message, code: 'DEPOSIT_REQUIRED' }, { status: 403 })
    }
    if (e instanceof Error && ['Unauthorized', 'Insufficient balance.'].includes(e.message)) {
      return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 400 })
    }
    console.error('withdraw error', e)
    return NextResponse.json({ error: 'Withdrawal failed.' }, { status: 500 })
  }
}
