'use client';

/**
 * Edit a chit fund (Form template), through the shared ChitFundForm in "edit" mode.
 * The fund is usually cached from its page; the form is prefilled once.
 */
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { toast } from '@/lib/toast';
import { ApiError } from '@/lib/query/fetcher';
import { chitFundDetailTag, chitFundWrites, invalidateChitFunds, useChitFund, type ChitFundDetail } from '@/lib/query/chit-funds';
import { ChitFundForm, EMPTY_FUND_FORM, type ChitFundFormSubmit, type FixedAmounts, type FundFormState } from '@/app/components/chit-funds/ChitFundForm';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { PageContainer, PageSkeleton } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { Button } from '@/components/ui/button';

/** Form values from the fund, as the edit page always prefilled them (start date as UTC YYYY-MM-DD). */
function stateFromFund(fund: ChitFundDetail): FundFormState {
  const fixedAmounts: FixedAmounts = {};
  if (fund.chitFundType === 'Fixed' && fund.fixedAmounts) {
    for (const item of fund.fixedAmounts) fixedAmounts[item.month] = item.amount.toString();
  }
  return {
    values: {
      ...EMPTY_FUND_FORM,
      name: fund.name || '',
      totalAmount: fund.totalAmount?.toString() || '',
      monthlyContribution: fund.monthlyContribution?.toString() || '',
      firstMonthContribution: fund.firstMonthContribution?.toString() || '',
      duration: fund.duration?.toString() || '',
      membersCount: fund.membersCount?.toString() || '',
      startDate: fund.startDate ? new Date(fund.startDate).toISOString().split('T')[0] : '',
      description: fund.description || '',
      status: fund.status || 'Active',
      chitFundType: fund.chitFundType || 'Auction',
    },
    fixedAmounts,
  };
}

/** The request body the edit page has always sent. */
function updateBody({ values: v, fixedAmounts }: ChitFundFormSubmit) {
  return {
    name: v.name,
    totalAmount: v.totalAmount,
    monthlyContribution: v.monthlyContribution,
    firstMonthContribution: v.firstMonthContribution,
    duration: v.duration,
    membersCount: v.membersCount,
    startDate: v.startDate,
    description: v.description,
    status: v.status,
    chitFundType: v.chitFundType,
    fixedAmounts: v.chitFundType === 'Fixed' ? fixedAmounts : undefined,
  };
}

export default function EditChitFundPage() {
  return (
    <PageContainer fallback={<PageSkeleton rows={8} />}>
      <EditChitFund />
    </PageContainer>
  );
}

function EditChitFund() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const router = useRouter();
  const { data: fund, error, mutate } = useChitFund(id || null);
  useBreadcrumbLabel(id ? `/chit-funds/${id}` : null, fund?.name);

  const [initial, setInitial] = React.useState<{ state: FundFormState; originalType: string } | null>(null);
  React.useEffect(() => {
    if (fund && !initial) setInitial({ state: stateFromFund(fund), originalType: fund.chitFundType });
  }, [fund, initial]);

  const submit = async (submitted: ChitFundFormSubmit) => {
    try {
      await chitFundWrites.update(id, updateBody(submitted));
      // The fund's page revalidates its detail when it mounts; no refetch here on the way out.
      void invalidateChitFunds([chitFundDetailTag(id)]);
      toast.success('Chit fund updated', { description: submitted.values.name });
      router.push(`/chit-funds/${id}`);
    } catch (err) {
      toast.error('Failed to update chit fund', { description: `${errorMessage(err) ?? 'An unknown error occurred'}. Please try again.` });
      throw err;
    }
  };

  const status = error instanceof ApiError ? error.status : 0;
  return (
    <div>
      <PageHeader
        title="Edit chit fund"
        description={fund?.name}
        actions={
          <Button variant="ghost" asChild>
            <Link href={`/chit-funds/${id}`}>Cancel</Link>
          </Button>
        }
      />
      {initial ? (
        <ChitFundForm
          mode="edit"
          initial={initial.state}
          originalType={initial.originalType}
          onSubmit={submit}
          cancelHref={`/chit-funds/${id}`}
          submitLabel="Update chit fund"
          submittingLabel="Updating…"
        />
      ) : error && (status === 404 || status === 403) ? (
        <EmptyState
          title="Chit fund not found"
          description="The chit fund you are looking for does not exist or has been removed."
          action={
            <Button size="sm" variant="outline" asChild>
              <Link href="/chit-funds">Return to chit funds</Link>
            </Button>
          }
        />
      ) : error ? (
        <ErrorState title="Failed to load chit fund data" error={error} onRetry={() => void mutate()} />
      ) : (
        <PageSkeleton rows={8} />
      )}
    </div>
  );
}
