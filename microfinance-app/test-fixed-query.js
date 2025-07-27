const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFixedQuery() {
  try {
    console.log('Testing fixed date calculation...\n');
    
    const now = new Date();
    // Using the fixed UTC calculation
    const lastMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
    const lastMonthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0));
    
    console.log('Fixed last month date range:');
    console.log(`Start: ${lastMonthStart.toISOString()} (${lastMonthStart.toISOString().split('T')[0]})`);
    console.log(`End: ${lastMonthEnd.toISOString()} (${lastMonthEnd.toISOString().split('T')[0]})`);

    // Test the fixed query
    const transactions = await prisma.transaction.findMany({
      where: {
        date: {
          gte: new Date(lastMonthStart.toISOString().split('T')[0]),
          lte: new Date(lastMonthEnd.toISOString().split('T')[0] + 'T23:59:59.999Z')
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    console.log(`\nFound ${transactions.length} transactions with fixed calculation:`);
    transactions.forEach(tx => {
      console.log(`- ID: ${tx.id}, Date: ${tx.date.toISOString()}, Amount: ${tx.amount}, Type: ${tx.type}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFixedQuery();
