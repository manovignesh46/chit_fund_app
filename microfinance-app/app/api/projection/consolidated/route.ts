import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';
import { getCurrentTotalBalance } from '../../../../lib/balanceCalculator';
import {
  computeBaselineAndSimulated,
  computeUnbookedAuctionLiability,
} from '../../../../lib/consolidatedProjection';

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

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [activeLoans, activeChitFunds, openingBalance, completedAuctions, pastMonthClosingBalance] =
      await Promise.all([
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
        getCurrentTotalBalance(currentUserId),
        prisma.auction.findMany({
          where: {
            chitFund: {
              createdById: currentUserId,
              status: 'Active',
            },
          },
          include: {
            chitFund: { select: { id: true, name: true } },
            winner: { include: { globalMember: true } },
          },
        }),
        getCurrentTotalBalance(currentUserId, startOfCurrentMonth),
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

    const actualAuctions = completedAuctions.map((a) => ({
      chitFundId: a.chitFundId,
      fundName: a.chitFund.name,
      amount: a.amount,
      date: a.date,
      memberName: a.winner.globalMember.name,
      fundMonth: a.month,
      winnerId: a.winnerId,
    }));

    const { projection, simulatedProjection } = computeBaselineAndSimulated(
      activeLoans,
      chitFundsInput,
      { actualAuctions, openingBalance, pastMonthClosingBalance, simulation }
    );

    // Single source of truth for both the unbooked head count and what those
    // members will still cost, so the summary cards can never disagree.
    const unbookedLiability = computeUnbookedAuctionLiability(
      chitFundsInput,
      actualAuctions
    );
    const liabilityByFundId = new Map(
      unbookedLiability.byFund.map((f) => [f.fundId, f])
    );

    const chitFundsWithBookingStatus = activeChitFunds.map((f) => {
      const liability = liabilityByFundId.get(f.id);
      return {
        id: f.id,
        name: f.name,
        monthlyContribution: f.monthlyContribution,
        duration: f.duration,
        currentMonth: f.currentMonth,
        startDate: f.startDate,
        totalMembers: f.members.length,
        unbookedCount: liability?.unbookedCount ?? 0,
        unbookedAmount: liability?.amount ?? 0,
      };
    });

    return NextResponse.json({
      projection,
      simulatedProjection,
      openingBalance,
      chitFunds: chitFundsWithBookingStatus,
      unbookedLiability,
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
