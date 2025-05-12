// Script to optimize database connection
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const appDir = process.cwd();
const prismaSchemaPath = path.join(appDir, 'prisma', 'schema.prisma');
const prismaClientPath = path.join(appDir, 'lib', 'prisma.ts');
const envPath = path.join(appDir, '.env');

console.log('Starting database connection optimization...');

// 1. Update Prisma schema
console.log('Updating Prisma schema...');
try {
  let prismaSchema = fs.readFileSync(prismaSchemaPath, 'utf8');

  // Ensure SQLite provider is used
  prismaSchema = prismaSchema.replace(
    /datasource db {[^}]*}/s,
    `datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}`
  );

  fs.writeFileSync(prismaSchemaPath, prismaSchema);
  console.log('Prisma schema updated successfully.');
} catch (error) {
  console.error('Error updating Prisma schema:', error.message);
  process.exit(1);
}

// 2. Update Prisma client
console.log('Updating Prisma client...');
try {
  let prismaClient = fs.readFileSync(prismaClientPath, 'utf8');

  // Simplify Prisma client initialization
  prismaClient = prismaClient.replace(
    /const prismaClientSingleton[^;]*;/s,
    `const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
  });
};`
  );

  fs.writeFileSync(prismaClientPath, prismaClient);
  console.log('Prisma client updated successfully.');
} catch (error) {
  console.error('Error updating Prisma client:', error.message);
  process.exit(1);
}

// 3. Generate Prisma client
console.log('Generating Prisma client...');
try {
  execSync('npx prisma generate', { cwd: appDir, stdio: 'inherit' });
  console.log('Prisma client generated successfully.');
} catch (error) {
  console.error('Error generating Prisma client:', error.message);
  process.exit(1);
}

// 4. Create a test script to verify the connection
console.log('Creating test script...');
const testScriptPath = path.join(appDir, 'scripts', 'test-connection.js');
const testScriptContent = `// Test database connection
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing database connection...');

    // Try to query the database
    const userCount = await prisma.user.count();
    console.log(\`Database connection successful! Found \${userCount} users.\`);

    // Get the first user
    const user = await prisma.user.findFirst();
    console.log('First user:', user ? user.email : 'No users found');

  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
`;

try {
  fs.writeFileSync(testScriptPath, testScriptContent);
  console.log('Test script created successfully.');
} catch (error) {
  console.error('Error creating test script:', error.message);
  process.exit(1);
}

// 5. Run the test script
console.log('Running test script...');
try {
  execSync('node scripts/test-connection.js', { cwd: appDir, stdio: 'inherit' });
} catch (error) {
  console.error('Error running test script:', error.message);
  process.exit(1);
}

console.log('Database connection optimization completed successfully!');
