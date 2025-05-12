// Script to check if the server is running
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3003, // The port your server is running on
  path: '/api/health',
  method: 'GET',
  timeout: 5000, // 5 seconds timeout
};

console.log('Checking if the server is running...');

const req = http.request(options, (res) => {
  console.log(`Server response status code: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    console.log('Server is running correctly!');
  } else {
    console.log('Server is running but returned an unexpected status code.');
  }
  
  res.on('data', (chunk) => {
    console.log(`Response body: ${chunk}`);
  });
});

req.on('error', (error) => {
  console.error('Error connecting to the server:', error.message);
  console.log('The server might not be running or might be running on a different port.');
});

req.on('timeout', () => {
  console.error('Request timed out. The server might be slow to respond.');
  req.destroy();
});

req.end();
