const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkJuneTransactions() {
  try {
    console.log('Checking transactions around June 30, 2025...\n');
    
    // Check all transactions in June 2025
    const juneTransactions = await prisma.transaction.findMany({
      where: {
        date: {
          gte: new Date('2025-06-01'),
          lte: new Date('2025-06-30T23:59:59.999Z')
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    console.log(`Found ${juneTransactions.length} transactions in June 2025:`);
    juneTransactions.forEach(tx => {
      console.log(`- ID: ${tx.id}, Date: ${tx.date}, Amount: ${tx.amount}, Type: ${tx.type}, Description: ${tx.description}`);
    });

    // Specifically check for June 30, 2025 transactions
    const june30Transactions = await prisma.transaction.findMany({
      where: {
        date: {
          gte: new Date('2025-06-30'),
          lte: new Date('2025-06-30T23:59:59.999Z')
        }
      }
    });

    console.log(`\nFound ${june30Transactions.length} transactions on June 30, 2025:`);
    june30Transactions.forEach(tx => {
      console.log(`- ID: ${tx.id}, Date: ${tx.date.toISOString()}, Amount: ${tx.amount}, Type: ${tx.type}, Description: ${tx.description}`);
    });

    // Check what the date range would be for "last month" calculation
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    console.log('\nLast month date range calculation:');
    console.log(`Start: ${lastMonthStart.toISOString()} (${lastMonthStart.toISOString().split('T')[0]})`);
    console.log(`End: ${lastMonthEnd.toISOString()} (${lastMonthEnd.toISOString().split('T')[0]})`);

    // Test the exact query that would be used by the API
    const apiQuery = await prisma.transaction.findMany({
      where: {
        date: {
          gte: new Date(lastMonthStart.toISOString().split('T')[0]),
          lte: new Date(lastMonthEnd.toISOString().split('T')[0] + 'T23:59:59.999Z')
        }
      }
    });

    console.log(`\nAPI query result for last month: ${apiQuery.length} transactions`);
    apiQuery.forEach(tx => {
      console.log(`- ID: ${tx.id}, Date: ${tx.date.toISOString()}, Amount: ${tx.amount}, Type: ${tx.type}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJuneTransactions();
