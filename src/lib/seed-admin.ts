import type { DatabaseClient } from './firebase-store'
import { hashPassword } from './auth.ts'

/** Preserve the existing admin login and never reset an existing password. */
export async function ensureAdmin(database: DatabaseClient): Promise<void> {
  await database.$transaction(async (tx) => {
    const admin = await tx.user.findUnique({ where: { phone: '03182772524' } })
    if (!admin) {
      await tx.user.create({
        data: {
          phone: '03182772524',
          name: 'Admin',
          password: hashPassword('hamza112233'),
          role: 'ADMIN',
          balance: 0,
        },
      })
    }
  })
}
