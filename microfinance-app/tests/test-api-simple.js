#!/usr/bin/env node

/**
 * Simple test to check API response
 */

console.log('🔍 Testing API response...');

const apiUrl = 'http://localhost:3001/api/transactions';

// First test: GET request to see if API is working
fetch(apiUrl)
.then(response => {
  console.log('GET Response status:', response.status);
  console.log('GET Response headers:', Object.fromEntries(response.headers.entries()));
  return response.text();
})
.then(text => {
  console.log('GET Response body (first 500 chars):', text.substring(0, 500));
  
  // Now test POST request
  console.log('\n🧪 Testing POST request...');
  
  const testData = {
    type: 'PARTNER_TO_PARTNER',
    amount: 1000,
    date: '2025-07-19',
    note: 'Simple test',
    from_partner_id: 1,
    to_partner_id: 2
  };

  return fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-active-partner': 'Mano'
    },
    body: JSON.stringify(testData)
  });
})
.then(response => {
  console.log('POST Response status:', response.status);
  console.log('POST Response headers:', Object.fromEntries(response.headers.entries()));
  return response.text();
})
.then(text => {
  console.log('POST Response body (first 1000 chars):', text.substring(0, 1000));
  
  // Try to parse as JSON
  try {
    const data = JSON.parse(text);
    console.log('\n✅ Successfully parsed JSON response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('\n❌ Failed to parse JSON. Raw response:', text);
  }
})
.catch(error => {
  console.error('❌ Error:', error);
});
