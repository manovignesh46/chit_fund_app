'use client';

/**
 * A fund's auctions (List template): every auction, month order, with record, details and
 * delete.
 *
 * Requests: the fund (usually cached from its page), every auction in one page (the same key
 * the fund page uses, so usually cached too) and every member of the fund (`all=1`): the
 * winner list must offer everyone who has not won yet. The page used to read the default
 * pages (10 auctions, 20 members), so later auctions were missing and members beyond the
 * 20th could not be chosen.
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Eye, Plus, Trash2, Users } from 'lucide-react';

import { toast } from '@/lib/toast';
import { formatMoney } from '@/lib/format';
import { ApiError } from '@/lib/query/fetcher';
import { chitFundWrites, invalidateChitFundAuctions, useAllChitFundMembers, useChitFund, useChitFundAuctions, type ChitFundAuction } from '@/lib/query/chit-funds';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { ConfirmDialog } from '@/components/kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { StatusBadge } from '@/components/kit/status-badge';
import { Discount } from '@/app/components/chit-funds/AuctionDialogs';

const AuctionFormDialog = dynamic(() => import('@/app/components/chit-funds/AuctionDialogs'), { ssr: false });
const AuctionDetailsDialog = dynamic(() => import('@/app/components/chit-funds/AuctionDialogs').then((m) => m.AuctionDetailsDialog), { ssr: false });

interface AuctionRow extends ChitFundAuction {
  /** Position among the auctions of the same month (1-based) when a month has several. */
  sameMonthIndex: number | null;
}

function PageSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

export default function ChitFundAuctionsPage() {
  return (
    <PageContainer fallback={<PageSkeleton />}>
      <AuctionsView />
    </PageContainer>
  );
}

