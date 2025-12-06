// Test script to verify if the initialization is working
// Run with: node test-initialization.js

const { initializeApp } = require('../lib/init.js');

console.log('🧪 Testing Application Initialization...\n');

try {
  // Force initialization
  initializeApp();
  
  console.log('✅ Initialization function called successfully');
  
  // Wait a bit and then check scheduler status
  setTimeout(async () => {
    try {
      const fetch = require('node-fetch');
      const response = await fetch('http://localhost:3001/api/scheduler', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhbWZpbmNvcnAxQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc0ODIyNDUwMSwiZXhwIjoxNzQ4MzEwOTAxfQ.HqTSSXQiZ-zdCCOUdwoFn14GbaEKuFCh6Dcrl5_27uU'
        }
      });
      
      if (response.ok) {
        const status = await response.json();
        console.log('\n📊 Scheduler Status After Initialization:');
        console.log(JSON.stringify(status, null, 2));
        
        if (status.monthly.running && status.weekly.running) {
          console.log('\n✅ Both schedulers are running correctly!');
        } else {
          console.log('\n❌ Schedulers are not running properly');
          console.log('Monthly running:', status.monthly.running);
          console.log('Weekly running:', status.weekly.running);
        }
      } else {
        console.log('❌ Failed to check scheduler status');
      }
    } catch (error) {
      console.error('❌ Error checking scheduler status:', error.message);
    }
  }, 2000);
  
} catch (error) {
  console.error('❌ Error during initialization test:', error);
}
