// Test script to verify database connection
const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  console.log('Testing database connection...');
  
  try {
    const prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });

    console.log('Prisma client initialized');
    console.log('Database URL:', process.env.DATABASE_URL);
    
    // Try to connect to the database
    console.log('Attempting to connect to the database...');
    const users = await prisma.user.findMany({
      take: 1,
    });
    
    console.log('Connection successful!');
    console.log(`Found ${users.length} users`);
    
    // Close the connection
    await prisma.$disconnect();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error connecting to the database:');
    console.error(error);
  }
}

testConnection();
