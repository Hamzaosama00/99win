# Firebase database setup

The web API and game server now share Firebase Realtime Database in project
`win-84409`, under `/99win`. Login remains phone + password using the existing
scrypt password hashes. The existing seeded admin phone and password are
unchanged. An existing account is never overwritten by seeding.

## Configure the server

1. In Firebase Console, select `win-84409`, then Project settings > Service
   accounts > Firebase Admin SDK. Generate a private key and keep it private.
2. In Vercel project Settings > Environment Variables, add
   `FIREBASE_SERVICE_ACCOUNT_JSON` with the **entire JSON file contents**.
   Select the environments you intend to deploy. Do not add a NEXT_PUBLIC prefix.
3. Set `AUTH_SECRET` to a long random secret. Use exactly the same value on
   Vercel and the separately hosted game server.
4. Set the same `FIREBASE_SERVICE_ACCOUNT_JSON` on the game server.
5. In Firebase Realtime Database > Rules, publish the contents of
   `database.rules.json`. All browser access is denied; your authenticated
   server accesses the database with its service-account credential.
6. Deploy the code. Build command: `bun run build` (or `npm run build`).
   The package specifies Node.js 24 (the Firebase Admin SDK requires Node 22+).
   Log in with your existing admin credentials. A new empty database creates
   that admin on the first login/register API request.

Your supplied browser API key is not a server credential. Browser SDK scripts
and Analytics are not needed to store users, balances or bets securely. The
database URL is configured in `src/lib/firebase-transport.ts`.

## Local development

Install with `bun install`. Copy `.env.example` to `.env`; set the service-account
JSON and AUTH_SECRET. `bun run dev` starts Next.js. Run the game service from
the project root with `bun run mini-services/game-service/index.ts` so Bun loads
the same environment. No SQLite database or `prisma db push` is needed.

Prisma remains only for generated TypeScript model/query types and potential
legacy data export; it is not the active storage engine. Never run `db:reset`
or `db:push` expecting them to manage Firebase.

## Existing data and limits

The supplied folder contains no SQLite database file. Existing users, balances
and transaction history have therefore **not been migrated**. If another server
contains that database, back it up and migrate its records (including existing
password hashes) before cutting over. Do not reset or replace existing live data.

The adapter supports only the queries this application currently uses. It reads
the app namespace and commits mutations with Firebase ETag conditional writes;
conflicts rerun the transaction with fresh data. This preserves wallet/ledger
atomicity across server instances. Transaction callbacks must have no external
side effects because they can run multiple times.

This snapshot approach is suitable for a small initial deployment; all records
are read and writes contend on one namespace. Before a large deployment, replace
it with indexed, per-user storage and paginated queries. It is not load-tested.

The game engine still needs its own persistent process; adding Firebase does
not run the Socket.IO service on Vercel. Configure NEXT_PUBLIC_GAME_SERVER_URL
and SIGNALS_API_URL to point to that service.

## Verification

Run `npm run test:firebase` with Node.js 24, `bunx tsc --noEmit`, and
`bun run build`. The unit tests use a local in-memory transport and never write
to the real Firebase project. A live login/deposit/review test still requires
the server credential and a configured database.
