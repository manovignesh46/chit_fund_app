/**
 * Script to migrate existing transactions and calculate balance columns
 * Run this script after adding the partnerBalance and totalBalance columns
 */

const prisma = require('../lib/prisma').default;
const { recalculateAllBalances } = require('../lib/balanceCalculator');

async function migrateExistingTransactions() {
  console.log('Starting migration of existing transactions...');

  try {
    // Get all users who have transactions
    const usersWithTransactions = await prisma.user.findMany({
      where: {
        transactions: {
          some: {}
        }
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    console.log(`Found ${usersWithTransactions.length} users with transactions`);

    // Process each user
    for (const user of usersWithTransactions) {
      console.log(`Processing transactions for user: ${user.name} (${user.email})`);
      
      try {
        await recalculateAllBalances(user.id);
        console.log(`✅ Completed balance calculation for user ${user.name}`);
      } catch (error) {
        console.error(`❌ Error processing user ${user.name}:`, error);
      }
    }

    console.log('Migration completed successfully!');

    // Print summary
    console.log('\n=== MIGRATION SUMMARY ===');
    for (const user of usersWithTransactions) {
      const transactionCount = await prisma.transaction.count({
        where: { createdById: user.id }
      });
      
      const latestTransaction = await prisma.transaction.findFirst({
        where: { createdById: user.id },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: { totalBalance: true }
      });

      console.log(`User: ${user.name}`);
      console.log(`  - Transactions processed: ${transactionCount}`);
      console.log(`  - Final total balance: ₹${latestTransaction?.totalBalance?.toLocaleString() || 0}`);
      console.log('');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateExistingTransactions();
}

module.exports = { migrateExistingTransactions };
