// Script to test the loans API and check for remainingDue field in the response
// Run this script in a browser console or using a Node.js fetch implementation

// Test function for browser environment
async function testLoanAPI() {
  console.log('Testing loan API to check for remainingDue field...');
  
  try {
    // Test loan list API
    console.log('Testing loan list API...');
    const listResponse = await fetch('/api/loans/consolidated?action=list&page=1&pageSize=10');
    const listData = await listResponse.json();
    
    console.log('Loan list response status:', listResponse.status);
    if (listData.loans && listData.loans.length > 0) {
      console.log('First loan in list:', {
        id: listData.loans[0].id,
        remainingDue: listData.loans[0].remainingDue,
        remainingAmount: listData.loans[0].remainingAmount
      });
      
      // Test loan detail API with the first loan ID
      const loanId = listData.loans[0].id;
      console.log(`Testing loan detail API for loan ID ${loanId}...`);
      const detailResponse = await fetch(`/api/loans/consolidated?action=detail&id=${loanId}`);
      const detailData = await detailResponse.json();
      
      console.log('Loan detail response status:', detailResponse.status);
      console.log('Loan detail response:', {
        id: detailData.id,
        remainingDue: detailData.remainingDue,
        remainingAmount: detailData.remainingAmount
      });
    } else {
      console.log('No loans found in the list response');
    }
  } catch (error) {
    console.error('Error testing loan API:', error);
  }
}

// Instructions for use:
// 1. Open the browser console on your app (localhost:3000)
// 2. Copy and paste this entire script
// 3. Call the testLoanAPI() function

// Note: This is meant to be run in a browser console, not as a Node.js script
