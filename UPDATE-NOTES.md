# 99win update

Implemented:
- Screenshot-style three-column Aviator game, responsive mobile layout, red flight curve and two independent bet panels.
- Withdrawals require this user's positive APPROVED deposit. Pending/rejected deposits and signup bonuses do not qualify. The server verifies eligibility inside the balance-hold transaction, and the withdrawal dialog checks eligibility on opening.
- Admin Users tab: search, Block, Ban, Unblock and confirmed Delete, account status and recent online/offline activity.
- Delete permanently disables account access and hides the account from the normal user list; financial/bet records are retained. Show deleted accounts reveals those records. Admin accounts cannot be banned, blocked or deleted here.
- Ban/block/delete revoke existing sessions. Unblock permits a fresh login; previously revoked tokens remain invalid. Socket access is checked on each incoming action and every 10 seconds.
- Online means a visible authenticated browser tab has checked in within 60 seconds; admin data refreshes every 12 seconds.

Validation:
- Production build passed.
- 15 Firebase/account/withdrawal tests and 3 betting tests passed.
- Desktop/mobile browser checks passed with local fixture data, including both bet panels, withdrawal gating, admin actions, canceling deletion and confirming deletion. No browser runtime errors or horizontal overflow were observed.
- Preview PNGs show test data, not real customer balances/activity.

Run/deploy:
- Use the existing README-DEPLOY.md and FIREBASE-SETUP.md for your server credentials and hosting.
- Install dependencies with bun install --frozen-lockfile.
- Generate types with bunx prisma generate; build with bun run build.
- Test with npm run test:firebase and bun run test:game.
- Deploy BOTH the Next.js application and mini-services/game-service together for two-panel betting and account restrictions.
- Set NEXT_PUBLIC_GAME_SERVER_URL to your actual game server before building for deployment.
- Firebase defaults supply ACTIVE account status for existing users; no database reset is needed.
- Live Firebase/payment testing was not performed because no server credentials were provided. Local tests use an isolated in-memory database.
