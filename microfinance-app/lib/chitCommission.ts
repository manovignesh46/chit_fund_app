/** Commission belongs to completed payouts, not to member cash awaiting rotation. */
export interface CommissionFund {
  monthlyContribution: number;
  firstMonthContribution?: number | null;
  membersCount?: number;
  members?: unknown[];
  chitFundType?: string;
}

export function calculateChitPayoutCommission(
  fund: CommissionFund,
  payout: { amount: number; month?: number },
): number {
  const memberCount = fund.membersCount ?? fund.members?.length ?? 0;
  const collection = fund.chitFundType === 'Fixed' && payout.month === 1
    ? (fund.firstMonthContribution ?? fund.monthlyContribution) +
      fund.monthlyContribution * Math.max(0, memberCount - 1)
    : fund.monthlyContribution * memberCount;
  // Keep a negative spread visible instead of silently hiding a payout loss.
  return collection - payout.amount;
}

export interface CommissionTrendFund extends CommissionFund {
  duration: number;
  currentMonth: number;
  status: string;
  fixedAmounts: { month: number; amount: number }[];
  contributions: { amount: number; paidDate: Date | string }[];
  auctions: { amount: number; month: number; date: Date | string }[];
}

export function calculateChitCommissionTrends(funds: CommissionTrendFund[], monthCount: number, now = new Date()) {
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - monthCount + 1 + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      year: date.getFullYear(), month: date.getMonth() + 1,
      label: index === monthCount - 1 ? 'This month' : date.toLocaleString('en-IN', {
        month: 'short', ...(date.getFullYear() !== now.getFullYear() ? { year: '2-digit' } : {}),
      }),
      commission: 0, auctionCount: 0,
    };
  });
  let commission = 0;
  let collections = 0;
  let payouts = 0;
  let expectedRemainingCommission = 0;
  let projectionComplete = true;
  for (const fund of funds) {
    const completed = fund.auctions.filter(a => new Date(a.date) <= now && a.month <= fund.currentMonth);
    const completedMonths = new Set(completed.map(a => a.month));
    collections += fund.contributions.filter(c => new Date(c.paidDate) <= now).reduce((sum, c) => sum + c.amount, 0);
    for (const payout of completed) {
      const amount = calculateChitPayoutCommission(fund, payout);
      commission += amount;
      payouts += payout.amount;
      const date = new Date(payout.date);
      const row = months.find(m => m.year === date.getFullYear() && m.month === date.getMonth() + 1);
      if (row) { row.commission += amount; row.auctionCount += 1; }
    }
    if (fund.status === 'Completed' || fund.status === 'Cancelled') continue;
    for (let month = 1; month <= fund.duration; month++) {
      if (completedMonths.has(month)) continue;
      const planned = fund.chitFundType === 'Fixed' && fund.fixedAmounts.find(p => p.month === month);
      if (!planned) projectionComplete = false;
      else expectedRemainingCommission += calculateChitPayoutCommission(fund, planned);
    }
  }
  return { months, summary: {
    commission, collections, payouts, collectionPayoutBalance: collections - payouts,
    expectedRemainingCommission: projectionComplete ? expectedRemainingCommission : null,
  } };
}
