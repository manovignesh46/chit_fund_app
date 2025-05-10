import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Adjust the import based on your project structure

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const repayments = await prismaAny.repayment.findMany({
            where: { loanId: Number(id) },
        });
        return NextResponse.json(repayments);
    } catch (error) {
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