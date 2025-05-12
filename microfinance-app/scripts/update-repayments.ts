/**
 * Script to update existing repayments without a period field
 * Run with: npx ts-node scripts/update-repayments.ts
 */

import { PrismaClient } from '@prisma/client';

// Helper function to calculate the week number for a repayment
function getRepaymentWeek(disbursementDate: Date | string, repaymentDate: Date | string): number {
  const startDate = new Date(disbursementDate);
  const paidDate = new Date(repaymentDate);

  // Calculate the difference in milliseconds
  const diffTime = Math.abs(paidDate.getTime() - startDate.getTime());

  // Convert to days and divide by 7 to get weeks
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.ceil(diffDays / 7);

  // Return at least 1 (first week)
  return Math.max(1, weekNumber);
}

const prisma = new PrismaClient();

async function updateRepayments() {
  try {
    console.log('Starting repayment update process...');

    // Get all loans
    const loans = await prisma.loan.findMany({
      include: {
        repayments: true
      }
    });

    console.log(`Found ${loans.length} loans to process`);

    let updatedCount = 0;
    let errorCount = 0;

    // Process each loan
    for (const loan of loans) {
      console.log(`Processing loan ID ${loan.id} with ${loan.repayments.length} repayments`);

      // Process each repayment
      for (const repayment of loan.repayments) {
        try {
          // Skip if period is already set
          if (repayment.period !== null && repayment.period !== undefined) {
            console.log(`Repayment ID ${repayment.id} already has period ${repayment.period}, skipping`);
            continue;
          }

          // Calculate period based on repayment date and loan type
          let period = 1; // Default to period 1 if we can't calculate

          if (loan.repaymentType === 'Weekly') {
            // For weekly loans, calculate the week number
            period = getRepaymentWeek(loan.disbursementDate, repayment.paidDate);
          } else {
            // For monthly loans, calculate the month number
            const disbursementDate = new Date(loan.disbursementDate);
            const paidDate = new Date(repayment.paidDate);

            // Calculate months between dates
            const monthDiff = (paidDate.getFullYear() - disbursementDate.getFullYear()) * 12 +
                             (paidDate.getMonth() - disbursementDate.getMonth());

            period = Math.max(1, monthDiff + 1); // Add 1 because month 1 is the first month
          }

          // Update the repayment with the calculated period
          await prisma.repayment.update({
            where: { id: repayment.id },
            data: { period }
          });

          console.log(`Updated repayment ID ${repayment.id} with period ${period}`);
          updatedCount++;
        } catch (error) {
          console.error(`Error updating repayment ID ${repayment.id}:`, error);
          errorCount++;
        }
      }
    }

    console.log(`Update complete. Updated ${updatedCount} repayments with ${errorCount} errors.`);
  } catch (error) {
    console.error('Error in update process:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update function
updateRepayments()
  .then(() => console.log('Script completed'))
  .catch(error => console.error('Script failed:', error));
