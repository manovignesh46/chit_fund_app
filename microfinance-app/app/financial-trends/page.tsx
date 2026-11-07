'use client';

/**
 * Financial trends (Report template): period in the URL (`?period=weekly|monthly|yearly`,
 * default monthly), export, KPI strip over the periods shown, chart cards (one measure per
 * chart) and the per-period breakdown table. Rows open the period's detail.
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import { Download } from 'lucide-react';

import { dashboardAPI } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useUrlState } from '@/lib/list/useUrlState';
import { prefetchQuery } from '@/lib/query/prefetch';
import { TREND_LIMITS, trendKeys, useFinancialData, type FinancialDataResponse, type FinancialPeriod, type TrendDuration } from '@/lib/query/dashboard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ChartCard } from '@/components/kit/chart-card';
import { DataTable, RefreshProgress, type DataTableColumn } from '@/components/kit/data-table';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { SegmentedControl } from '@/components/kit/period-picker';
import { StatCard } from '@/components/kit/stat-card';

const FinancialGraph = dynamic(() => import('../components/FinancialGraph'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});
const FinancialDetailModal = dynamic(() => import('../components/FinancialDetailModal'), { ssr: false });

// Start loading the chart code with the page's code (in parallel with the data), not after
// the data arrives; a document load of the page also starts its data request right here.
if (typeof window !== 'undefined') {
  void import('../components/FinancialGraph');
  if (window.location.pathname === '/financial-trends') {
    const period = new URLSearchParams(window.location.search).get('period');
    prefetchQuery(trendKeys.financialData(period === 'weekly' || period === 'yearly' ? period : 'monthly'));
  }
}

const PERIODS: { value: TrendDuration; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];
const isDuration = (v: string): v is TrendDuration => v === 'weekly' || v === 'monthly' || v === 'yearly';

/** The API's parallel arrays as one row per period, with each period's detail (as the page always built it). */
function toPeriods(api: FinancialDataResponse | undefined): { periods: FinancialPeriod[]; error: string | null } {
  if (!api || !Array.isArray(api.labels) || api.labels.length === 0) return { periods: [], error: 'No financial data available' };
  const { labels, cashInflow, cashOutflow, profit, outsideAmount } = api;
  if (![cashInflow, cashOutflow, profit, outsideAmount].every(Array.isArray)) return { periods: [], error: 'Missing required data in API response' };
  if (![cashInflow!, cashOutflow!, profit!, outsideAmount!].every((a) => a.length === labels.length)) {
    return { periods: [], error: 'Inconsistent data format received from API' };
  }
  return {
    error: null,
    periods: labels.map((label, i) => ({
      label,
      period: label,
      cashInflow: cashInflow![i],
      cashOutflow: cashOutflow![i],
      profit: profit![i],
      outsideAmount: outsideAmount![i],
      ...(api.periodsData?.[i] ?? {}),
    })) as FinancialPeriod[],
  };
}

export default function FinancialTrendsPage() {
  return (
    <PageContainer>
      <FinancialTrends />
    </PageContainer>
  );
}

