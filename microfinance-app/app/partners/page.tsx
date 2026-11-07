'use client';

/**
 * Partners (Detail/report template): the active partner, each partner's cash balance, and
 * manual entries (partner transfer, credit/debit) recorded in a dialog. Balances come from
 * the same query as the transactions page (`['partners', 'balances']`); a recorded entry
 * invalidates it, so the cards update in place. Each card links to that partner's
 * transactions (`/transactions?partner=<name>`).
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeftRight, ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { usePartnerBalances, type PartnerWithBalance } from '@/lib/query/dashboard';
import { usePartner } from '../contexts/PartnerContext';
import PartnerSelector from '../components/partners/PartnerSelector';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { PageContainer, PageSkeleton } from '@/components/kit/page-container';
import { iconOnPhone, PageHeader } from '@/components/kit/page-header';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { SectionCard } from '@/components/kit/section-card';
import { StatusBadge } from '@/components/kit/status-badge';

const TransactionForm = dynamic(() => import('../components/TransactionForm'), { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> });

export default function PartnersPage() {
  return (
    <PageContainer>
      <Partners />
    </PageContainer>
  );
}

function BalanceCard({ partner, balance, loading }: { partner: Pick<PartnerWithBalance, 'id' | 'name' | 'isActive'>; balance: number | null; loading: boolean }) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-foreground">{partner.name}</h3>
        <StatusBadge status={partner.isActive ? 'Active' : 'Cancelled'} label={partner.isActive ? 'Active' : 'Inactive'} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Balance</p>
        <div className="text-xl font-semibold">
          {loading ? (
            <Skeleton className="h-7 w-28" />
          ) : balance === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Money value={balance} decimals={2} tone="plain" className={cn(balance < 0 && 'text-destructive-text')} />
          )}
        </div>
      </div>
      <Link
        href={`/transactions?partner=${encodeURIComponent(partner.name)}`}
        className="inline-flex min-h-[44px] items-center gap-1 self-start rounded-sm text-sm font-medium text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0"
      >
        Transactions
        <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Partners() {
  const { partners, loading, error, refreshPartners } = usePartner();
  const balances = usePartnerBalances();
  const [recordOpen, setRecordOpen] = React.useState<boolean | null>(null);

  if (loading && partners.length === 0) return <PageSkeleton rows={3} />;
  if (error && partners.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <ErrorState title="Couldn't load partners" error={error} onRetry={() => void refreshPartners()} />
      </div>
    );
  }

  // The balances response lists the partners with their balance; until it arrives (or if
  // it fails) the cards show the partners from the shared partner list.
  const withBalances = balances.data?.partners;
  const cards: { partner: PartnerWithBalance; balance: number | null }[] = withBalances
    ? withBalances.map((p) => ({ partner: p, balance: p.balance || 0 }))
    : partners.map((p) => ({ partner: p, balance: null }));
  const balancesLoading = !withBalances && !balances.error;
  const total = withBalances ? withBalances.reduce((sum, p) => sum + (p.balance || 0), 0) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partners"
        description="Who you are working as, each partner's cash balance, and manual entries."
        actions={
          <Button className={iconOnPhone} onClick={() => setRecordOpen(true)}>
            <ArrowLeftRight aria-hidden="true" />
            <span className="max-sm:sr-only">Record transaction</span>
          </Button>
        }
      />

      <SectionCard title="Active partner" description="Transactions and payments you record are entered as this partner.">
        <div className="max-w-xs">
          <PartnerSelector />
        </div>
      </SectionCard>

      <section aria-labelledby="partner-balances">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="partner-balances" className="text-base font-semibold text-foreground">
            Partner balances
          </h2>
          {total !== null && cards.length > 1 ? (
            <p className="text-sm text-muted-foreground">
              Total <Money value={total} decimals={2} tone="plain" className={cn('font-medium text-foreground', total < 0 && 'text-destructive-text')} />
            </p>
          ) : null}
        </div>
        {balances.error && !withBalances ? (
          <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
            <span>Couldn't load the balances.</span>
            <Button variant="outline" size="sm" onClick={() => void balances.mutate()}>
              Retry
            </Button>
          </div>
        ) : null}
        {cards.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EmptyState title="No partners found" description="Add a partner to get started." />
          </div>
        ) : (
          <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3', balances.isValidating && withBalances && 'opacity-80 transition-opacity')}>
            {cards.map(({ partner, balance }) => (
              <BalanceCard key={partner.id} partner={partner} balance={balance} loading={balancesLoading} />
            ))}
          </div>
        )}
      </section>

      {recordOpen !== null ? (
        <ResponsiveDialog
          open={recordOpen}
          onOpenChange={setRecordOpen}
          title="Record manual transaction"
          description="Every manual entry needs a reason and is reviewed before it is saved."
          size="lg"
        >
          <div className="max-h-[70vh] overflow-y-auto px-0.5 pb-1">
            <TransactionForm onClose={() => setRecordOpen(false)} />
          </div>
        </ResponsiveDialog>
      ) : null}
    </div>
  );
}
