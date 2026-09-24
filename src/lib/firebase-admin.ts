import { cert, getApps, initializeApp } from 'firebase-admin/app'

/** Server-only credentials. Never import this module from a client component. */
export async function firebaseAccessToken(): Promise<string> {
  const name = '99win-server'
  let app = getApps().find((candidate) => candidate.name === name)
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (!raw) throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON in the server environment before using Firebase.')
    const account = JSON.parse(raw)
    if (account.project_id !== 'win-84409') throw new Error('Firebase service account must belong to win-84409.')
    app = initializeApp({ credential: cert(account) }, name)
  }
  const credential = app.options.credential
  if (!credential) throw new Error('Firebase server credential is missing.')
  return (await credential.getAccessToken()).access_token
}
