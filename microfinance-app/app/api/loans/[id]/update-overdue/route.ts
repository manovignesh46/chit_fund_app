import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateOverdueAmountFromRepayments } from '@/lib/paymentSchedule';
import { apiCache } from '@/lib/cache';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const loanId = Number(id);

        // Check if we should redirect back to the loan page
        const { searchParams } = new URL(request.url);
        const shouldRedirect = searchParams.get('redirect') === 'true';

        // Calculate overdue amount using our new function
        const result = await updateOverdueAmountFromRepayments(loanId);

        // If redirect parameter is true, redirect back to the loan page
        if (shouldRedirect) {
            return NextResponse.redirect(new URL(`/loans/${id}`, request.url));
        }

        // Otherwise return JSON response
        return NextResponse.json({
            message: 'Overdue amount updated successfully',
            loan: {
                id: loanId,
                overdueAmount: result.overdueAmount,
                missedPayments: result.missedPayments
            }
        });
    } catch (error) {
        console.error('Error updating overdue amount:', error);
        return NextResponse.json(
            { error: 'Failed to update overdue amount' },
            { status: 500 }
        );
    }
}
