import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const loans = await prisma.loan.findMany({
            include: {
                _count: {
                    select: { repayments: true }
                }
            }
        });
        return NextResponse.json(loans);
    } catch (error) {
        console.error('Error fetching loans:', error);
        return NextResponse.json(
            { error: 'Failed to fetch loans' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const requiredFields = ['borrowerName', 'contact', 'loanType', 'amount', 'interestRate', 'duration', 'disbursementDate', 'repaymentType'];
        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json(
                    { error: `${field} is required` },
                    { status: 400 }
                );
            }
        }

        // Create the loan
        const loan = await prisma.loan.create({
            data: {
                borrowerName: body.borrowerName,
                contact: body.contact,
                loanType: body.loanType,
                amount: parseFloat(body.amount),
                interestRate: parseFloat(body.interestRate),
                duration: parseInt(body.duration),
                disbursementDate: new Date(body.disbursementDate),
                repaymentType: body.repaymentType,
                remainingAmount: parseFloat(body.amount), // Initially, remaining amount is the full loan amount
                nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : null,
                status: body.status || 'Active',
                purpose: body.purpose || null,
            }
        });

        return NextResponse.json(loan, { status: 201 });
    } catch (error) {
        console.error('Error creating loan:', error);
        return NextResponse.json(
            { error: 'Failed to create loan' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { error: 'ID is required' },
                { status: 400 }
            );
        }

        const loan = await prisma.loan.update({
            where: { id: body.id },
            data: {
                borrowerName: body.borrowerName,
                contact: body.contact,
                loanType: body.loanType,
                amount: body.amount ? parseFloat(body.amount) : undefined,
                interestRate: body.interestRate ? parseFloat(body.interestRate) : undefined,
                duration: body.duration ? parseInt(body.duration) : undefined,
                disbursementDate: body.disbursementDate ? new Date(body.disbursementDate) : undefined,
                repaymentType: body.repaymentType,
                remainingAmount: body.remainingAmount ? parseFloat(body.remainingAmount) : undefined,
                nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : null,
                status: body.status,
                purpose: body.purpose,
            },
        });

        return NextResponse.json(loan);
    } catch (error) {
        console.error('Error updating loan:', error);
        return NextResponse.json(
            { error: 'Failed to update loan' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { error: 'ID is required' },
                { status: 400 }
            );
        }

        // Delete related records first
        await prisma.repayment.deleteMany({
            where: { loanId: id },
        });

        // Delete the loan
        await prisma.loan.delete({
            where: { id },
        });

        return NextResponse.json({ message: 'Loan deleted successfully' });
    } catch (error) {
        console.error('Error deleting loan:', error);
        return NextResponse.json(
            { error: 'Failed to delete loan' },
            { status: 500 }
        );
    }
}