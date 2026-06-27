/**
 * Forward-looking auction booking projection for chit funds.
 * Uses planned bookings (not historical auction records) for payout estimates.
 */

export interface ProjectionChitFund {
  totalAmount: number;
  monthlyContribution: number;
  firstMonthContribution?: number | null;
  duration: number;
  chitFundType?: string;
  memberCount: number;
  fixedAmounts?: { month: number; amount: number }[];
}

export interface ProjectionBooking {
  month: number;
  memberId: number;
  memberName: string;
}

export interface ProjectionMonthRow {
  month: number;
  bookedMembers: { memberId: number; memberName: string }[];
  estimatedCollection: number;
  auctionPayout: number;
  net: number;
  cumulativeBalance: number;
}

export interface ProjectionOptions {
  /** Add one extra member's contribution from this month onward */
  simulateNewMemberFromMonth?: number | null;
  /** Monthly contribution for the simulated new member (defaults to fund's monthlyContribution) */
  simulatedMemberContribution?: number;
}

/** Estimated monthly collection — mirrors dashboard / aggregations logic per fund month. */
export function getEstimatedMonthlyCollection(
  chitFund: ProjectionChitFund,
  month: number,
  memberCount: number
): number {
  if (
    chitFund.chitFundType === 'Fixed' &&
    chitFund.firstMonthContribution &&
    month === 1
  ) {
    return (
      chitFund.firstMonthContribution +
      chitFund.monthlyContribution * Math.max(0, memberCount - 1)
    );
  }
  return chitFund.monthlyContribution * memberCount;
}

/** Fixed prize amount paid per auction winner for a given month. */
export function getPrizeAmountPerWinner(
  chitFund: ProjectionChitFund,
  month: number
): number {
  if (chitFund.chitFundType === 'Fixed' && chitFund.fixedAmounts?.length) {
    const fixed = chitFund.fixedAmounts.find((fa) => fa.month === month);
    if (fixed) return fixed.amount;
  }
  return chitFund.totalAmount;
}

export function computeProjection(
  chitFund: ProjectionChitFund,
  bookings: ProjectionBooking[],
  options: ProjectionOptions = {}
): ProjectionMonthRow[] {
  const rows: ProjectionMonthRow[] = [];
  let cumulativeBalance = 0;
  const simulateFrom = options.simulateNewMemberFromMonth ?? null;
  const extraContribution =
    options.simulatedMemberContribution ?? chitFund.monthlyContribution;

  for (let month = 1; month <= chitFund.duration; month++) {
    let memberCount = chitFund.memberCount;
    if (simulateFrom !== null && month >= simulateFrom) {
      memberCount += 1;
    }

    const estimatedCollection = getEstimatedMonthlyCollection(
      chitFund,
      month,
      memberCount
    );

    const monthBookings = bookings.filter((b) => b.month === month);
    const prizePerWinner = getPrizeAmountPerWinner(chitFund, month);
    const auctionPayout = prizePerWinner * monthBookings.length;
    const net = estimatedCollection - auctionPayout;
    cumulativeBalance += net;

    rows.push({
      month,
      bookedMembers: monthBookings.map((b) => ({
        memberId: b.memberId,
        memberName: b.memberName,
      })),
      estimatedCollection,
      auctionPayout,
      net,
      cumulativeBalance,
    });
  }

  return rows;
}
