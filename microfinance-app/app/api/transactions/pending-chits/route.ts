import { NextRequest, NextResponse } from "next/server";
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
      let paymentDate = new Date(chitFund.startDate);
      const chitTermEnd = new Date(chitFund.startDate);
      chitTermEnd.setMonth(chitTermEnd.getMonth() + (chitFund.duration || 0));
      let currentMonth = 1;

      // Start from the first contribution date
      while (paymentDate < chitTermEnd && currentMonth <= chitFund.duration) {
        if (paymentDate >= periodStart && paymentDate <= periodEnd) {
          expectedMonthsInRange.push(currentMonth);
        }
        // Move to the next month's contribution date
        paymentDate.setMonth(paymentDate.getMonth() + 1);
        currentMonth++;
      }

      // If no expected months in this range, skip this chit fund
      if (expectedMonthsInRange.length === 0) return null;

      // Find members with pending contributions
      const pendingMembers = chitFund.members
        .map((member) => {
          // Get the months that were paid for this member
          const paidMonths = new Set(
            member.contributions
              .filter((c) => c.paidDate !== null)
              .map((c) => c.month)
          );

          // Find which expected months in range are not paid
          const unpaidMonths = expectedMonthsInRange.filter(
            (month) => !paidMonths.has(month)
          );

          if (unpaidMonths.length === 0) return null;

          return {
            memberName: member.globalMember.name,
            pendingAmount: unpaidMonths.length * monthlyContribution,
            pendingPeriods: unpaidMonths.length,
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
