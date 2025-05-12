// Script to check database connection
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  try {
    console.log('Checking database connection...');
    
    // Try to query the database
    const users = await prisma.user.findMany({
      take: 1,
    });
    
    console.log('Database connection successful!');
    console.log('Found users:', users.length);
    
    // Check if we have the admin user
    const adminUser = await prisma.user.findUnique({
      where: {
        email: process.env.ADMIN_EMAIL || 'amfincorp1@gmail.com',
      },
    });
    
    if (adminUser) {
      console.log('Admin user exists:', adminUser.email);
    } else {
      console.log('Admin user not found. You may need to run the seed script.');
    }
    
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
