import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';
import { calculateChitCommissionTrends } from '../../../../lib/chitCommission';

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const months = Number(new URL(request.url).searchParams.get('months') ?? 12);
    if (!Number.isInteger(months) || months < 1 || months > 24) {
      return NextResponse.json({ error: 'months must be an integer between 1 and 24' }, { status: 400 });
    }
    // Read schedules and records only; never update fund months or transactions.
    const funds = await prisma.chitFund.findMany({
      where: { createdById: currentUserId },
      select: {
        monthlyContribution: true, firstMonthContribution: true,
        membersCount: true, chitFundType: true, duration: true, currentMonth: true, status: true,
        fixedAmounts: { select: { month: true, amount: true } },
        contributions: { select: { amount: true, paidDate: true } },
        auctions: { select: { amount: true, month: true, date: true } },
      },
    });
    return NextResponse.json(calculateChitCommissionTrends(funds, months));
  } catch (error) {
    console.error('Error fetching monthly chit profit:', error);
    return NextResponse.json({ error: 'Failed to fetch monthly chit profit' }, { status: 500 });
  }
}
