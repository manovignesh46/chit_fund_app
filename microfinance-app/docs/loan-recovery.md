# Non-Recoverable loans

On Loan Details, open the **⋮ Actions** menu beside Edit and choose **Mark as Non-Recoverable**. In the confirmation popup, enter a reason and the unpaid interest to track (enter 0 if none), then confirm. Principal and unpaid installment dues are saved separately at marking. Installment dues include principal and must not be added to it again.

The loan leaves routine collections, member dues, collection forecasts, unpaid calendar events and future due reminders. Find it using the **Non-Recoverable** status filter under Loans, the dashboard link, or the member's separate recovery section. Original repayments, transactions and schedules remain available. Dashboard principal is split into active, Non-Recoverable and total exposure.

**Record Recovery** captures actual cash received, a principal/interest allocation, the collector, payment date and notes. It creates one linked repayment and transaction and updates the collecting partner's balance. Partial and fully recovered cases retain their Non-Recoverable classification. Interest received is income; principal received reduces principal outstanding.

**Settle Case** records any final payment and separately records the principal/interest waived. Confirmation and a reason are required. Settled cases remain in history with zero remaining balances. Marking alone does not waive balances or book a loss.

**Reverse Receipt** corrects a receipt within the current open/fully recovered case. It removes the incorrect cash entry, recalculates running balances and restores principal/interest. The original receipt details and reversal remain in audit history. Receipts from a prior case and settled cases cannot be reversed through this action.

**Restore to Active** shows the overdue/next-30-day preview before confirmation. The original schedule resumes, including unpaid periods while the loan was marked. Prior offline recoveries credit the oldest unpaid installments. Re-marking starts a new snapshot; earlier audit events and receipts are retained. Ordinary loan editing/deletion and ordinary repayment deletion are blocked once a loan has recovery history, to preserve those snapshots.

Recovery dates use the Indian business calendar. Every action records the actual logged-in actor, with business-owner scoping. Financial writes and the audit event commit in one transaction. Recovery requests have an idempotency key and retry serialization conflicts to prevent duplicate/over-limit receipts.

## Database rollout

The additive PostgreSQL migration is `prisma/migrations/20261105_add_loan_recovery/migration.sql`. Apply it to the application database before running the updated app and regenerate Prisma Client (`npx prisma generate`). Use the project's existing migration deployment procedure; installations that apply the SQL directly can run:

```sh
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261105_add_loan_recovery/migration.sql
npx prisma generate
```

Existing loans keep their current status and balances. No loans are automatically reclassified. This change does not modify the legacy provider-specific schema templates.

## Verification

```sh
node tests/test-loan-recovery.js
node tests/test-loan-recovery-ui.js
node tests/test-member-dues.js
node tests/test-calendar-pending.js
node tests/trends-calculations.js
```

`node tests/test-loan-recovery.js --integration` uses only the disposable PostgreSQL database `chit_recovery` at `/tmp/chit-recovery-pg-socket`, port 55439, initialized from the pre-change schema plus the migration. It never uses the application DATABASE_URL. It checks snapshots, tenant/partner boundaries, retries, concurrent collections, cash balances, reversal, settlement, restoration, re-marking and ordinary mutation guards.
