#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma db push --accept-data-loss

echo "Ensuring admin user exists..."
# Use node directly since we are in the app container
node scripts/setup-admin.js

echo "Setting up default partners..."
npx ts-node scripts/setup-default-partners.ts

echo "Starting the application..."
exec npm start
