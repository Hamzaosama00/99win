import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, signToken } from '@/lib/auth'
import { ensureSeed, publicUser } from '@/lib/seed'

export const runtime = 'nodejs'

/** POST /api/auth/login — phone + password */
export async function POST(req: Request) {
  await ensureSeed()
  try {
    const { phone, password } = await req.json()
    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Phone and password are required.' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { phone: String(phone) } })
    if (!user || !verifyPassword(String(password), user.password)) {
      return NextResponse.json(
        { error: 'Invalid phone number or password.' },
        { status: 401 }
      )
    }

    const token = signToken(user.id, user.role)
    return NextResponse.json({ token, user: publicUser(user) })
  } catch (e) {
    console.error('login error', e)
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 })
  }
}
