# 99win — Vercel Deployment Guide

99win is a real-time multiplayer Aviator-style crash game with an integrated
wallet, simulated Easypaisa payments, admin panel and an installable Signals
PWA. It is made of **two deployable pieces**:

| Piece | Location | Runs on |
|---|---|---|
| Web app (UI + REST API + admin) | repo root (Next.js 16) | **Vercel** |
| Game engine (socket.io + signals API) | `mini-services/game-service` | **Render / Railway / Fly.io** (needs a long-running process — serverless platforms cannot host websockets) |

---

## 1. Push the code to GitHub

Unzip, `git init`, commit and push to a new GitHub repository.

```bash
npm install            # or bun install
cp .env.example .env   # fill values (see below)
npx prisma generate    # generate model types (storage is Firebase)
npm run dev            # http://localhost:3000
```

## 2. Deploy the game engine first (Render example)

1. Render → **New Web Service** → connect the repo.
2. Settings:
   - **Root Directory:** leave empty (repo root)
   - **Runtime:** Bun (or Node + `npm i -g bun`)
   - **Build Command:** `bun install && bunx prisma generate`
   - **Start Command:** `cd mini-services/game-service && GAME_PORT=$PORT bun index.ts`
3. Environment variables:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — Firebase server credential (see FIREBASE-SETUP.md)
   - `AUTH_SECRET` — a long random string (must match the web app!)
   - Do not manually set `PORT`; Render supplies it. The game and Signals API share that single port.
4. Deploy → note the public URL, e.g. `https://99win-game.onrender.com`

## 3. Deploy the web app (Vercel)

1. Vercel → **Add New Project** → import the repo (framework auto-detected: Next.js).
2. Environment variables:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — the same Firebase server credential used by the game service
   - `AUTH_SECRET` — **the same value** used on the game service
   - `NEXT_PUBLIC_GAME_SERVER_URL=https://99win-game.onrender.com`
   - `SIGNALS_API_URL=https://99win-game.onrender.com`
3. Deploy → open the app → register → play.

> Admin account is auto-seeded on the first login/register API call. **Change the hard-coded seed password in `src/lib/seed-admin.ts` before any public launch, and use a private repository.**

## 4. Firebase database

Users, wallet records and bets now use Firebase Realtime Database in
`win-84409`. Follow [FIREBASE-SETUP.md](FIREBASE-SETUP.md) for credentials,
database rules, verification and migration limitations. Both services must
use this database. The existing admin login is preserved.

## 5. Signals PWA (mobile install)

1. Log in → profile menu → **Admin Panel** → **Signals App** tab → *Open Signals App*.
2. In the Signals app press **Install App** (Android Chrome shows an install
   prompt; iOS: Share → *Add to Home Screen*).
3. The next-round signal updates automatically every round — no refresh needed.

## 6. Game economy knobs

- House edge / probability engine: `mini-services/game-service/config.ts`
  (`HOUSE_EDGE`, `INSTANT_CRASH_CHANCE`, `MAX_CRASH`) — mirrored in
  `src/lib/fair.ts` (keep both in sync; the Signals engine must match).
- Round timings, min/max bet, bot counts: same `config.ts` file.
- Wallet limits & cashback tiers: `src/lib/money.ts`.

## 7. Local development

```bash
# terminal 1 — web app
npm run dev                 # port 3000

# terminal 2 — game engine
bun run mini-services/game-service/index.ts   # port 3003 (socket + signals)
```

Both pieces must share the same `.env` values (`FIREBASE_SERVICE_ACCOUNT_JSON`, `AUTH_SECRET`).
