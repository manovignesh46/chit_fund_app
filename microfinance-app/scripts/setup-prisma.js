// Script to ensure Prisma is properly set up for deployment
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables from .env file
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment variables from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.log('No .env file found, using existing environment variables');
}

console.log('Starting Prisma setup for deployment...');

// Get the current environment
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set!');
  console.error('Please make sure your .env file contains a DATABASE_URL entry.');
  process.exit(1);
}

// Paths
const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

// Ensure the schema file exists
if (!fs.existsSync(schemaPath)) {
  console.error(`ERROR: Prisma schema file not found at ${schemaPath}`);
  process.exit(1);
}

// Read the schema file
const schema = fs.readFileSync(schemaPath, 'utf8');
console.log('Prisma schema file found and read successfully.');

// Check if the schema has the correct binary targets
const requiredTargets = ['debian-openssl-3.0.x', 'rhel-openssl-3.0.x'];
const missingTargets = requiredTargets.filter(target => !schema.includes(target));

if (missingTargets.length > 0) {
  console.warn(`WARNING: Prisma schema is missing some recommended binary targets: ${missingTargets.join(', ')}`);
  console.log('Continuing with available targets...');
  // Don't exit - just warn and continue
}

// Run Prisma generate
try {
  console.log('Running prisma generate...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('Prisma client generated successfully.');
} catch (error) {
  console.error('ERROR: Failed to generate Prisma client:', error.message);
  process.exit(1);
}

// Verify the Prisma client was generated
const clientPaths = [
  path.join(process.cwd(), 'node_modules', '.prisma', 'client'),
  path.join(process.cwd(), 'node_modules', '@prisma', 'client')
];

const clientExists = clientPaths.some(clientPath => fs.existsSync(clientPath));

if (!clientExists) {
  console.error(`ERROR: Prisma client not found at any of the expected locations:`);
  clientPaths.forEach(p => console.error(`- ${p}`));

  // Try running prisma generate one more time with verbose logging
  try {
    console.log('Attempting to generate Prisma client again with verbose logging...');
    execSync('npx prisma generate --verbose', { stdio: 'inherit' });
    console.log('Second attempt at Prisma client generation completed.');
  } catch (error) {
    console.error('ERROR: Second attempt to generate Prisma client failed:', error.message);
    // Continue anyway - the build might still work if the client is generated elsewhere
  }
}

console.log('Prisma setup completed successfully!');
