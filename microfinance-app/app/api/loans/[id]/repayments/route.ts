import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Adjust the import based on your project structure
import { calculateNextPaymentDate } from '@/lib/paymentSchedule';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

// Function to calculate overdue amount for a loan
async function calculateOverdueAmount(loanId: number) {
    try {
        // Get the loan with its repayments and payment schedules
        const loan = await prismaAny.loan.findUnique({
            where: { id: loanId },
            include: {
                repayments: {
                    orderBy: { paidDate: 'asc' }
                },
                paymentSchedules: {
                    orderBy: { period: 'asc' }
                }
            }
        });

        if (!loan) {
            console.error('Loan not found when calculating overdue amount');
            return { overdueAmount: 0, missedPayments: 0 };
        }

        // If loan is not active or hasn't started yet, no overdue
        if (loan.status !== 'Active' || loan.currentMonth === 0) {
            return { overdueAmount: 0, missedPayments: 0 };
        }

        // Get the current date
        const currentDate = new Date();

        // If there are repayments, we need to check if the next payment date indicates a missed payment
        if (loan.currentMonth > 0 && loan.nextPaymentDate) {
            // Get the next payment date
            const nextPaymentDate = new Date(loan.nextPaymentDate);

            // If there are no repayments yet
            if (loan.repayments.length === 0) {
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
            } else {
                // There are repayments, so we need to check if the next payment date is as expected
                // Get the last repayment date
                const lastRepayment = loan.repayments.sort((a: any, b: any) =>
                    new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime()
                )[0];

                const lastRepaymentDate = new Date(lastRepayment.paidDate);
                const expectedNextPaymentDate = new Date(lastRepaymentDate);

                if (loan.repaymentType === 'Monthly') {
                    expectedNextPaymentDate.setMonth(lastRepaymentDate.getMonth() + 1);
                } else if (loan.repaymentType === 'Weekly') {
                    expectedNextPaymentDate.setDate(lastRepaymentDate.getDate() + 7);
                }

                // If the next payment date is later than expected, it means a payment was missed
                // But we need to check if the borrower has already made the expected number of payments
                // based on the current month
                const disbursementDate = new Date(loan.disbursementDate);
                const monthsPassed = loan.currentMonth;

                // If the number of full payments is less than the months passed, there are missed payments
                const fullPayments = loan.repayments.filter((r: any) => r.paymentType !== 'interestOnly').length;

                if (fullPayments < monthsPassed) {
                    const missedPayments = monthsPassed - fullPayments;
                    return {
                        overdueAmount: loan.installmentAmount * missedPayments,
                        missedPayments: missedPayments
                    };
                } else {
                    // All expected payments have been made
                    return { overdueAmount: 0, missedPayments: 0 };
                }
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

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '10');

        // Validate pagination parameters
        const validPage = page > 0 ? page : 1;
        const validPageSize = pageSize > 0 ? pageSize : 10;

        // Calculate skip value for pagination
        const skip = (validPage - 1) * validPageSize;

        // Get total count for pagination
        const totalCount = await prismaAny.repayment.count({
            where: { loanId: Number(id) }
        });

        // Get paginated repayments
        const repayments = await prismaAny.repayment.findMany({
            where: { loanId: Number(id) },
            orderBy: { paidDate: 'desc' },
            skip,
            take: validPageSize
        });

        return NextResponse.json({
            repayments,
            totalCount,
            page: validPage,
            pageSize: validPageSize,
            totalPages: Math.ceil(totalCount / validPageSize)
        });
    } catch (error) {
        console.error('Error fetching repayments:', error);
        return NextResponse.json(
            { error: 'Failed to fetch repayments' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { amount, paidDate, paymentType = 'full', period = null } = await request.json();
        const loanId = Number(id);
        const paymentAmount = parseFloat(amount);
        const isInterestOnly = paymentType === 'interestOnly';

        // Get the current loan to check remaining amount
        const loan = await prismaAny.loan.findUnique({
            where: { id: loanId }
        });

        if (!loan) {
            return NextResponse.json(
                { error: 'Loan not found' },
                { status: 404 }
            );
        }

        // Validate payment amount
        if (paymentAmount <= 0) {
            return NextResponse.json(
                { error: 'Payment amount must be greater than zero' },
                { status: 400 }
            );
        }

        // Only validate against remaining amount for full payments
        if (!isInterestOnly && paymentAmount > loan.remainingAmount) {
            return NextResponse.json(
                { error: 'Payment amount cannot exceed the remaining balance' },
                { status: 400 }
            );
        }

        // Calculate new remaining amount - only reduce for full payments
        const newRemainingAmount = isInterestOnly
            ? loan.remainingAmount // No change for interest-only payments
            : loan.remainingAmount - paymentAmount;

        // Calculate overdue amount after this payment
        const { overdueAmount, missedPayments } = await calculateOverdueAmount(loanId);

        // Use a transaction to ensure both operations succeed or fail together
        const result = await prismaAny.$transaction([
            // Create the repayment record
            prismaAny.repayment.create({
                data: {
                    loanId: loanId,
                    amount: paymentAmount,
                    paidDate: new Date(paidDate),
                    paymentType: isInterestOnly ? 'interestOnly' : 'full',
                    // Store the period if provided
                    period: period ? Number(period) : null
                },
            }),

            // Calculate the next payment date based on loan details and repayment history
            calculateNextPaymentDate(loanId).then(nextPaymentDate => {
                // Update the loan with the calculated next payment date
                return prismaAny.loan.update({
                    where: { id: loanId },
                    data: {
                        // Only update remaining amount for full payments
                        remainingAmount: newRemainingAmount,
                        // If fully paid, update the status
                        status: newRemainingAmount <= 0 ? 'Completed' : 'Active',
                        // Update next payment date with the calculated value
                        nextPaymentDate: newRemainingAmount <= 0 ? null : nextPaymentDate,
                        // Update overdue information
                        overdueAmount: overdueAmount,
                        missedPayments: missedPayments
                    },
                });
            }),
        ]);

        return NextResponse.json({
            ...result[0],
            paymentType: isInterestOnly ? 'interestOnly' : 'full'
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating repayment:', error);
        return NextResponse.json(
            { error: 'Failed to create repayment' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const loanId = Number(id);
        const body = await request.json();

        // Check if we're deleting a single repayment or multiple
        if (body.repaymentId) {
            // Get the repayment to check if it's a full payment and get its payment schedule
            const repayment = await prismaAny.repayment.findUnique({
                where: { id: body.repaymentId }
            });

            if (!repayment) {
                return NextResponse.json(
                    { error: 'Repayment not found' },
                    { status: 404 }
                );
            }

            // Check if this repayment has a period
            let period = null;

            if (repayment.period) {
                period = repayment.period;
            }

            // Get the loan to update remaining amount
            const loan = await prismaAny.loan.findUnique({
                where: { id: loanId }
            });

            if (!loan) {
                return NextResponse.json(
                    { error: 'Loan not found' },
                    { status: 404 }
                );
            }

            // Only adjust remaining amount if it was a full payment
            const newRemainingAmount = repayment.paymentType === 'full'
                ? loan.remainingAmount + repayment.amount
                : loan.remainingAmount;

            // First delete the repayment
            await prismaAny.repayment.delete({
                where: { id: body.repaymentId }
            });

            // No need to reset payment schedule status as it's been removed
            // Calculate new overdue amount after deletion
            const { overdueAmount, missedPayments } = await calculateOverdueAmount(loanId);

            // Recalculate the next payment date regardless of whether the repayment had a period or payment schedule
            let nextPaymentDate;
            try {
                // We need to recalculate the next payment date since a payment was deleted
                nextPaymentDate = await calculateNextPaymentDate(loanId);
            } catch (error) {
                console.error('Error recalculating next payment date:', error);
                // Continue even if calculation fails
                nextPaymentDate = loan.nextPaymentDate;
            }

            // Update the loan with new values
            await prismaAny.loan.update({
                where: { id: loanId },
                data: {
                    remainingAmount: newRemainingAmount,
                    // Update status back to Active if it was Completed
                    status: 'Active',
                    // Update next payment date with the recalculated value
                    nextPaymentDate: nextPaymentDate,
                    // Update overdue information
                    overdueAmount: overdueAmount,
                    missedPayments: missedPayments
                },
            });

            return NextResponse.json({ message: 'Repayment deleted successfully' });
        }
        else if (body.repaymentIds && Array.isArray(body.repaymentIds)) {
            // Get all repayments to calculate amount adjustment and get their payment schedules
            const repayments = await prismaAny.repayment.findMany({
                where: {
                    id: { in: body.repaymentIds },
                    loanId: loanId
                }
            });

            if (repayments.length === 0) {
                return NextResponse.json(
                    { error: 'No valid repayments found' },
                    { status: 404 }
                );
            }

            // Collect periods for repayments that have them
            const periods = repayments
                .filter((r: any) => r.period)
                .map((r: any) => r.period);

            // Get the loan to update remaining amount
            const loan = await prismaAny.loan.findUnique({
                where: { id: loanId }
            });

            if (!loan) {
                return NextResponse.json(
                    { error: 'Loan not found' },
                    { status: 404 }
                );
            }

            // Calculate amount to add back to remaining amount (only for full payments)
            const amountToAddBack = repayments
                .filter((r: any) => r.paymentType === 'full')
                .reduce((sum: number, r: any) => sum + r.amount, 0);

            // First delete the repayments
            await prismaAny.repayment.deleteMany({
                where: {
                    id: { in: body.repaymentIds },
                    loanId: loanId
                }
            });

            // No need to reset payment schedule statuses as they've been removed

            // Calculate new overdue amount after deletion
            const { overdueAmount, missedPayments } = await calculateOverdueAmount(loanId);

            // Recalculate the next payment date regardless of whether the repayments had periods or payment schedules
            let nextPaymentDate;
            try {
                // We need to recalculate the next payment date since payments were deleted
                nextPaymentDate = await calculateNextPaymentDate(loanId);
            } catch (error) {
                console.error('Error recalculating next payment date:', error);
                // Continue even if calculation fails
                nextPaymentDate = loan.nextPaymentDate;
            }

            // Update the loan with new values
            await prismaAny.loan.update({
                where: { id: loanId },
                data: {
                    remainingAmount: loan.remainingAmount + amountToAddBack,
                    // Update status back to Active if it was Completed
                    status: 'Active',
                    // Update next payment date with the recalculated value
                    nextPaymentDate: nextPaymentDate,
                    // Update overdue information
                    overdueAmount: overdueAmount,
                    missedPayments: missedPayments
                },
            });

            return NextResponse.json({
                message: `${repayments.length} repayments deleted successfully`
            });
        }
        else {
            return NextResponse.json(
                { error: 'No repayment ID or IDs provided' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Error deleting repayment(s):', error);
        return NextResponse.json(
            { error: 'Failed to delete repayment(s)' },
            { status: 500 }
        );
    }
}