'use client';

interface YieldMetricsCardProps { loanProfit: number; chitFundProfit: number; investedAmount: number; }

export default function YieldMetricsCard({ loanProfit, chitFundProfit, investedAmount }: YieldMetricsCardProps) {
  const totalIncome = loanProfit + chitFundProfit;
  const currency = (amount: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
  const rows = [
    ['Chit payout commission', chitFundProfit],
    ['Loan interest + document charges', loanProfit],
    ['Net recorded owner capital', investedAmount],
  ] as const;
  return (
    <div className="dark-card p-4 sm:p-6">
      <div className="flex justify-between gap-3 mb-3">
        <h3 className="card-title">Business Earnings</h3>
        <span className="text-xs text-gray-400">All-time</span>
      </div>
      <p className={`text-3xl font-bold ${totalIncome < 0 ? 'text-red-600' : 'text-green-600 dark:text-green-400'}`}>{currency(totalIncome)}</p>
      <p className="text-xs text-gray-500 mt-2">Combined income before operating expenses and losses.</p>
      <dl className="mt-5 space-y-3 text-sm">
        {rows.map(([label, amount]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-semibold text-gray-900 dark:text-theme-heading">{currency(amount)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-gray-500 mt-5">
        Member contributions and principal recoveries are cash movements, not earnings.
        Moving chit earnings into loans creates no additional income; interest earned afterwards belongs to loans.
      </p>
    </div>
  );
}
