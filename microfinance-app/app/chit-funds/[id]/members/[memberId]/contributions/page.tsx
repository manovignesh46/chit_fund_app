'use client';

/**
 * One member's contributions in a fund (Detail template): months 1..current month with what
 * was paid, balances, and record / pay-balance / export.
 *
 * Requests: the fund (usually cached) and the member (`member-detail`), in parallel. The
 * member-detail response already holds every contribution of the member; the page used to
 * read a separate 10-row contributions page, so with more than 10 contributions the older
 * months showed as "Pending" and offered "Record Payment" for months already paid.
 */
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileDown, Plus, Wallet } from 'lucide-react';

import { toast } from '@/lib/toast';
import { formatMoney } from '@/lib/format';
import { ApiError } from '@/lib/query/fetcher';
import { chitFundWrites, useChitFund, useChitFundMember, type ChitContribution } from '@/lib/query/chit-funds';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { DateText } from '@/components/kit/date-text';
import { DescriptionList } from '@/components/kit/description-list';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { PageContainer } from '@/components/kit/page-container';
import { iconOnPhone, PageHeader } from '@/components/kit/page-header';
import { SectionCard } from '@/components/kit/section-card';
import { StatusBadge } from '@/components/kit/status-badge';
import { Updating } from '@/components/kit/updating';
import { hasPendingBalance, type ShownContribution } from '@/app/components/chit-funds/contribution-display';
import { ContributionBusyError, pendingFor, useContributionWrites, type PendingContribution } from '@/app/components/chit-funds/contribution-writes';
import { quickContributionBody, quickContributionValues, type QuickContributionValues } from '@/app/components/chit-funds/QuickContributionDialog';

const QuickContributionDialog = dynamic(() => import('@/app/components/chit-funds/QuickContributionDialog'), { ssr: false });
const PayBalanceDialog = dynamic(() => import('@/app/components/chit-funds/PayBalanceDialog'), { ssr: false });
const ContributionDetailsDialog = dynamic(() => import('@/app/components/chit-funds/contribution-display').then((m) => m.ContributionDetailsDialog), { ssr: false });

interface MonthRow {
  month: number;
  contribution: ChitContribution | null;
  pending: PendingContribution | undefined;
}

function PageSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

export default function MemberContributionsPage() {
  return (
    <PageContainer fallback={<PageSkeleton />}>
      <MemberContributions />
    </PageContainer>
  );
}