function FinancialTrends() {
  const url = useUrlState({ period: 'monthly' });
  const duration: TrendDuration = isDuration(url.values.period) ? url.values.period : 'monthly';
  const query = useFinancialData(url.ready ? duration : null);
  const [showProfit, setShowProfit] = React.useState(false);
  const [selected, setSelected] = React.useState<FinancialPeriod | null>(null);
  const [detailMounted, setDetailMounted] = React.useState(false);

  const { periods, error: shapeError } = React.useMemo(() => toPeriods(query.data), [query.data]);
  const loaded = query.data !== undefined;
  const refreshing = loaded && query.isLoading;
  const error = query.error ?? (loaded ? shapeError : null);

  const totals = React.useMemo(
    () => ({
      inflow: periods.reduce((s, p) => s + (p.cashInflow || 0), 0),
      outflow: periods.reduce((s, p) => s + (p.cashOutflow || 0), 0),
      profit: periods.reduce((s, p) => s + (p.profit || 0), 0),
      outside: periods.length ? periods[periods.length - 1].outsideAmount : 0,
    }),
    [periods]
  );

  const open = (period: string) => {
    const row = periods.find((p) => p.period === period);
    if (!row) return;
    setDetailMounted(true);
    setSelected(row);
  };

  const chartData = periods.map((p) => ({ period: p.period, cashInflow: p.cashInflow, cashOutflow: p.cashOutflow, outsideAmount: p.outsideAmount, profit: p.profit }));
  const unit = duration === 'weekly' ? 'weeks' : duration === 'monthly' ? 'months' : 'years';
  const span = `Last ${TREND_LIMITS[duration]} ${unit}`;

  const columns: DataTableColumn<FinancialPeriod>[] = [
    { id: 'period', header: 'Period', cell: (p) => <span className="font-medium text-foreground">{p.period}</span> },
    { id: 'cashInflow', header: 'Cash inflow', numeric: true, cell: (p) => <Money value={p.cashInflow} tone="inflow" /> },
    { id: 'cashOutflow', header: 'Cash outflow', numeric: true, cell: (p) => <Money value={p.cashOutflow} tone="plain" /> },
    { id: 'net', header: 'Net cash flow', numeric: true, hideBelow: 'sm', cell: (p) => <Money value={p.cashFlowDetails?.netCashFlow ?? p.cashInflow - p.cashOutflow} tone="auto" /> },
    ...(showProfit ? [{ id: 'profit', header: 'Profit', numeric: true, cell: (p: FinancialPeriod) => <Money value={p.profit} tone="auto" /> }] : []),
    { id: 'outsideAmount', header: 'Outside amount', numeric: true, cell: (p) => <Money value={p.outsideAmount} tone="plain" /> },
  ];

  return (
    <div>
      <PageHeader
        title="Financial trends"
        description="Cash flow, profit and money outside, period by period."
        actions={
          <>
            <SegmentedControl aria-label="Period" value={duration} onChange={(next) => url.set({ period: next === 'monthly' ? null : next })} options={PERIODS} />
            <Button
              variant="outline"
              onClick={() => {
                void dashboardAPI.exportFinancialData(duration, TREND_LIMITS[duration]);
                toast('Downloading the financial report');
              }}
            >
              <Download aria-hidden="true" />
              Export
            </Button>
          </>
        }
      />

      {error && periods.length === 0 ? (
        <ErrorState title="Failed to load financial data" error={error} onRetry={() => void query.mutate()} />
      ) : (
        <div className="relative space-y-6" aria-busy={refreshing || undefined}>
          <RefreshProgress active={refreshing} />
          <section aria-label={`Totals, ${span.toLowerCase()}`} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard loading={!loaded} label="Cash inflow" value={<Money value={totals.inflow} tone="inflow" />} hint={span} />
            <StatCard loading={!loaded} label="Cash outflow" value={<Money value={totals.outflow} tone="plain" />} hint={span} />
            {showProfit ? (
              <StatCard loading={!loaded} label="Profit" value={<Money value={totals.profit} tone="auto" />} hint={span} />
            ) : (
              <StatCard loading={!loaded} label="Net cash flow" value={<Money value={totals.inflow - totals.outflow} tone="auto" />} hint={span} />
            )}
            <StatCard loading={!loaded} label="Outside amount" value={<Money value={totals.outside} tone="plain" />} hint="At the end of the latest period" />
          </section>

          <div className="flex items-center gap-2">
            <Switch id="trends-show-profit" checked={showProfit} onCheckedChange={setShowProfit} />
            <Label htmlFor="trends-show-profit" className="text-sm font-normal">
              Show profit
            </Label>
          </div>

          <div className={`grid grid-cols-1 gap-4 transition-opacity lg:grid-cols-2 ${refreshing ? 'opacity-60' : ''}`}>
            <ChartCard
              title="Cash flow"
              description="Money in (repayments, contributions) and out (loans given, auction payouts)"
              legend={[
                { label: 'Cash inflow', slot: 1 },
                { label: 'Cash outflow', slot: 2 },
              ]}
              tableNote="Every figure is listed in the table below. Click a period for its breakdown."
              className="lg:col-span-2"
              height={300}
            >
              {loaded ? (
                <FinancialGraph
                  kind="bar"
                  data={chartData}
                  onSelect={open}
                  series={[
                    { key: 'cashInflow', label: 'Cash inflow', slot: 1 },
                    { key: 'cashOutflow', label: 'Cash outflow', slot: 2 },
                  ]}
                />
              ) : (
                <Skeleton className="h-full w-full" />
              )}
            </ChartCard>
            <ChartCard title="Outside amount" description="Loans and chit funds still to be collected" height={240} className={showProfit ? undefined : 'lg:col-span-2'}>
              {loaded ? <FinancialGraph kind="line" data={chartData} onSelect={open} series={[{ key: 'outsideAmount', label: 'Outside amount', slot: 1 }]} /> : <Skeleton className="h-full w-full" />}
            </ChartCard>
            {showProfit ? (
              <ChartCard title="Profit" description="Interest, document charges and auction commissions" height={240}>
                {loaded ? <FinancialGraph kind="bar" data={chartData} onSelect={open} series={[{ key: 'profit', label: 'Profit', slot: 1 }]} /> : <Skeleton className="h-full w-full" />}
              </ChartCard>
            ) : null}
          </div>

          <section aria-labelledby="trends-breakdown" className="space-y-3">
            <h2 id="trends-breakdown" className="text-base font-semibold text-foreground">
              Breakdown by period
            </h2>
            <DataTable<FinancialPeriod>
              label="Breakdown by period"
              mode="client"
              columns={columns}
              rows={periods}
              getRowId={(p) => p.period}
              isInitialLoading={!loaded}
              isRefreshing={refreshing}
              skeletonRows={TREND_LIMITS[duration]}
              onRowClick={(p) => open(p.period)}
              emptyState={<p className="p-6 text-center text-sm text-muted-foreground">No periods to show.</p>}
            />
          </section>
        </div>
      )}

      {detailMounted ? <FinancialDetailModal isOpen={selected !== null} onClose={() => setSelected(null)} periodData={selected} /> : null}
    </div>
  );
}
