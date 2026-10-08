import { NextRequest, NextResponse } from "next/server";
import { getFundMonthCalendarDate } from "../../../../lib/monthlyAggregations";
import prisma from "../../../../lib/prisma";
import { getCurrentUserId } from "../../../../lib/auth";

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = new Date(searchParams.get("startDate") || "");
    const endDate = new Date(searchParams.get("endDate") || "");

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
      return NextResponse.json({ error: "A valid date range is required" }, { status: 400 });
    }
    endDate.setUTCHours(23, 59, 59, 999);

    // Get active chit funds
    const activeChitFunds = await prisma.chitFund.findMany({
      where: {
        createdById: currentUserId,
        status: "Active",
        startDate: {
          lte: endDate,
        },
      },
      include: {
        members: {
          include: {
            globalMember: {
              select: {
                name: true,
              },
            },
            contributions: true,
          },
        },
      },
    });

    // Calculate pending contributions grouped by chit fund
    const pendingChitFunds = activeChitFunds.map((chitFund) => {
      const monthlyContribution = chitFund.monthlyContribution || 0;
      const periodStart = new Date(startDate);
      const periodEnd = new Date(endDate);

      // Calculate which months fall within the date range
      const expectedMonthsInRange: number[] = [];
      for (let month = 1; month <= chitFund.duration; month++) {
        const paymentDate = getFundMonthCalendarDate(chitFund.startDate, month);
        if (paymentDate >= periodStart && paymentDate <= periodEnd) {
          expectedMonthsInRange.push(month);
        }
      }

      // If no expected months in this range, skip this chit fund
      if (expectedMonthsInRange.length === 0) return null;

      // Find members with pending contributions
      const pendingMembers = chitFund.members
        .map((member) => {
          const paidAmounts = new Map<number, number>();
          const settledMonths = new Set<number>();
          for (const contribution of member.contributions) {
            if (contribution.paidDate) {
              paidAmounts.set(contribution.month, (paidAmounts.get(contribution.month) || 0) + contribution.amount);
              if (contribution.balancePaymentStatus === "Paid") {
                settledMonths.add(contribution.month);
              }
            }
          }

          const pendingMonths = expectedMonthsInRange.filter((month) => {
            const expectedAmount = month === 1
              ? (chitFund.firstMonthContribution ?? monthlyContribution)
              : monthlyContribution;
            return !settledMonths.has(month) && expectedAmount > (paidAmounts.get(month) || 0);
          });
          if (pendingMonths.length === 0) return null;

          const pendingAmount = pendingMonths.reduce((sum, month) => {
            const expectedAmount = month === 1
              ? (chitFund.firstMonthContribution ?? monthlyContribution)
              : monthlyContribution;
            return sum + Math.max(0, expectedAmount - (paidAmounts.get(month) || 0));
          }, 0);

          return {
            memberId: member.id,
            memberName: member.globalMember.name,
            pendingAmount,
            pendingPeriods: pendingMonths.length,
            pendingMonths,
          };
        })
        .filter((m) => m !== null);

      // Only return chit funds with pending members
      if (pendingMembers.length === 0) return null;

      const totalPendingAmount = pendingMembers.reduce(
        (sum, m) => sum + (m?.pendingAmount || 0),
        0
      );

      return {
        id: chitFund.id,
        name: chitFund.name,
        totalAmount: chitFund.totalAmount,
        installmentAmount: monthlyContribution,
        frequency: "Monthly",
        pendingMembers,
        totalPendingAmount,
      };
    }).filter((cf) => cf !== null);

    return NextResponse.json({ pendingChitFunds });
  } catch (error: any) {
    console.error("Error fetching pending chit funds:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch pending chit funds" },
      { status: 500 }
    );
  }
}
