import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '../../../../lib/auth';
import { updateOverdueAmountFromRepayments } from '../../../../lib/paymentSchedule';
import prisma from '../../../../lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active loans for the user
    const loans = await prisma.loan.findMany({
      where: {
        createdById: currentUserId,
        status: 'Active',
      },
      select: { id: true },
    });

    // Update overdue amounts for all loans
    const results = await Promise.all(
      loans.map((loan) => updateOverdueAmountFromRepayments(loan.id))
    );

    return NextResponse.json({
      success: true,
      updatedCount: loans.length,
    });
  } catch (error) {
    console.error('Error updating all overdue amounts:', error);
    return NextResponse.json(
      { error: 'Failed to update overdue amounts' },
      { status: 500 }
    );
  }
}
