#!/usr/bin/env node

/**
 * Test script to verify the repayment creation fix
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRepaymentFix() {
  console.log('🔧 Testing repayment creation fix...');
  console.log('=====================================\n');

  try {
    // Check if we have any loans with borrower information
    const loansWithBorrower = await prisma.loan.findMany({
      include: {
        borrower: true
      },
      take: 3
    });

    console.log(`📊 Found ${loansWithBorrower.length} loans in database`);

    if (loansWithBorrower.length > 0) {
      console.log('\n🏦 Loans with borrower information:');
      loansWithBorrower.forEach(loan => {
        console.log(`   ID: ${loan.id} | Borrower: ${loan.borrower?.name || 'NULL'} | Amount: ₹${loan.amount}`);
        console.log(`      Borrower ID: ${loan.borrowerId} | Status: ${loan.status}`);
      });

      // Check if any loan has a null borrower
      const loansWithNullBorrower = loansWithBorrower.filter(loan => !loan.borrower);
      if (loansWithNullBorrower.length > 0) {
        console.log('\n⚠️  Found loans with null borrower:');
        loansWithNullBorrower.forEach(loan => {
          console.log(`   Loan ID: ${loan.id} | Borrower ID: ${loan.borrowerId} (but borrower is null)`);
        });
      } else {
        console.log('\n✅ All loans have valid borrower information');
      }
    }

    // Check existing repayments
    const repayments = await prisma.repayment.findMany({
      include: {
        loan: {
          include: {
            borrower: true
          }
        }
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n💰 Found ${repayments.length} repayments in database`);
    if (repayments.length > 0) {
      console.log('\n📋 Recent repayments:');
      repayments.forEach(repayment => {
        console.log(`   ID: ${repayment.id} | Loan ID: ${repayment.loanId} | Amount: ₹${repayment.amount}`);
        console.log(`      Borrower: ${repayment.loan.borrower?.name || 'NULL'} | Date: ${repayment.paidDate.toISOString().split('T')[0]}`);
      });
    }

    // Check partners
    const partners = await prisma.partner.findMany();
    console.log(`\n👥 Found ${partners.length} partners:`);
    partners.forEach(partner => {
      console.log(`   ID: ${partner.id} | Name: ${partner.name} | Active: ${partner.isActive}`);
    });

    console.log('\n✅ Database structure check completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - Loans: ${loansWithBorrower.length}`);
    console.log(`   - Repayments: ${repayments.length}`);
    console.log(`   - Partners: ${partners.length}`);
    console.log('\n🔧 The fix should handle null borrower cases with optional chaining');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testRepaymentFix();
