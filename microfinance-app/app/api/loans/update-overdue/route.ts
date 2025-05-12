import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiCache } from '@/lib/cache';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

// Function to calculate overdue amount for a loan
async function calculateOverdueAmount(loan: any) {
    try {
        // If loan is not active or hasn't started yet, no overdue
        if (loan.status !== 'Active' || loan.currentMonth === 0) {
            return { overdueAmount: 0, missedPayments: 0 };
        }

        // If payment schedules are not included, fetch them
        if (!loan.paymentSchedules) {
            loan = await prismaAny.loan.findUnique({
                where: { id: loan.id },
                include: {
                    repayments: true,
                    paymentSchedules: {
                        orderBy: { period: 'asc' }
                    }
                }
            });
        }

        // Get the current date
        const currentDate = new Date();

        // Check if the loan has a next payment date that's different from what would be expected
        // This indicates a missed payment
        if (loan.currentMonth > 0 && loan.repayments.length === 0 && loan.nextPaymentDate) {
            // Get the next payment date
            const nextPaymentDate = new Date(loan.nextPaymentDate);

            // Calculate what the first payment date should have been
            const disbursementDate = new Date(loan.disbursementDate);
            const expectedFirstPaymentDate = new Date(disbursementDate);

            if (loan.repaymentType === 'Monthly') {
                expectedFirstPaymentDate.setMonth(disbursementDate.getMonth() + 1);
            } else if (loan.repaymentType === 'Weekly') {
                expectedFirstPaymentDate.setDate(disbursementDate.getDate() + 7);
            }

            // If the next payment date is later than the expected first payment date,
            // it means the borrower has missed at least one payment
            if (nextPaymentDate.getTime() > expectedFirstPaymentDate.getTime()) {
                // Calculate how many payments have been missed
                let missedPayments = 1; // At least one payment missed

                // For the missed payment(s), the overdue amount is the installment amount
                return {
                    overdueAmount: loan.installmentAmount * missedPayments,
                    missedPayments: missedPayments
                };
            }
        }

        // Get the next payment date
        const nextPaymentDate = loan.nextPaymentDate ? new Date(loan.nextPaymentDate) : null;

        // If next payment date is in the future and we have at least one payment, no overdue
        if (nextPaymentDate && nextPaymentDate > currentDate && loan.repayments.length > 0) {
            return { overdueAmount: 0, missedPayments: 0 };
        }

        // Calculate how many payments should have been made by now
        const disbursementDate = new Date(loan.disbursementDate);
        let expectedPayments = 0;

        if (loan.repaymentType === 'Monthly') {
            // For monthly loans, calculate months difference
            const monthsDiff = (currentDate.getFullYear() - disbursementDate.getFullYear()) * 12 +
                              (currentDate.getMonth() - disbursementDate.getMonth());

            // Add 1 because first payment is due after 1 month
            expectedPayments = Math.max(0, monthsDiff);

            // Adjust if we haven't reached the same day of the month yet
            if (currentDate.getDate() < disbursementDate.getDate()) {
                expectedPayments--;
            }
        } else if (loan.repaymentType === 'Weekly') {
            // For weekly loans, calculate weeks difference
            const daysDiff = Math.floor((currentDate.getTime() - disbursementDate.getTime()) / (24 * 60 * 60 * 1000));
            expectedPayments = Math.floor(daysDiff / 7);
        }

        // Ensure we don't expect more payments than the loan duration
        expectedPayments = Math.min(expectedPayments, loan.duration);

        // Get all repayments sorted by period to handle multiple payments for the same period
        const repaymentsByPeriod = new Map();

        // Group repayments by period, keeping the most recent one for each period
        loan.repayments.forEach((repayment: any) => {
            const period = repayment.period || 0;

            // If we don't have this period yet, or this is a newer payment for the same period
            if (!repaymentsByPeriod.has(period) ||
                new Date(repaymentsByPeriod.get(period).paidDate) < new Date(repayment.paidDate)) {
                repaymentsByPeriod.set(period, repayment);
            }
        });

        // Create an array of periods that should have been paid by now
        const periodsExpected = Array.from({ length: expectedPayments }, (_, i) => i + 1);

        // Calculate the principal portion of each payment
        const principalPerPayment = loan.repaymentType === 'Monthly'
            ? (loan.amount / loan.duration)
            : (loan.amount / (loan.duration - 1));

        // Calculate the interest portion of each payment
        const interestPerPayment = loan.installmentAmount - principalPerPayment;

        // Calculate overdue amount and missed payments
        let overdueAmount = 0;
        let missedPayments = 0;

        // Check each expected period
        for (const period of periodsExpected) {
            const repayment = repaymentsByPeriod.get(period);

            if (!repayment) {
                // No payment made for this period, add full installment amount to overdue
                overdueAmount += loan.installmentAmount;
                missedPayments++;
            } else if (repayment.paymentType === 'interestOnly') {
                // Interest-only payment made, add only principal portion to overdue
                overdueAmount += principalPerPayment;
                missedPayments++;
            }
            // If full payment was made, nothing to add to overdue
        }

        return { overdueAmount, missedPayments };
    } catch (error) {
        console.error('Error calculating overdue amount:', error);
        return { overdueAmount: 0, missedPayments: 0 };
    }
}


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function GET(request: NextRequest) {
    try {
        // Check for API key or other authentication if needed
        const { searchParams } = new URL(request.url);
        const apiKey = searchParams.get('apiKey');

        // Simple API key check - in production, use a more secure method
        if (apiKey !== process.env.OVERDUE_UPDATE_API_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all active loans with their repayments and payment schedules
        const loans = await prismaAny.loan.findMany({
            where: { status: 'Active' },
            include: {
                repayments: true,
                paymentSchedules: {
                    orderBy: { period: 'asc' }
                }
            }
        });

        const updates = [];

        // Process each loan
        for (const loan of loans) {
            // Calculate overdue amount
            const { overdueAmount, missedPayments } = await calculateOverdueAmount(loan);

            // Only update if values have changed
            if (loan.overdueAmount !== overdueAmount || loan.missedPayments !== missedPayments) {
                // Update the loan
                const updatedLoan = await prismaAny.loan.update({
                    where: { id: loan.id },
                    data: {
                        overdueAmount,
                        missedPayments
                    }
                });

                updates.push({
                    loanId: loan.id,
                    previousOverdueAmount: loan.overdueAmount,
                    newOverdueAmount: overdueAmount,
                    previousMissedPayments: loan.missedPayments,
                    newMissedPayments: missedPayments
                });
            }
        }

        return NextResponse.json({
            message: 'Overdue amounts updated successfully',
            loansProcessed: loans.length,
            loansUpdated: updates.length,
            updates
        });
    } catch (error) {
        console.error('Error updating overdue amounts:', error);
        return NextResponse.json(
            { error: 'Failed to update overdue amounts' },
            { status: 500 }
        );
    }
}
