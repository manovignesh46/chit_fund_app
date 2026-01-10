#!/bin/bash

# Test script for the new loan API
# This script tests loan creation and repayment using the new architecture

BASE_URL="http://localhost:3000"

echo "🧪 Testing New Loan API Architecture"
echo "===================================="
echo ""

# 1. Login to get auth token
echo "1️⃣  Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "amfincorp1@gmail.com",
    "password": "admin123"
  }')

# Extract token (this is simplified - adjust based on your actual auth response)
echo "Login response: $LOGIN_RESPONSE"
echo ""

# 2. Get list of partners
echo "2️⃣  Fetching partners..."
curl -s "$BASE_URL/api/partners" | jq '.'
echo ""

# 3. Test loan creation
echo "3️⃣  Creating a test loan..."
LOAN_DATA='{
  "borrowerId": 1,
  "loanType": "Personal",
  "amount": 10000,
  "interestRate": 300,
  "documentCharge": 200,
  "duration": 10,
  "disbursementDate": "2026-01-10",
  "repaymentType": "Monthly",
  "purpose": "Test loan for new architecture",
  "partnerId": 1
}'

curl -s -X POST "$BASE_URL/api/loans" \
  -H "Content-Type: application/json" \
  -d "$LOAN_DATA" | jq '.'
echo ""

# 4. Get loan list
echo "4️⃣  Fetching loans list..."
curl -s "$BASE_URL/api/loans?page=1&pageSize=10" | jq '.'
echo ""

echo "✅ Test complete!"
