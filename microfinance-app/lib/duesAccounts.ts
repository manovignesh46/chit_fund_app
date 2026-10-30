/**
 * Builds per-account dues (one row per loan / chit membership) from the database.
 * Shared by /api/dues (everyone) and the member detail page (one member).
 */
import {
  addToAging,
  computeChitMemberDuePeriods,
  computeLoanDuePeriods,
  emptyAging,
  getLoanInstallment,
  summarizePeriods,
  type AgingBucket,
  type DueAccountSummary,
  type DuePeriod,
} from './duesTracker';

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface DueAccount extends DueAccountSummary {
  key: string;
  kind: 'loan' | 'chit';
  entityId: number;
  memberId?: number;
  entityName: string;
  memberName: string;
  globalMemberId: number;
  contact: string;
  installmentAmount: number;
  frequency: 'Weekly' | 'Monthly';
  actionHref: string;
  detailHref: string;
  periods: DuePeriod[];
}

export interface DuesSummary {
  overdueAmount: number;
  overdueAccounts: number;
  overdueMembers: number;
  dueSoonAmount: number;
  dueLaterAmount: number;
  totalOutstanding: number;
  aging: Record<AgingBucket, number>;
}

export interface BuildDuesOptions {
  asOf?: Date;
  horizonDays?: number;
  /** Restrict to one member (GlobalMember id). */
  globalMemberId?: number;
}

/** Minimal Prisma surface used here, so tests can pass a fake. */
interface DuesDb {
  loan: { findMany: (args: any) => Promise<any[]> };
  chitFund: { findMany: (args: any) => Promise<any[]> };
}

export async function buildDueAccounts(
  db: DuesDb,
  userId: number,
  { asOf = new Date(), horizonDays = 30, globalMemberId }: BuildDuesOptions = {}
): Promise<{ accounts: DueAccount[]; summary: DuesSummary }> {
  const rangeEnd = new Date(asOf.getTime() + horizonDays * DAY_MS);
  rangeEnd.setHours(23, 59, 59, 999);
  const range = { start: new Date(0), end: rangeEnd };

  const [loans, chitFunds] = await Promise.all([
    db.loan.findMany({
      where: {
        createdById: userId,
        status: 'Active',
        disbursementDate: { lte: rangeEnd },
        ...(globalMemberId ? { borrowerId: globalMemberId } : {}),
      },
      include: {
        borrower: { select: { id: true, name: true, contact: true } },
        repayments: { select: { period: true, amount: true, paidDate: true } },
      },
    }),
    db.chitFund.findMany({
      where: {
        createdById: userId,
        status: 'Active',
        startDate: { lte: rangeEnd },
        ...(globalMemberId ? { members: { some: { globalMemberId } } } : {}),
      },
      include: {
        members: {
          ...(globalMemberId ? { where: { globalMemberId } } : {}),
          include: {
            globalMember: { select: { id: true, name: true, contact: true } },
            contributions: { select: { month: true, amount: true, paidDate: true, balancePaymentStatus: true } },
          },
        },
      },
    }),
  ]);

  const accounts: DueAccount[] = [];
  const aging = emptyAging();
  const push = (base: Omit<DueAccount, 'periods' | keyof DueAccountSummary>, periods: DuePeriod[]) => {
    if (periods.length === 0) return;
    addToAging(aging, periods);
    accounts.push({ ...base, periods, ...summarizePeriods(periods) });
  };

  for (const loan of loans) {
    push(
      {
        key: `loan-${loan.id}`,
        kind: 'loan',
        entityId: loan.id,
        entityName: `Loan #${loan.id} · ${loan.loanType}`,
        memberName: loan.borrower.name,
        globalMemberId: loan.borrower.id,
        contact: loan.borrower.contact,
        installmentAmount: getLoanInstallment(loan),
        frequency: loan.repaymentType === 'Weekly' ? 'Weekly' : 'Monthly',
        actionHref: `/loans/${loan.id}/repayments/new`,
        detailHref: `/loans/${loan.id}`,
      },
      computeLoanDuePeriods(loan, range, asOf)
    );
  }

  for (const chitFund of chitFunds) {
    for (const member of chitFund.members) {
      if (globalMemberId && member.globalMember.id !== globalMemberId) continue;
      const periods = computeChitMemberDuePeriods(chitFund, member.contributions, range, asOf);
      const firstMonth = periods[0]?.period;
      push(
        {
          key: `chit-${chitFund.id}-${member.id}`,
          kind: 'chit',
          entityId: chitFund.id,
          memberId: member.id,
          entityName: chitFund.name,
          memberName: member.globalMember.name,
          globalMemberId: member.globalMember.id,
          contact: member.globalMember.contact,
          installmentAmount: chitFund.monthlyContribution,
          frequency: 'Monthly',
          actionHref: `/chit-funds/${chitFund.id}/contributions${firstMonth ? `?month=${firstMonth}` : ''}`,
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
    for (const p of a.periods) {
      if (p.status === 'overdue') continue;
      if (new Date(p.dueDate) <= weekEnd) dueSoonAmount += p.outstanding;
      else dueLaterAmount += p.outstanding;
    }
  }

  const overdue = accounts.filter((a) => a.overdueAmount > 0);
  return {
    accounts,
    summary: {
      overdueAmount: round2(overdue.reduce((s, a) => s + a.overdueAmount, 0)),
      overdueAccounts: overdue.length,
      overdueMembers: new Set(overdue.map((a) => a.globalMemberId)).size,
      dueSoonAmount: round2(dueSoonAmount),
      dueLaterAmount: round2(dueLaterAmount),
      totalOutstanding: round2(accounts.reduce((s, a) => s + a.totalOutstanding, 0)),
      aging,
    },
  };
}
