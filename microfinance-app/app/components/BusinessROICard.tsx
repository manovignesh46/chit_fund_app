'use client';

interface BusinessROICardProps { loanProfit: number; investedAmount: number; }

export default function BusinessROICard({ loanProfit, investedAmount }: BusinessROICardProps) {
  const roi = investedAmount > 0 ? `${((loanProfit / investedAmount) * 100).toFixed(1)}%` : '—';
  const currency = (amount: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
  return (
    <div className="dark-card p-4 sm:p-6">
      <div className="flex justify-between gap-3 mb-3">
        <h3 className="card-title">Loan Return on Owner Capital</h3>
        <span className="text-xs text-gray-400">All-time</span>
      </div>
      <p className={`text-3xl font-bold ${loanProfit < 0 ? 'text-red-600' : 'text-green-600 dark:text-green-400'}`}>{roi}</p>
      <p className="text-sm text-gray-500 mt-3">Interest and document charges ÷ net recorded owner capital.</p>
      <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
        <p>Loan income: {currency(loanProfit)}</p>
        <p>Net owner capital: {currency(investedAmount)}</p>
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Chit commission is excluded. This is a cumulative ratio, not an annual return.
        {investedAmount <= 0 && ' Return is unavailable without positive recorded capital.'}
      </p>
    </div>
  );
}
