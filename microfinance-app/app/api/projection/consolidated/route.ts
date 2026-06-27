import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';
import { computeBaselineAndSimulated } from '../../../../lib/consolidatedProjection';

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const simulateFundId = searchParams.get('simulateFundId');
    const simulateFromYear = searchParams.get('simulateFromYear');
    const simulateFromMonth = searchParams.get('simulateFromMonth');
    const simulatedContribution = searchParams.get('simulatedContribution');

    const [activeLoans, activeChitFunds] = await Promise.all([
      prisma.loan.findMany({
        where: {
          createdById: currentUserId,
          status: 'Active',
        },
        select: {
          id: true,
          installmentAmount: true,
          disbursementDate: true,
          duration: true,
          repaymentType: true,
        },
      }),
      prisma.chitFund.findMany({
        where: {
          createdById: currentUserId,
          status: 'Active',
        },
        include: {
          members: true,
          fixedAmounts: true,
          auctionBookings: {
            include: {
              member: { include: { globalMember: true } },
            },
          },
        },
      }),
    ]);

    let simulation;
    if (simulateFundId && simulateFromYear && simulateFromMonth) {
      const fundId = parseInt(simulateFundId, 10);
      const fromYear = parseInt(simulateFromYear, 10);
      const fromMonth = parseInt(simulateFromMonth, 10);
      const fund = activeChitFunds.find((f) => f.id === fundId);
      if (fund && !isNaN(fromYear) && !isNaN(fromMonth)) {
        simulation = {
          fundId,
          fromYear,
          fromMonth,
          contribution: simulatedContribution
            ? parseFloat(simulatedContribution)
            : fund.monthlyContribution,
        };
      }
    }

    const chitFundsInput = activeChitFunds.map((f) => ({
      id: f.id,
      name: f.name,
      startDate: f.startDate,
      duration: f.duration,
      monthlyContribution: f.monthlyContribution,
      firstMonthContribution: f.firstMonthContribution,
      chitFundType: f.chitFundType,
      totalAmount: f.totalAmount,
      members: f.members,
      fixedAmounts: f.fixedAmounts.map((fa) => ({
        month: fa.month,
        amount: fa.amount,
      })),
      auctionBookings: f.auctionBookings.map((b) => ({
        month: b.month,
        memberId: b.memberId,
        memberName: b.member.globalMember.name,
      })),
    }));

    const { projection, simulatedProjection } = computeBaselineAndSimulated(
      activeLoans,
      chitFundsInput,
      simulation
    );

    return NextResponse.json({
      projection,
      simulatedProjection,
      chitFunds: activeChitFunds.map((f) => ({
        id: f.id,
        name: f.name,
        monthlyContribution: f.monthlyContribution,
        duration: f.duration,
        currentMonth: f.currentMonth,
        startDate: f.startDate,
      })),
      simulation: simulation || null,
    });
  } catch (error) {
    console.error('Error computing consolidated projection:', error);
    return NextResponse.json(
      { error: 'Failed to compute consolidated projection' },
      { status: 500 }
    );
  }
}
