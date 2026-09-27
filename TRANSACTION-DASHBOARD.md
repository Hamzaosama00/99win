# Transaction dashboard update

Open Admin > All Transactions.

- Browse every stored transaction using pagination (50 per page).
- Filter by type/status, search TID, account, user name, phone or transaction ID.
- Approve/reject pending deposits and withdrawals after checking payment records.
- Reverse an APPROVED DEPOSIT using Reverse approval, a mandatory reason and confirmation.
- A reversal atomically deducts the original deposit plus its issued cashback, adjusts user deposit/cashback totals, marks the original entries REVERSED, and creates a separate REVERSAL ledger entry. The original TID and approval time are retained.
- Repeated or concurrent reversal requests cannot charge twice.
- Only currently authorized administrators can review or reverse transactions.
- Reversed deposits no longer qualify as approved deposits for withdrawal eligibility.

Important limits:
- TIDs are user-submitted references. This update does not integrate with Easypaisa/bank verification APIs. Check your actual bank/Easypaisa statement before approving or reversing.
- If the user has already spent/withdrawn the balance and available funds cannot cover the deposit plus cashback, the operation fails with no partial deduction or status change. Investigate/block the account and reconcile payment obligations separately.
- An already completed external withdrawal cannot be recalled here.
- Older deposits may have unlinked cashback. The confirmation form requires selecting the original matching cashback record. Verify its timestamp and payment records; do not guess. Newly approved deposits link cashback automatically.

Deployment:
- Merge this update into the web project and redeploy Vercel.
- Run prisma generate during the normal build. The Firebase store supplies null defaults for the added audit fields; no Firebase reset is required.
- Keep server credentials out of the archive. This change does not publish automatically or change any live transaction.

Validation: 18 database/review regression tests passed; TypeScript validation passed; production build passed. Browser checks use isolated fixture data.
