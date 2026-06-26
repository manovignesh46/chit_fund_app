import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { getCurrentUserId } from "../../../../lib/auth";

// Compute aggregations for a single date window given pre-fetched loan/chit data.
function computeAggregations(
  allLoans: any[],
  allChitFunds: any[],
  repaymentMap: Map<string, number>,
  contributionMap: Map<string, number>,
  startDate: Date,
  endDate: Date
) {
  let expectedLoanRepayment = 0;
  const periodsInRange = new Set<string>();

  for (const loan of allLoans) {
    const installment = loan.installmentAmount || 0;
    const loanTermEnd = new Date(loan.disbursementDate);
    let paymentDate = new Date(loan.disbursementDate);
    let period = 1;

    if (loan.repaymentType === "Weekly") {
      loanTermEnd.setDate(loanTermEnd.getDate() + (loan.duration || 0) * 7);
      paymentDate.setDate(paymentDate.getDate() + 7);
      while (paymentDate <= endDate && paymentDate <= loanTermEnd) {
        if (paymentDate >= startDate) {
          expectedLoanRepayment += installment;
          periodsInRange.add(`${loan.id}-${period}`);
        }
        paymentDate.setDate(paymentDate.getDate() + 7);
        period++;
      }
    } else {
      loanTermEnd.setMonth(loanTermEnd.getMonth() + (loan.duration || 0));
      paymentDate.setMonth(paymentDate.getMonth() + 1);
      while (paymentDate <= endDate && paymentDate <= loanTermEnd) {
        if (paymentDate >= startDate) {
          expectedLoanRepayment += installment;
          periodsInRange.add(`${loan.id}-${period}`);
        }
        paymentDate.setMonth(paymentDate.getMonth() + 1);
        period++;
      }
    }
  }

  const actualLoanRepayment = [...periodsInRange].reduce(
    (sum, key) => sum + (repaymentMap.get(key) || 0),
    0
  );

  let expectedChitContribution = 0;
  const chitMonthsInRange = new Set<string>();

  for (const cf of allChitFunds) {
    const contribution = cf.monthlyContribution || 0;
    const membersCount = cf.members.length;
    const chitTermEnd = new Date(cf.startDate);
    chitTermEnd.setMonth(chitTermEnd.getMonth() + (cf.duration || 0));
    let paymentDate = new Date(cf.startDate);
    let month = 1;

    while (paymentDate <= endDate && paymentDate < chitTermEnd && month <= cf.duration) {
      if (paymentDate >= startDate) {
        expectedChitContribution += contribution * membersCount;
        chitMonthsInRange.add(`${cf.id}-${month}`);
      }
      paymentDate.setMonth(paymentDate.getMonth() + 1);
      month++;
    }
  }

  const actualChitContribution = [...chitMonthsInRange].reduce(
    (sum, key) => sum + (contributionMap.get(key) || 0),
    0
  );

  return {
    expectedLoanRepayment,
    actualLoanRepayment,
    expectedChitContribution,
    actualChitContribution,
    totalExpectedAmount: expectedLoanRepayment + expectedChitContribution,
    totalActualAmount: actualLoanRepayment + actualChitContribution,
  };
}

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    // ── Batch mode: ?months=N ──────────────────────────────────────────────
    const monthsParam = searchParams.get("months");
    if (monthsParam) {
      const monthsCount = Math.max(1, parseInt(monthsParam, 10) || 6);
      const now = new Date();

      const monthRanges = Array.from({ length: monthsCount }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (monthsCount - 1 - i), 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const label =
          d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            ? "This month"
            : d.toLocaleString("default", { month: "short" }) +
              (d.getFullYear() !== now.getFullYear()
                ? ` '${String(d.getFullYear()).slice(2)}`
                : "");
        return { start, end, label };
      });

      const overallStart = monthRanges[0].start;
      const overallEnd = monthRanges[monthRanges.length - 1].end;

      // Fetch all data once for the full window
      const [completedLoans, activeLoans, allChitFunds] = await Promise.all([
        prisma.loan.findMany({
          where: {
            createdById: currentUserId,
            status: "Completed",
            repayments: { some: { paidDate: { gte: overallStart, lte: overallEnd } } },
          },
        }),
        prisma.loan.findMany({
          where: {
            createdById: currentUserId,
            status: "Active",
            disbursementDate: { lte: overallEnd },
          },
        }),
        prisma.chitFund.findMany({
          where: {
            createdById: currentUserId,
            OR: [
              { status: "Active", startDate: { lte: overallEnd } },
              { status: "Completed", startDate: { lte: overallEnd } },
            ],
          },
          include: { members: true },
        }),
      ]);

      const allLoans = [...activeLoans, ...completedLoans];

      const [allRepayments, allContributions] = await Promise.all([
        prisma.repayment.findMany({
          where: { createdById: currentUserId, loanId: { in: allLoans.map((l) => l.id) } },
          select: { loanId: true, period: true, amount: true },
        }),
        prisma.contribution.findMany({
          where: {
            createdById: currentUserId,
            chitFundId: { in: allChitFunds.map((cf) => cf.id) },
          },
          select: { chitFundId: true, month: true, amount: true },
        }),
      ]);

      // Build lookup maps
      const repaymentMap = new Map<string, number>();
      for (const r of allRepayments) {
        const k = `${r.loanId}-${r.period}`;
        repaymentMap.set(k, (repaymentMap.get(k) || 0) + r.amount);
      }
      const contributionMap = new Map<string, number>();
      for (const c of allContributions) {
        const k = `${c.chitFundId}-${c.month}`;
        contributionMap.set(k, (contributionMap.get(k) || 0) + c.amount);
      }

      const months = monthRanges.map(({ start, end, label }) => ({
        label,
        ...computeAggregations(allLoans, allChitFunds, repaymentMap, contributionMap, start, end),
      }));

      return NextResponse.json({ months });
    }

    // ── Single-window mode: ?startDate=…&endDate=… ─────────────────────────
    const startDate = new Date(searchParams.get("startDate") || "");
    const endDate = new Date(searchParams.get("endDate") || "");

    const [completedLoansInPeriod, activeLoans, allChitFunds] = await Promise.all([
      prisma.loan.findMany({
        where: {
          createdById: currentUserId,
          status: "Completed",
          repayments: { some: { paidDate: { gte: startDate, lte: endDate } } },
        },
      }),
      prisma.loan.findMany({
        where: {
          createdById: currentUserId,
          status: "Active",
          disbursementDate: { lte: endDate },
        },
      }),
      prisma.chitFund.findMany({
        where: {
          createdById: currentUserId,
          OR: [
            { status: "Active", startDate: { lte: endDate } },
            { status: "Completed", startDate: { lte: endDate } },
          ],
        },
        include: { members: true },
      }),
    ]);

    const allLoans = [...activeLoans, ...completedLoansInPeriod];

    const [repayments, contributions] = await Promise.all([
      prisma.repayment.findMany({
        where: { createdById: currentUserId, loanId: { in: allLoans.map((l) => l.id) } },
        select: { loanId: true, period: true, amount: true },
      }),
      prisma.contribution.findMany({
        where: { createdById: currentUserId, chitFundId: { in: allChitFunds.map((cf) => cf.id) } },
        select: { chitFundId: true, month: true, amount: true },
      }),
    ]);

    const repaymentMap = new Map<string, number>();
    for (const r of repayments) {
      const k = `${r.loanId}-${r.period}`;
      repaymentMap.set(k, (repaymentMap.get(k) || 0) + r.amount);
    }
    const contributionMap = new Map<string, number>();
    for (const c of contributions) {
      const k = `${c.chitFundId}-${c.month}`;
      contributionMap.set(k, (contributionMap.get(k) || 0) + c.amount);
    }

    const response = computeAggregations(
      allLoans,
      allChitFunds,
      repaymentMap,
      contributionMap,
      startDate,
      endDate
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in aggregations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
