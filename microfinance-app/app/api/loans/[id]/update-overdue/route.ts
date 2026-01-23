import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '../../../../../lib/auth';
import { updateOverdueAmountFromRepayments } from '../../../../../lib/paymentSchedule';
import prisma from '../../../../../lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const loanId = parseInt(id);

    // Verify loan belongs to user
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { createdById: true },
    });

    if (!loan || loan.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Loan not found or forbidden' }, { status: 404 });
    }

    await updateOverdueAmountFromRepayments(loanId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating overdue amount:', error);
    return NextResponse.json(
      { error: 'Failed to update overdue amount' },
      { status: 500 }
    );
  }
}
