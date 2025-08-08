#!/usr/bin/env node

/**
 * Script to fix balance calculations for all transactions
 * This script will recalculate balances for all users and update the database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBalances() {
  try {
    console.log('🔧 Starting balance recalculation...');
    
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, email: true }
    });

    console.log(`Found ${users.length} users to process`);

    for (const user of users) {
      console.log(`\n📊 Processing user: ${user.email} (ID: ${user.id})`);
      
      // Get all transactions for this user, ordered by date and creation time
      const transactions = await prisma.transaction.findMany({
        where: { createdById: user.id },
        orderBy: [
          // { date: 'asc' },
          { createdAt: 'asc' }
        ],
        include: {
          fromPartner: true,
          toPartner: true
        }
      });

      console.log(`  Found ${transactions.length} transactions`);

      if (transactions.length === 0) {
        console.log('  No transactions to process');
        continue;
      }

      // Initialize running balances
      let totalBalance = 0;
      const partnerBalances = new Map();

      // Process each transaction in chronological order
      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        
        // Calculate balance changes based on transaction type
        let totalBalanceChange = 0;
        const affectedPartners = new Map(); // partnerId -> balanceChange
        
        switch (transaction.type) {
          case 'collection':
          case 'CHIT_CONTRIBUTION':
          case 'LOAN_REPAYMENT':
            // Money coming in - increases total and receiving partner's balance
            totalBalanceChange = transaction.amount;
            if (transaction.to_partner_id) {
              affectedPartners.set(transaction.to_partner_id, transaction.amount);
            }
            break;

          case 'expense':
          case 'LOAN_DISBURSEMENT':
          case 'AUCTION_PAYOUT':
            // Money going out - decreases total and sending partner's balance
            totalBalanceChange = -transaction.amount;
            if (transaction.from_partner_id) {
              affectedPartners.set(transaction.from_partner_id, -transaction.amount);
            }
            break;

          case 'transfer':
          case 'PARTNER_TO_PARTNER':
            // Internal transfer - no change to total, but affects both partners
            totalBalanceChange = 0;
            if (transaction.from_partner_id) {
              affectedPartners.set(transaction.from_partner_id, -transaction.amount);
            }
            if (transaction.to_partner_id) {
              affectedPartners.set(transaction.to_partner_id, transaction.amount);
            }
            break;

          case 'balance_adjustment':
            // Manual adjustment - affects total and target partner
            totalBalanceChange = transaction.amount;
            if (transaction.to_partner_id) {
              affectedPartners.set(transaction.to_partner_id, transaction.amount);
            }
            break;

          case 'RECORD_AMOUNT':
            // Record amount - can be either credit (to_partner) or debit (from_partner)
            if (transaction.to_partner_id) {
              // Money coming in to to_partner (credit)
              totalBalanceChange = transaction.amount;
              affectedPartners.set(transaction.to_partner_id, transaction.amount);
            } else if (transaction.from_partner_id) {
              // Money going out from from_partner (debit)
              totalBalanceChange = -transaction.amount;
              affectedPartners.set(transaction.from_partner_id, -transaction.amount);
            }
            break;

          default:
            console.log(`  ⚠️  Unknown transaction type: ${transaction.type}`);
            break;
        }

        // Update total balance
        totalBalance += totalBalanceChange;

        // Update partner balances
        for (const [partnerId, balanceChange] of affectedPartners) {
          const currentBalance = partnerBalances.get(partnerId) || 0;
          partnerBalances.set(partnerId, currentBalance + balanceChange);
        }

        // Determine which partner balance to store in the transaction record
        // Priority: to_partner_id, then from_partner_id
        const primaryPartnerId = transaction.to_partner_id || transaction.from_partner_id;
        const transactionPartnerBalance = primaryPartnerId ? (partnerBalances.get(primaryPartnerId) || 0) : 0;

        // Update the transaction record
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            partnerBalance: transactionPartnerBalance,
            totalBalance: totalBalance
          }
        });

        if (i % 10 === 0 || i === transactions.length - 1) {
          console.log(`  📈 Processed ${i + 1}/${transactions.length} transactions`);
        }
      }

      console.log(`  ✅ Completed user ${user.email}`);
      console.log(`  📊 Final total balance: ₹${totalBalance.toLocaleString()}`);
      console.log(`  👥 Partner balances:`);
      
      // Show partner balances
      const partners = await prisma.partner.findMany({
        where: { createdById: user.id },
        select: { id: true, name: true }
      });

      for (const partner of partners) {
        const balance = partnerBalances.get(partner.id) || 0;
        console.log(`    ${partner.name}: ₹${balance.toLocaleString()}`);
      }
    }

    console.log('\n🎉 Balance recalculation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during balance recalculation:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  fixBalances()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixBalances };
