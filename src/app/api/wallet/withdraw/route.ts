import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { publicUser } from '@/lib/seed'
import { MIN_WITHDRAW } from '@/lib/money'

export const runtime = 'nodejs'

/**
 * POST /api/wallet/withdraw
 * Creates a PENDING withdrawal. Balance is HELD immediately (deducted) for
 * liquidity control; admin approval completes it, rejection refunds it.
 * Body: { amount, account, method }
 */
export async function POST(req: Request) {
  const payload = getTokenPayload(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { amount, account, method } = await req.json()
    const amt = Number(amount)

    if (!amt || amt < MIN_WITHDRAW) {
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

    const user = await db.user.findUnique({ where: { id: payload.uid } })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.balance < amt) {
      return NextResponse.json(
        { error: 'Insufficient balance.' },
        { status: 400 }
      )
    }

    // Hold funds immediately (server-side financial operation)
    const user2 = await db.user.update({
      where: { id: user.id },
      data: { balance: { decrement: amt } },
    })

    const tx = await db.transaction.create({
      data: {
        userId: user.id,
        type: 'WITHDRAW',
        amount: amt,
        status: 'PENDING',
        method: method || 'Easypaisa',
        account: String(account),
      },
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
    console.error('withdraw error', e)
    return NextResponse.json({ error: 'Withdrawal failed.' }, { status: 500 })
  }
}
