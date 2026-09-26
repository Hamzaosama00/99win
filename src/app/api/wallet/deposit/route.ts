import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveSession } from '@/lib/session'
import { publicUser } from '@/lib/seed'
import { MIN_DEPOSIT, MAX_DEPOSIT, cashbackPercent } from '@/lib/money'

export const runtime = 'nodejs'

/**
 * POST /api/wallet/deposit
 * Creates a PENDING deposit — balance is credited ONLY after admin approval.
 * Body: { amount, txnId, method }
 */
export async function POST(req: Request) {
  const payload = await getActiveSession(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { amount, txnId, method } = await req.json()
    const amt = Number(amount)

    if (!amt || amt < MIN_DEPOSIT || amt > MAX_DEPOSIT) {
      return NextResponse.json(
        { error: `Deposit must be between PKR ${MIN_DEPOSIT} and PKR ${MAX_DEPOSIT}.` },
        { status: 400 }
      )
    }
    if (!txnId || String(txnId).trim().length < 6) {
      return NextResponse.json(
        { error: 'Enter the valid Easypaisa Transaction ID (TID) from your receipt.' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: payload.uid } })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Duplicate TID guard
    const dup = await db.transaction.findFirst({
      where: { txnId: String(txnId).trim(), type: 'DEPOSIT' },
    })
    if (dup) {
      return NextResponse.json(
        { error: 'This Transaction ID has already been submitted.' },
        { status: 409 }
      )
    }

    const tx = await db.transaction.create({
      data: {
        userId: user.id,
        type: 'DEPOSIT',
        amount: amt,
        status: 'PENDING',
        method: method || 'Easypaisa',
        txnId: String(txnId).trim(),
        note: `Cashback tier: ${cashbackPercent(amt)}%`,
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
      cashbackPercent: cashbackPercent(amt),
      message:
        'Deposit submitted! Funds will be credited after verification (usually 5–10 minutes).',
    })
  } catch (e) {
    console.error('deposit error', e)
    return NextResponse.json({ error: 'Deposit failed.' }, { status: 500 })
  }
}

/** GET /api/wallet/deposit — payment channel details for the checkout modal */
export async function GET() {
  return NextResponse.json({
    channels: [
      {
        method: 'Easypaisa',
        merchantName: '99WIN OFFICIAL',
        merchantPhone: '03459988721',
        merchantPhoneMasked: '0345****721',
        iban: 'PK24HABB0000045178991003',
        ibanMasked: 'PK24****8991003',
      },
    ],
  })
}
