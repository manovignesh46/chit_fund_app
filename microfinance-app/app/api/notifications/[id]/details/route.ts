import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getCurrentUserId, getActorUserId } from '../../../../../lib/auth';

/**
 * GET /api/notifications/:id/details
 *
 * Returns the notification plus the current state of the record it refers to,
 * so the notification can be opened in place instead of navigating away.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actorUserId = await getActorUserId(request);
    const dataOwnerId = await getCurrentUserId(request);
    if (!actorUserId || !dataOwnerId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid notification id' }, { status: 400 });
    }

    // Recipients can only open their own notifications.
    const notification = await prisma.notification.findFirst({
      where: { id, userId: actorUserId },
      include: { actor: { select: { id: true, name: true } } },
    });
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    let transactions: any[] = [];
    let entityMissing = false;

    if (notification.entityType === 'transaction' && notification.entityId) {
      const details = (notification.details || {}) as { transactionIds?: unknown };
      const ids = Array.isArray(details.transactionIds)
        ? details.transactionIds.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20)
        : [notification.entityId];

      transactions = await prisma.transaction.findMany({
        where: { id: { in: ids }, createdById: dataOwnerId },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          note: true,
          from_partner: true,
          to_partner: true,
          entered_by: true,
          partnerBalance: true,
          totalBalance: true,
          createdAt: true,
        },
      });
      entityMissing = transactions.length === 0;
    }

    return NextResponse.json({ notification, transactions, entityMissing });
  } catch (error) {
    console.error('Error fetching notification details:', error);
    return NextResponse.json({ error: 'Failed to load notification details' }, { status: 500 });
  }
}
