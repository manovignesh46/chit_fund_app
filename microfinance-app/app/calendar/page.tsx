'use client';

/**
 * Calendar (Report/List hybrid). The month is `?month=YYYY-MM` (each change is a history
 * entry, so Back returns to the previous month); the kind filter is `?type=loan|chit`.
 * A month is one request (events + the month's figures); while the next month loads the
 * current one stays on screen, dimmed. Desktop: a month grid with event chips. Phones: a
 * compact grid with dots and the selected day's agenda underneath.
 *
 * The figures and the pending-members list live in app/components/calendar/month-panels.tsx
 * (tested by tests/test-calendar-pending.js).
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { eachDayOfInterval, endOfMonth, format, isSameDay, startOfMonth } from 'date-fns';
import { CalendarCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import { useUrlState } from '@/lib/list/useUrlState';
import { calendarKeys, useCalendarMonth, type CalendarEvent } from '@/lib/query/dashboard';
import { prefetchQuery } from '@/lib/query/prefetch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { chartColor } from '@/components/kit/chart-card';
import { RefreshProgress } from '@/components/kit/data-table';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { currentMonthKey, MonthPicker, monthLabel, monthRange, parseMonth, SegmentedControl } from '@/components/kit/period-picker';
import { StatusBadge } from '@/components/kit/status-badge';
import { MonthlyStatsCards, parseEventDate, toMonthStats, type ModalKind, type PendingKind } from '../components/calendar/month-panels';

const MonthTransactionsDialog = dynamic(() => import('../components/calendar/month-dialogs').then((m) => m.MonthTransactionsDialog), { ssr: false });
const CashFlowDialog = dynamic(() => import('../components/calendar/month-dialogs').then((m) => m.CashFlowDialog), { ssr: false });
const PendingMembersDialog = dynamic(() => import('../components/calendar/month-dialogs').then((m) => m.PendingMembersDialog), { ssr: false });

// A document load starts the month's request while the page is being evaluated.
if (typeof window !== 'undefined' && window.location.pathname === '/calendar') {
  const m = parseMonth(new URLSearchParams(window.location.search).get('month')) ?? parseMonth(currentMonthKey())!;
  prefetchQuery(calendarKeys.month(m.year, m.month));
}

const KINDS = [
  { value: 'all', label: 'All' },
  { value: 'loan', label: 'Loans' },
  { value: 'chit', label: 'Chit funds' },
] as const;
type Kind = (typeof KINDS)[number]['value'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DayEvent extends CalendarEvent {
  rawDate: Date;
}

const eventHref = (event: CalendarEvent) =>
  event.entityType === 'loan' && event.entityId
    ? `/loans/${event.entityId}`
    : event.entityType === 'chitFund' && event.entityId
      ? `/chit-funds/${event.entityId}`
      : null;

/** "Ravi Kumar Loan Payment (Period 3)" → "Ravi Kumar" (as the grid always shortened it). */
const chipTitle = (event: CalendarEvent) =>
  event.title.includes('Loan Payment') ? event.title.split('Loan Payment')[0].trim() : event.title;

const slotOf = (event: CalendarEvent) => (event.type === 'Loan' ? 1 : 2) as 1 | 2;

function EventStatus({ event }: { event: CalendarEvent }) {
  if (event.status === 'Overdue') return <StatusBadge status="Overdue" />;
  if (event.status === 'Paid') return <StatusBadge status="Paid" />;
  if (event.isDueTomorrow) return <StatusBadge status="Due Tomorrow" />;
  return null;
}

export default function CalendarPage() {
  return (
    <PageContainer wide fallback={<CalendarSkeleton />}>
      <Calendar />
    </PageContainer>
  );
}

