// Script to verify that dashboard's "Outstanding Loan Amount" is correctly calculated
// from the sum of all loans' remainingAmount values

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateTotalFinancialMetrics } = require('../lib/centralizedFinancialCalculations');

async function verifyDashboardRemainingAmount() {
  console.log('Starting verification of dashboard Outstanding Loan Amount calculation...');
  
  try {
    // Get all active loans with their remainingAmount and remainingDue fields
    const allLoans = await prisma.loan.findMany({
      where: {
        status: 'Active'
      },
      select: {
        id: true,
        borrowerId: true,
        amount: true,
        installmentAmount: true,
        duration: true,
        remainingAmount: true,
        remainingDue: true,
        repayments: {
          select: {
            id: true,
            amount: true,
            paymentType: true,
            paidDate: true
          }
        }
      }
    });
    
    console.log(`Found ${allLoans.length} active loans`);
    
    // Calculate the sum of all remainingAmount values directly
    const manualTotalRemainingAmount = allLoans.reduce((sum, loan) => sum + loan.remainingAmount, 0);
    console.log(`Manually calculated total Outstanding Loan Amount: ${manualTotalRemainingAmount}`);
    
    // Verify that each loan's remainingAmount = remainingDue * installmentAmount
    console.log('\nVerifying individual loan calculations:');
    for (const loan of allLoans) {
      const expectedRemainingAmount = loan.remainingDue * loan.installmentAmount;
      const actualRemainingAmount = loan.remainingAmount;
      const isCorrect = Math.abs(expectedRemainingAmount - actualRemainingAmount) < 0.01; // Allow for small rounding differences
      
      console.log(`Loan ID ${loan.id}:`);
      console.log(`  remainingDue: ${loan.remainingDue}`);
      console.log(`  installmentAmount: ${loan.installmentAmount}`);
      console.log(`  Expected remainingAmount: ${expectedRemainingAmount}`);
      console.log(`  Actual remainingAmount: ${actualRemainingAmount}`);
      console.log(`  Calculation correct: ${isCorrect ? 'YES' : 'NO - DISCREPANCY FOUND!'}`);
      
      if (!isCorrect) {
        console.log(`  WARNING: Loan ID ${loan.id} has incorrect remainingAmount!`);
      }
    }
    
    // Now calculate using the centralized financial calculations (as used by the dashboard)
    const chitFunds = await prisma.chitFund.findMany({
      where: {
        status: 'Active'
      },
      include: {
        contributions: true,
        auctions: true
      }
    });
    
    // Calculate metrics using the centralized system
    const totalMetrics = calculateTotalFinancialMetrics(allLoans, chitFunds);
    const dashboardRemainingAmount = totalMetrics.loanRemainingAmount;
    
    console.log('\nDashboard calculation verification:');
    console.log(`Dashboard API calculated Outstanding Loan Amount: ${dashboardRemainingAmount}`);
    console.log(`Manually calculated total: ${manualTotalRemainingAmount}`);
    
    const calculationsMatch = Math.abs(dashboardRemainingAmount - manualTotalRemainingAmount) < 0.01;
    console.log(`Dashboard calculation matches manual calculation: ${calculationsMatch ? 'YES' : 'NO - DISCREPANCY FOUND!'}`);
    
    if (calculationsMatch) {
      console.log('\nVERIFICATION SUCCESSFUL: Dashboard Outstanding Loan Amount is correctly calculated from the sum of all loans\' remainingAmount values.');
    } else {
      console.log('\nVERIFICATION FAILED: There is a discrepancy between the dashboard calculation and the manual calculation.');
    }
    
  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyDashboardRemainingAmount();
