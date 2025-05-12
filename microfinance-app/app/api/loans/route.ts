import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId, isResourceOwner } from '@/lib/auth';
import { generatePaymentSchedule, calculateNextPaymentDate } from '@/lib/paymentSchedule';
import { apiCache } from '@/lib/cache';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '10');
        const status = searchParams.get('status') || null;

        // Validate pagination parameters
        const validPage = page > 0 ? page : 1;
        const validPageSize = pageSize > 0 ? pageSize : 10;

        // Calculate skip value for pagination
        const skip = (validPage - 1) * validPageSize;

        // Get the current user ID
        const currentUserId = getCurrentUserId(request);
        if (!currentUserId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Build where clause for filtering
        const where: any = {
            // Only show loans created by the current user
            createdById: currentUserId
        };

        if (status) {
            where.status = status;
        }

        // Get total count for pagination with filter
        const totalCount = await prismaAny.loan.count({
            where
        });

        // Get paginated loans with filter
        const loans = await prismaAny.loan.findMany({
            where,
            include: {
                _count: {
                    select: { repayments: true }
                },
                borrower: true
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: validPageSize,
        });

        return NextResponse.json({
            loans,
            totalCount,
            page: validPage,
            pageSize: validPageSize,
            totalPages: Math.ceil(totalCount / validPageSize)
        });
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
            // Get the current user ID for the global member creation
            const currentUserId = getCurrentUserId(request);
            if (!currentUserId) {
                return NextResponse.json(
                    { error: 'Authentication required' },
                    { status: 401 }
                );
            }

            // Create a new global member
            globalMember = await prismaAny.globalMember.create({
                data: {
                    name: body.borrowerName,
                    contact: body.contact,
                    email: body.email || null,
                    address: body.address || null,
                    notes: body.notes || null,
                    createdById: currentUserId,
                }
            });
        }

        // Parse the disbursement date
        const disbursementDate = new Date(body.disbursementDate);
        console.log('Creating loan with disbursement date:', disbursementDate);

        // Get the current user ID
        const currentUserId = getCurrentUserId(request);
        if (!currentUserId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Parse the disbursement date once
        const parsedDisbursementDate = new Date(body.disbursementDate);

        // Calculate initial next payment date based on disbursement date and repayment type
        const initialNextPaymentDate = new Date(parsedDisbursementDate);

        if (body.repaymentType === 'Monthly') {
            initialNextPaymentDate.setMonth(parsedDisbursementDate.getMonth() + 1);
        } else if (body.repaymentType === 'Weekly') {
            initialNextPaymentDate.setDate(parsedDisbursementDate.getDate() + 7);
        }

        // Create a loan data object with all fields
        const loanData = {
            borrowerId: globalMember.id,
            loanType: body.loanType,
            amount: parseFloat(body.amount),
            interestRate: parseFloat(body.interestRate),
            documentCharge: body.documentCharge ? parseFloat(body.documentCharge) : 0,
            installmentAmount: body.installmentAmount ? parseFloat(body.installmentAmount) : 0,
            duration: parseInt(body.duration),
            disbursementDate: parsedDisbursementDate,
            repaymentType: body.repaymentType,
            remainingAmount: parseFloat(body.amount), // Initially, remaining amount is the full loan amount
            status: body.status || 'Active',
            purpose: body.purpose || null,
            // Set the creator
            createdById: currentUserId,
            // Add the next payment date
            nextPaymentDate: initialNextPaymentDate
        };

        console.log('Creating loan with data:', loanData);

        // Create the loan
        const loan = await prismaAny.loan.create({
            data: loanData,
            include: {
                borrower: true
            }
        });

        // Generate payment schedule for the loan
        try {
            await generatePaymentSchedule(loan.id, loan);
            console.log('Payment schedule generated successfully for loan ID:', loan.id);
        } catch (scheduleError) {
            console.error('Error generating payment schedule:', scheduleError);
            // Continue even if schedule generation fails - we don't want to roll back the loan creation
        }

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

        // Get the current user ID
        const currentUserId = getCurrentUserId(request);
        if (!currentUserId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // First, get the current loan to find the borrower
        // Ensure id is a number
        const loanId = typeof body.id === 'string' ? parseInt(body.id, 10) : body.id;

        const currentLoan = await prismaAny.loan.findUnique({
            where: { id: loanId },
            include: { borrower: true }
        });

        if (!currentLoan) {
            return NextResponse.json(
                { error: 'Loan not found' },
                { status: 404 }
            );
        }

        // Check if the current user is the owner
        if (currentLoan.createdById !== currentUserId) {
            return NextResponse.json(
                { error: 'You do not have permission to update this loan' },
                { status: 403 }
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
            where: { id: loanId },
            data: {
                loanType: body.loanType,
                amount: body.amount ? parseFloat(body.amount) : undefined,
                interestRate: body.interestRate ? parseFloat(body.interestRate) : undefined,
                documentCharge: body.documentCharge !== undefined ? parseFloat(body.documentCharge) : undefined,
                installmentAmount: body.installmentAmount !== undefined ? parseFloat(body.installmentAmount) : undefined,
                duration: body.duration ? parseInt(body.duration) : undefined,
                disbursementDate: body.disbursementDate ? new Date(body.disbursementDate) : undefined,
                repaymentType: body.repaymentType,
                remainingAmount: body.remainingAmount ? parseFloat(body.remainingAmount) : undefined,
                status: body.status,
                purpose: body.purpose,
            },
            include: {
                borrower: true
            }
        });

        // Recalculate the next payment date based on the updated loan details
        try {
            const nextPaymentDate = await calculateNextPaymentDate(loanId);

            // Update the loan with the new next payment date
            await prismaAny.loan.update({
                where: { id: loanId },
                data: {
                    nextPaymentDate
                }
            });

            // Add the calculated next payment date to the response
            loan.nextPaymentDate = nextPaymentDate;
        } catch (error) {
            console.error('Error calculating next payment date:', error);
            // Continue even if next payment date calculation fails
        }

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

        // Get the current user ID
        const currentUserId = getCurrentUserId(request);
        if (!currentUserId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Ensure id is a number
        const loanId = typeof id === 'string' ? parseInt(id, 10) : id;

        // Check if the loan exists and belongs to the current user
        const existingLoan = await prismaAny.loan.findUnique({
            where: { id: loanId },
            select: { createdById: true }
        });

        if (!existingLoan) {
            return NextResponse.json(
                { error: 'Loan not found' },
                { status: 404 }
            );
        }

        // Check if the current user is the owner
        if (existingLoan.createdById !== currentUserId) {
            return NextResponse.json(
                { error: 'You do not have permission to delete this loan' },
                { status: 403 }
            );
        }

        // Delete related records first
        await prismaAny.repayment.deleteMany({
            where: { loanId: loanId },
        });

        // Delete payment schedules
        await prismaAny.paymentSchedule.deleteMany({
            where: { loanId: loanId },
        });

        // Delete the loan
        await prismaAny.loan.delete({
            where: { id: loanId },
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