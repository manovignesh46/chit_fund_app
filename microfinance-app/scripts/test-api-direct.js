// Script to make direct HTTP requests to the API and check the response

const http = require('http');

function fetchLoanDetail(loanId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/loans/consolidated?action=detail&id=${loanId}`,
      method: 'GET',
      headers: {
        'Cookie': 'YOUR_AUTH_COOKIE_HERE' // Replace with an actual auth cookie
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Response status code: ${res.statusCode}`);
        console.log(`Response headers: ${JSON.stringify(res.headers)}`);
        
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Error making request:', error);
      reject(error);
    });
    
    req.end();
  });
}

async function testAPI() {
  try {
    const loanId = 10; // Example loan ID
    console.log(`Fetching details for loan ID ${loanId}...`);
    
    const loanData = await fetchLoanDetail(loanId);
    console.log('Loan data received:');
    console.log(JSON.stringify(loanData, null, 2));
    
    // Specifically check for remainingDue
    console.log('\nChecking for remainingDue field:');
    console.log(`remainingDue: ${loanData.remainingDue}`);
    console.log(`remainingDue type: ${typeof loanData.remainingDue}`);
    console.log(`Loan has remainingDue property: ${'remainingDue' in loanData}`);
    
    // Print all loan properties
    console.log('\nAll loan properties:');
    console.log(Object.keys(loanData));
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Note: This script requires authentication to work.
// You would need to extract an auth cookie from your browser and insert it above.
console.log('Note: You need to replace YOUR_AUTH_COOKIE_HERE with a valid auth cookie to use this script.');
// testAPI();