function AuctionsView() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const fundQuery = useChitFund(id || null);
  const fund = fundQuery.data;
  useBreadcrumbLabel(id ? `/chit-funds/${id}` : null, fund?.name);
  const auctionsQuery = useChitFundAuctions(id || null);
  const membersQuery = useAllChitFundMembers(id || null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [formMounted, setFormMounted] = React.useState(false);
  const [details, setDetailsState] = React.useState<ChitFundAuction | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const setDetails = (a: ChitFundAuction) => {
    setDetailsState(a);
    setDetailsOpen(true);
  };
  const [toDelete, setToDelete] = React.useState<ChitFundAuction | null>(null);

  const auctions = auctionsQuery.data?.auctions;
  const rows = React.useMemo<AuctionRow[]>(() => {
    const list = [...(auctions ?? [])].sort((a, b) => a.month - b.month || new Date(a.date).getTime() - new Date(b.date).getTime());
    const byMonth = new Map<number, AuctionRow[]>();
    const out = list.map((a) => ({ ...a, sameMonthIndex: null as number | null }));
    for (const a of out) byMonth.set(a.month, [...(byMonth.get(a.month) ?? []), a]);
    for (const group of byMonth.values()) if (group.length > 1) group.forEach((a, i) => (a.sameMonthIndex = i + 1));
    return out;
  }, [auctions]);
  const members = membersQuery.data?.members;
  // Members who have not won any auction yet.
  const eligible = React.useMemo(
    () => (members ?? []).filter((m) => !(auctions ?? []).some((a) => a.winnerId === m.id)).map((m) => ({ id: m.id, name: m.globalMember.name })),
    [members, auctions]
  );

  if (!fund) {
    if (fundQuery.error) {
      const status = fundQuery.error instanceof ApiError ? fundQuery.error.status : 0;
      if (status === 404 || status === 403 || status === 400) {
        return (
          <EmptyState
            title="Chit fund not found"
            description="The chit fund you are looking for does not exist or has been removed."
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/chit-funds">Back to chit funds</Link>
              </Button>
            }
          />
        );
      }
      return <ErrorState title="Couldn't load this chit fund" error={fundQuery.error} onRetry={() => void fundQuery.mutate()} />;
    }
    return <PageSkeleton />;
  }

  const ready = auctions !== undefined && members !== undefined;
  const canRecord = ready && eligible.length > 0;

  const recordAuction = async (body: Record<string, unknown>) => {
    const saved = await chitFundWrites.addAuction(fund.id, body);
    const winner = eligible.find((m) => m.id === Number(body.winnerId));
    toast.success('Auction recorded', { description: `${saved?.winner?.globalMember?.name ?? winner?.name ?? 'Winner'} · Month ${body.month} · ${formatMoney(Number(body.amount))}` });
    void invalidateChitFundAuctions(fund.id);
  };

  const deleteAuction = async () => {
    if (!toDelete) return;
    await chitFundWrites.deleteAuction(fund.id, toDelete.id);
    toast.success('Auction deleted', { description: `Month ${toDelete.month} · ${toDelete.winner?.globalMember?.name ?? `Member ID: ${toDelete.winnerId}`}` });
    await invalidateChitFundAuctions(fund.id);
  };

  const winnerName = (a: ChitFundAuction) => a.winner?.globalMember?.name || `Member ID: ${a.winnerId}`;
  const columns: DataTableColumn<AuctionRow>[] = [
    {
      id: 'month',
      header: 'Month',
      cell: (a) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          Month {a.month}
          {a.sameMonthIndex ? <StatusBadge status="Partial" label={`#${a.sameMonthIndex}`} /> : null}
        </span>
      ),
    },
    { id: 'winner', header: 'Winner', cell: (a) => <span className="font-medium text-foreground">{winnerName(a)}</span> },
    { id: 'amount', header: 'Amount', numeric: true, cell: (a) => <Money value={a.amount} tone="outflow" /> },
    { id: 'date', header: 'Auction date', cell: (a) => <DateText value={a.date} /> },
    { id: 'discount', header: 'Discount', numeric: true, cell: (a) => <Discount total={fund.totalAmount} amount={a.amount} /> },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (a) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setDetails(a)}>
            <Eye aria-hidden="true" />
            View details
          </Button>
          <Button size="sm" variant="ghost" aria-label="Delete auction" className="text-destructive-text hover:bg-destructive-subtle hover:text-destructive-text" onClick={() => setToDelete(a)}>
            <Trash2 aria-hidden="true" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`Chit fund #${fund.id} · ${fund.name}`}
        title="Auctions"
        count={auctions?.length}
        description={
          <>
            Month {fund.currentMonth} of {fund.duration} · Monthly contribution <Money value={fund.monthlyContribution} tone="plain" /> · Type{' '}
            <span className="font-semibold text-foreground">{fund.chitFundType || 'Auction'}</span>
            {fund.chitFundType === 'Fixed' ? <span className="ml-1 text-primary-text">(Fixed amounts per month)</span> : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/chit-funds/${fund.id}/members`}>
                <Users aria-hidden="true" />
                View members
              </Link>
            </Button>
            {!ready || canRecord ? (
              <Button
                disabled={!ready}
                onClick={() => {
                  setFormMounted(true);
                  setFormOpen(true);
                }}
              >
                <Plus aria-hidden="true" />
                Record auction
              </Button>
            ) : (
              <Button disabled title="All members have already won auctions">
                <Plus aria-hidden="true" />
                Record auction (no eligible members)
              </Button>
            )}
          </>
        }
      />

      <DataTable<AuctionRow>
        label="Auctions"
        mode="client"
        columns={columns}
        rows={rows}
        getRowId={(a) => a.id}
        isInitialLoading={auctions === undefined && !auctionsQuery.error}
        isRefreshing={auctions !== undefined && auctionsQuery.isValidating}
        error={auctionsQuery.error}
        onRetry={() => void auctionsQuery.mutate()}
        skeletonRows={5}
        rowClassName={(a) => (a.sameMonthIndex ? 'bg-warning-subtle/60' : undefined)}
        emptyState={
          <EmptyState
            title="No auctions found"
            description="Record auctions for this chit fund."
            action={
              canRecord ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setFormMounted(true);
                    setFormOpen(true);
                  }}
                >
                  <Plus aria-hidden="true" />
                  Record auction
                </Button>
              ) : undefined
            }
          />
        }
        renderCard={(a) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  Month {a.month}
                  {a.sameMonthIndex ? <StatusBadge status="Partial" label={`#${a.sameMonthIndex}`} /> : null}
                </p>
                <p className="truncate text-sm text-muted-foreground">{winnerName(a)}</p>
                <p className="text-xs text-muted-foreground">
                  <DateText value={a.date} />
                </p>
              </div>
              <div className="text-right">
                <Money value={a.amount} tone="outflow" className="font-medium" />
                <p className="mt-0.5 text-xs">
                  <Discount total={fund.totalAmount} amount={a.amount} />
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setDetails(a)}>
                <Eye aria-hidden="true" />
                View details
              </Button>
              <Button size="sm" variant="ghost" aria-label="Delete auction" className="text-destructive-text hover:bg-destructive-subtle hover:text-destructive-text" onClick={() => setToDelete(a)}>
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            </div>
          </div>
        )}
      />
      {membersQuery.error ? (
        <div className="mt-4">
          <ErrorState compact title="Couldn't load the fund's members (needed to record an auction)" error={membersQuery.error} onRetry={() => void membersQuery.mutate()} />
        </div>
      ) : null}

      {formMounted ? (
        <AuctionFormDialog open={formOpen} onOpenChange={setFormOpen} fund={fund} eligibleMembers={eligible} auctions={auctions ?? []} onSubmit={recordAuction} />
      ) : null}
      {details ? <AuctionDetailsDialog open={detailsOpen} auction={details} totalAmount={fund.totalAmount} onOpenChange={setDetailsOpen} /> : null}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this auction?"
        description="Are you sure you want to delete this auction? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={deleteAuction}
      >
        {toDelete ? (
          <p className="text-sm text-muted-foreground">
            Month {toDelete.month} · {winnerName(toDelete)} · <Money value={toDelete.amount} tone="plain" />
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
