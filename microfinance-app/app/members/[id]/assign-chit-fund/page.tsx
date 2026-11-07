'use client';

/**
 * Assign a member to a chit fund (Form template).
 *
 * Loads the member (usually cached from the member page) and the chit funds in parallel.
 * The chit-fund list response is `{ chitFunds, … }`; the page used to treat it as an array
 * and crashed on load. Only funds with status Active are offered, as before; funds the
 * member already belongs to are listed but disabled (the server would refuse them).
 * The body is unchanged (`{ globalMemberId, contribution }`); it now goes to the
 * consolidated add-member action, because the old target had no POST handler.
 */
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { toast } from '@/lib/toast';
import { formatMoney } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { ApiError } from '@/lib/query/fetcher';
import { invalidateChitMembership, memberWrites, useMember } from '@/lib/query/members';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { FormActions } from '@/components/kit/form-actions';
import { FormField } from '@/components/kit/form-field';
import { FormSection } from '@/components/kit/form-section';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';

interface ChitFundOption {
  id: number;
  name: string;
  totalAmount: number;
  monthlyContribution: number;
  duration: number;
  status: string;
}

/** Enough for every fund this app has; a hint appears if there are ever more. */
const FUND_PAGE_SIZE = 100;
const fundsKey = queryKeys.list('chit-funds', { page: 1, pageSize: FUND_PAGE_SIZE });

function FormSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-56 w-full max-w-3xl rounded-xl" />
    </div>
  );
}

export default function AssignChitFundPage() {
  return (
    <PageContainer fallback={<FormSkeleton />}>
      <AssignChitFund />
    </PageContainer>
  );
}

function AssignChitFund() {
  const params = useParams<{ id: string }>();
  const memberId = parseInt(params.id, 10) || 0;
  const router = useRouter();
  const memberQuery = useMember(memberId || null);
  const fundsQuery = useSWR<{ chitFunds?: ChitFundOption[]; totalCount?: number }>(memberId ? fundsKey : null);
  const member = memberQuery.data;
  useBreadcrumbLabel(memberId ? `/members/${memberId}` : null, member?.name);

  const [selectedChitFund, setSelectedChitFund] = React.useState('');
  const [contribution, setContribution] = React.useState('');
  const [errors, setErrors] = React.useState<{ chitFund?: string; contribution?: string; submit?: string }>({});
  const [submitting, setSubmitting] = React.useState(false);

  const activeFunds = React.useMemo(() => (fundsQuery.data?.chitFunds ?? []).filter((cf) => cf.status === 'Active'), [fundsQuery.data]);
  const joined = React.useMemo(() => new Set((member?.chitFundMembers ?? []).map((m) => m.chitFund.id)), [member]);

  const error = memberQuery.error ?? fundsQuery.error;
  if (!member || !fundsQuery.data) {
    if (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (memberQuery.error && (status === 404 || status === 403 || status === 400)) {
        return (
          <EmptyState
            title="Member not found"
            description="The member you are looking for does not exist or has been removed."
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/members">Back to members</Link>
              </Button>
            }
          />
        );
      }
      return (
        <ErrorState
          title="Couldn't load this form"
          error={error}
          onRetry={() => {
            void memberQuery.mutate();
            void fundsQuery.mutate();
          }}
        />
      );
    }
    return <FormSkeleton />;
  }

  const onFundChange = (value: string) => {
    setSelectedChitFund(value);
    // Default the contribution to the fund's monthly contribution, as before.
    if (value) {
      const fund = activeFunds.find((cf) => cf.id.toString() === value);
      if (fund) setContribution(fund.monthlyContribution.toString());
    } else {
      setContribution('');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const found: typeof errors = {};
    if (!selectedChitFund) found.chitFund = 'Please select a chit fund';
    if (!contribution) found.contribution = 'Contribution amount is required';
    else if (isNaN(Number(contribution)) || Number(contribution) <= 0) found.contribution = 'Contribution must be a positive number';
    setErrors(found);
    if (found.chitFund || found.contribution) {
      document.getElementById(found.chitFund ? 'chitFund' : 'contribution')?.focus();
      return;
    }
    setSubmitting(true);
    const fundId = Number(selectedChitFund);
    const fund = activeFunds.find((cf) => cf.id === fundId);
    try {
      await memberWrites.assignToChitFund(fundId, { globalMemberId: Number(memberId), contribution: Number(contribution) });
      toast.success(`${member.name} added to ${fund?.name ?? 'the chit fund'}`);
      void invalidateChitMembership(memberId, fundId);
      router.push(`/members/${memberId}?tab=chit-funds`);
    } catch (err) {
      const message = errorMessage(err) ?? 'Failed to assign member to chit fund. Please try again.';
      setErrors({ submit: message });
      toast.error("Couldn't assign the member", { description: message });
      setSubmitting(false);
    }
  };

  const options = activeFunds.map((cf) => ({
    value: cf.id.toString(),
    label: `${cf.name} - ${formatMoney(cf.totalAmount)} (${cf.duration} months)${joined.has(cf.id) ? ' · already a member' : ''}`,
    disabled: joined.has(cf.id),
  }));
  const moreFunds = (fundsQuery.data.totalCount ?? 0) > FUND_PAGE_SIZE;

  return (
    <div>
      <PageHeader
        eyebrow={`Member #${member.id}`}
        title={`Assign ${member.name} to a chit fund`}
        description="Only active chit funds are listed. The monthly contribution defaults to the fund's."
      />
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6" noValidate>
        <FormSection title="Chit fund">
          <FormField
            label="Select chit fund"
            required
            nativeRequired={false}
            id="chitFund"
            error={errors.chitFund}
            description={
              options.length === 0
                ? 'There are no active chit funds.'
                : moreFunds
                  ? `Showing the first ${FUND_PAGE_SIZE} chit funds.`
                  : undefined
            }
          >
            <NativeSelect value={selectedChitFund} onValueChange={onFundChange} placeholder="Select a chit fund" options={options} />
          </FormField>
          <FormField label="Monthly contribution (₹)" required nativeRequired={false} id="contribution" error={errors.contribution}>
            <Input type="number" inputMode="decimal" min="1" step="1" value={contribution} onChange={(event) => setContribution(event.target.value)} />
          </FormField>
        </FormSection>
        {errors.submit ? (
          <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
            {errors.submit}
          </p>
        ) : null}
        <FormActions>
          <Button variant="outline" asChild>
            <Link href={`/members/${memberId}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting} aria-busy={submitting || undefined}>
            {submitting ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
            {submitting ? 'Assigning…' : 'Assign to chit fund'}
          </Button>
        </FormActions>
      </form>
    </div>
  );
}
