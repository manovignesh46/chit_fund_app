# Adding remainingDue Field to Loans

This document explains how to add the `remainingDue` field to the Loan table and update existing loans.

## What is remainingDue?

The `remainingDue` field keeps track of how many payments are still due for a loan. This is different from `remainingAmount` which tracks the monetary value still owed. The `remainingDue` field is an integer representing the count of remaining installments.

## Implementation Steps

1. **Add the field to the Prisma schema**:
   - Already added to the schema: `remainingDue Int @default(0)`

2. **Create and apply the migration**:
   ```bash
   # Generate the migration
   ./scripts/generate-remaining-due-migration.sh
   
   # Apply the migration
   npx prisma migrate dev
   ```

3. **Update existing loans**:
   ```bash
   # Run the update script
   npx ts-node scripts/update-loans-remaining-due.ts
   ```

## How it works

The `remainingDue` field is:

- Initialized with the loan's duration when a new loan is created
- Updated when a repayment is added (decremented)
- Updated when a repayment is deleted (incremented)
- It excludes interest-only payments when calculating the count

## Functions Modified

1. `addRepayment` - Updates remainingDue when a payment is recorded
2. `deleteRepayment` - Updates remainingDue when a payment is deleted
3. `createLoan` - Initializes remainingDue to the loan duration

## New Functions Added

1. `calculateRemainingDue` - Calculates the number of remaining due payments

## Testing

After applying the migration and running the update script, verify that:

1. Existing loans show the correct number of remaining payments
2. New loans initialize with the correct remainingDue value
3. Adding a payment decreases remainingDue
4. Deleting a payment increases remainingDue
5. Interest-only payments don't affect remainingDue

## Troubleshooting

If you encounter any issues:

1. Check the Prisma migration logs
2. Verify that the update script ran successfully
3. Check that the `remainingDue` field appears in the database
4. For individual loans, you can manually recalculate using:
   ```
   npx ts-node -e "require('./lib/loanCalculations').calculateRemainingDue(LOAN_ID)"
   ```

## Rollback

If necessary, you can rollback by:

1. Reverting the migration: `npx prisma migrate down`
2. Removing the field from the schema
3. Reverting the code changes
