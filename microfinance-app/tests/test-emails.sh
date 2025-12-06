#!/bin/bash

# Test script to manually trigger monthly and weekly emails
# Make executable with: chmod +x test-emails.sh
# Run with: ./test-emails.sh

BASE_URL="http://localhost:3000"
INTERNAL_KEY="microfinance-scheduler-2024-secure-key"

echo "🚀 Starting Email Test Suite..."
echo ""

# Function to trigger monthly email
trigger_monthly() {
    echo "🔄 Triggering monthly email..."

    response=$(curl -s -w "\n%{http_code}" -X POST \
        "${BASE_URL}/api/scheduled/email" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${INTERNAL_KEY}")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)

    if [ "$http_code" -eq 200 ]; then
        echo "✅ Monthly email sent successfully!"
        echo "Response: $body"
    else
        echo "❌ Failed to send monthly email (HTTP $http_code)"
        echo "Error: $body"
    fi
    echo ""
}

# Function to trigger weekly email
trigger_weekly() {
    echo "🔄 Triggering weekly email..."

    response=$(curl -s -w "\n%{http_code}" -X POST \
        "${BASE_URL}/api/scheduled/weekly-email" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${INTERNAL_KEY}")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)

    if [ "$http_code" -eq 200 ]; then
        echo "✅ Weekly email sent successfully!"
        echo "Response: $body"
    else
        echo "❌ Failed to send weekly email (HTTP $http_code)"
        echo "Error: $body"
    fi
    echo ""
}

# Function to check email status
check_status() {
    echo "📊 Checking email configuration..."

    response=$(curl -s "${BASE_URL}/api/scheduled/email")
    echo "Monthly Email Status: $response"
    echo ""
}

# Function to test recovery system
test_recovery() {
    echo "🧪 Testing email recovery system..."

    response=$(curl -s "${BASE_URL}/api/email-recovery?action=status")
    echo "Recovery System Status: $response"
    echo ""
}

# Main execution
echo "Base URL: $BASE_URL"
echo "Internal Key: ${INTERNAL_KEY:0:10}..."
echo ""

# Check status first
check_status

# Trigger monthly email
trigger_monthly

# Wait a bit
echo "⏳ Waiting 3 seconds..."
sleep 3

# Trigger weekly email
trigger_weekly

# Test recovery system
test_recovery

echo "🎉 Email test suite completed!"
echo "📧 Check your email inbox for the reports."
echo ""
echo "💡 Tips:"
echo "   - Make sure your .env file has correct email configuration"
echo "   - Check DEFAULT_EMAIL_RECIPIENTS is set"
echo "   - Verify SMTP settings are correct"
echo "   - Look at server logs for any error details"
