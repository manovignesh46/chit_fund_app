// Script to optimize the database
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error'],
});

async function main() {
  try {
    console.log('Starting database optimization...');
    
    // 1. Create indexes for frequently queried fields
    console.log('Creating indexes...');
    
    // This is a SQLite-specific command to optimize the database
    await prisma.$executeRawUnsafe(`PRAGMA optimize;`);
    
    // Vacuum the database to reclaim space and optimize
    console.log('Vacuuming database...');
    await prisma.$executeRawUnsafe(`VACUUM;`);
    
    // Analyze the database to update statistics
    console.log('Analyzing database...');
    await prisma.$executeRawUnsafe(`ANALYZE;`);
    
    console.log('Database optimization completed successfully!');
    
  } catch (error) {
    console.error('Database optimization error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
