'use client';

/**
 * Auction bookings (Auction Plan): plan future auction winners per fund month. The chosen
 * fund is kept in the URL (?fund=), so refresh and Back reopen it. Completed auctions show
 * as "won" tags; planned bookings can be removed (after a confirmation) or added per month.
 * Requests and bodies are as before: GET/POST/DELETE /api/chit-funds/:id/auction-bookings.
 */
import * as React from 'react';
import { Plus, X } from 'lucide-react';

import { toast } from '@/lib/toast';
import { useListParams } from '@/lib/list/useListParams';
import { getFundMonthCalendarDate } from '@/lib/monthlyAggregations';
import useSWR from 'swr';
import {
  chitFundKeys,
  chitFundWrites,
  invalidateProjection,
  useAuctionBookings,
  type AuctionBooking,
  type AuctionBookingsResponse,
  type ChitFundRecord,
} from '@/lib/query/chit-funds';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { FormField } from '@/components/kit/form-field';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { SectionCard } from '@/components/kit/section-card';
import { cn } from '@/lib/utils';

const FILTERS = ['fund'] as const;

interface MonthRow {
  month: number;
  planned: AuctionBooking[];
  completed: AuctionBookingsResponse['completedAuctions'];
}

function formatFundCalendarMonth(startDate: string, fundMonth: number): string {
  return getFundMonthCalendarDate(startDate, fundMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
}

export default function AuctionBookingsPage() {
  return (
    <PageContainer>
      <AuctionBookings />
    </PageContainer>
  );
}

function AuctionBookings() {
  const list = useListParams<(typeof FILTERS)[number]>({ id: 'auction-bookings', filters: FILTERS });
  const fundsQuery = useSWR<{ chitFunds?: ChitFundRecord[] }>(chitFundKeys.activeFunds());
  const chitFunds = fundsQuery.data?.chitFunds ?? [];
  const selectedFundId = list.ready ? list.params.fund ?? '' : '';
  const fundId = parseInt(selectedFundId, 10) || null;
  const bookingsQuery = useAuctionBookings(fundId);
  const data = bookingsQuery.data;
  const fundMeta = data?.chitFund ?? null;

  const [addingMonth, setAddingMonth] = React.useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState<AuctionBooking | null>(null);

  React.useEffect(() => {
    setAddingMonth(null);
    setSelectedMemberId('');
  }, [fundId]);

  const bookings = React.useMemo(() => data?.bookings ?? [], [data]);
  const completedAuctions = React.useMemo(() => data?.completedAuctions ?? [], [data]);
  const members = data?.members ?? [];

  const assignedMemberIds = React.useMemo(() => {
    const ids = new Set<number>();
    for (const b of bookings) ids.add(b.memberId);
    for (const a of completedAuctions) ids.add(a.memberId);
    return ids;
  }, [bookings, completedAuctions]);

  const bookingsByMonth = React.useMemo<MonthRow[]>(() => {
    if (!fundMeta) return [];
    const map = new Map<number, MonthRow>();
    for (let m = 1; m <= fundMeta.duration; m++) map.set(m, { month: m, planned: [], completed: [] });
    for (const b of bookings) {
      const entry = map.get(b.month) ?? { month: b.month, planned: [], completed: [] };
      entry.planned.push(b);
      map.set(b.month, entry);
    }
    for (const a of completedAuctions) {
      const entry = map.get(a.month) ?? { month: a.month, planned: [], completed: [] };
      entry.completed.push(a);
      map.set(a.month, entry);
    }
    return Array.from(map.values());
  }, [bookings, completedAuctions, fundMeta]);

  const availableMembers = members.filter((m) => !assignedMemberIds.has(m.id));

  /** Put the server's change into the cached bookings (no refetch, as the page always did). */
  const updateBookings = (change: (prev: AuctionBooking[]) => AuctionBooking[]) =>
    bookingsQuery.mutate((prev) => (prev ? { ...prev, bookings: change(prev.bookings) } : prev), { revalidate: false });

  const handleAddBooking = async (month: number) => {
    if (!selectedMemberId || !fundId) return;
    setSaving(true);
    try {
      const newBooking = await chitFundWrites.addBooking(fundId, { month, memberId: Number(selectedMemberId) });
      await updateBookings((prev) => [...prev, newBooking]);
      void invalidateProjection();
      toast.success('Booking added', { description: `${newBooking.memberName} · month ${newBooking.month}` });
      setSelectedMemberId('');
      setAddingMonth(null);
    } catch (error) {
      toast.error('Failed to add booking', { description: errorMessage(error) ?? undefined });
    } finally {
      setSaving(false);
    }
  };

  const removeBooking = async (booking: AuctionBooking) => {
    if (!fundId) return;
    setSaving(true);
    try {
      await chitFundWrites.removeBooking(fundId, booking.id);
      await updateBookings((prev) => prev.filter((b) => b.id !== booking.id));
      void invalidateProjection();
      toast.success('Booking removed', { description: `${booking.memberName} · month ${booking.month}` });
    } catch (error) {
      throw new Error(errorMessage(error) ?? 'Failed to remove booking');
    } finally {
      setSaving(false);
    }
  };

  const now = new Date();
  const columns: DataTableColumn<MonthRow>[] = fundMeta
    ? [
        {
          id: 'month',
          header: 'Due month',
          width: '8rem',
          cell: ({ month }) => (
            <span className="whitespace-nowrap">
              <span className="font-medium text-foreground tabular-nums">{month}</span>
              {month === fundMeta.currentMonth ? <span className="ml-2 text-xs text-primary-text">(current)</span> : null}
              {month < fundMeta.currentMonth ? <span className="ml-2 text-xs text-muted-foreground">(past)</span> : null}
            </span>
          ),
        },
        {
          id: 'calendar',
          header: 'Calendar month',
          cell: ({ month }) => {
            const calDate = getFundMonthCalendarDate(fundMeta.startDate, month);
            const isNow = calDate.getFullYear() === now.getFullYear() && calDate.getMonth() === now.getMonth();
            return (
              <span className="whitespace-nowrap text-muted-foreground">
                {formatFundCalendarMonth(fundMeta.startDate, month)}
                {isNow ? <span className="ml-1 text-xs text-primary-text">(now)</span> : null}
              </span>
            );
          },
        },
        {
          id: 'booked',
          header: 'Booked / won',
          cell: ({ planned, completed }) =>
            planned.length === 0 && completed.length === 0 ? (
              <span className="italic text-muted-foreground">Unbooked</span>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {completed.map((a) => (
                  <li
                    key={`auction-${a.id}`}
                    title="Completed auction — recorded on Auctions page"
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-success-border bg-success-subtle px-2.5 text-xs font-medium text-success-text"
                  >
                    {a.memberName}
                    <span className="opacity-75">(won)</span>
                  </li>
                ))}
                {planned.map((b) => (
                  <li key={b.id} className="inline-flex h-7 items-center gap-0.5 rounded-full border border-info-border bg-info-subtle pl-2.5 text-xs font-medium text-info-text">
                    {b.memberName}
                    <button
                      type="button"
                      onClick={() => setRemoving(b)}
                      disabled={saving}
                      aria-label={`Remove planned booking for ${b.memberName}`}
                      title="Remove planned booking"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:text-destructive-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ),
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: ({ month }) =>
            addingMonth === month ? (
              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect
                  size="sm"
                  aria-label={`Member for month ${month}`}
                  className="min-w-40"
                  value={selectedMemberId}
                  onValueChange={setSelectedMemberId}
                  placeholder="Select member…"
                  options={availableMembers.map((m) => ({ value: String(m.id), label: m.name }))}
                  autoFocus
                />
                <Button size="sm" onClick={() => void handleAddBooking(month)} disabled={!selectedMemberId || saving}>
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingMonth(null);
                    setSelectedMemberId('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="link"
                className="px-0"
                onClick={() => {
                  setAddingMonth(month);
                  setSelectedMemberId('');
                }}
                disabled={availableMembers.length === 0 || saving}
              >
                {availableMembers.length === 0 ? (
                  'All members booked'
                ) : (
                  <>
                    <Plus aria-hidden="true" />
                    Add member
                  </>
                )}
              </Button>
            ),
        },
      ]
    : [];

  const counts = [
    { label: 'members assigned', value: `${assignedMemberIds.size} of ${members.length}` },
    ...(completedAuctions.length > 0 ? [{ label: `completed auction${completedAuctions.length !== 1 ? 's' : ''}`, value: String(completedAuctions.length) }] : []),
    ...(bookings.length > 0 ? [{ label: `planned booking${bookings.length !== 1 ? 's' : ''}`, value: String(bookings.length) }] : []),
    { label: 'unassigned', value: String(availableMembers.length) },
  ];

  return (
    <div>
      <PageHeader
        title="Auction bookings"
        description="Plan future auction winners. Green tags are completed auctions; blue tags are planned bookings you can edit."
      />

      <SectionCard className="mb-6">
        <FormField label="Select chit fund" id="chitFund" className="max-w-md">
          <NativeSelect
            value={selectedFundId}
            onValueChange={(value) => list.setParams({ fund: value || null })}
            disabled={!fundsQuery.data && !fundsQuery.error}
            placeholder="Choose a chit fund…"
            options={chitFunds.map((f) => ({ value: String(f.id), label: `${f.name} (Month ${f.currentMonth}/${f.duration})` }))}
          />
        </FormField>
        {fundsQuery.error ? <ErrorState compact title="Failed to load chit funds" error={fundsQuery.error} onRetry={() => void fundsQuery.mutate()} /> : null}
      </SectionCard>

      {!fundId ? (
        fundsQuery.data ? (
          <SectionCard>
            <EmptyState title="Select a chit fund above to plan auction bookings." />
          </SectionCard>
        ) : null
      ) : bookingsQuery.error && !data ? (
        <SectionCard>
          <ErrorState title="Failed to load bookings" error={bookingsQuery.error} onRetry={() => void bookingsQuery.mutate()} />
        </SectionCard>
      ) : (
        <>
          {fundMeta ? (
            <dl className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {counts.map((c) => (
                <div key={c.label} className="flex items-baseline gap-1.5">
                  <dd className="font-semibold tabular-nums text-foreground">{c.value}</dd>
                  <dt>{c.label}</dt>
                </div>
              ))}
            </dl>
          ) : null}
          <div className={cn(bookingsQuery.isLoading && data && 'opacity-60')}>
            <DataTable<MonthRow>
              label="Auction bookings by month"
              mode="client"
              columns={columns}
              rows={bookingsByMonth}
              getRowId={(row) => row.month}
              isInitialLoading={!data}
              isRefreshing={!!data && bookingsQuery.isLoading}
              skeletonRows={8}
              rowClassName={(row) => (fundMeta && row.month === fundMeta.currentMonth ? 'bg-primary-subtle/50' : undefined)}
              emptyState={<EmptyState compact title="This fund has no months." />}
            />
          </div>
        </>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove planned booking?"
        description={removing ? `${removing.memberName} will no longer be booked for month ${removing.month}. You can book them again.` : undefined}
        confirmLabel="Remove booking"
        onConfirm={() => (removing ? removeBooking(removing) : undefined)}
      />
    </div>
  );
}
