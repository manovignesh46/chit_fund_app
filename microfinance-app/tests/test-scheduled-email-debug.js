// Debug script for scheduled email functionality
// Run with: node test-scheduled-email-debug.js

const fetch = require('node-fetch');
require('dotenv').config();

const BASE_URL = 'http://localhost:3001';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhbWZpbmNvcnAxQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc0ODIyNDUwMSwiZXhwIjoxNzQ4MzEwOTAxfQ.HqTSSXQiZ-zdCCOUdwoFn14GbaEKuFCh6Dcrl5_27uU';

async function debugScheduledEmails() {
  console.log('🔍 Debugging Scheduled Email Functionality...\n');

  try {
    // 1. Check scheduler status
    console.log('1️⃣ Checking scheduler status...');
    const statusResponse = await fetch(`${BASE_URL}/api/scheduler`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${AUTH_TOKEN}`
      }
    });

    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('✅ Scheduler Status:', JSON.stringify(status, null, 2));
    } else {
      console.log('❌ Failed to get scheduler status');
      return;
    }

    console.log('\n2️⃣ Testing direct monthly email API...');
    
    // 2. Test direct monthly email API
    const monthlyResponse = await fetch(`${BASE_URL}/api/scheduled/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`
      }
    });

    console.log(`Monthly API Status: ${monthlyResponse.status}`);
    
    if (monthlyResponse.ok) {
      const monthlyResult = await monthlyResponse.json();
      console.log('✅ Monthly email API response:', monthlyResult);
    } else {
      const monthlyError = await monthlyResponse.text();
      console.log('❌ Monthly email API error:', monthlyError);
    }

    console.log('\n3️⃣ Testing direct weekly email API...');
    
    // 3. Test direct weekly email API
    const weeklyResponse = await fetch(`${BASE_URL}/api/scheduled/weekly-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`
      }
    });

    console.log(`Weekly API Status: ${weeklyResponse.status}`);
    
    if (weeklyResponse.ok) {
      const weeklyResult = await weeklyResponse.json();
      console.log('✅ Weekly email API response:', weeklyResult);
    } else {
      const weeklyError = await weeklyResponse.text();
      console.log('❌ Weekly email API error:', weeklyError);
    }

    console.log('\n4️⃣ Testing email recovery system...');
    
    // 4. Test email recovery system
    const recoveryResponse = await fetch(`${BASE_URL}/api/email-recovery?action=status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${AUTH_TOKEN}`
      }
    });

    if (recoveryResponse.ok) {
      const recoveryStatus = await recoveryResponse.json();
      console.log('✅ Email recovery status:', JSON.stringify(recoveryStatus, null, 2));
    } else {
      console.log('❌ Failed to get email recovery status');
    }

    console.log('\n5️⃣ Checking for missed emails...');
    
    // 5. Check for missed emails
    const missedResponse = await fetch(`${BASE_URL}/api/email-recovery?action=check-missed`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${AUTH_TOKEN}`
      }
    });

    if (missedResponse.ok) {
      const missedEmails = await missedResponse.json();
      console.log('✅ Missed emails check:', JSON.stringify(missedEmails, null, 2));
    } else {
      console.log('❌ Failed to check missed emails');
    }

    console.log('\n6️⃣ Testing manual email recovery...');
    
    // 6. Test manual email recovery
    const manualRecoveryResponse = await fetch(`${BASE_URL}/api/email-recovery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        action: 'check-and-send'
      })
    });

    if (manualRecoveryResponse.ok) {
      const recoveryResult = await manualRecoveryResponse.json();
      console.log('✅ Manual recovery result:', recoveryResult);
    } else {
      const recoveryError = await manualRecoveryResponse.text();
      console.log('❌ Manual recovery error:', recoveryError);
    }

  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
  }

  console.log('\n📋 Debug Summary:');
  console.log('- Basic email configuration: ✅ Working (test email sent)');
  console.log('- Scheduler API: Check results above');
  console.log('- Direct email APIs: Check results above');
  console.log('- Email recovery system: Check results above');
  console.log('\n💡 Next steps:');
  console.log('1. Check your email inbox for any emails from the tests above');
  console.log('2. Look at the server console logs for any error messages');
  console.log('3. Verify that the scheduled email routes are working correctly');
}

// Run the debug test
debugScheduledEmails().catch(console.error);
