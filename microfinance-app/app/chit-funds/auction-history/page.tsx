'use client';

/**
 * Auction history (Auction Plan, Report template): every completed auction payout across
 * the chit funds, grouped by calendar month (newest first) with each month's total.
 * One request, as before: /api/projection/auction-history.
 */
import * as React from 'react';
import useSWR from 'swr';
import { CalendarDays, Gavel, Wallet } from 'lucide-react';

import { formatCalendarMonthLabel } from '@/lib/monthlyAggregations';
import { chitFundKeys } from '@/lib/query/chit-funds';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { SectionCard } from '@/components/kit/section-card';
import { StatCard } from '@/components/kit/stat-card';

interface AuctionHistoryRow {
  chitFundId: number;
  fundName: string;
  fundStatus: string;
  amount: number;
  date: string;
  memberName: string;
  fundMonth: number;
}

interface MonthGroup {
  year: number;
  month: number;
  label: string;
  total: number;
  rows: AuctionHistoryRow[];
}

const columns: DataTableColumn<AuctionHistoryRow>[] = [
  {
    id: 'fundName',
    header: 'Chit fund',
    cell: (a) => (
      <span>
        {a.fundName}
        {a.fundStatus !== 'Active' ? <span className="ml-1.5 text-xs text-muted-foreground">({a.fundStatus})</span> : null}
      </span>
    ),
  },
  { id: 'memberName', header: 'Member', cell: (a) => <span className="font-medium text-foreground">{a.memberName}</span> },
  { id: 'fundMonth', header: 'Fund month', cell: (a) => <span className="text-muted-foreground">Month {a.fundMonth}</span> },
  { id: 'date', header: 'Date', cell: (a) => <DateText value={a.date} className="text-muted-foreground" /> },
  { id: 'amount', header: 'Payout', numeric: true, cell: (a) => <Money value={a.amount} tone="outflow" /> },
];

export default function AuctionHistoryPage() {
  return (
    <PageContainer>
      <AuctionHistory />
    </PageContainer>
  );
}

function AuctionHistory() {
  const { data, error, mutate } = useSWR<{ auctions?: AuctionHistoryRow[] }>(chitFundKeys.auctionHistory());
  const auctions = React.useMemo(() => data?.auctions ?? [], [data]);

  const groups = React.useMemo<MonthGroup[]>(() => {
    const map = new Map<string, MonthGroup>();
    for (const a of auctions) {
      const d = new Date(a.date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${month}`;
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(a);
        existing.total += a.amount;
      } else {
        map.set(key, { year, month, label: formatCalendarMonthLabel(year, month), total: a.amount, rows: [a] });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
  }, [auctions]);

  const total = auctions.reduce((sum, a) => sum + a.amount, 0);
  const funds = new Set(auctions.map((a) => a.chitFundId)).size;

  return (
    <div>
      <PageHeader title="Auction history" description="All completed auction payouts across your chit funds, most recent first." />

      {error && !data ? (
        <SectionCard>
          <ErrorState title="Failed to load auction history" error={error} onRetry={() => void mutate()} />
        </SectionCard>
      ) : !data ? (
        <div aria-hidden="true" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : groups.length === 0 ? (
        <SectionCard>
          <EmptyState title="No completed auctions yet." />
        </SectionCard>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Total paid out" icon={Wallet} value={<Money value={total} tone="plain" compact />} hint={`${groups.length} months`} />
            <StatCard label="Auctions" icon={Gavel} value={auctions.length.toLocaleString('en-IN')} hint={`Across ${funds} chit ${funds === 1 ? 'fund' : 'funds'}`} />
            <StatCard
              label="Latest payout"
              icon={CalendarDays}
              value={<DateText value={auctions[0]?.date ?? null} className="text-xl" />}
              hint={auctions[0] ? `${auctions[0].memberName} · ${auctions[0].fundName}` : undefined}
            />
          </div>
          {groups.map((group) => (
            <SectionCard
              key={`${group.year}-${group.month}`}
              title={group.label}
              actions={<Money value={group.total} tone="outflow" className="text-sm font-semibold" />}
              flush
              contentClassName="p-3 sm:p-4"
            >
              <DataTable<AuctionHistoryRow>
                label={`Auction payouts, ${group.label}`}
                mode="client"
                columns={columns}
                rows={group.rows}
                getRowId={(a) => `${a.chitFundId}-${a.fundMonth}-${a.date}-${a.memberName}`}
              />
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
