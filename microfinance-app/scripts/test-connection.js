// Test database connection
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing database connection...');
    
    // Try to query the database
    const userCount = await prisma.user.count();
    console.log(`Database connection successful! Found ${userCount} users.`);
    
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
