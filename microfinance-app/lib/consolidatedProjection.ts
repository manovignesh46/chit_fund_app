/**
 * Consolidated calendar-month cash flow projection across all loans and chit funds.
 */

import {
  ChitFundForAggregation,
  LoanForAggregation,
  CalendarMonth,
  computeExpectedLoanRepayment,
  computeExpectedChitContribution,
  generateCalendarMonths,
  getProjectionEndDate,
  getFundMonthCalendarDate,
  isDateInCalendarMonth,
  isCalendarMonthOnOrAfter,
  fundHasContributionInCalendarMonth,
} from './monthlyAggregations';
import { getPrizeAmountPerWinner } from './auctionProjection';

export interface ChitFundWithBookings extends ChitFundForAggregation {
  totalAmount: number;
  fixedAmounts?: { month: number; amount: number }[];
  auctionBookings: { month: number; memberId: number; memberName: string }[];
}

export interface ConsolidatedSimulationOptions {
  fundId: number;
  fromYear: number;
  fromMonth: number;
  contribution: number;
}

export interface ConsolidatedProjectionRow {
  year: number;
  month: number;
  label: string;
  expectedLoanRepayments: number;
  expectedChitContributions: number;
  totalExpectedCollection: number;
  totalAuctionPayout: number;
  net: number;
  cumulativeBalance: number;
  isCurrentMonth?: boolean;
  /** Payout breakdown by fund name for tooltips/detail */
  auctionPayoutDetails?: { fundName: string; amount: number; bookedCount: number }[];
  /** Members booked or actual winners for auction payout in this calendar month */
  bookedMembers?: {
    fundId: number;
    fundName: string;
    memberName: string;
    fundMonth: number;
    payoutAmount: number;
    isActual?: boolean;
  }[];
}

export interface ActualAuctionRecord {
  chitFundId: number;
  fundName: string;
  amount: number;
  date: Date | string;
  memberName: string;
  fundMonth: number;
}

export interface ConsolidatedProjectionOptions {
  actualAuctions?: ActualAuctionRecord[];
  openingBalance?: number;
  simulation?: ConsolidatedSimulationOptions;
}

