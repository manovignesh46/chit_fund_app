'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '../../lib/formatUtils';

interface Summary {
  overdueAmount: number;
  overdueAccounts: number;
  overdueMembers: number;
  dueSoonAmount: number;
}

/** Dashboard banner pointing to the Dues Tracker whenever anything is overdue or due this week. */
export default function OverdueAlert() {
  const [summary, setSummary] = useState(null as Summary | null);
  const [oldestDays, setOldestDays] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dues?horizonDays=7')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setSummary(data.summary);
        setOldestDays(data.accounts?.[0]?.maxDaysOverdue || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary || (summary.overdueAmount <= 0 && summary.dueSoonAmount <= 0)) return null;

  const overdue = summary.overdueAmount > 0;
  return (
    <Link
      href="/dues"
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 sm:p-4 mb-4 transition-colors ${
        overdue
          ? 'border-red-200 bg-red-50 hover:bg-red-100 dark:border-red-900 dark:bg-red-900/20'
          : 'border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-900/20'
      }`}
    >
      <div>
        <p className={`text-sm font-semibold ${overdue ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
          {overdue
            ? `${formatCurrency(summary.overdueAmount)} overdue from ${summary.overdueMembers} member${summary.overdueMembers === 1 ? '' : 's'}`
            : `${formatCurrency(summary.dueSoonAmount)} due in the next 7 days`}
        </p>
        <p className="text-xs text-gray-600 dark:text-theme-muted">
          {overdue
            ? `${summary.overdueAccounts} account${summary.overdueAccounts === 1 ? '' : 's'} · oldest ${oldestDays} day${oldestDays === 1 ? '' : 's'} late${summary.dueSoonAmount > 0 ? ` · ${formatCurrency(summary.dueSoonAmount)} more due this week` : ''}`
            : 'Send reminders before they become overdue'}
        </p>
      </div>
      <span className={`text-sm font-medium whitespace-nowrap ${overdue ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
        Open Dues Tracker →
      </span>
    </Link>
  );
}
