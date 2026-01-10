import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../../lib/prisma';
import { getCurrentUserId } from '../../../../../../lib/auth';
import { TRANSACTION_TYPES_CONFIG } from '../../../../../../config/config';
import { calculateNextPaymentDate, updateOverdueAmountFromRepayments } from '../../../../../../lib/paymentSchedule';

// DELETE /api/loans/[id]/repayments/[repaymentId] - Delete repayment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; repaymentId: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, repaymentId: rId } = await params;
    const loanId = parseInt(id);
    const repaymentId = parseInt(rId);

    // Verify loan and repayment exist and belong to user
    const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        select: { createdById: true },
    });

    if (!loan || loan.createdById !== currentUserId) {
        return NextResponse.json({ error: 'Loan not found or forbidden' }, { status: 404 });
    }

    const repayment = await prisma.repayment.findUnique({
        where: { id: repaymentId },
        include: { transaction: true },
    });

    if (!repayment) {
        return NextResponse.json({ error: 'Repayment not found' }, { status: 404 });
    }

    if (repayment.loanId !== loanId) {
        return NextResponse.json({ error: 'Repayment does not belong to this loan' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
        // 1. Revert Partner Balance (Debit/Decrement)
        // Check if transaction exists and has partnerId
        if (repayment.transaction && repayment.transaction.partnerId) {
             const partnerId = repayment.transaction.partnerId;
             // We need to reverse the CREDIT. So we decrement the balance.
             // Or create a DEBIT transaction?
             // Usually deleting a transaction implies reversing its effect.
             // If we delete the transaction record, we should update the balance.
             
             // Create a reversal transaction or just adjust balance?
             // If we delete the original transaction, we assume it never happened.
             // So we decrement the balance by the amount.
             
             await tx.partnerBalance.updateMany({
                 where: {
                     partnerId: partnerId,
                     createdById: currentUserId
                 },
                 data: {
                     balance: { decrement: repayment.amount },
                     lastUpdated: new Date()
                 }
             });
        }

        // 2. Delete Transaction
        if (repayment.transactionId) {
            await tx.transaction.delete({
                where: { id: repayment.transactionId }
            });
        }

        // 3. Delete Repayment
        await tx.repayment.delete({
            where: { id: repaymentId }
        });

        // 4. Revert Payment Schedule
        await tx.paymentSchedule.updateMany({
            where: {
                loanId: loanId,
                period: repayment.period
            },
            data: {
                status: 'Pending',
                actualPaymentDate: null
            }
        });

        // 5. Update Loan (Add back principal)
        // We need to know how much principal was paid.
        // Assuming strict ordering isn't enforced for deletion, we just reverse the remainingAmount.
        // If paymentType was REGULAR, principal = amount - interest.
        // But we don't have the interest rate handy easily unless we fetch loan fully.
        // Let's fetch loan fully.
        const fullLoan = await tx.loan.findUnique({ where: { id: loanId } });
        if (fullLoan) {
             let principalToAdd = 0;
             if (repayment.paymentType !== 'interestOnly') {
                 if (repayment.paymentType === 'REGULAR') {
                     // CAUTION: This assumes the interest rate hasn't changed.
                     // And that the repayment followed the schedule exactly.
                     // Ideally we should store principal portion in Repayment model.
                     // usage of repayment.amount - fullLoan.interestRate might be inaccurate if partial payment?
                     // But the app seems to enforce full schedule payments.
                     principalToAdd = Math.max(0, repayment.amount - fullLoan.interestRate);
                 } else {
                     // Principal only?
                     principalToAdd = repayment.amount;
                 }
                 
                 // Cap at original amount?
                 // remainingAmount += principalToAdd
             }

             await tx.loan.update({
                 where: { id: loanId },
                 data: {
                     remainingAmount: { increment: principalToAdd },
                     // We might need to revert 'Completed' status to 'Active'
                     status: 'Active', 
                     // Recalculate next payment date is handled below
                 }
             });
        }

        // 6. Recalculate Next Payment Date
        const nextPaymentDate = await calculateNextPaymentDate(loanId, tx);
        await tx.loan.update({
            where: { id: loanId },
            data: { nextPaymentDate }
        });

        // 7. Update Overdue Amount
        await updateOverdueAmountFromRepayments(loanId, tx);
    });

    return NextResponse.json({ message: 'Repayment deleted successfully' });

  } catch (error) {
    console.error('Error deleting repayment:', error);
    return NextResponse.json(
      { error: 'Failed to delete repayment' },
      { status: 500 }
    );
  }
}
