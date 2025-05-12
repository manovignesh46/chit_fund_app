import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Adjust the import based on your project structure
import { apiCache } from '@/lib/cache';

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


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const loan = await prismaAny.loan.findUnique({
            where: { id: Number(id) },
            include: {
                borrower: true
            }
        });

        // If installmentAmount is 0 or null, calculate it based on loan details
        if (loan && (!loan.installmentAmount || loan.installmentAmount === 0)) {
            // Calculate installment amount
            let installmentAmount = 0;

            if (loan.repaymentType === 'Monthly') {
                // For monthly loans: Principal/Duration + Interest
                const principalPerMonth = loan.amount / loan.duration;
                installmentAmount = principalPerMonth + loan.interestRate;
            } else {
                // For weekly loans: Principal/(Duration-1)
                const effectiveDuration = Math.max(1, loan.duration - 1);
                installmentAmount = loan.amount / effectiveDuration;
            }

            // Update the loan with the calculated installment amount
            await prismaAny.loan.update({
                where: { id: Number(id) },
                data: {
                    installmentAmount: installmentAmount
                }
            });

            // Update the loan object with the calculated value
            loan.installmentAmount = installmentAmount;
        }

        if (!loan) {
            return NextResponse.json({ message: 'Loan not found' }, { status: 404 });
        }

        return NextResponse.json(loan);
    } catch (error) {
        return NextResponse.json({ message: 'Error retrieving loan' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Extract and validate the ID parameter
        let id;
        try {
            const paramsObj = await params;
            id = paramsObj.id;
            console.log('Received update request for loan ID:', id);

            if (!id) {
                return NextResponse.json({
                    message: 'Missing ID parameter',
                    details: 'Loan ID is required'
                }, { status: 400 });
            }
        } catch (paramError) {
            console.error('Error extracting params:', paramError);
            return NextResponse.json({
                message: 'Invalid request parameters',
                details: 'Could not extract loan ID from request'
            }, { status: 400 });
        }

        // Safely parse the request body
        let data;
        try {
            const bodyText = await request.text();
            console.log('Request body text:', bodyText);

            if (!bodyText) {
                return NextResponse.json({
                    message: 'Empty request body',
                    details: 'Request body cannot be empty'
                }, { status: 400 });
            }

            data = JSON.parse(bodyText);
            console.log('Parsed request data:', data);
        } catch (e) {
            console.error('Error parsing request body:', e);
            return NextResponse.json({
                message: 'Invalid request body',
                details: 'Could not parse JSON body'
            }, { status: 400 });
        }

        // Validate the data
        if (data.currentMonth === undefined) {
            return NextResponse.json({
                message: 'Missing required field',
                details: 'currentMonth field is required'
            }, { status: 400 });
        }

        // Convert to number if it's a string
        const currentMonth = typeof data.currentMonth === 'string'
            ? parseInt(data.currentMonth, 10)
            : data.currentMonth;

        if (isNaN(currentMonth) || currentMonth < 0) {
            return NextResponse.json({
                message: 'Invalid currentMonth value',
                details: `currentMonth must be a non-negative number, received: ${data.currentMonth}`
            }, { status: 400 });
        }

        // Validate that currentMonth doesn't exceed duration
        try {
            const existingLoan = await prismaAny.loan.findUnique({
                where: { id: Number(id) }
            });

            if (existingLoan && currentMonth > existingLoan.duration) {
                return NextResponse.json({
                    message: 'Invalid currentMonth value',
                    details: `currentMonth (${currentMonth}) cannot exceed loan duration (${existingLoan.duration})`
                }, { status: 400 });
            }

            // For future disbursement dates, ensure currentMonth is 0
            if (existingLoan) {
                const disbursementDate = new Date(existingLoan.disbursementDate);
                const currentDate = new Date();

                if (disbursementDate > currentDate && currentMonth > 0) {
                    console.log('Warning: Setting currentMonth to 0 for future disbursement date');
                    // For future disbursement dates, force currentMonth to 0
                    data.currentMonth = 0;
                }
            }
        } catch (error) {
            console.error('Error validating currentMonth against loan duration:', error);
            // Continue with the update even if this validation fails
        }

        // Validate the loan exists
        let existingLoan;
        try {
            existingLoan = await prismaAny.loan.findUnique({
                where: { id: Number(id) }
            });

            console.log('Found existing loan:', existingLoan ? 'Yes' : 'No');

            if (!existingLoan) {
                return NextResponse.json({
                    message: 'Loan not found',
                    details: `No loan found with ID ${id}`
                }, { status: 404 });
            }
        } catch (findError) {
            console.error('Error finding loan:', findError);
            return NextResponse.json({
                message: 'Database query failed',
                details: 'Error finding loan in database'
            }, { status: 500 });
        }

        // Log the update operation for debugging
        console.log(`Updating loan ${id} with currentMonth:`, currentMonth);

        try {
            // Use the potentially modified data.currentMonth value
            const finalCurrentMonth = data.currentMonth !== undefined ? data.currentMonth : currentMonth;

            console.log(`Updating loan ${id} with final currentMonth:`, finalCurrentMonth);

            // Calculate overdue amount based on the new current month
            const { overdueAmount, missedPayments } = await calculateOverdueAmount(Number(id));

            console.log(`Calculated overdue amount: ${overdueAmount}, missed payments: ${missedPayments}`);

            // Perform the update with currentMonth and overdue information
            const updatedLoan = await prismaAny.loan.update({
                where: { id: Number(id) },
                data: {
                    currentMonth: finalCurrentMonth,
                    overdueAmount: overdueAmount,
                    missedPayments: missedPayments
                },
                include: {
                    borrower: true
                }
            });

            console.log('Loan updated successfully:', updatedLoan);

            return NextResponse.json(updatedLoan);
        } catch (updateError) {
            console.error('Database update error:', updateError);
            return NextResponse.json({
                message: 'Database update failed',
                details: updateError instanceof Error ? updateError.message : 'Unknown database error'
            }, { status: 500 });
        }
    } catch (error) {
        console.error('Error updating loan:', error);
        return NextResponse.json({
            message: 'Error updating loan',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await prismaAny.loan.delete({
            where: { id: Number(id) },
        });

        return NextResponse.json({ message: 'Loan deleted successfully' });
    } catch (error) {
        return NextResponse.json({ message: 'Error deleting loan' }, { status: 500 });
    }
}