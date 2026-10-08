// Run with: node tests/trends-calculations.js. No database connection or writes.
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'CommonJS', jsx: 'react-jsx' });
require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { calculateChitPayoutCommission, calculateChitCommissionTrends } = require('../lib/chitCommission');
const { calculateChitFundProfit, calculateChitFundProfitUpToCurrentMonth, calculateLoanProfit } = require('../lib/financialUtils');
const { calculateTotalFinancialMetrics, calculatePeriodFinancialMetrics } = require('../lib/centralizedFinancialCalculations');
const LoanReturn = require('../app/components/BusinessROICard').default;
const BusinessEarnings = require('../app/components/YieldMetricsCard').default;
const CapitalPosition = require('../app/components/CapitalUtilizationCard').default;

const fund = {
  monthlyContribution: 4800, firstMonthContribution: 5000, membersCount: 10,
  chitFundType: 'Fixed', currentMonth: 2, duration: 3, status: 'Active',
  fixedAmounts: [{ month: 1, amount: 40000 }, { month: 2, amount: 45000 }, { month: 3, amount: 47000 }],
  auctions: [
    { id: 1, month: 1, amount: 40000, date: new Date('2026-08-15') },
    { id: 2, month: 2, amount: 45000, date: new Date('2026-09-15') },
  ],
  contributions: [{ id: 1, month: 1, amount: 48200, paidDate: new Date('2026-08-10') }],
};

test('fixed commission respects first-month rules and actual payout amounts', () => {
  assert.equal(calculateChitPayoutCommission(fund, fund.auctions[0]), 8200);
  assert.equal(calculateChitPayoutCommission(fund, fund.auctions[1]), 3000);
  assert.equal(calculateChitPayoutCommission({ ...fund, firstMonthContribution: null }, fund.auctions[0]), 8000);
  assert.equal(calculateChitPayoutCommission({ ...fund, chitFundType: 'Auction' }, fund.auctions[0]), 8000);
  assert.equal(calculateChitPayoutCommission(fund, { month: 2, amount: 49000 }), -1000);
});

test('unpaid payout cash and member contributions are not income', () => {
  assert.equal(calculateChitFundProfit(fund, fund.contributions, []), 0);
  assert.equal(calculateChitFundProfitUpToCurrentMonth(fund, fund.contributions, []), 0);
  assert.equal(calculateChitFundProfitUpToCurrentMonth(fund, fund.contributions, fund.auctions), 11200);
  assert.equal(calculateChitFundProfitUpToCurrentMonth({ ...fund, currentMonth: 1 }, [], fund.auctions), 8200);
  assert.equal(calculateChitFundProfit(fund, [], [{ amount: 49000, month: 2 }]), -1000);
});

test('monthly commission and lifetime total reconcile; projection is separate', () => {
  const result = calculateChitCommissionTrends([fund], 6, new Date('2026-10-08'));
  assert.equal(result.months.length, 6);
  assert.equal(result.months.reduce((sum, row) => sum + row.commission, 0), result.summary.commission);
  assert.equal(result.summary.commission, 11200);
  assert.equal(result.summary.expectedRemainingCommission, 1000);
  assert.equal(result.summary.collectionPayoutBalance, -36800);
  assert.equal(result.months.find(row => row.key === '2026-08').commission, 8200);
  assert.equal(result.months.find(row => row.key === '2026-09').commission, 3000);
});

test('missing schedules are unknown, and future payouts and collections are excluded', () => {
  assert.equal(calculateChitCommissionTrends([{ ...fund, fixedAmounts: [] }], 6).summary.expectedRemainingCommission, null);
  const result = calculateChitCommissionTrends([{
    ...fund, currentMonth: 3,
    auctions: [...fund.auctions, { month: 3, amount: 47000, date: '2026-11-01' }],
    contributions: [...fund.contributions, { amount: 1000, paidDate: '2026-11-01' }],
  }], 6, new Date('2026-10-08'));
  assert.equal(result.summary.commission, 11200);
  assert.equal(result.summary.collections, 48200);
  assert.equal(result.summary.expectedRemainingCommission, 1000);
  assert.equal(calculateChitCommissionTrends([{ ...fund, status: 'Completed' }], 6).summary.expectedRemainingCommission, 0);
});

