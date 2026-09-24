import type { DatabaseSnapshot, SnapshotTransport } from './firebase-store'

// Keep the app's private data under one namespace so wallet + ledger changes
// can commit together. No browser access to this namespace is required.
const databaseURL = 'https://win-84409-default-rtdb.firebaseio.com'

export function createFirebaseTransport(
  getToken: () => Promise<string> = async () => (await import('./firebase-admin')).firebaseAccessToken(),
  fetcher: typeof fetch = fetch,
): SnapshotTransport {
  async function request(init: RequestInit): Promise<Response> {
    const token = await getToken()
    const response = await fetcher(`${databaseURL}/99win.json`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok && response.status !== 412) {
      // Do not log access tokens, credentials, or database contents.
      throw new Error(`Firebase database request failed (${response.status}). Check server credentials and database access.`)
    }
    return response
  }
  return {
  async read() {
    const response = await request({ headers: { 'X-Firebase-ETag': 'true' } })
    const etag = response.headers.get('etag')
    if (!etag) throw new Error('Firebase did not return a transaction version.')
    return { data: (await response.json()) as DatabaseSnapshot | null, version: etag }
  },
  async compareAndSet(version, data) {
    const response = await request({
      method: 'PUT',
      headers: { 'If-Match': version, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.status !== 412
  },
  }
}

export const firebaseTransport = createFirebaseTransport()
