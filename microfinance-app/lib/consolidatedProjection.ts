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
  /** The single month immediately preceding the current one, shown for context */
  isPastMonth?: boolean;
  /** Whether isPastMonth's cumulativeBalance is a rough estimate rather than a real recorded balance */
  isPastBalanceEstimated?: boolean;
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
  /** Member id of the winner — used to tell who still has no auction assigned */
  winnerId: number;
}

/** Expected future payouts for one fund's members who have neither booked nor won yet. */
export interface UnbookedFundLiability {
  fundId: number;
  fundName: string;
  unbookedCount: number;
  amount: number;
  months: { fundMonth: number; amount: number }[];
}

export interface ConsolidatedProjectionOptions {
  actualAuctions?: ActualAuctionRecord[];
  openingBalance?: number;
  /** Real recorded balance as of the end of the month before the current one */
  pastMonthClosingBalance?: number;
  simulation?: ConsolidatedSimulationOptions;
}

function isCurrentCalendarMonth(
  year: number,
  month: number,
  now = new Date()
): boolean {
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

function isPreviousCalendarMonth(
  year: number,
  month: number,
  now = new Date()
): boolean {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return year === prev.getFullYear() && month === prev.getMonth() + 1;
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

/** Shape getPrizeAmountPerWinner expects, built from a projection input fund. */
function toProjectionFund(fund: ChitFundWithBookings) {
  return {
    totalAmount: fund.totalAmount,
    monthlyContribution: fund.monthlyContribution,
    firstMonthContribution: fund.firstMonthContribution,
    duration: fund.duration,
    chitFundType: fund.chitFundType,
    memberCount: fund.members.length,
    fixedAmounts: fund.fixedAmounts,
  };
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
        toProjectionFund(fund),
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

/**
 * What the members who have neither booked nor won an auction yet will still cost.
 *
 * The month-by-month projection only knows about members with an actual
 * AuctionBooking, so anyone not yet booked contributes nothing to any row's
 * payout — leaving the final cumulative balance optimistic by their whole
 * future payout. Every member takes a payout eventually, so we price them
 * here: each still-open fund month has a predefined amount (fixed funds), and
 * we assume the unbooked members take the open months at the end of the fund.
 *
 * This is deliberately kept out of the projection rows themselves — the table
 * stays a view of what's actually booked, and this total is subtracted once at
 * the summary level.
 */
export function computeUnbookedAuctionLiability(
  chitFunds: (ChitFundWithBookings & { name?: string })[],
  actualAuctions: ActualAuctionRecord[] = []
): { total: number; totalMembers: number; byFund: UnbookedFundLiability[] } {
  const byFund: UnbookedFundLiability[] = [];

  for (const fund of chitFunds) {
    const fundAuctions = actualAuctions.filter((a) => a.chitFundId === fund.id);

    const assignedMemberIds = new Set<number>([
      ...fund.auctionBookings.map((b) => b.memberId),
      ...fundAuctions.map((a) => a.winnerId),
    ]);
    const unbookedCount = Math.max(
      0,
      fund.members.length - assignedMemberIds.size
    );
    if (unbookedCount === 0) continue;

    const takenMonths = new Set<number>([
      ...fund.auctionBookings.map((b) => b.month),
      ...fundAuctions.map((a) => a.fundMonth),
    ]);
    const openMonths: number[] = [];
    for (let m = 1; m <= fund.duration; m++) {
      if (!takenMonths.has(m)) openMonths.push(m);
    }

    // Unbooked members are assumed to take their auction at the end of the
    // fund, so bill them against the *last* open months. If the schedule has
    // fewer open months than unbooked members (a data inconsistency), the
    // extras are priced at the final month rather than silently dropped.
    const chosenMonths = openMonths.slice(-unbookedCount);
    while (chosenMonths.length < unbookedCount) {
      chosenMonths.push(fund.duration);
    }

    const projectionFund = toProjectionFund(fund);
    const months = chosenMonths.map((fundMonth) => ({
      fundMonth,
      amount: getPrizeAmountPerWinner(projectionFund, fundMonth),
    }));

    byFund.push({
      fundId: fund.id,
      fundName: fund.name || `Fund ${fund.id}`,
      unbookedCount,
      amount: months.reduce((s, m) => s + m.amount, 0),
      months,
    });
  }

  return {
    total: byFund.reduce((s, f) => s + f.amount, 0),
    totalMembers: byFund.reduce((s, f) => s + f.unbookedCount, 0),
    byFund,
  };
}

function groupByFund(
  entries: NonNullable<ConsolidatedProjectionRow['bookedMembers']>
): { fundName: string; amount: number; bookedCount: number }[] {
  const byFund = new Map<string, { amount: number; count: number }>();
  for (const e of entries) {
    const existing = byFund.get(e.fundName) || { amount: 0, count: 0 };
    existing.amount += e.payoutAmount;
    existing.count += 1;
    byFund.set(e.fundName, existing);
  }
  return [...byFund.entries()].map(([fundName, { amount, count }]) => ({
    fundName,
    amount,
    bookedCount: count,
  }));
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
  const { actualAuctions = [], openingBalance = 0, pastMonthClosingBalance, simulation } = options;
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rangeEnd = getProjectionEndDate(chitFunds);
  const calendarMonths = generateCalendarMonths(rangeStart, rangeEnd);

  const rows: ConsolidatedProjectionRow[] = [];
  // Seed the running total from last month's real closing balance so every
  // row — including the current month — chains forward uniformly via its own
  // net, the same way every future month already does. Falling back to
  // today's balance only happens if the caller couldn't supply a real one.
  const pastBalanceIsEstimated = pastMonthClosingBalance === undefined;
  let cumulativeBalance = pastBalanceIsEstimated ? openingBalance : pastMonthClosingBalance;
  // Anything still pending from last month is an overdue liability: it's
  // excluded from last month's own real closing balance (never paid) and
  // last month's row is excluded from the forward chain, so without this it
  // would silently never get subtracted anywhere. Carry it into this month.
  let carriedOverPending: NonNullable<ConsolidatedProjectionRow['bookedMembers']> = [];

  for (const cal of calendarMonths) {
    const isCurrent = isCurrentCalendarMonth(cal.year, cal.month, now);
    const isPastMonth = isPreviousCalendarMonth(cal.year, cal.month, now);

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

    if (isCurrent || isPastMonth) {
      const actuals = getActualAuctionsForCalendarMonth(
        actualAuctions,
        cal.year,
        cal.month
      );
      const actualPayout = buildActualPayoutDetails(actuals);

      const pendingBooked = getPendingBookedMembersForCalendarMonth(
        chitFunds,
        cal.year,
        cal.month,
        actualAuctions
      ) || [];

      // Net/cumulative-balance math treats booked-but-unpaid winners the same
      // as every future month does (assume the booking happens), so the page
      // can be used to plan what balance remains after paying them out.
      bookedMembers = [...(actualPayout.members || []), ...pendingBooked];
      totalAuctionPayout = bookedMembers.reduce((s, b) => s + b.payoutAmount, 0);
      auctionPayoutDetails = groupByFund(bookedMembers);

      if (isPastMonth) {
        carriedOverPending = pendingBooked;
      } else if (isCurrent && carriedOverPending.length > 0) {
        bookedMembers = [...bookedMembers, ...carriedOverPending];
        totalAuctionPayout = bookedMembers.reduce((s, b) => s + b.payoutAmount, 0);
        auctionPayoutDetails = groupByFund(bookedMembers);
      }
    } else {
      bookedMembers = getBookedMembersForCalendarMonth(chitFunds, cal.year, cal.month) || [];
      totalAuctionPayout = bookedMembers.reduce((s, b) => s + b.payoutAmount, 0);
      auctionPayoutDetails = groupByFund(bookedMembers);
    }

    const net = totalExpectedCollection - totalAuctionPayout;

    if (!isPastMonth) {
      // isPastMonth already holds its own closing balance (seeded above) —
      // every other row, including the current month, adds its own net on
      // top of the running total, so nothing is ever double-counted between
      // what's already real (last month, and any of this month already
      // reflected in today's balance) and what's still projected.
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
      isPastMonth,
      isPastBalanceEstimated: isPastMonth ? pastBalanceIsEstimated : undefined,
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
    pastMonthClosingBalance?: number;
    simulation?: ConsolidatedSimulationOptions;
  } = {}
): {
  projection: ConsolidatedProjectionRow[];
  simulatedProjection: ConsolidatedProjectionRow[] | null;
} {
  const { actualAuctions = [], openingBalance = 0, pastMonthClosingBalance, simulation } = options;
  const projection = computeConsolidatedProjection(loans, chitFunds, {
    actualAuctions,
    openingBalance,
    pastMonthClosingBalance,
  });
  const simulatedProjection = simulation
    ? computeConsolidatedProjection(loans, chitFunds, {
        actualAuctions,
        openingBalance,
        pastMonthClosingBalance,
        simulation,
      })
    : null;
  return { projection, simulatedProjection };
}