function isCurrentCalendarMonth(
  year: number,
  month: number,
  now = new Date()
): boolean {
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

function getActualAuctionsForCalendarMonth(
  actualAuctions: ActualAuctionRecord[],
  year: number,
  month: number
): ActualAuctionRecord[] {
  return actualAuctions.filter((a) => {
    const d = new Date(a.date);
    return isDateInCalendarMonth(d, year, month);
  });
}

function buildActualPayoutDetails(
  actuals: ActualAuctionRecord[]
): { total: number; details: { fundName: string; amount: number; bookedCount: number }[]; members: ConsolidatedProjectionRow['bookedMembers'] } {
  const byFund = new Map<string, { amount: number; count: number }>();
  const members: NonNullable<ConsolidatedProjectionRow['bookedMembers']> = [];

  for (const a of actuals) {
    const existing = byFund.get(a.fundName) || { amount: 0, count: 0 };
    existing.amount += a.amount;
    existing.count += 1;
    byFund.set(a.fundName, existing);

    members.push({
      fundId: a.chitFundId,
      fundName: a.fundName,
      memberName: a.memberName,
      fundMonth: a.fundMonth,
      payoutAmount: a.amount,
      isActual: true,
    });
  }

  const details = [...byFund.entries()].map(([fundName, { amount, count }]) => ({
    fundName,
    amount,
    bookedCount: count,
  }));

  return {
    total: actuals.reduce((s, a) => s + a.amount, 0),
    details,
    members,
  };
}

export function computeAuctionPayoutForCalendarMonth(
  chitFunds: (ChitFundWithBookings & { name?: string })[],
  year: number,
  month: number
): { total: number; details: { fundName: string; amount: number; bookedCount: number }[] } {
  let total = 0;
  const details: { fundName: string; amount: number; bookedCount: number }[] = [];

  for (const fund of chitFunds) {
    const monthBookings = fund.auctionBookings.filter((b) => {
      const calDate = getFundMonthCalendarDate(fund.startDate, b.month);
      return isDateInCalendarMonth(calDate, year, month);
    });

    if (monthBookings.length === 0) continue;

    const prizePerWinner = getPrizeAmountPerWinner(
      {
        totalAmount: fund.totalAmount,
        monthlyContribution: fund.monthlyContribution,
        firstMonthContribution: fund.firstMonthContribution,
        duration: fund.duration,
        chitFundType: fund.chitFundType,
        memberCount: fund.members.length,
        fixedAmounts: fund.fixedAmounts,
      },
      monthBookings[0].month
    );

    const fundPayout = prizePerWinner * monthBookings.length;
    total += fundPayout;
    details.push({
      fundName: fund.name || `Fund ${fund.id}`,
      amount: fundPayout,
      bookedCount: monthBookings.length,
    });
  }

  return { total, details };
}

export function getBookedMembersForCalendarMonth(
  chitFunds: (ChitFundWithBookings & { name?: string })[],
  year: number,
  month: number
): ConsolidatedProjectionRow['bookedMembers'] {
  const booked: NonNullable<ConsolidatedProjectionRow['bookedMembers']> = [];

  for (const fund of chitFunds) {
    const monthBookings = fund.auctionBookings.filter((b) => {
      const calDate = getFundMonthCalendarDate(fund.startDate, b.month);
      return isDateInCalendarMonth(calDate, year, month);
    });

    for (const booking of monthBookings) {
      const prizePerWinner = getPrizeAmountPerWinner(
        {
          totalAmount: fund.totalAmount,
          monthlyContribution: fund.monthlyContribution,
          firstMonthContribution: fund.firstMonthContribution,
          duration: fund.duration,
          chitFundType: fund.chitFundType,
          memberCount: fund.members.length,
          fixedAmounts: fund.fixedAmounts,
        },
        booking.month
      );

      booked.push({
        fundId: fund.id,
        fundName: fund.name || `Fund ${fund.id}`,
        memberName: booking.memberName,
        fundMonth: booking.month,
        payoutAmount: prizePerWinner,
        isActual: false,
      });
    }
  }

  return booked;
}

/**
 * Booked members for a calendar month, excluding any booking whose fund+fund-month
 * already has a recorded actual auction (a stale booking left over after the real
 * payout was entered elsewhere, without the booking being removed).
 */
export function getPendingBookedMembersForCalendarMonth(
  chitFunds: (ChitFundWithBookings & { name?: string })[],
  year: number,
  month: number,
  actualAuctions: ActualAuctionRecord[]
): ConsolidatedProjectionRow['bookedMembers'] {
  const supersededKeys = new Set(
    actualAuctions.map((a) => `${a.chitFundId}-${a.fundMonth}`)
  );

  const allBooked = getBookedMembersForCalendarMonth(chitFunds, year, month) || [];
  return allBooked.filter(
    (b) => !supersededKeys.has(`${b.fundId}-${b.fundMonth}`)
  );
}

function getSimulatedChitExtra(
  chitFunds: ChitFundForAggregation[],
  year: number,
  month: number,
  simulation?: ConsolidatedSimulationOptions
): number {
  if (!simulation) return 0;
  if (!isCalendarMonthOnOrAfter(year, month, simulation.fromYear, simulation.fromMonth)) {
    return 0;
  }
  const fund = chitFunds.find((f) => f.id === simulation.fundId);
  if (!fund) return 0;
  if (!fundHasContributionInCalendarMonth(fund, year, month)) return 0;
  return simulation.contribution;
}

export function computeConsolidatedProjection(
  loans: LoanForAggregation[],
  chitFunds: (ChitFundWithBookings & { name?: string })[],
  options: ConsolidatedProjectionOptions = {}
): ConsolidatedProjectionRow[] {
  const { actualAuctions = [], openingBalance = 0, simulation } = options;
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeEnd = getProjectionEndDate(chitFunds);
  const calendarMonths = generateCalendarMonths(rangeStart, rangeEnd);

  const rows: ConsolidatedProjectionRow[] = [];
  let cumulativeBalance = openingBalance;

  for (const cal of calendarMonths) {
    const isCurrent = isCurrentCalendarMonth(cal.year, cal.month, now);

    const expectedLoanRepayments = computeExpectedLoanRepayment(
      loans,
      cal.start,
      cal.end
    );
    let expectedChitContributions = computeExpectedChitContribution(
      chitFunds,
      cal.start,
      cal.end
    );
    expectedChitContributions += getSimulatedChitExtra(
      chitFunds,
      cal.year,
      cal.month,
      simulation
    );

    const totalExpectedCollection =
      expectedLoanRepayments + expectedChitContributions;

    let totalAuctionPayout: number;
    let auctionPayoutDetails: ConsolidatedProjectionRow['auctionPayoutDetails'];
    let bookedMembers: ConsolidatedProjectionRow['bookedMembers'];

    if (isCurrent) {
      const actuals = getActualAuctionsForCalendarMonth(
        actualAuctions,
        cal.year,
        cal.month
      );
      const actualPayout = buildActualPayoutDetails(actuals);
      totalAuctionPayout = actualPayout.total;
      auctionPayoutDetails = actualPayout.details;

      const pendingBooked = getPendingBookedMembersForCalendarMonth(
        chitFunds,
        cal.year,
        cal.month,
        actualAuctions
      ) || [];
      bookedMembers = [...(actualPayout.members || []), ...pendingBooked];
    } else {
      const booked = computeAuctionPayoutForCalendarMonth(
        chitFunds,
        cal.year,
        cal.month
      );
      totalAuctionPayout = booked.total;
      auctionPayoutDetails = booked.details;
      bookedMembers = getBookedMembersForCalendarMonth(
        chitFunds,
        cal.year,
        cal.month
      );
    }

    const net = totalExpectedCollection - totalAuctionPayout;

    if (isCurrent) {
      cumulativeBalance = openingBalance;
    } else {
      cumulativeBalance += net;
    }

    rows.push({
      year: cal.year,
      month: cal.month,
      label: cal.label,
      expectedLoanRepayments,
      expectedChitContributions,
      totalExpectedCollection,
      totalAuctionPayout,
      net,
      cumulativeBalance,
      isCurrentMonth: isCurrent,
      auctionPayoutDetails,
      bookedMembers,
    });
  }

  return rows;
}

export function computeBaselineAndSimulated(
  loans: LoanForAggregation[],
  chitFunds: (ChitFundWithBookings & { name?: string })[],
  options: {
    actualAuctions?: ActualAuctionRecord[];
    openingBalance?: number;
    simulation?: ConsolidatedSimulationOptions;
  } = {}
): {
  projection: ConsolidatedProjectionRow[];
  simulatedProjection: ConsolidatedProjectionRow[] | null;
} {
  const { actualAuctions = [], openingBalance = 0, simulation } = options;
  const projection = computeConsolidatedProjection(loans, chitFunds, {
    actualAuctions,
    openingBalance,
  });
  const simulatedProjection = simulation
    ? computeConsolidatedProjection(loans, chitFunds, {
        actualAuctions,
        openingBalance,
        simulation,
      })
    : null;
  return { projection, simulatedProjection };
}
