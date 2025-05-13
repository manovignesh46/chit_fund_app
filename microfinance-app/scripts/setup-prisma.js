// Script to ensure Prisma is properly set up for deployment
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting Prisma setup for deployment...');

// Get the current environment
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set!');
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
if (!schema.includes('rhel-openssl-3.0.x')) {
  console.error('ERROR: Prisma schema does not include required binary targets for Vercel deployment.');
  process.exit(1);
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
const clientPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client');
if (!fs.existsSync(clientPath)) {
  console.error(`ERROR: Prisma client not found at ${clientPath}`);
  process.exit(1);
}

console.log('Prisma setup completed successfully!');
