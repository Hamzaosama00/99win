import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, signToken } from '@/lib/auth'
import { ensureSeed, publicUser } from '@/lib/seed'
import { SIGNUP_BONUS } from '@/lib/money'

export const runtime = 'nodejs'

/** POST /api/auth/register — phone-based signup + PKR 100 welcome bonus */
export async function POST(req: Request) {
  await ensureSeed()
  try {
    const { phone, name, password } = await req.json()

    if (!phone || !/^[0-9]{10,15}$/.test(String(phone))) {
      return NextResponse.json(
        { error: 'Enter a valid phone number (10–15 digits).' },
        { status: 400 }
      )
    }
    if (!name || String(name).trim().length < 3) {
      return NextResponse.json(
        { error: 'Name must be at least 3 characters.' },
        { status: 400 }
      )
    }
    if (!password || String(password).length < 4) {
      return NextResponse.json(
        { error: 'Password must be at least 4 characters.' },
        { status: 400 }
      )
    }

    const existing = await db.user.findUnique({ where: { phone: String(phone) } })
    if (existing) {
      return NextResponse.json(
        { error: 'This phone number is already registered. Please login.' },
        { status: 409 }
      )
    }

    const user = await db.user.create({
      data: {
        phone: String(phone),
        name: String(name).trim().slice(0, 20),
        password: hashPassword(String(password)),
        balance: SIGNUP_BONUS,
        transactions: {
          create: {
            type: 'BONUS',
            amount: SIGNUP_BONUS,
            status: 'APPROVED',
            note: 'Welcome bonus',
            processedAt: new Date(),
          },
        },
      },
    })

    const token = signToken(user.id, user.role)
    return NextResponse.json({ token, user: publicUser(user) })
  } catch (e) {
    console.error('register error', e)
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 })
  }
}
