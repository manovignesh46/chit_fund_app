import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { getCurrentUserId } from "../../../lib/auth";
import {
  addToAging,
  computeChitMemberDuePeriods,
  computeLoanDuePeriods,
  emptyAging,
  getLoanInstallment,
  summarizePeriods,
  type DuePeriod,
} from "../../../lib/duesTracker";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/dues?asOf=YYYY-MM-DD&horizonDays=30
 *
 * Every unpaid loan installment and chit contribution that is overdue as of
 * `asOf` or falls due within the next `horizonDays`, one row per
 * loan / chit membership, with aging and summary totals.
 */
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const asOfParam = params.get("asOf");
    const asOf = asOfParam ? new Date(asOfParam) : new Date();
    const horizonDays = Number(params.get("horizonDays") ?? 30);
    if (isNaN(asOf.getTime()) || !Number.isInteger(horizonDays) || horizonDays < 0 || horizonDays > 366) {
      return NextResponse.json({ error: "Invalid asOf or horizonDays" }, { status: 400 });
    }

    const rangeEnd = new Date(asOf.getTime() + horizonDays * DAY_MS);
    rangeEnd.setHours(23, 59, 59, 999);
    const range = { start: new Date(0), end: rangeEnd };

    const [loans, chitFunds] = await Promise.all([
      prisma.loan.findMany({
        where: { createdById: currentUserId, status: "Active", disbursementDate: { lte: rangeEnd } },
        include: {
          borrower: { select: { id: true, name: true, contact: true } },
          repayments: { select: { period: true, amount: true, paidDate: true } },
        },
      }),
      prisma.chitFund.findMany({
        where: { createdById: currentUserId, status: "Active", startDate: { lte: rangeEnd } },
        include: {
          members: {
            include: {
              globalMember: { select: { id: true, name: true, contact: true } },
              contributions: { select: { month: true, amount: true, paidDate: true, balancePaymentStatus: true } },
            },
          },
        },
      }),
    ]);

    const accounts: any[] = [];
    const aging = emptyAging();
    const pushAccount = (base: Record<string, unknown>, periods: DuePeriod[]) => {
      if (periods.length === 0) return;
      addToAging(aging, periods);
      accounts.push({ ...base, periods, ...summarizePeriods(periods) });
    };

    for (const loan of loans) {
      pushAccount(
        {
          key: `loan-${loan.id}`,
          kind: "loan",
          entityId: loan.id,
          entityName: `Loan #${loan.id} · ${loan.loanType}`,
          memberName: loan.borrower.name,
          globalMemberId: loan.borrower.id,
          contact: loan.borrower.contact,
          installmentAmount: getLoanInstallment(loan),
          frequency: loan.repaymentType === "Weekly" ? "Weekly" : "Monthly",
          actionHref: `/loans/${loan.id}/repayments/new`,
          detailHref: `/loans/${loan.id}`,
        },
        computeLoanDuePeriods(loan, range, asOf)
      );
    }

    for (const chitFund of chitFunds) {
      for (const member of chitFund.members) {
        const periods = computeChitMemberDuePeriods(chitFund, member.contributions, range, asOf);
        const firstMonth = periods[0]?.period;
        pushAccount(
          {
            key: `chit-${chitFund.id}-${member.id}`,
            kind: "chit",
            entityId: chitFund.id,
            memberId: member.id,
            entityName: chitFund.name,
            memberName: member.globalMember.name,
            globalMemberId: member.globalMember.id,
            contact: member.globalMember.contact,
            installmentAmount: chitFund.monthlyContribution,
            frequency: "Monthly",
            actionHref: `/chit-funds/${chitFund.id}/contributions${firstMonth ? `?month=${firstMonth}` : ""}`,
            detailHref: `/chit-funds/${chitFund.id}`,
          },
          periods
        );
      }
    }

    // Most overdue first, then biggest amount.
    accounts.sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue || b.totalOutstanding - a.totalOutstanding);

    const weekEnd = new Date(asOf.getTime() + 7 * DAY_MS);
    let dueSoonAmount = 0;
    let dueLaterAmount = 0;
    for (const a of accounts) {
      for (const p of a.periods as DuePeriod[]) {
        if (p.status === "overdue") continue;
        if (new Date(p.dueDate) <= weekEnd) dueSoonAmount += p.outstanding;
        else dueLaterAmount += p.outstanding;
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const overdueAccounts = accounts.filter((a) => a.overdueAmount > 0);
    return NextResponse.json({
      asOf: asOf.toISOString(),
      horizonDays,
      summary: {
        overdueAmount: round2(overdueAccounts.reduce((s, a) => s + a.overdueAmount, 0)),
        overdueAccounts: overdueAccounts.length,
        overdueMembers: new Set(overdueAccounts.map((a) => a.globalMemberId)).size,
        dueSoonAmount: round2(dueSoonAmount),
        dueLaterAmount: round2(dueLaterAmount),
        totalOutstanding: round2(accounts.reduce((s, a) => s + a.totalOutstanding, 0)),
        aging,
      },
      accounts,
    });
  } catch (error: any) {
    console.error("Error fetching dues:", error);
    return NextResponse.json({ error: "Failed to fetch dues" }, { status: 500 });
  }
}
