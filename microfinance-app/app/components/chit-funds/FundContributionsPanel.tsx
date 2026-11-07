'use client';

/**
 * A fund's contributions at a glance (the fund page's Contributions tab): one card per
 * month that has started, and the outstanding partial-payment balances.
 *
 * Figures are the ones the fund page always computed in the browser, from the
 * contributions endpoint's complete `allContributions` and `members` lists:
 *  - a month is shown once its 1st calendar day has arrived (start date + month − 1);
 *  - expected = monthly contribution × members; collected = sum of that month's amounts;
 *  - balance = partial-payment balances of the month + monthly contribution × members
 *    with no contribution that month;
 *  - outstanding = balances > 0 whose balance payment is not 'Paid', per member.
 * No month cards when the fund has no members or no contributions yet (as before).
 */
import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import type { ChitFundDetail, ContributionsResponse } from '@/lib/query/chit-funds';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/kit/empty-state';
import { Money } from '@/components/kit/money';
import { SectionCard } from '@/components/kit/section-card';
import { cn } from '@/lib/utils';

type StatusMember = ContributionsResponse['members'][number];

export interface MonthContributions {
  month: number;
  contributionCount: number;
  memberCount: number;
  pendingCount: number;
  totalExpected: number;
  totalCollected: number;
  totalBalance: number;
  pendingMembers: StatusMember[];
}

export interface MemberBalance {
  id: number;
  name: string;
  totalBalance: number;
  months: { month: number; balance: number }[];
}

/** Months whose 1st day has arrived, by calendar date. */
function visibleMonthCount(startDate: string, duration: number, today = new Date()): number {
  const start = new Date(startDate);
  let max = 0;
  for (let month = 1; month <= (duration || 0); month++) {
    const monthStart = new Date(start);
    monthStart.setMonth(monthStart.getMonth() + (month - 1));
    monthStart.setDate(1);
    if (monthStart <= today) max = month;
    else break;
  }
  return max;
}

export function contributionsByMonth(fund: Pick<ChitFundDetail, 'startDate' | 'duration' | 'monthlyContribution'>, data: ContributionsResponse): MonthContributions[] {
  const members = data.members ?? [];
  const all = data.allContributions ?? [];
  if (!members.length || !all.length) return [];
  const out: MonthContributions[] = [];
  const last = visibleMonthCount(fund.startDate, fund.duration);
  for (let month = 1; month <= last; month++) {
    const forMonth = all.filter((c) => c.month === month);
    const pendingMembers = members.filter((member) => !all.some((c) => c.memberId === member.id && c.month === month));
    const pendingCount = pendingMembers.length;
    const totalCollected = forMonth.reduce((sum, c) => sum + c.amount, 0);
    const partial = forMonth.reduce((sum, c) => sum + (c.balance || 0), 0);
    out.push({
      month,
      contributionCount: forMonth.length,
      memberCount: members.length,
      pendingCount,
      totalExpected: fund.monthlyContribution * members.length,
      totalCollected,
      totalBalance: partial + pendingCount * fund.monthlyContribution,
      pendingMembers,
    });
  }
  return out;
}

export function outstandingBalances(data: ContributionsResponse): { total: number; members: MemberBalance[] } {
  const names = new Map((data.members ?? []).map((m) => [m.id, m.globalMember?.name]));
  const byMember = new Map<number, MemberBalance>();
  let total = 0;
  for (const c of data.allContributions ?? []) {
    if (!(c.balance > 0 && c.balancePaymentStatus !== 'Paid')) continue;
    total += c.balance;
    const entry = byMember.get(c.memberId) ?? { id: c.memberId, name: names.get(c.memberId) || 'Unknown', totalBalance: 0, months: [] };
    entry.totalBalance += c.balance;
    entry.months.push({ month: c.month, balance: c.balance });
    byMember.set(c.memberId, entry);
  }
  return { total, members: Array.from(byMember.values()) };
}

function MonthCard({ fundId, data }: { fundId: number; data: MonthContributions }) {
  const full = data.contributionCount === data.memberCount;
  const tone = data.totalBalance > 0 ? 'destructive' : full ? 'success' : 'warning';
  const percent = data.totalExpected > 0 ? Math.min((data.totalCollected / data.totalExpected) * 100, 100) : 0;
  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/chit-funds/${fundId}/contributions?month=${data.month}`}
            className="text-base font-semibold text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Month {data.month}
          </Link>
          {data.pendingCount > 0 ? (
            <span className="rounded-full border border-destructive-border bg-destructive-subtle px-2 py-0.5 text-xs font-medium text-destructive-text">
              {data.pendingCount} pending
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            'text-sm font-semibold',
            tone === 'destructive' ? 'text-destructive-text' : tone === 'success' ? 'text-success-text' : 'text-warning-text'
          )}
        >
          {data.totalBalance > 0 ? <Money value={data.totalBalance} tone="plain" /> : full ? 'Fully collected' : 'Partial'}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {data.contributionCount} of {data.memberCount} members
        </span>
        <span className="tabular-nums">
          <Money value={data.totalCollected} tone="plain" className="text-foreground" /> / <Money value={data.totalExpected} tone="plain" />
        </span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`Month ${data.month} collected`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div
          className={cn('h-full rounded-full', tone === 'destructive' ? 'bg-destructive' : tone === 'success' ? 'bg-success' : 'bg-warning')}
          style={{ width: `${percent}%` }}
        />
      </div>
      {data.pendingCount > 0 ? (
        <details className="group mt-3 text-sm">
          <summary className="cursor-pointer rounded-sm text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Show pending members ({data.pendingCount})
          </summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {data.pendingMembers.map((member) => (
              <li key={member.id} className="rounded-md bg-destructive-subtle px-2 py-0.5 text-xs text-destructive-text">
                {member.globalMember?.name ?? `Member #${member.id}`}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

export function FundContributionsPanel({ fund, data }: { fund: ChitFundDetail; data: ContributionsResponse }) {
  const months = React.useMemo(() => contributionsByMonth(fund, data).sort((a, b) => b.month - a.month), [fund, data]);
  const balances = React.useMemo(() => outstandingBalances(data), [data]);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Contributions overview"
        description="Every month that has started, latest first."
        actions={
          <Button variant="link" size="sm" asChild className="px-0">
            <Link href={`/chit-funds/${fund.id}/contributions`}>
              View all
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        {months.length === 0 ? (
          <EmptyState compact title="No contribution data available" />
        ) : (
          <ul className="space-y-3">
            {months.map((month) => (
              <MonthCard key={month.month} fundId={fund.id} data={month} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Outstanding balances"
        description="Partial payments still owed."
        actions={
          balances.members.length > 0 ? (
            <span className="rounded-full border border-destructive-border bg-destructive-subtle px-2.5 py-1 text-sm font-semibold text-destructive-text">
              <Money value={balances.total} tone="plain" />
            </span>
          ) : null
        }
      >
        {balances.members.length === 0 ? (
          <EmptyState compact title="No outstanding balances." />
        ) : (
          <ul className="divide-y">
            {balances.members.map((member) => (
              <li key={member.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <Money value={member.totalBalance} tone="overdue" className="text-sm font-semibold" />
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {member.months.map((m, index) => (
                    <li key={index} className="rounded-full bg-destructive-subtle px-2 py-0.5 text-xs font-medium text-destructive-text">
                      Month {m.month}: <Money value={m.balance} tone="plain" />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