test('weekly loan income includes document charges and excess repayment once', () => {
  const loan = { id: 1, amount: 10000, documentCharge: 500, loanType: 'Flat', repaymentType: 'Weekly',
    interestRate: 0, remainingAmount: 0, disbursementDate: new Date('2026-08-01'),
    repayments: [{ id: 1, amount: 11000, paidDate: new Date('2026-09-01') }],
  };
  assert.equal(calculateLoanProfit(loan, loan.repayments), 1500);
  const total = calculateTotalFinancialMetrics([loan], [fund]);
  assert.equal(total.loanProfit, 1500);
  assert.equal(total.interestPayments, 1000);
  assert.equal(total.documentCharges, 500);
  assert.equal(total.chitFundProfit, 11200);
  assert.equal(total.totalProfit, 12700);
});

test('monthly and lifetime commission use the same completed-payout formula', () => {
  const result = calculatePeriodFinancialMetrics([], [fund], [], {
    startDate: new Date('2026-09-01'), endDate: new Date('2026-09-30T23:59:59'),
  });
  assert.equal(result.chitFundProfit, 3000);
});

test('loan return excludes chit earnings; zero/negative capital is unavailable', () => {
  const html = renderToStaticMarkup(React.createElement(LoanReturn, { loanProfit: 3000, investedAmount: 100000 }));
  assert.match(html, /3\.0%/);
  assert.doesNotMatch(html, /23\.0%/);
  for (const investedAmount of [0, -100]) {
    const unavailable = renderToStaticMarkup(React.createElement(LoanReturn, { loanProfit: 3000, investedAmount }));
    assert.match(unavailable, /—/);
    assert.doesNotMatch(unavailable, /Infinity|NaN/);
  }
  const combined = renderToStaticMarkup(React.createElement(BusinessEarnings, { loanProfit: 3000, chitFundProfit: 20000, investedAmount: 100000 }));
  assert.match(combined, /23,000/);
  assert.doesNotMatch(combined, /Overall ROI|Active Book Yield|Profit Margin/);
  const capital = renderToStaticMarkup(React.createElement(CapitalPosition, { loanOutstanding: 120000, investedAmount: 100000 }));
  assert.match(capital, /1\.20x/);
  assert.doesNotMatch(capital, /Capital Rotating|Available Buffer|Capital Multiplying/);
});

test('commission API enforces authentication and month bounds and only reads owner records', async () => {
  const Module = require('node:module');
  const originalLoad = Module._load;
  let currentUserId = null;
  const queries = [];
  let GET;
  try {
    Module._load = function(request, parent, isMain) {
      if (request.endsWith('/lib/auth')) return { getCurrentUserId: async () => currentUserId };
      if (request.endsWith('/lib/prisma')) return { __esModule: true, default: {
        chitFund: { findMany: async query => { queries.push(query); return [fund]; } },
      } };
      return originalLoad.call(this, request, parent, isMain);
    };
    GET = require('../app/api/chit-funds/monthly-profit/route').GET;
  } finally { Module._load = originalLoad; }
  const request = months => new Request(`http://localhost/api/chit-funds/monthly-profit?months=${months}`);
  assert.equal((await GET(request('6'))).status, 401);
  assert.equal(queries.length, 0);
  currentUserId = 42;
  for (const months of ['0', '-1', '25', 'abc', '1.5']) {
    assert.equal((await GET(request(months))).status, 400);
  }
  assert.equal(queries.length, 0);
  const response = await GET(request('6'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).months.length, 6);
  assert.deepEqual(queries[0].where, { createdById: 42 });
  // The mock exposes findMany only: any attempted create/update/delete fails this test.
});
