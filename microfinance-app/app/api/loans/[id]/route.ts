import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Adjust the import based on your project structure

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

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

            // Perform the update with only the currentMonth field
            const updatedLoan = await prismaAny.loan.update({
                where: { id: Number(id) },
                data: {
                    currentMonth: finalCurrentMonth
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