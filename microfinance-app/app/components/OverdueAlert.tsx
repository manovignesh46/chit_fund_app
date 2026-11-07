'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import { useDuesSoon } from '@/lib/query/dashboard';

/** Banner pointing to the Dues Tracker whenever anything is overdue or due this week. */
export default function OverdueAlert() {
  const { data } = useDuesSoon();
  const summary = data?.summary;
  if (!summary || (summary.overdueAmount <= 0 && summary.dueSoonAmount <= 0)) return null;
  const oldestDays = data?.accounts?.[0]?.maxDaysOverdue || 0;
  const overdue = summary.overdueAmount > 0;
  const Icon = overdue ? AlertTriangle : Clock;
  return (
    <Link
      href="/dues"
      className={cn(
        'mb-4 flex flex-col justify-between gap-2 rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:p-4',
        overdue ? 'border-destructive-border bg-destructive-subtle hover:bg-destructive-subtle/80' : 'border-warning-border bg-warning-subtle hover:bg-warning-subtle/80'
      )}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={cn('mt-0.5 h-5 w-5 shrink-0', overdue ? 'text-destructive-text' : 'text-warning-text')} />
        <div>
          <p className={cn('text-sm font-semibold tabular-nums', overdue ? 'text-destructive-text' : 'text-warning-text')}>
            {overdue
              ? `${formatMoney(summary.overdueAmount)} overdue from ${summary.overdueMembers} member${summary.overdueMembers === 1 ? '' : 's'}`
              : `${formatMoney(summary.dueSoonAmount)} due in the next 7 days`}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {overdue
              ? `${summary.overdueAccounts} account${summary.overdueAccounts === 1 ? '' : 's'} · oldest ${oldestDays} day${oldestDays === 1 ? '' : 's'} late${summary.dueSoonAmount > 0 ? ` · ${formatMoney(summary.dueSoonAmount)} more due this week` : ''}`
              : 'Send reminders before they become overdue'}
          </p>
        </div>
      </div>
      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium', overdue ? 'text-destructive-text' : 'text-warning-text')}>
        Open Dues Tracker
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </span>
    </Link>
  );
}
