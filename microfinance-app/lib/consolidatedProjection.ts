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
  /** Payout breakdown by fund name for tooltips/detail */
  auctionPayoutDetails?: { fundName: string; amount: number; bookedCount: number }[];
  /** Members booked for auction payout in this calendar month */
  bookedMembers?: {
    fundId: number;
    fundName: string;
    memberName: string;
    fundMonth: number;
    payoutAmount: number;
  }[];
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
      });
    }
  }

  return booked;
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
  simulation?: ConsolidatedSimulationOptions
): ConsolidatedProjectionRow[] {
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeEnd = getProjectionEndDate(chitFunds);
  const calendarMonths = generateCalendarMonths(rangeStart, rangeEnd);

  const rows: ConsolidatedProjectionRow[] = [];
  let cumulativeBalance = 0;

  for (const cal of calendarMonths) {
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

    const { total: totalAuctionPayout, details: auctionPayoutDetails } =
      computeAuctionPayoutForCalendarMonth(chitFunds, cal.year, cal.month);

    const bookedMembers = getBookedMembersForCalendarMonth(
      chitFunds,
      cal.year,
      cal.month
    );

    const net = totalExpectedCollection - totalAuctionPayout;
    cumulativeBalance += net;

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
      auctionPayoutDetails,
      bookedMembers,
    });
  }

  return rows;
}

export function computeBaselineAndSimulated(
  loans: LoanForAggregation[],
  chitFunds: (ChitFundWithBookings & { name?: string })[],
  simulation?: ConsolidatedSimulationOptions
): {
  projection: ConsolidatedProjectionRow[];
  simulatedProjection: ConsolidatedProjectionRow[] | null;
} {
  const projection = computeConsolidatedProjection(loans, chitFunds);
  const simulatedProjection = simulation
    ? computeConsolidatedProjection(loans, chitFunds, simulation)
    : null;
  return { projection, simulatedProjection };
}
