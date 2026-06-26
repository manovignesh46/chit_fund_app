import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';

// Commission per auction = (monthlyContribution × memberCount) − auctionPayout
// Grouped by calendar month across all chit funds the user manages.

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const months = Math.min(parseInt(searchParams.get('months') || '12', 10), 24);

    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    // Fetch auctions with their chit fund details.
    // Use the stored membersCount field — the same field the profit formula uses.
    // _count.members counts relation rows which can differ from membersCount.
    const auctions = await prisma.auction.findMany({
      where: {
        chitFund: { createdById: currentUserId },
        date: { gte: since },
      },
      select: {
        amount: true,
        date: true,
        chitFund: {
          select: {
            monthlyContribution: true,
            membersCount: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Build month-keyed map
    const map: Record<string, { year: number; month: number; commission: number; auctionCount: number }> = {};

    for (const auction of auctions) {
      const d = new Date(auction.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const memberCount = auction.chitFund.membersCount;
      const pot = auction.chitFund.monthlyContribution * memberCount;
      const commission = pot - (auction.amount || 0);

      if (!map[key]) {
        map[key] = { year: d.getFullYear(), month: d.getMonth() + 1, commission: 0, auctionCount: 0 };
      }
      map[key].commission += commission > 0 ? commission : 0;
      map[key].auctionCount += 1;
    }

    // Fill in zero-commission months so the chart has a complete grid
    const result = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result.push({
        key,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label:
          d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            ? 'This month'
            : d.toLocaleString('default', { month: 'short' }) +
              (d.getFullYear() !== now.getFullYear()
                ? ` '${String(d.getFullYear()).slice(2)}`
                : ''),
        commission: map[key]?.commission ?? 0,
        auctionCount: map[key]?.auctionCount ?? 0,
      });
    }

    return NextResponse.json({ months: result });
  } catch (error) {
    console.error('Error fetching monthly chit profit:', error);
    return NextResponse.json({ error: 'Failed to fetch monthly chit profit' }, { status: 500 });
  }
}
