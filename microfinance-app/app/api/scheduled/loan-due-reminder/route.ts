import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { notifyAllOrgUsers } from '../../../../lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const internalKey = process.env.INTERNAL_API_KEY || 'default-internal-key';

    if (authHeader !== `Bearer ${internalKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const loans = await prisma.loan.findMany({
      where: {
        status: 'Active',
        nextPaymentDate: {
          gte: tomorrow,
          lt: dayAfterTomorrow,
        },
      },
      include: {
        createdBy: { select: { id: true, dataOwnerId: true } },
        borrower: { select: { name: true } },
      },
    });

    if (loans.length === 0) {
      return NextResponse.json({ message: 'No loans due tomorrow', notified: 0 });
    }

    let notifiedCount = 0;

    for (const loan of loans) {
      const orgOwnerId = loan.createdBy.dataOwnerId ?? loan.createdBy.id;
      const dueDate = loan.nextPaymentDate!.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      await notifyAllOrgUsers({
        orgOwnerId,
        actorId: loan.createdById,
        type: 'loan_due_reminder',
        title: 'Loan Payment Due Tomorrow',
        message: `Loan of ${loan.borrower.name} (₹${loan.installmentAmount.toLocaleString('en-IN')}) is due on ${dueDate}.`,
        link: `/loans/${loan.id}`,
      });

      notifiedCount++;
    }

    return NextResponse.json({
      message: `Loan due reminders sent for ${notifiedCount} loan(s)`,
      notified: notifiedCount,
    });
  } catch (error) {
    console.error('Error sending loan due reminders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
