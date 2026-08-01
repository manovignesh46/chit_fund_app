import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const auctions = await prisma.auction.findMany({
      where: {
        chitFund: { createdById: currentUserId },
      },
      include: {
        chitFund: { select: { id: true, name: true, status: true } },
        winner: { include: { globalMember: true } },
      },
      orderBy: { date: 'desc' },
    });

    const rows = auctions.map((a) => ({
      chitFundId: a.chitFundId,
      fundName: a.chitFund.name,
      fundStatus: a.chitFund.status,
      amount: a.amount,
      date: a.date,
      memberName: a.winner.globalMember.name,
      fundMonth: a.month,
    }));

    return NextResponse.json({ auctions: rows });
  } catch (error) {
    console.error('Error fetching auction history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auction history' },
      { status: 500 }
    );
  }
}
