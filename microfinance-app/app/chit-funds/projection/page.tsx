'use client';

/**
 * Auction Plan: the consolidated cash-flow projection (Report template). KPI strip, the
 * "simulate a new member" controls, a cumulative-balance chart, and the month table with
 * booked winners per month. Every figure is the server's (/api/projection/consolidated);
 * the page only sums the booked-but-unpaid payouts for the KPI strip, as before.
 * While a simulation loads, the previous figures stay on screen, dimmed.
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import useSWR from 'swr';
import { ChevronRight, History, ListPlus, Scale, UserPlus, Wallet } from 'lucide-react';

import { formatMoney } from '@/lib/format';
import { chitFundKeys } from '@/lib/query/chit-funds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartCard } from '@/components/kit/chart-card';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState } from '@/components/kit/error-state';
import { FormField } from '@/components/kit/form-field';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { SectionCard } from '@/components/kit/section-card';
import { StatCard } from '@/components/kit/stat-card';
import { StatusBadge } from '@/components/kit/status-badge';
import { cn } from '@/lib/utils';

const ProjectionChart = dynamic(() => import('@/app/components/chit-funds/ProjectionChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

interface ChitFundOption {
  id: number;
  name: string;
  duration: number;
  currentMonth: number;
  monthlyContribution: number;
  startDate: string;
  totalMembers?: number;
  unbookedCount?: number;
  unbookedAmount?: number;
}

interface UnbookedLiability {
  total: number;
  totalMembers: number;
  byFund: { fundId: number; fundName: string; unbookedCount: number; amount: number; months: { fundMonth: number; amount: number }[] }[];
}

interface BookedMember {
  fundId: number;
  fundName: string;
  memberName: string;
  fundMonth: number;
  payoutAmount: number;
  isActual?: boolean;
}

interface ProjectionRow {
  year: number;
  month: number;
  label: string;
  expectedLoanRepayments: number;
  expectedChitContributions: number;
  totalExpectedCollection: number;
  totalAuctionPayout: number;
  net: number;
  cumulativeBalance: number;
  isCurrentMonth?: boolean;
  isPastMonth?: boolean;
  isPastBalanceEstimated?: boolean;
  bookedMembers?: BookedMember[];
}

interface ProjectionResponse {
  projection?: ProjectionRow[];
  simulatedProjection?: ProjectionRow[] | null;
  chitFunds?: ChitFundOption[];
  openingBalance?: number | null;
  unbookedLiability?: UnbookedLiability | null;
}

interface Simulation {
  fundId: string;
  year: string;
  month: string;
  contribution: string;
}

/** Same params as before: simulateFundId, simulateFromYear, simulateFromMonth[, simulatedContribution]. */
function simulationParams(sim: Simulation | null): Record<string, string> | undefined {
  if (!sim?.fundId || !sim.year || !sim.month) return undefined;
  return {
    simulateFundId: sim.fundId,
    simulateFromYear: sim.year,
    simulateFromMonth: sim.month,
    ...(sim.contribution ? { simulatedContribution: sim.contribution } : {}),
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''}`;

export default function ChitFundProjectionPage() {
  return (
    <PageContainer>
      <Projection />
    </PageContainer>
  );
}

function Projection() {
  const [simulation, setSimulation] = React.useState<Simulation | null>(null);
  const query = useSWR<ProjectionResponse>(chitFundKeys.projection(simulationParams(simulation)));
  const data = query.data;
  const loading = query.isLoading;
  const projection = data?.projection ?? [];
  const simulatedProjection = data?.simulatedProjection ?? null;
  const chitFunds = data?.chitFunds ?? [];
  const openingBalance = data?.openingBalance ?? null;
  const unbookedLiability = data?.unbookedLiability ?? null;

  const [simulateFundId, setSimulateFundId] = React.useState('');
  const [simulateCalendarKey, setSimulateCalendarKey] = React.useState('');
  const [simulatedContribution, setSimulatedContribution] = React.useState('');
  const [expandedMonthKey, setExpandedMonthKey] = React.useState<string | null>(null);

  // Picking a fund fills the contribution with its monthly contribution (when empty), as before.
  React.useEffect(() => {
    if (simulateFundId && !simulatedContribution) {
      const fund = chitFunds.find((f) => String(f.id) === simulateFundId);
      if (fund) setSimulatedContribution(String(fund.monthlyContribution));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulateFundId, chitFunds]);

  const calendarMonthOptions = projection
    .filter((row) => !row.isPastMonth)
    .map((row) => ({ value: `${row.year}-${row.month}`, label: row.label }));

  const showSimulation = simulation !== null;
  const applySimulation = () => {
    if (!simulateFundId || !simulateCalendarKey) return;
    const [year, month] = simulateCalendarKey.split('-');
    setSimulation({ fundId: simulateFundId, year, month, contribution: simulatedContribution });
  };
  const clearSimulation = () => {
    setSimulation(null);
    setSimulateFundId('');
    setSimulateCalendarKey('');
  };

  const displayRows = showSimulation && simulatedProjection ? simulatedProjection : projection;
  const compareMode = showSimulation && !!simulatedProjection && projection.length > 0;

  const totalUnbookedMembers = chitFunds.reduce((sum, f) => sum + (f.unbookedCount ?? 0), 0);
  const fundsWithUnbooked = chitFunds.filter((f) => (f.unbookedCount ?? 0) > 0);

  // Last month's own pending entries are carried forward into "this month" so they're
  // actually subtracted somewhere in the balance chain — exclude the past-month row here so
  // those entries aren't summed twice.
  const pendingForTotals = projection
    .filter((row) => !row.isPastMonth)
    .flatMap((row) => row.bookedMembers ?? [])
    .filter((b) => !b.isActual);
  const totalPendingPayout = pendingForTotals.reduce((sum, b) => sum + b.payoutAmount, 0);
  const totalPendingCount = pendingForTotals.length;
  const finalRow = projection.length > 0 ? projection[projection.length - 1] : null;

  // Members with no booking yet never appear in any projection row, so their future payouts
  // are missing from the cumulative balance entirely. Booked winners, by contrast, are
  // already netted out month by month — subtracting them again would double-count them.
  const totalUnbookedPayout = unbookedLiability?.total ?? 0;
  const balanceAfterAllAuctions = (finalRow?.cumulativeBalance ?? 0) - totalUnbookedPayout;

  const points = React.useMemo(
    () =>
      displayRows.map((row, idx) => ({
        label: row.label,
        balance: row.cumulativeBalance,
        ...(compareMode && projection[idx] ? { baseline: projection[idx].cumulativeBalance } : {}),
      })),
    [displayRows, compareMode, projection]
  );

  const lastMonthRow = projection.find((r) => r.isPastMonth);
  const now = new Date();
  const hasData = !loading || data !== undefined;

  return (
    <div>
      <PageHeader
        title="Consolidated cash flow projection"
        description="Calendar-month view across all loans and chit funds — one shared pool of funds."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/chit-funds/auction-history">
                <History aria-hidden="true" />
                Auction history
              </Link>
            </Button>
            <Button asChild>
              <Link href="/chit-funds/auction-bookings">
                <ListPlus aria-hidden="true" />
                Edit bookings
              </Link>
            </Button>
          </>
        }
      />

      {query.error && !data ? (
        <SectionCard>
          <ErrorState title="Failed to load projection" error={query.error} onRetry={() => void query.mutate()} />
        </SectionCard>
      ) : null}

      {data === undefined && !query.error ? (
        <div aria-hidden="true" className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : null}

      {hasData && data !== undefined ? (
        <div className={cn('space-y-6 transition-opacity', loading && 'opacity-60')} aria-busy={loading || undefined}>
          {projection.length > 0 ? (
            <section aria-label="Auction planning summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Members not yet booked"
                icon={UserPlus}
                value={totalUnbookedMembers.toLocaleString('en-IN')}
                hint={fundsWithUnbooked.length > 0 ? fundsWithUnbooked.map((f) => `${f.name}: ${f.unbookedCount}`).join(', ') : 'Every member is booked or has won'}
              />
              <StatCard
                label="Pending auction payouts (booked)"
                icon={Wallet}
                tone={totalPendingPayout > 0 ? 'destructive' : 'neutral'}
                value={<Money value={totalPendingPayout} tone="plain" />}
                hint={
                  totalPendingCount === 0
                    ? 'Nothing still owed on booked winners'
                    : `Owed to ${totalPendingCount} booked winner${totalPendingCount !== 1 ? 's' : ''} — already subtracted in the table below`
                }
              />
              <StatCard
                label="Expected payouts — not yet booked"
                icon={Wallet}
                tone={totalUnbookedPayout > 0 ? 'destructive' : 'neutral'}
                value={<Money value={totalUnbookedPayout} tone="plain" />}
                hint={
                  <>
                    {totalUnbookedMembers === 0
                      ? 'Every member is booked or has won'
                      : `${plural(totalUnbookedMembers, 'open slot')} at each fund's predefined amounts — not in the table below`}
                    {(unbookedLiability?.byFund?.length ?? 0) > 0 ? (
                      <span className="mt-1 block">{unbookedLiability!.byFund.map((f) => `${f.fundName}: ${formatMoney(f.amount)}`).join(', ')}</span>
                    ) : null}
                  </>
                }
              />
              <StatCard
                label="Balance after settling all auctions"
                icon={Scale}
                tone={finalRow ? (balanceAfterAllAuctions >= 0 ? 'success' : 'destructive') : 'neutral'}
                value={finalRow ? <Money value={balanceAfterAllAuctions} tone="plain" /> : '—'}
                hint={
                  finalRow
                    ? totalUnbookedPayout > 0
                      ? `By ${finalRow.label} — the ${formatMoney(finalRow.cumulativeBalance)} closing balance below, less the not-yet-booked payouts`
                      : `By ${finalRow.label} — what remains after paying every booked winner above`
                    : ''
                }
              />
            </section>
          ) : null}

          <SectionCard
            title="Simulate adding a new member"
            description="Add one member's monthly contribution to a selected chit fund from a calendar month onward, and see the impact on consolidated cumulative balance."
          >
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_auto]">
              <FormField label="Chit fund" id="simulateFund">
                <NativeSelect
                  value={simulateFundId}
                  onValueChange={setSimulateFundId}
                  placeholder="Select fund…"
                  options={chitFunds.map((f) => ({ value: String(f.id), label: f.name }))}
                />
              </FormField>
              <FormField label="Starting calendar month" id="simulateMonth">
                <NativeSelect
                  value={simulateCalendarKey}
                  onValueChange={setSimulateCalendarKey}
                  placeholder="Select month…"
                  options={calendarMonthOptions}
                  disabled={calendarMonthOptions.length === 0}
                />
              </FormField>
              <FormField label="Monthly contribution" id="simulateContribution">
                <Input type="number" inputMode="decimal" min="0" value={simulatedContribution} onChange={(e) => setSimulatedContribution(e.target.value)} />
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={applySimulation} disabled={!simulateFundId || !simulateCalendarKey || loading}>
                  Run simulation
                </Button>
                {showSimulation ? (
                  <Button type="button" variant="outline" onClick={clearSimulation}>
                    Clear simulation
                  </Button>
                ) : null}
              </div>
            </div>
          </SectionCard>

          {query.error && data ? (
            <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
              {query.error.message}
            </p>
          ) : null}

          {projection.length > 0 ? (
            <>
              <ChartCard
                title="Cumulative balance by month"
                description={compareMode ? 'Simulated balance against the baseline.' : 'Projected closing balance of the shared pool, month by month.'}
                legend={compareMode ? [{ label: 'Simulated', slot: 1 }, { label: 'Baseline', slot: 2, dashed: true }] : undefined}
                height={260}
                tableNote="Every month's figures are listed in the table below."
              >
                <ProjectionChart points={points} compare={compareMode} />
              </ChartCard>

              <SectionCard flush>
                {compareMode ? (
                  <div className="border-b bg-warning-subtle px-4 py-3 text-sm text-warning-text">
                    Showing <strong>simulated</strong> consolidated projection. Cumulative balance differences vs baseline are highlighted.
                  </div>
                ) : null}
                {openingBalance !== null ? (
                  <p className="border-b px-4 py-2 text-xs text-muted-foreground">
                    {lastMonthRow ? (
                      <>
                        Each month builds forward from last month&apos;s real closing balance ({formatMoney(lastMonthRow.cumulativeBalance)}), adding that month&apos;s
                        own projected activity — including auction winners booked but not yet paid — so you can see what will remain after those payouts go out.
                      </>
                    ) : (
                      <>This month starts from your actual cash balance ({formatMoney(openingBalance)}) and projects forward from there.</>
                    )}
                  </p>
                ) : null}
                <p className="border-b px-4 py-2 text-xs text-muted-foreground">Click a calendar month to see booked auction winners.</p>
                <ProjectionTable
                  rows={displayRows}
                  baseline={projection}
                  compareMode={compareMode}
                  expandedKey={expandedMonthKey}
                  onToggle={(key) => setExpandedMonthKey((prev) => (prev === key ? null : key))}
                  now={now}
                />
              </SectionCard>
            </>
          ) : !query.error ? (
            <SectionCard>
              <EmptyState title="No active chit funds found." description="Projection requires at least one active chit fund." />
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ProjectionTable({
  rows,
  baseline,
  compareMode,
  expandedKey,
  onToggle,
  now,
}: {
  rows: ProjectionRow[];
  baseline: ProjectionRow[];
  compareMode: boolean;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  now: Date;
}) {
  const colSpan = compareMode ? 8 : 7;
  const th = 'px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="border-b bg-elevated">
          <tr>
            <th scope="col" className={cn(th, 'sticky left-0 z-10 bg-elevated text-left')}>
              Calendar month
            </th>
            <th scope="col" className={cn(th, 'text-right')}>Loan repayments</th>
            <th scope="col" className={cn(th, 'text-right')}>Chit contributions</th>
            <th scope="col" className={cn(th, 'text-right')}>Total collection</th>
            <th scope="col" className={cn(th, 'text-right')}>
              Auction payout
              <span className="block text-[10px] font-normal normal-case">(projected)</span>
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              Net
              <span className="block text-[10px] font-normal normal-case">(projected)</span>
            </th>
            <th scope="col" className={cn(th, 'text-right')}>{compareMode ? 'Sim. cumulative' : 'Cumulative balance'}</th>
            {compareMode ? <th scope="col" className={cn(th, 'text-right')}>Baseline cumulative</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const base = baseline[idx];
            const cumDiff = compareMode && base ? row.cumulativeBalance - base.cumulativeBalance : 0;
            const isCurrent = row.year === now.getFullYear() && row.month === now.getMonth() + 1;
            const isPastMonth = !!row.isPastMonth;
            const rowKey = `${row.year}-${row.month}`;
            const isExpanded = expandedKey === rowKey;
            const booked = row.bookedMembers ?? [];
            const pendingAmount = isCurrent || isPastMonth ? booked.filter((b) => !b.isActual).reduce((sum, b) => sum + b.payoutAmount, 0) : 0;
            const detailsId = `projection-month-${rowKey}`;
            return (
              <React.Fragment key={rowKey}>
                <tr
                  onClick={() => onToggle(rowKey)}
                  className={cn('cursor-pointer border-b transition-colors hover:bg-accent/60', isCurrent && 'bg-primary-subtle/60', isExpanded && 'bg-accent/60')}
                >
                  <td className={cn('sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-3 font-medium', isCurrent && 'bg-primary-subtle')}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={isExpanded ? detailsId : undefined}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle(rowKey);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ChevronRight aria-hidden="true" className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                      {row.label}
                      {isCurrent ? <span className="text-xs font-normal text-primary-text">(current)</span> : null}
                      {isPastMonth ? <span className="text-xs font-normal text-muted-foreground">(last month)</span> : null}
                      {booked.length > 0 ? <span className="text-xs font-normal text-muted-foreground">({booked.length} booked)</span> : null}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.expectedLoanRepayments > 0 ? <Money value={row.expectedLoanRepayments} tone="plain" /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.expectedChitContributions > 0 ? <Money value={row.expectedChitContributions} tone="plain" /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-medium">
                    <Money value={row.totalExpectedCollection} tone="plain" />
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.totalAuctionPayout > 0 ? <Money value={row.totalAuctionPayout} tone="outflow" /> : <span className="text-muted-foreground">—</span>}
                    {(isCurrent || isPastMonth) && pendingAmount > 0 ? (
                      <span className="block text-xs text-muted-foreground">({formatMoney(pendingAmount)} pending)</span>
                    ) : null}
                  </td>
                  <td className={cn('px-3 py-3 text-right font-medium', row.net > 0 ? 'text-success-text' : row.net < 0 ? 'text-destructive-text' : '')}>
                    <Money value={row.net} tone="plain" />
                  </td>
                  <td className={cn('px-3 py-3 text-right font-semibold', row.cumulativeBalance >= 0 ? 'text-success-text' : 'text-destructive-text')}>
                    <Money value={row.cumulativeBalance} tone="plain" />
                    {isPastMonth ? (
                      <span className="block text-xs font-normal text-muted-foreground">{row.isPastBalanceEstimated ? '(estimated)' : '(actual)'}</span>
                    ) : null}
                    {compareMode && cumDiff !== 0 ? (
                      <span className={cn('block text-xs font-normal', cumDiff >= 0 ? 'text-success-text' : 'text-destructive-text')}>
                        {cumDiff >= 0 ? '+' : ''}
                        {formatMoney(cumDiff)} vs baseline
                      </span>
                    ) : null}
                  </td>
                  {compareMode ? (
                    <td className="px-3 py-3 text-right text-muted-foreground">{base ? formatMoney(base.cumulativeBalance) : '—'}</td>
                  ) : null}
                </tr>
                {isExpanded ? (
                  <tr id={detailsId} className="border-b bg-elevated">
                    <td colSpan={colSpan} className="px-4 py-4 sm:px-6">
                      <BookedWinners row={row} showStatus={isCurrent || isPastMonth} />
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BookedWinners({ row, showStatus }: { row: ProjectionRow; showStatus: boolean }) {
  const members = row.bookedMembers ?? [];
  const paidCount = members.filter((b) => b.isActual).length;
  const pendingCount = members.length - paidCount;
  const sorted = [...members].sort((a, b) => Number(b.isActual) - Number(a.isActual));
  const heading = showStatus
    ? paidCount > 0 && pendingCount > 0
      ? `Auction payouts — ${paidCount} paid, ${pendingCount} booked (${row.label})`
      : paidCount > 0
        ? `Completed auction payouts — ${row.label}`
        : `Booked auction winners — ${row.label}`
    : `Booked auction winners — ${row.label}`;
  const emptyText = showStatus ? 'No auction winners recorded or booked for this month.' : 'No members booked for this month.';
  return (
    <div className="max-w-3xl rounded-lg border bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</p>
      {sorted.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="pb-2 pr-4 font-medium">Chit fund</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Member</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Fund month</th>
                {showStatus ? <th scope="col" className="pb-2 pr-4 font-medium">Status</th> : null}
                <th scope="col" className="pb-2 text-right font-medium">Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((b, i) => (
                <tr key={`${b.fundId}-${b.memberName}-${i}`}>
                  <td className="py-2 pr-4">{b.fundName}</td>
                  <td className="py-2 pr-4 font-medium">{b.memberName}</td>
                  <td className="py-2 pr-4 text-muted-foreground">Month {b.fundMonth}</td>
                  {showStatus ? (
                    <td className="py-2 pr-4">{b.isActual ? <StatusBadge status="Paid" /> : <StatusBadge status="Upcoming" label="Booked" />}</td>
                  ) : null}
                  <td className="py-2 text-right">
                    <Money value={b.payoutAmount} tone="outflow" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}
