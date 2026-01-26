#!/bin/bash

# Quick Security Setup for Production
# Run this script before deploying to production

echo "🔒 Production Security Setup"
echo "=============================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Create .env from .env.example first"
    exit 1
fi

echo "1️⃣  Checking JWT_SECRET..."
JWT_SECRET=$(grep "^JWT_SECRET=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
if [ ${#JWT_SECRET} -lt 32 ]; then
    echo "⚠️  Generating new JWT_SECRET..."
    NEW_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo ""
    echo "Add this to your .env file:"
    echo "JWT_SECRET=$NEW_SECRET"
    echo ""
fi

echo "2️⃣  Checking DATABASE_URL SSL..."
DATABASE_URL=$(grep "^DATABASE_URL=" .env)
if ! echo "$DATABASE_URL" | grep -q "sslmode=require\|ssl=true"; then
    echo "⚠️  Add SSL to your production DATABASE_URL:"
    echo "DATABASE_URL=\"your-url?sslmode=require\""
    echo ""
fi

echo "3️⃣  Running security check..."
./scripts/security-check.sh

echo ""
echo "4️⃣  Pre-deployment checklist:"
echo "   [ ] SSL certificate configured for domain"
echo "   [ ] DATABASE_URL has sslmode=require"
echo "   [ ] JWT_SECRET is strong (32+ chars)"
echo "   [ ] .env is NOT in git"
echo "   [ ] All security headers are set"
echo "   [ ] Rate limiting is active"
echo "   [ ] Backups are configured"
echo "   [ ] Monitoring/logging is set up"
echo ""
echo "✅ Review the checklist and deploy!"
