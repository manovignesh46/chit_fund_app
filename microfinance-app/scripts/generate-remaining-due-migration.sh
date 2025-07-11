#!/bin/bash

# Script to apply the Prisma migration for adding the remainingDue field

echo "Generating Prisma migration for adding remainingDue field..."

# Navigate to the app directory
cd "$(dirname "$0")/.."

# Generate the migration
npx prisma migrate dev --name add_remaining_due_field --create-only

echo "Migration file created. Please check the migration file and then apply it."
echo "To apply the migration, run: npx prisma migrate dev"
echo "After migration is applied, run the update script: npx ts-node scripts/update-loans-remaining-due.ts"
