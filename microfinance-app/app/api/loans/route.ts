import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

export async function GET() {
    try {
        const loans = await prismaAny.loan.findMany({
            include: {
                _count: {
                    select: { repayments: true }
                },
                borrower: true
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

        // First, find or create a global member
        let globalMember;

        if (body.globalMemberId) {
            // Use existing global member
            globalMember = await prismaAny.globalMember.findUnique({
                where: { id: body.globalMemberId }
            });

            if (!globalMember) {
                return NextResponse.json(
                    { error: 'Global member not found' },
                    { status: 404 }
                );
            }
        } else {
            // Create a new global member
            globalMember = await prismaAny.globalMember.create({
                data: {
                    name: body.borrowerName,
                    contact: body.contact,
                    email: body.email || null,
                    address: body.address || null,
                    notes: body.notes || null,
                }
            });
        }

        // Parse the disbursement date
        const disbursementDate = new Date(body.disbursementDate);
        console.log('Creating loan with disbursement date:', disbursementDate);

        // Create a loan data object without the problematic fields
        const loanData = {
            borrowerId: globalMember.id,
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
        };

        console.log('Creating loan with data:', loanData);

        // Create the loan
        const loan = await prismaAny.loan.create({
            data: loanData,
            include: {
                borrower: true
            }
        });

        return NextResponse.json(loan, { status: 201 });
    } catch (error) {
        console.error('Error creating loan:', error);

        // Provide more detailed error information
        let errorMessage = 'Failed to create loan';
        let errorDetails = '';

        if (error instanceof Error) {
            errorMessage = error.message;
            errorDetails = error.stack || '';
            console.error('Full error object:', error);
        }

        // Check for specific Prisma errors
        if (errorMessage.includes('Prisma')) {
            if (errorMessage.includes('Foreign key constraint failed')) {
                errorMessage = 'Invalid relationship reference';
            } else if (errorMessage.includes('Unique constraint failed')) {
                errorMessage = 'Duplicate record found';
            } else if (errorMessage.includes('Unknown arg')) {
                errorMessage = 'Schema mismatch - please contact support';
                // This is likely due to a mismatch between the schema and the generated client
                console.error('Schema mismatch detected. The Prisma client may need to be regenerated.');
            }
        }

        return NextResponse.json(
            {
                error: errorMessage,
                details: errorDetails
            },
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

        // First, get the current loan to find the borrower
        const currentLoan = await prismaAny.loan.findUnique({
            where: { id: body.id },
            include: { borrower: true }
        });

        if (!currentLoan) {
            return NextResponse.json(
                { error: 'Loan not found' },
                { status: 404 }
            );
        }

        // Update the global member if needed
        if (body.borrowerName || body.contact) {
            await prismaAny.globalMember.update({
                where: { id: currentLoan.borrowerId },
                data: {
                    name: body.borrowerName || currentLoan.borrower.name,
                    contact: body.contact || currentLoan.borrower.contact,
                    email: body.email !== undefined ? body.email : currentLoan.borrower.email,
                    address: body.address !== undefined ? body.address : currentLoan.borrower.address,
                }
            });
        }

        // Update the loan
        const loan = await prismaAny.loan.update({
            where: { id: body.id },
            data: {
                loanType: body.loanType,
                amount: body.amount ? parseFloat(body.amount) : undefined,
                interestRate: body.interestRate ? parseFloat(body.interestRate) : undefined,
                documentCharge: body.documentCharge !== undefined ? parseFloat(body.documentCharge) : undefined,
                duration: body.duration ? parseInt(body.duration) : undefined,
                disbursementDate: body.disbursementDate ? new Date(body.disbursementDate) : undefined,
                repaymentType: body.repaymentType,
                remainingAmount: body.remainingAmount ? parseFloat(body.remainingAmount) : undefined,
                nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : null,
                status: body.status,
                purpose: body.purpose,
            },
            include: {
                borrower: true
            }
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
        await prismaAny.repayment.deleteMany({
            where: { loanId: id },
        });

        // Delete the loan
        await prismaAny.loan.delete({
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