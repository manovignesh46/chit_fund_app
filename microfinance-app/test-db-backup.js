// Test script to verify the database backup API endpoint
const testDBBackup = async () => {
  try {
    console.log('Testing database backup API...');
    
    const response = await fetch('/api/db-backup');
    
    if (response.ok) {
      console.log('✅ API endpoint is accessible');
      console.log('Response headers:', Object.fromEntries(response.headers));
      
      // Don't actually download in test, just check if it would work
      const contentType = response.headers.get('content-type');
      const contentDisposition = response.headers.get('content-disposition');
      
      console.log('Content-Type:', contentType);
      console.log('Content-Disposition:', contentDisposition);
      
      if (contentType === 'application/zip') {
        console.log('✅ Response is a ZIP file');
      } else {
        console.log('❌ Response is not a ZIP file');
      }
      
    } else {
      console.log('❌ API request failed');
      const errorText = await response.text();
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Export for use in browser console or Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = testDBBackup;
} else if (typeof window !== 'undefined') {
  window.testDBBackup = testDBBackup;
}

console.log('Database backup test function loaded. Run testDBBackup() to test.');