import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';
import { getTransactionClass, getTransactionPartnerId } from '../../../lib/transactionHelpers';
import { TRANSACTION_TYPES_CONFIG } from '../../../config/config';
import { generatePaymentSchedule, calculateNextPaymentDate } from '../../../lib/paymentSchedule';

// GET /api/loans - List all loans
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const status = searchParams.get('status');
    const searchTerm = searchParams.get('search');

    const skip = (page - 1) * pageSize;
    const where: any = {
      createdById: currentUserId,
      ...(status && { status }),
    };

    // Add search filter if provided
    if (searchTerm) {
      where.borrower = {
        name: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      };
    }

    const [loans, totalCount] = await Promise.all([
      prisma.loan.findMany({
        where,
        include: {
          borrower: true,
          _count: { select: { repayments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.loan.count({ where }),
    ]);

    return NextResponse.json({
      loans,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    });
  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loans' },
      { status: 500 }
    );
  }
}

// POST /api/loans - Create new loan
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      borrowerId,
      loanType,
      amount,
      interestRate,
      documentCharge = 0,
      duration,
      disbursementDate,
      repaymentType,
      purpose,
      partnerId, // Partner disbursing the loan
    } = body;

    // Validate required fields
    if (!borrowerId || !amount || !duration || !disbursementDate || !partnerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const loan = await prisma.$transaction(async (tx) => {
      // Calculate amounts
      const loanAmount = parseFloat(amount);
      const docCharge = parseFloat(documentCharge || 0);
      const actualDisbursementAmount = loanAmount - docCharge;

      // Calculate installment amount for monthly loans
      let installmentAmount = 0;
      if (repaymentType === 'Monthly') {
        const rate = parseFloat(interestRate || 0);
        installmentAmount = (loanAmount / duration) + rate;
      }

      // Create loan record first (without nextPaymentDate, we'll calculate it after)
      const newLoan = await tx.loan.create({
        data: {
          borrowerId: parseInt(borrowerId),
          loanType: loanType || 'Personal',
          amount: loanAmount,
          interestRate: parseFloat(interestRate || 0),
          documentCharge: docCharge,
          duration: parseInt(duration),
          disbursementDate: new Date(disbursementDate),
          repaymentType,
          remainingAmount: loanAmount,
          installmentAmount,
          purpose,
          createdById: currentUserId,
        },
        include: { borrower: true },
      });

      // Calculate next payment date using loanId
      const nextPaymentDate = await calculateNextPaymentDate(newLoan.id, tx);
      
      //Update loan with nextPaymentDate
      if (nextPaymentDate) {
        await tx.loan.update({
          where: { id: newLoan.id },
          data: { nextPaymentDate },
        });
      }

      // Create LOAN_DISBURSEMENT transaction
      const disbursementTransaction = await tx.transaction.create({
        data: {
          type: TRANSACTION_TYPES_CONFIG.LOAN_DISBURSEMENT,
          amount: actualDisbursementAmount,
          transactionClass: 'DEBIT',
          partnerId: parseInt(partnerId),
          date: new Date(disbursementDate),
          note: `Loan disbursement to ${newLoan.borrower.name}`,
          createdById: currentUserId,
        },
      });

      // Link loan to disbursement transaction
      await tx.loan.update({
        where: { id: newLoan.id },
        data: { transactionId: disbursementTransaction.id },
      });

      // Update partner balance (debit)
      await tx.partnerBalance.upsert({
        where: {
          partnerId_createdById: {
            partnerId: parseInt(partnerId),
            createdById: currentUserId,
          },
        },
        create: {
          partnerId: parseInt(partnerId),
          balance: -actualDisbursementAmount,
          createdById: currentUserId,
          lastTransactionId: disbursementTransaction.id,
        },
        update: {
          balance: { decrement: actualDisbursementAmount },
          lastTransactionId: disbursementTransaction.id,
          lastUpdated: new Date(),
        },
      });

      // If there's a document charge, create another transaction
      if (docCharge > 0) {
        // Create Repayment for Document Charge to link it to the Loan
        const docChargeRepayment = await tx.repayment.create({
          data: {
             amount: docCharge,
             paidDate: new Date(disbursementDate),
             period: 0, // 0 for document charges/upfront fees
             loanId: newLoan.id,
             paymentType: 'DOCUMENT_CHARGE',
             createdById: currentUserId,
          }
        });

        // Create transaction linked to this Repayment
        const docChargeTransaction = await tx.transaction.create({
          data: {
            type: TRANSACTION_TYPES_CONFIG.DOCUMENT_CHARGE,
            amount: docCharge,
            transactionClass: 'CREDIT',
            partnerId: parseInt(partnerId),
            date: new Date(disbursementDate),
            note: `Document charge for loan to ${newLoan.borrower.name}`,
            createdById: currentUserId,
          },
        });
        
        // Link repayment to transaction
        await tx.repayment.update({
            where: { id: docChargeRepayment.id },
            data: { transactionId: docChargeTransaction.id }
        });

        // Update partner balance (credit)
        await tx.partnerBalance.update({
          where: {
            partnerId_createdById: {
              partnerId: parseInt(partnerId),
              createdById: currentUserId,
            },
          },
          data: {
            balance: { increment: docCharge },
            lastTransactionId: docChargeTransaction.id,
            lastUpdated: new Date(),
          },
        });
      }

      // Generate payment schedules (async function)
      const schedules = await generatePaymentSchedule(newLoan.id, newLoan, tx);
      if (schedules && schedules.length > 0) {
        await tx.paymentSchedule.createMany({
          data: schedules.map((schedule) => ({
            loanId: newLoan.id,
            period: schedule.period,
            dueDate: schedule.dueDate,
            amount: schedule.amount,
            status: schedule.status,
          })),
        });
      }

      return newLoan;
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
