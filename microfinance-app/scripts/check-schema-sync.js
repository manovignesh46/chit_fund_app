// Script to check if the Prisma schema matches the database

const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const prisma = new PrismaClient();

async function checkSchemaSync() {
  console.log('Checking if Prisma schema is in sync with the database...');
  
  try {
    // 1. Get the database URL from environment variables or use a default
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/microfinance';
    console.log(`Using database URL: ${databaseUrl.replace(/:.+@/, ':****@')}`);
    
    // 2. Run prisma db pull to get the current database schema
    console.log('Running prisma db pull to get current database schema...');
    const { stdout, stderr } = await execPromise('npx prisma db pull');
    console.log('Prisma db pull output:', stdout);
    if (stderr) {
      console.error('Prisma db pull errors:', stderr);
    }
    
    // 3. Run prisma validate to check if the schema is valid
    console.log('Running prisma validate to check schema validity...');
    const validateResult = await execPromise('npx prisma validate');
    console.log('Prisma validate output:', validateResult.stdout);
    if (validateResult.stderr) {
      console.error('Prisma validate errors:', validateResult.stderr);
    }
    
    console.log('Schema check complete!');
    
    // 4. Try to generate a fresh Prisma client
    console.log('Generating fresh Prisma client...');
    const generateResult = await execPromise('npx prisma generate');
    console.log('Prisma generate output:', generateResult.stdout);
    if (generateResult.stderr) {
      console.error('Prisma generate errors:', generateResult.stderr);
    }
    
    console.log('Prisma client generation complete!');
  } catch (error) {
    console.error('Error checking schema sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
checkSchemaSync();
