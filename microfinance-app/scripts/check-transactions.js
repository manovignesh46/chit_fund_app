#!/usr/bin/env node

/**
 * Simple script to check the transaction data structure in the database
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTransactions() {
  console.log('🔍 Checking transaction data structure...');
  console.log('=====================================\n');

  try {
    // Check total transaction count
    const totalTransactions = await prisma.transaction.count();
    console.log(`📊 Total transactions in database: ${totalTransactions}`);

    if (totalTransactions > 0) {
      // Get transaction types
      const transactionTypes = await prisma.transaction.groupBy({
        by: ['type'],
        _count: {
          type: true
        }
      });

      console.log('\n📈 Transaction types breakdown:');
      transactionTypes.forEach(type => {
        console.log(`   ${type.type}: ${type._count.type} transactions`);
      });

      // Get recent transactions
      const recentTransactions = await prisma.transaction.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          type: true,
          amount: true,
          member: true,
          from_partner: true,
          to_partner: true,
          action_performer: true,
          entered_by: true,
          date: true,
          note: true
        }
      });

      console.log('\n🕒 Recent transactions:');
      recentTransactions.forEach(t => {
        console.log(`   ID: ${t.id} | Type: ${t.type} | Amount: ₹${t.amount} | From: ${t.from_partner} | To: ${t.to_partner}`);
        console.log(`      Performer: ${t.action_performer} | Entered by: ${t.entered_by} | Date: ${t.date.toISOString().split('T')[0]}`);
        if (t.note) console.log(`      Note: ${t.note}`);
        console.log('');
      });
    }

    // Check partners
    const partners = await prisma.partner.findMany({
      select: {
        id: true,
        name: true,
        isActive: true
      }
    });

    console.log('\n👥 Partners in database:');
    partners.forEach(p => {
      console.log(`   ID: ${p.id} | Name: ${p.name} | Active: ${p.isActive}`);
    });

    // Check loans
    const totalLoans = await prisma.loan.count();
    console.log(`\n💰 Total loans in database: ${totalLoans}`);

    if (totalLoans > 0) {
      const recentLoans = await prisma.loan.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          status: true,
          borrower: {
            select: { name: true }
          }
        }
      });

      console.log('\n🏦 Recent loans:');
      recentLoans.forEach(l => {
        console.log(`   ID: ${l.id} | Borrower: ${l.borrower.name} | Amount: ₹${l.amount} | Status: ${l.status}`);
      });
    }

    console.log('\n✅ Database check completed successfully!');

  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkTransactions();
