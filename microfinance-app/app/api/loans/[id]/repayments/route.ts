import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getCurrentUserId } from '../../../../../lib/auth';
import { TRANSACTION_TYPES_CONFIG } from '../../../../../config/config';
import { calculateNextPaymentDate, updateOverdueAmountFromRepayments } from '../../../../../lib/paymentSchedule';

// GET /api/loans/[id]/repayments - List repayments for a loan
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

    // Verify loan belongs to user
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { createdById: true },
    });

    if (!loan || loan.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const skip = (page - 1) * pageSize;

    const [repayments, totalCount] = await Promise.all([
      prisma.repayment.findMany({
        where: { loanId },
        include: {
          transaction: true,  // Transaction relation
        },
        orderBy: [{ period: 'desc' }, { paidDate: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.repayment.count({ where: { loanId } }),
    ]);

    return NextResponse.json({
      repayments,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    });
  } catch (error) {
    console.error('Error fetching repayments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repayments' },
      { status: 500 }
    );
  }
}

// POST /api/loans/[id]/repayments - Add repayment
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
    const body = await request.json();
    const { amount, paidDate, period, paymentType = 'REGULAR', partnerId } = body;

    // Validate required fields
    // Amount is optional for interestOnly payments as it falls back to loan interest rate
    if ((!amount && paymentType !== 'interestOnly' && paymentType !== 'InterestOnly') || !paidDate || !period || !partnerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify loan belongs to user
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { borrower: true },
    });

    if (!loan || loan.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    // Determine final amount
    let finalAmount = amount ? parseFloat(amount) : 0;
    
    if ((paymentType === 'interestOnly' || paymentType === 'InterestOnly') && !amount) {
        if (!loan.interestRate) {
             return NextResponse.json({ error: 'Loan does not have an interest rate defined' }, { status: 400 });
        }
        finalAmount = loan.interestRate;
    }

    const repayment = await prisma.$transaction(async (tx) => {
      // Create repayment transaction
      const transaction = await tx.transaction.create({
        data: {
          type: TRANSACTION_TYPES_CONFIG.LOAN_REPAYMENT,
          amount: finalAmount,
          transactionClass: 'CREDIT',
          partnerId: parseInt(partnerId),
          date: new Date(paidDate),
          note: `Loan repayment from ${loan.borrower.name} - Period ${period}`,
          createdById: currentUserId,
        },
      });

      // Update partner balance (credit)
      await tx.partnerBalance.upsert({
        where: {
          partnerId_createdById: {
            partnerId: parseInt(partnerId),
            createdById: currentUserId,
          },
        },
        create: {
          partnerId: parseInt(partnerId),
          balance: finalAmount,
          createdById: currentUserId,
          lastTransactionId: transaction.id,
        },
        update: {
          balance: { increment: finalAmount },
          lastTransactionId: transaction.id,
          lastUpdated: new Date(),
        },
      });

      // Create repayment record
      const newRepayment = await tx.repayment.create({
        data: {
          amount: finalAmount,
          paidDate: new Date(paidDate),
          period: parseInt(period),
          loanId,
          paymentType,
          createdById: currentUserId,
          transactionId: transaction.id,
        },
        include: {
          transaction: true,  // Transaction relation
        },
      });

      // Update loan based on repayment
      let remainingAmount = loan.remainingAmount;
      let currentMonth = loan.currentMonth;

      // Only reduce remaining amount for non-interest-only payments
      if (paymentType !== 'interestOnly') {
        const principalPaid = paymentType === 'REGULAR' 
          ? finalAmount - loan.interestRate 
          : finalAmount;
        remainingAmount = Math.max(0, loan.remainingAmount - principalPaid);
        currentMonth = parseInt(period);
      }

      // Calculate next payment date
      const nextPaymentDate = await calculateNextPaymentDate(loanId, tx);

      // Determine loan status
      const status = remainingAmount <= 0.01 ? 'Completed' : loan.status;

      // Update loan
      await tx.loan.update({
        where: { id: loanId },
        data: {
          remainingAmount,
          currentMonth,
          nextPaymentDate,
          status,
        },
      });

      // Update payment schedule status
      await tx.paymentSchedule.updateMany({
        where: {
          loanId,
          period: parseInt(period),
        },
        data: {
          status: 'Paid',
          actualPaymentDate: new Date(paidDate),
        },
      });

      // Update overdue amount
      await updateOverdueAmountFromRepayments(loanId, tx);

      return newRepayment;
    });

    return NextResponse.json(repayment, { status: 201 });
  } catch (error) {
    console.error('Error adding repayment:', error);
    return NextResponse.json(
      { error: 'Failed to add repayment' },
      { status: 500 }
    );
  }
}
