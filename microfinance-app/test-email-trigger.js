// Test script to manually trigger monthly and weekly emails
// Run with: node test-email-trigger.js

const fetch = require('node-fetch');

const BASE_URL = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3001';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'microfinance-scheduler-2024-secure-key';

async function triggerMonthlyEmail() {
  console.log('🔄 Triggering monthly email...');

  try {
    const response = await fetch(`${BASE_URL}/api/scheduler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${getAuthToken()}`
      },
      body: JSON.stringify({
        action: 'trigger-monthly'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Monthly email sent successfully:', result);
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Failed to send monthly email:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error triggering monthly email:', error.message);
    return false;
  }
}

async function triggerWeeklyEmail() {
  console.log('🔄 Triggering weekly email...');

  try {
    const response = await fetch(`${BASE_URL}/api/scheduler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${getAuthToken()}`
      },
      body: JSON.stringify({
        action: 'trigger-weekly'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Weekly email sent successfully:', result);
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Failed to send weekly email:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error triggering weekly email:', error.message);
    return false;
  }
}

// Function to get auth token (from terminal history)
function getAuthToken() {
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhbWZpbmNvcnAxQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc0ODIyNDUwMSwiZXhwIjoxNzQ4MzEwOTAxfQ.HqTSSXQiZ-zdCCOUdwoFn14GbaEKuFCh6Dcrl5_27uU';
}

async function checkEmailStatus() {
  console.log('📊 Checking email configuration status...');

  try {
    const response = await fetch(`${BASE_URL}/api/scheduler`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${getAuthToken()}`
      }
    });

    if (response.ok) {
      const status = await response.json();
      console.log('📧 Email Scheduler Status:', status);
    } else {
      console.error('❌ Failed to get email scheduler status');
    }
  } catch (error) {
    console.error('❌ Error checking email status:', error.message);
  }
}

async function testEmailRecoverySystem() {
  console.log('🧪 Testing email recovery system...');

  try {
    // Check for missed emails
    const response = await fetch(`${BASE_URL}/api/email-recovery?action=check-missed`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token' // You'll need a valid auth token
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('📋 Missed emails check:', result);
    } else {
      console.log('ℹ️  Email recovery check requires authentication');
    }
  } catch (error) {
    console.error('❌ Error checking recovery system:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting Email Test Suite...\n');

  // Check current configuration
  await checkEmailStatus();
  console.log('');

  // Test monthly email
  const monthlySuccess = await triggerMonthlyEmail();
  console.log('');

  // Wait a bit between emails
  console.log('⏳ Waiting 3 seconds before sending weekly email...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test weekly email
  const weeklySuccess = await triggerWeeklyEmail();
  console.log('');

  // Test recovery system (optional)
  await testEmailRecoverySystem();
  console.log('');

  // Summary
  console.log('📊 Test Results Summary:');
  console.log(`Monthly Email: ${monthlySuccess ? '✅ Success' : '❌ Failed'}`);
  console.log(`Weekly Email: ${weeklySuccess ? '✅ Success' : '❌ Failed'}`);

  if (monthlySuccess && weeklySuccess) {
    console.log('\n🎉 All email tests passed! Check your email inbox for the reports.');
  } else {
    console.log('\n⚠️  Some email tests failed. Check the error messages above.');
  }
}

// Run the test
main().catch(console.error);
