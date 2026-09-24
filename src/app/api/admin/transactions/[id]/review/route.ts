import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTokenPayload } from '@/lib/auth'
import { publicUser } from '@/lib/seed'
import { cashbackPercent, round2 } from '@/lib/money'

export const runtime = 'nodejs'

/**
 * POST /api/admin/transactions/[id]/review
 * Body: { action: 'approve' | 'reject' }
 *
 * Approve DEPOSIT   → credit balance + totalDeposit, auto-issue tiered cashback.
 * Reject  DEPOSIT   → mark rejected (no balance change).
 * Approve WITHDRAW  → mark COMPLETED (funds were held at request time).
 * Reject  WITHDRAW  → refund held amount back to balance.
 *
 * All mutations are atomic (interactive transaction) — server-side only.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenPayload(req)
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const { action } = await req.json()
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({ where: { id } })
      if (!transaction) throw new Error('Transaction not found.')
      if (transaction.status !== 'PENDING') {
        throw new Error(`Transaction already ${transaction.status}.`)
      }

      // ---------- DEPOSIT ----------
      if (transaction.type === 'DEPOSIT') {
        if (action === 'approve') {
          const user = await tx.user.update({
            where: { id: transaction.userId },
            data: {
              balance: { increment: transaction.amount },
              totalDeposit: { increment: transaction.amount },
            },
          })

          // Tiered cashback issued automatically on approval
          const cbPct = cashbackPercent(transaction.amount)
          if (cbPct > 0) {
            const cb = round2((transaction.amount * cbPct) / 100)
            await tx.user.update({
              where: { id: transaction.userId },
              data: { balance: { increment: cb }, cashbackEarned: { increment: cb } },
            })
            await tx.transaction.create({
              data: {
                userId: transaction.userId,
                type: 'CASHBACK',
                amount: cb,
                status: 'APPROVED',
                note: `${cbPct}% cashback on PKR ${transaction.amount} deposit`,
                processedAt: new Date(),
              },
            })
          }

          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: 'APPROVED', processedAt: new Date() },
          })
          return { kind: 'DEPOSIT_APPROVED', user: publicUser(user) }
        }
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'REJECTED', processedAt: new Date() },
        })
        return { kind: 'DEPOSIT_REJECTED' }
      }

      // ---------- WITHDRAWAL ----------
      if (transaction.type === 'WITHDRAW') {
        if (action === 'approve') {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: 'COMPLETED', processedAt: new Date() },
          })
          return { kind: 'WITHDRAW_APPROVED' }
        }
        // refund the held amount
        const user = await tx.user.update({
          where: { id: transaction.userId },
          data: { balance: { increment: transaction.amount } },
        })
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'REJECTED', processedAt: new Date() },
        })
        return { kind: 'WITHDRAW_REJECTED', user: publicUser(user) }
      }

      throw new Error('Unsupported transaction type.')
    })

    return NextResponse.json({
      ok: true,
      kind: result.kind,
      user: 'user' in result ? result.user : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Review failed.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
