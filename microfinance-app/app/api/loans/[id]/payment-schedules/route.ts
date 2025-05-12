import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDynamicPaymentSchedule, recordPaymentForPeriod, updateOverdueAmountFromRepayments } from '@/lib/paymentSchedule';
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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const status = searchParams.get('status');
    const includeAll = searchParams.get('includeAll') === 'true';

    // Validate pagination parameters
    const validPage = page > 0 ? page : 1;
    const validPageSize = pageSize > 0 ? pageSize : 10;

    // Use the new dynamic function to generate schedules
    const result = await getDynamicPaymentSchedule(Number(id), {
      page: validPage,
      pageSize: validPageSize,
      status: status || undefined,
      includeAll
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching payment schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment schedules' },
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
    const loanId = Number(id);
    const body = await request.json();
    const { action } = body;

    // Check what action to perform
    if (action === 'recordPayment') {
      // Record a payment for a specific period
      const { period, amount, paidDate, paymentType = 'full' } = body;

      if (!period || !amount || !paidDate) {
        return NextResponse.json(
          { error: 'Period, amount, and paidDate are required' },
          { status: 400 }
        );
      }

      try {
        console.log(`API: Recording payment for loan ${loanId}, period ${period}, amount ${amount}, type ${paymentType}`);

        // Record the payment
        const repayment = await recordPaymentForPeriod(
          loanId,
          Number(period),
          parseFloat(amount),
          paidDate,
          paymentType as 'full' | 'interestOnly'
        );

        console.log(`API: Payment recorded successfully for loan ${loanId}`);

        return NextResponse.json({
          message: 'Payment recorded successfully',
          repayment
        });
      } catch (error) {
        console.error('Error recording payment:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to record payment';
        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        );
      }
    } else if (action === 'updateOverdue') {
      // Update overdue amount for the loan
      try {
        const result = await updateOverdueAmountFromRepayments(loanId);

        return NextResponse.json({
          message: 'Overdue amount updated successfully',
          ...result
        });
      } catch (error) {
        console.error('Error updating overdue amount:', error);
        return NextResponse.json(
          { error: 'Failed to update overdue amount' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid action specified' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error managing payment schedule:', error);
    return NextResponse.json(
      { error: 'Failed to manage payment schedule' },
      { status: 500 }
    );
  }
}
