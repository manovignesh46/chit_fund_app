/**
 * Simple JavaScript migration script for transaction balances
 * Run with: node scripts/migrate-balances.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Balance calculation function
function calculateTransactionBalance(transaction, affectedPartnerId, currentPartnerBalance = 0, currentTotalBalance = 0) {
  let partnerBalanceChange = 0;
  let totalBalanceChange = 0;

  switch (transaction.type) {
    case 'collection':
      // Only affects the collecting partner (to_partner_id)
      if (affectedPartnerId === transaction.to_partner_id) {
        partnerBalanceChange = transaction.amount;
      }
      totalBalanceChange = transaction.amount;
      break;

    case 'expense':
      // Only affects the spending partner (from_partner_id)
      if (affectedPartnerId === transaction.from_partner_id) {
        partnerBalanceChange = -transaction.amount;
      }
      totalBalanceChange = -transaction.amount;
      break;

    case 'transfer':
    case 'PARTNER_TO_PARTNER':
      if (affectedPartnerId === transaction.to_partner_id) {
        partnerBalanceChange = transaction.amount;
      } else if (affectedPartnerId === transaction.from_partner_id) {
        partnerBalanceChange = -transaction.amount;
      }
      totalBalanceChange = 0;
      break;

    case 'balance_adjustment':
      // Only affects the target partner (to_partner_id)
      if (affectedPartnerId === transaction.to_partner_id) {
        partnerBalanceChange = transaction.amount;
      }
      totalBalanceChange = transaction.amount;
      break;

    case 'LOAN_DISBURSEMENT':
    case 'loan_given':
      // Affects the disbursing partner (from_partner_id)
      if (affectedPartnerId === transaction.from_partner_id) {
        partnerBalanceChange = -transaction.amount;
      }
      totalBalanceChange = -transaction.amount;
      break;

    case 'LOAN_REPAYMENT':
    case 'loan_repaid':
      // Affects the collecting partner (to_partner_id)
      if (affectedPartnerId === transaction.to_partner_id) {
        partnerBalanceChange = transaction.amount;
      }
      totalBalanceChange = transaction.amount;
      break;

    case 'CHIT_CONTRIBUTION':
      // Affects the collecting partner (to_partner_id)
      if (affectedPartnerId === transaction.to_partner_id) {
        partnerBalanceChange = transaction.amount;
      }
      totalBalanceChange = transaction.amount;
      break;

    case 'AUCTION_PAYOUT':
      // Affects the disbursing partner (from_partner_id)
      if (affectedPartnerId === transaction.from_partner_id) {
        partnerBalanceChange = -transaction.amount;
      }
      totalBalanceChange = -transaction.amount;
      break;

    case 'RECORD_AMOUNT':
      // Record amount - can be either credit (to_partner) or debit (from_partner)
      if (affectedPartnerId === transaction.to_partner_id) {
        partnerBalanceChange = transaction.amount;
        totalBalanceChange = transaction.amount;
      } else if (affectedPartnerId === transaction.from_partner_id) {
        partnerBalanceChange = -transaction.amount;
        totalBalanceChange = -transaction.amount;
      }
      break;

    default:
      partnerBalanceChange = 0;
      totalBalanceChange = 0;
      break;
  }

  return {
    partnerBalance: currentPartnerBalance + partnerBalanceChange,
    totalBalance: currentTotalBalance + totalBalanceChange
  };
}

async function recalculateAllBalances(userId) {
  console.log(`Processing user ID: ${userId}`);
  
  // Get all transactions ordered by date and creation time
  const transactions = await prisma.transaction.findMany({
    where: { createdById: userId },
    orderBy: [
      { date: 'asc' },
      { createdAt: 'asc' }
    ],
    include: {
      fromPartner: true,
      toPartner: true
    }
  });

  console.log(`Found ${transactions.length} transactions to process`);

  let totalBalance = 0;
  const partnerBalances = new Map();

  for (const transaction of transactions) {
    // For each transaction, we need to update balances for all affected partners
    const affectedPartners = [];
    
    // Determine which partners are affected by this transaction
    if (transaction.type === 'transfer' || transaction.type === 'PARTNER_TO_PARTNER') {
      // Transfers affect both partners
      if (transaction.from_partner_id) affectedPartners.push(transaction.from_partner_id);
      if (transaction.to_partner_id) affectedPartners.push(transaction.to_partner_id);
    } else {
      // Other transactions typically affect one partner
      const primaryPartner = transaction.to_partner_id || transaction.from_partner_id;
      if (primaryPartner) affectedPartners.push(primaryPartner);
    }

    // Calculate the new total balance (this is the same regardless of which partner we're calculating for)
    const totalBalanceCalc = calculateTransactionBalance(
      {
        type: transaction.type,
        amount: transaction.amount,
        from_partner_id: transaction.from_partner_id,
        to_partner_id: transaction.to_partner_id
      },
      null, // null means we're calculating total balance only
      0,
      totalBalance
    );
    totalBalance = totalBalanceCalc.totalBalance;

    // Find the primary partner for storing the balance in the transaction record
    const primaryPartnerId = transaction.to_partner_id || transaction.from_partner_id;
    let transactionPartnerBalance = 0;

    // Update balances for all affected partners
    for (const partnerId of affectedPartners) {
      const currentPartnerBalance = partnerBalances.get(partnerId) || 0;
      
      const partnerBalanceCalc = calculateTransactionBalance(
        {
          type: transaction.type,
          amount: transaction.amount,
          from_partner_id: transaction.from_partner_id,
          to_partner_id: transaction.to_partner_id
        },
        partnerId,
        currentPartnerBalance,
        totalBalance
      );

      partnerBalances.set(partnerId, partnerBalanceCalc.partnerBalance);
      
      // Use the primary partner's balance for the transaction record
      if (partnerId === primaryPartnerId) {
        transactionPartnerBalance = partnerBalanceCalc.partnerBalance;
      }
    }

    // Update the transaction record
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        partnerBalance: transactionPartnerBalance,
        totalBalance: totalBalance
      }
    });

    if (transactions.indexOf(transaction) % 10 === 0) {
      console.log(`Processed ${transactions.indexOf(transaction) + 1}/${transactions.length} transactions`);
    }
  }

  console.log(`✅ Completed balance calculation for user ${userId}`);
  console.log(`Final total balance: ₹${totalBalance.toLocaleString()}`);
}

async function migrateExistingTransactions() {
  console.log('🚀 Starting migration of existing transactions...\n');

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

    console.log(`Found ${usersWithTransactions.length} users with transactions\n`);

    // Process each user
    for (const user of usersWithTransactions) {
      console.log(`📊 Processing transactions for user: ${user.name} (${user.email})`);
      
      try {
        await recalculateAllBalances(user.id);
      } catch (error) {
        console.error(`❌ Error processing user ${user.name}:`, error);
      }
      console.log(''); // Empty line for readability
    }

    console.log('✅ Migration completed successfully!\n');

    // Print summary
    console.log('=== MIGRATION SUMMARY ===');
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
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateExistingTransactions();
