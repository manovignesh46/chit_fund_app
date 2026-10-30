import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { getCurrentUserId } from "../../../../lib/auth";
import { computeChitMemberDuePeriods, summarizePeriods } from "../../../../lib/duesTracker";

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
                contact: true,
              },
            },
            contributions: true,
          },
        },
      },
    });

    // Calculate pending contributions grouped by chit fund
    const range = { start: startDate, end: endDate };
    const asOf = new Date();
    const pendingChitFunds = activeChitFunds.map((chitFund) => {
      const monthlyContribution = chitFund.monthlyContribution || 0;

      const pendingMembers = chitFund.members
        .map((member) => {
          const periods = computeChitMemberDuePeriods(chitFund, member.contributions, range, asOf);
          if (periods.length === 0) return null;
          const summary = summarizePeriods(periods);

          return {
            memberId: member.id,
            memberName: member.globalMember.name,
            contact: member.globalMember.contact,
            pendingAmount: summary.totalOutstanding,
            pendingPeriods: periods.length,
            pendingMonths: periods.map((p) => p.period),
            overdueAmount: summary.overdueAmount,
            maxDaysOverdue: summary.maxDaysOverdue,
            periods,
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