function Calendar() {
  const monthState = useUrlState({ month: '' }, { history: 'push' });
  const filterState = useUrlState({ type: 'all' });
  const month = parseMonth(monthState.values.month) ? monthState.values.month : currentMonthKey();
  const kind: Kind = (['loan', 'chit'] as string[]).includes(filterState.values.type) ? (filterState.values.type as Kind) : 'all';
  const { year, month: m } = parseMonth(month)!;
  const query = useCalendarMonth(monthState.ready ? year : null, m);
  const data = query.data;

  // What is on screen is the loaded month (the previous one while the next loads).
  const shownYear = data?.year ?? year;
  const shownMonth = data?.month ?? m;
  const shownDate = new Date(shownYear, shownMonth - 1, 1);
  const refreshing = !!data && (data.year !== year || data.month !== m || query.isLoading);
  const label = monthLabel(shownYear, shownMonth);

  const events: DayEvent[] = React.useMemo(
    () => (data?.events ?? []).map((event) => ({ ...event, rawDate: parseEventDate(event.date) })),
    [data]
  );
  const visible = events.filter((e) => kind === 'all' || (kind === 'loan' ? e.type === 'Loan' : e.type === 'Chit Fund'));
  const stats = data ? toMonthStats(data) : null;
  const range = monthRange(shownYear, shownMonth);

  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  React.useEffect(() => {
    // Default the agenda to today in the current month, else the first day with events.
    if (!data) return;
    const today = new Date();
    const inMonth = today.getFullYear() === data.year && today.getMonth() + 1 === data.month;
    setSelectedDay(inMonth ? new Date(today.getFullYear(), today.getMonth(), today.getDate()) : events[0]?.rawDate ?? null);
  }, [data, events]);

  const [modal, setModal] = React.useState<ModalKind | null>(null);
  const [pending, setPending] = React.useState<PendingKind | null>(null);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const mount = () => setMounted(true);

  const goTo = (next: string) => monthState.set({ month: next === currentMonthKey() ? null : next });

  const header = (
    <PageHeader
      title="Calendar"
      description={monthLabel(year, m)}
      actions={
        <>
          <MonthPicker value={month} onChange={goTo} />
          <Button variant="outline" onClick={() => goTo(currentMonthKey())} aria-label="Go to Today">
            <CalendarCheck aria-hidden="true" />
            Today
          </Button>
        </>
      }
    />
  );

  if (!data) {
    return (
      <div>
        {header}
        {query.error ? <ErrorState title="Failed to load events" error={query.error} onRetry={() => void query.mutate()} /> : <CalendarBodySkeleton />}
      </div>
    );
  }

  const monthStart = startOfMonth(shownDate);
  const monthEnd = endOfMonth(shownDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const eventsOn = (day: Date) => visible.filter((e) => isSameDay(e.rawDate, day));
  const today = new Date();
  const agendaDays = selectedDay ? [selectedDay] : days.filter((d) => eventsOn(d).length > 0);

  return (
    <div className="relative" aria-busy={refreshing || undefined}>
      {header}
      <RefreshProgress active={refreshing} />
      <div className={cn('space-y-4 transition-opacity duration-200', refreshing && 'opacity-60 delay-150')}>
        <section aria-label={`${label} calendar`} className="rounded-xl border bg-card p-2 text-card-foreground shadow-sm sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-base font-semibold text-foreground">{label}</h2>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-3 text-xs text-muted-foreground sm:inline-flex" aria-hidden="true">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColor(1) }} />Loan</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColor(2) }} />Chit fund</span>
              </span>
              <SegmentedControl size="sm" aria-label="Show events" value={kind} onChange={(v) => filterState.set({ type: v === 'all' ? null : v })} options={[...KINDS]} />
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} aria-hidden="true" className="py-1 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {Array.from({ length: monthStart.getDay() }, (_, i) => (
              <div key={`s${i}`} aria-hidden="true" />
            ))}
            {days.map((day) => {
              const dayEvents = eventsOn(day);
              const isToday = isSameDay(day, today);
              const selected = !!selectedDay && isSameDay(day, selectedDay);
              const overdue = dayEvents.some((e) => e.status === 'Overdue');
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-w-0 rounded-md border md:min-h-[7.5rem]',
                    isToday ? 'border-primary' : 'border-border',
                    selected ? 'bg-primary-subtle' : 'bg-card'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDay(selected ? null : day)}
                    aria-label={`${format(day, 'd MMMM yyyy')}: ${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`}
                    aria-pressed={selected}
                    className="flex w-full flex-col items-center gap-1 rounded-md px-0.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:items-start md:px-2 md:py-1"
                  >
                    <span className={cn('text-sm font-semibold tabular-nums', isToday ? 'text-primary-text' : 'text-foreground')}>{format(day, 'd')}</span>
                    {/* Phones: dots (up to 3) for the day's events. */}
                    <span className="flex h-1.5 gap-0.5 md:hidden" aria-hidden="true">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: e.status === 'Overdue' ? 'hsl(var(--destructive))' : chartColor(slotOf(e)) }} />
                      ))}
                    </span>
                    {overdue ? <span className="sr-only">Has overdue payments</span> : null}
                  </button>
                  {/* Desktop: up to three chips, then "+N more" (opens the day's agenda). */}
                  <ul className="hidden space-y-1 px-1.5 pb-1.5 md:block">
                    {dayEvents.slice(0, 3).map((event) => {
                      const href = eventHref(event);
                      const body = (
                        <>
                          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chartColor(slotOf(event)) }} />
                          <span className="min-w-0 flex-1 truncate">{chipTitle(event)}</span>
                          {event.status === 'Overdue' ? <span className="shrink-0 font-semibold text-destructive-text">OD</span> : null}
                          {event.status === 'Paid' ? <span className="shrink-0 font-semibold text-success-text">Paid</span> : null}
                        </>
                      );
                      const cls = cn(
                        'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
                        event.status === 'Overdue' ? 'bg-destructive-subtle text-foreground' : event.isDueTomorrow ? 'bg-warning-subtle text-foreground' : 'bg-muted text-foreground'
                      );
                      const title = `${event.title}${event.dueAmount !== undefined ? `: ${formatMoney(event.dueAmount)}` : ''}`;
                      return (
                        <li key={event.id}>
                          {href ? (
                            <Link href={href} title={title} className={cn(cls, 'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
                              {body}
                            </Link>
                          ) : (
                            <span title={title} className={cls}>{body}</span>
                          )}
                        </li>
                      );
                    })}
                    {dayEvents.length > 3 ? (
                      <li>
                        <button type="button" onClick={() => setSelectedDay(day)} className="rounded px-1.5 text-xs font-medium text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          +{dayEvents.length - 3} more
                        </button>
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="calendar-agenda" className="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-6">
            <h2 id="calendar-agenda" className="text-base font-semibold text-foreground">
              {selectedDay ? format(selectedDay, 'EEEE, d MMMM') : `All events in ${label}`}
            </h2>
            {selectedDay ? (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
                Show whole month
              </Button>
            ) : null}
          </div>
          {visible.length === 0 ? (
            <EmptyState compact title="No events found" description="There are no events scheduled for this month." />
          ) : (
            <div className="divide-y">
              {agendaDays.map((day) => {
                const list = eventsOn(day);
                return (
                  <div key={day.toISOString()} className="px-4 py-3 sm:px-6">
                    {!selectedDay ? <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{format(day, 'EEE d MMM')}</h3> : null}
                    {list.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nothing scheduled on this day.</p>
                    ) : (
                      <ul className="space-y-2">
                        {list.map((event) => {
                          const href = eventHref(event);
                          const content = (
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-2">
                                <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chartColor(slotOf(event)) }} />
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-medium text-foreground">{event.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {event.type}
                                    {event.period ? ` · due: ${event.period}` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                {event.dueAmount !== undefined ? <Money value={event.dueAmount} tone="plain" className="text-sm font-semibold" /> : null}
                                <EventStatus event={event} />
                              </div>
                            </div>
                          );
                          return (
                            <li key={event.id}>
                              {href ? (
                                <Link href={href} className="-mx-2 block rounded-md px-2 py-1.5 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                  {content}
                                </Link>
                              ) : (
                                <div className="py-1.5">{content}</div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {stats ? (
          <MonthlyStatsCards
            stats={stats}
            monthLabel={label}
            onOpenModal={(k) => { mount(); setModal(k); }}
            onOpenSummary={() => { mount(); setSummaryOpen(true); }}
            onOpenPending={(k) => { mount(); setPending(k); }}
          />
        ) : null}
      </div>

      {mounted ? (
        <>
          <MonthTransactionsDialog kind={modal} onClose={() => setModal(null)} range={range} monthLabel={label} />
          {stats ? <CashFlowDialog open={summaryOpen} onClose={() => setSummaryOpen(false)} stats={stats} monthLabel={label} /> : null}
          <PendingMembersDialog kind={pending} month={shownDate} monthLabel={label} onClose={() => setPending(null)} />
        </>
      ) : null}
    </div>
  );
}

function CalendarBodySkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="h-10 md:h-28" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-80" />
      </div>
      <CalendarBodySkeleton />
    </div>
  );
}
