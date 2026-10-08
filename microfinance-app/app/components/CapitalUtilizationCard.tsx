'use client';

interface CapitalUtilizationCardProps { loanOutstanding: number; investedAmount: number; }

export default function CapitalUtilizationCard({ loanOutstanding, investedAmount }: CapitalUtilizationCardProps) {
  const currency = (amount: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
  const ratio = investedAmount > 0 ? `${(loanOutstanding / investedAmount).toFixed(2)}x` : '—';
  return (
    <div className="dark-card p-4 sm:p-6">
      <h3 className="card-title mb-3">Loan Capital Position</h3>
      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{ratio}</p>
      <p className="text-sm text-gray-500 mt-2">Outstanding loan principal relative to net owner capital.</p>
      <dl className="space-y-3 mt-5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Outstanding principal</dt>
          <dd className="font-semibold text-gray-900 dark:text-theme-heading">{currency(loanOutstanding)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Net recorded owner capital</dt>
          <dd className="font-semibold text-gray-900 dark:text-theme-heading">{currency(investedAmount)}</dd>
        </div>
      </dl>
      <p className="text-xs text-gray-500 mt-5">
        Reinvested earnings can also fund loans. This comparison does not measure cash available or how often capital was lent again.
      </p>
    </div>
  );
}