function MemberContributions() {
  const params = useParams<{ id: string; memberId: string }>();
  const id = parseInt(params.id, 10) || 0;
  const memberId = parseInt(params.memberId, 10) || 0;
  const fundQuery = useChitFund(id || null);
  const memberQuery = useChitFundMember(id || null, memberId || null);
  const fund = fundQuery.data;
  const member = memberQuery.data;
  useBreadcrumbLabel(id ? `/chit-funds/${id}` : null, fund?.name);
  useBreadcrumbLabel(id && memberId ? `/chit-funds/${id}/members/${memberId}` : null, member?.globalMember?.name);
  const writes = useContributionWrites(id);

  const [record, setRecord] = React.useState<{ open: boolean; month: number; values: QuickContributionValues; error: string | null } | null>(null);
  const [detailsId, setDetailsId] = React.useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [payId, setPayId] = React.useState<number | null>(null);
  const [payOpen, setPayOpen] = React.useState(false);

  const contributions = member?.contributions;
  const rows = React.useMemo<MonthRow[]>(() => {
    if (!fund || !contributions) return [];
    const byMonth = new Map<number, ChitContribution>();
    for (const c of contributions) if (!byMonth.has(c.month)) byMonth.set(c.month, c);
    return Array.from({ length: Math.max(0, fund.currentMonth) }, (_, i) => i + 1).map((month) => ({
      month,
      contribution: byMonth.get(month) ?? null,
      pending: pendingFor(writes.pending, memberId, month),
    }));
  }, [fund, contributions, writes.pending, memberId]);
  const byId = React.useMemo(() => new Map((contributions ?? []).map((c) => [c.id, c])), [contributions]);

  const error = fundQuery.error ?? memberQuery.error;
  if (!fund || !member) {
    if (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 404 || status === 403 || status === 400) {
        return (
          <EmptyState
            title="Not found"
            description="The chit fund or member you are looking for does not exist or has been removed."
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href={`/chit-funds/${params.id}/members`}>Back to members</Link>
              </Button>
            }
          />
        );
      }
      return (
        <ErrorState
          title="Couldn't load this member's contributions"
          error={error}
          onRetry={() => {
            void fundQuery.mutate();
            void memberQuery.mutate();
          }}
        />
      );
    }
    return <PageSkeleton />;
  }

  const name = member.globalMember.name;
  const openRecord = (month: number) => setRecord({ open: true, month, values: quickContributionValues(fund ? fund.monthlyContribution.toString() : ''), error: null });
  const submitRecord = (values: QuickContributionValues) => {
    if (!record) return;
    const month = record.month;
    setRecord({ ...record, open: false, values });
    const paidAmount = parseFloat(values.amount);
    const expected = fund.monthlyContribution;
    void writes
      .record(quickContributionBody(member.id, month, values), member.globalMemberId)
      .then(() => {
        let message = `Successfully recorded contribution for Month ${month}`;
        if (paidAmount < expected) message += ` (Partial payment: ${formatMoney(paidAmount)} of ${formatMoney(expected)})`;
        toast.success('Contribution recorded', { description: message });
      })
      .catch((err) => {
        const message = err instanceof ContributionBusyError ? err.message : errorMessage(err) ?? 'Failed to record contribution';
        toast.error('Contribution not recorded', { description: message });
        setRecord({ open: true, month, values, error: message });
      });
  };
  const openDetails = (c: ChitContribution) => {
    setDetailsId(c.id);
    setDetailsOpen(true);
  };
  const openPay = (c: ShownContribution) => {
    setDetailsOpen(false);
    setPayId(c.id);
    setPayOpen(true);
  };
  const detailsRow = detailsId !== null ? byId.get(detailsId) ?? null : null;
  const payRow = payId !== null ? byId.get(payId) ?? null : null;

  const balanceCell = (r: MonthRow) => {
    const c = r.contribution;
    if (!c) return r.pending ? <Updating active><span className="text-muted-foreground">—</span></Updating> : <span className="text-muted-foreground">-</span>;
    const body =
      c.balancePaymentStatus === 'Paid' ? (
        <span className="font-semibold text-success-text">Paid in full</span>
      ) : c.balance > 0 ? (
        <span className="flex flex-col items-start gap-1">
          <Money value={c.balance} tone="overdue" className="font-semibold" />
          <span className="text-xs font-medium text-warning-text">Partial payment</span>
        </span>
      ) : (
        <span className="font-semibold text-success-text">Paid in full</span>
      );
    return <Updating active={writes.updatingIds.has(c.id)}>{body}</Updating>;
  };
  const balanceDateCell = (r: MonthRow) => {
    const c = r.contribution;
    if (!c) return <span className="text-muted-foreground">-</span>;
    if (c.balancePaymentStatus === 'Paid' && c.actualBalancePaymentDate) return <DateText value={c.actualBalancePaymentDate} className="text-success-text" />;
    if (c.balancePaymentDate) return <DateText value={c.balancePaymentDate} />;
    return <span className="text-muted-foreground">-</span>;
  };
  const amountCell = (r: MonthRow) =>
    r.contribution ? <Money value={r.contribution.amount} tone="plain" /> : r.pending ? <Money value={r.pending.amount} tone="plain" /> : <Money value={fund.monthlyContribution || 0} tone="plain" />;
  const paidCell = (r: MonthRow) =>
    r.contribution ? (
      <DateText value={r.contribution.paidDate} />
    ) : r.pending ? (
      <span className="flex flex-wrap items-center gap-2">
        <DateText value={r.pending.paidDate} />
        <StatusBadge status="saving" />
      </span>
    ) : (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-destructive-text">Pending</span>
        <Button size="sm" variant="outline" disabled={writes.busy} onClick={() => openRecord(r.month)}>
          <Plus aria-hidden="true" />
          Record payment
        </Button>
      </span>
    );

  const columns: DataTableColumn<MonthRow>[] = [
    { id: 'month', header: 'Month', cell: (r) => <span className="whitespace-nowrap font-medium">Month {r.month}</span> },
    { id: 'amount', header: 'Amount', numeric: true, cell: amountCell },
    { id: 'paidDate', header: 'Paid date', cell: paidCell },
    { id: 'balance', header: 'Balance', cell: balanceCell },
    { id: 'balanceDate', header: 'Balance payment date', cell: balanceDateCell },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`Chit fund #${fund.id} · ${fund.name}`}
        title={`${name}'s contributions`}
        description={
          <>
            {fund.name} · Monthly contribution <Money value={fund.monthlyContribution} tone="plain" />
          </>
        }
        actions={
          <Button className={iconOnPhone} variant="outline" onClick={() => chitFundWrites.exportMembers(fund.id, [member.id])}>
            <FileDown aria-hidden="true" />
            <span className="max-sm:sr-only">Export member data</span>
          </Button>
        }
      />

      <SectionCard className="mb-6">
        <DescriptionList
          columns={3}
          items={[
            { label: 'Member name', value: <span className="font-semibold">{name}</span> },
            { label: 'Contact', value: <span className="tabular-nums">{member.globalMember.contact}</span> },
            { label: 'Join date', value: <DateText value={member.joinDate} /> },
          ]}
        />
      </SectionCard>

      <DataTable<MonthRow>
        label={`${name}'s contributions by month`}
        mode="client"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.month}
        isRefreshing={memberQuery.isValidating && !writes.saving}
        onRowClick={(r) => r.contribution && openDetails(r.contribution)}
        rowClassName={(r) => (r.pending ? 'bg-info-subtle/60' : undefined)}
        emptyState={<EmptyState compact title="No months to display for this member." />}
        renderCard={(r) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">Month {r.month}</p>
                <div className="mt-1 text-sm">{paidCell(r)}</div>
              </div>
              <div className="text-right">
                {amountCell(r)}
                <div className="mt-1 text-sm">{balanceCell(r)}</div>
              </div>
            </div>
            {r.contribution && (r.contribution.balancePaymentDate || r.contribution.actualBalancePaymentDate) ? (
              <p className="text-xs text-muted-foreground">Balance payment date: {balanceDateCell(r)}</p>
            ) : null}
            {r.contribution && hasPendingBalance(r.contribution) ? (
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="outline" disabled={writes.busy} onClick={() => openPay(r.contribution!)}>
                  <Wallet aria-hidden="true" />
                  Pay balance
                </Button>
              </div>
            ) : null}
          </div>
        )}
      />

      {record ? (
        <QuickContributionDialog
          open={record.open}
          onOpenChange={(open) => setRecord((prev) => (prev ? { ...prev, open } : prev))}
          title={`Record contribution for Month ${record.month}`}
          description={name}
          values={record.values}
          onValuesChange={(values) => setRecord((prev) => (prev ? { ...prev, values } : prev))}
          dateMessage="Please enter a valid payment date"
          submitError={record.error}
          busy={writes.busy}
          onSubmit={submitRecord}
        />
      ) : null}
      {detailsId !== null ? (
        <ContributionDetailsDialog
          open={detailsOpen && detailsRow !== null}
          onOpenChange={setDetailsOpen}
          contribution={detailsRow}
          memberName={name}
          statusText="member"
          onPayBalance={openPay}
          updating={detailsRow ? writes.updatingIds.has(detailsRow.id) : false}
        />
      ) : null}
      {payId !== null ? (
        <PayBalanceDialog
          open={payOpen && payRow !== null}
          onOpenChange={setPayOpen}
          contribution={payRow}
          memberName={name}
          onSubmit={async (body) => {
            await writes.payBalance(body, member.globalMemberId);
            toast.success('Balance payment recorded', { description: `${name} · Month ${payRow?.month} · ${formatMoney(body.amount)}` });
          }}
        />
      ) : null}
    </div>
  );
}
