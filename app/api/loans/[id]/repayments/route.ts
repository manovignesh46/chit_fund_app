import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Adjust the import based on your project structure

// Define interfaces for type safety
interface Repayment {
    id: number;
    loanId: number;
    amount: number;
    paidDate: Date;
    paymentType: string;
    createdAt: Date;
    updatedAt: Date;
}

interface Loan {
    id: number;
    remainingAmount: number;
    status: string;
}

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

export async function GET(
    request: NextRequest,
    context: { params: { id: string } }
) {
    try {
        const id = context.params.id;
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
            take: validPageSize,
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
    context: { params: { id: string } }
) {
    try {
        const id = context.params.id;
        const { amount, paidDate, paymentType = 'full' } = await request.json();
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

        // Use a transaction to ensure both operations succeed or fail together
        const result = await prismaAny.$transaction([
            // Create the repayment record
            prismaAny.repayment.create({
                data: {
                    loanId: loanId,
                    amount: paymentAmount,
                    paidDate: new Date(paidDate),
                    paymentType: isInterestOnly ? 'interestOnly' : 'full'
                },
            }),

            // Update the loan's remaining amount (only for full payments)
            prismaAny.loan.update({
                where: { id: loanId },
                data: {
                    // Only update remaining amount for full payments
                    remainingAmount: newRemainingAmount,
                    // If fully paid, update the status
                    status: newRemainingAmount <= 0 ? 'Completed' : 'Active',
                    // Update next payment date (30 days from current payment)
                    nextPaymentDate: newRemainingAmount <= 0 ? null : (() => {
                        const nextDate = new Date(paidDate);
                        nextDate.setDate(nextDate.getDate() + 30);
                        return nextDate;
                    })(),
                },
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
    context: { params: { id: string } }
) {
    try {
        const id = context.params.id;
        const loanId = Number(id);
        const body = await request.json();

        // Check if we're deleting a single repayment or multiple
        if (body.repaymentId) {
            // Get the repayment to check if it's a full payment
            const repayment = await prismaAny.repayment.findUnique({
                where: { id: body.repaymentId }
            });

            if (!repayment) {
                return NextResponse.json(
                    { error: 'Repayment not found' },
                    { status: 404 }
                );
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

            // Use a transaction to ensure both operations succeed or fail together
            await prismaAny.$transaction([
                // Delete the repayment
                prismaAny.repayment.delete({
                    where: { id: body.repaymentId }
                }),

                // Update the loan's remaining amount if it was a full payment
                prismaAny.loan.update({
                    where: { id: loanId },
                    data: {
                        remainingAmount: newRemainingAmount,
                        // Update status back to Active if it was Completed
                        status: 'Active',
                    },
                }),
            ]);

            return NextResponse.json({ message: 'Repayment deleted successfully' });
        }
        else if (body.repaymentIds && Array.isArray(body.repaymentIds)) {
            // Get all repayments to calculate amount adjustment
            const repayments: Repayment[] = await prismaAny.repayment.findMany({
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

            // Get the loan to update remaining amount
            const loan: Loan = await prismaAny.loan.findUnique({
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
                .filter((r: Repayment) => r.paymentType === 'full')
                .reduce((sum: number, r: Repayment) => sum + r.amount, 0);

            // Use a transaction to ensure both operations succeed or fail together
            await prismaAny.$transaction([
                // Delete the repayments
                prismaAny.repayment.deleteMany({
                    where: {
                        id: { in: body.repaymentIds },
                        loanId: loanId
                    }
                }),

                // Update the loan's remaining amount
                prismaAny.loan.update({
                    where: { id: loanId },
                    data: {
                        remainingAmount: loan.remainingAmount + amountToAddBack,
                        // Update status back to Active if it was Completed
                        status: 'Active',
                    },
                }),
            ]);

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
