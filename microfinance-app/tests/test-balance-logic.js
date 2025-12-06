#!/usr/bin/env node

/**
 * Test PARTNER_TO_PARTNER balance calculation
 */

const { PrismaClient } = require('@prisma/client');
const { calculateTransactionBalance, getCurrentPartnerBalance, getCurrentTotalBalance } = require('../lib/balanceCalculator');

const prisma = new PrismaClient();

async function testPartnerTransferBalances() {
  try {
    console.log('🧪 Testing PARTNER_TO_PARTNER balance calculation...\n');

    // Get test data
    const users = await prisma.user.findMany({ take: 1 });
    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }

    const user = users[0];
    const partners = await prisma.partner.findMany({
      where: { createdById: user.id },
      take: 2,
      orderBy: { id: 'asc' }
    });

    if (partners.length < 2) {
      console.log('❌ Need at least 2 partners');
      return;
    }

    console.log(`👥 Testing with partners:`);
    console.log(`   ${partners[0].name} (ID: ${partners[0].id})`);
    console.log(`   ${partners[1].name} (ID: ${partners[1].id})\n`);

    // Get current balances before any transaction
    const partner1CurrentBalance = await getCurrentPartnerBalance(partners[0].id, user.id);
    const partner2CurrentBalance = await getCurrentPartnerBalance(partners[1].id, user.id);
    const totalBalance = await getCurrentTotalBalance(user.id);

    console.log('📊 Current balances:');
    console.log(`   ${partners[0].name}: ₹${partner1CurrentBalance}`);
    console.log(`   ${partners[1].name}: ₹${partner2CurrentBalance}`);
    console.log(`   Total: ₹${totalBalance}\n`);

    // Test balance calculation for a hypothetical transfer: Partner 1 sends ₹5000 to Partner 2
    const transferAmount = 5000;
    
    console.log(`💸 Testing transfer: ${partners[0].name} → ${partners[1].name}, Amount: ₹${transferAmount}\n`);

    // Calculate balance for sending partner (Partner 1)
    const senderBalanceCalc = calculateTransactionBalance(
      {
        type: 'PARTNER_TO_PARTNER',
        amount: transferAmount,
        from_partner_id: partners[0].id,
        to_partner_id: partners[1].id
      },
      partners[0].id, // Affected partner is the sender
      partner1CurrentBalance,
      totalBalance
    );

    // Calculate balance for receiving partner (Partner 2)
    const receiverBalanceCalc = calculateTransactionBalance(
      {
        type: 'PARTNER_TO_PARTNER',
        amount: transferAmount,
        from_partner_id: partners[0].id,
        to_partner_id: partners[1].id
      },
      partners[1].id, // Affected partner is the receiver
      partner2CurrentBalance,
      totalBalance
    );

    console.log('🔢 Calculated balances:');
    console.log(`   ${partners[0].name} (sender):`);
    console.log(`     Before: ₹${partner1CurrentBalance}`);
    console.log(`     After: ₹${senderBalanceCalc.partnerBalance}`);
    console.log(`     Change: ₹${senderBalanceCalc.partnerBalance - partner1CurrentBalance}`);
    console.log(`     Total Balance: ₹${senderBalanceCalc.totalBalance}`);
    
    console.log(`   ${partners[1].name} (receiver):`);
    console.log(`     Before: ₹${partner2CurrentBalance}`);
    console.log(`     After: ₹${receiverBalanceCalc.partnerBalance}`);
    console.log(`     Change: ₹${receiverBalanceCalc.partnerBalance - partner2CurrentBalance}`);
    console.log(`     Total Balance: ₹${receiverBalanceCalc.totalBalance}`);

    // Verify the logic
    const senderChange = senderBalanceCalc.partnerBalance - partner1CurrentBalance;
    const receiverChange = receiverBalanceCalc.partnerBalance - partner2CurrentBalance;
    const totalChange = senderBalanceCalc.totalBalance - totalBalance;

    console.log('\n✅ Verification:');
    console.log(`   Sender change should be -₹${transferAmount}: ${senderChange === -transferAmount ? '✅' : '❌'} (${senderChange})`);
    console.log(`   Receiver change should be +₹${transferAmount}: ${receiverChange === transferAmount ? '✅' : '❌'} (${receiverChange})`);
    console.log(`   Total balance should remain same: ${totalChange === 0 ? '✅' : '❌'} (change: ${totalChange})`);

    // Test getting recent PARTNER_TO_PARTNER transactions
    console.log('\n📋 Recent PARTNER_TO_PARTNER transactions:');
    const recentTransfers = await prisma.transaction.findMany({
      where: {
        createdById: user.id,
        type: 'PARTNER_TO_PARTNER'
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 5,
      select: {
        id: true,
        date: true,
        amount: true,
        from_partner: true,
        to_partner: true,
        partnerBalance: true,
        totalBalance: true,
        note: true
      }
    });

    if (recentTransfers.length > 0) {
      recentTransfers.forEach((t, index) => {
        console.log(`   ${index + 1}. ${t.date.toISOString().split('T')[0]} | ${t.from_partner} → ${t.to_partner} | ₹${t.amount} | Stored Balance: ₹${t.partnerBalance} | Total: ₹${t.totalBalance}`);
      });
    } else {
      console.log('   No PARTNER_TO_PARTNER transactions found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testPartnerTransferBalances();
}
