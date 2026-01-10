import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';

// GET /api/loans/[id] - Get loan details
export async function GET(
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
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        borrower: true,
        repayments: {
          orderBy: [{ period: 'desc' }, { paidDate: 'desc' }],
        },
        paymentSchedules: {
          orderBy: { period: 'asc' },
        },
        transaction: true,  // Transaction now has single 'partner' relation
        _count: { select: { repayments: true } },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    if (loan.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(loan);
  } catch (error) {
    console.error('Error fetching loan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loan' },
      { status: 500 }
    );
  }
}

// PUT /api/loans/[id] - Update loan
export async function PUT(
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
    const body = await request.json();

    // Check if loan exists and belongs to user
    const existingLoan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { createdById: true },
    });

    if (!existingLoan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    if (existingLoan.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.nextPaymentDate && { nextPaymentDate: new Date(body.nextPaymentDate) }),
        ...(body.purpose && { purpose: body.purpose }),
      },
      include: {
        borrower: true,
        _count: { select: { repayments: true } },
      },
    });

    return NextResponse.json(updatedLoan);
  } catch (error) {
    console.error('Error updating loan:', error);
    return NextResponse.json(
      { error: 'Failed to update loan' },
      { status: 500 }
    );
  }
}

// DELETE /api/loans/[id] - Delete loan
export async function DELETE(
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

    // Check if loan exists and belongs to user
    const existingLoan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { createdById: true, status: true },
    });

    if (!existingLoan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    if (existingLoan.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete loan (cascades to repayments and payment schedules)
    await prisma.loan.delete({
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
