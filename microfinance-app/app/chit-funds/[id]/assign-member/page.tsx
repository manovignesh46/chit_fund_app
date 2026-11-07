'use client';

/**
 * Assign a member to this chit fund (Form template).
 *
 * The page used to load `/api/chit-funds/:id`, which has no handler (404), so it only ever
 * showed an error; it now reads the fund from the consolidated detail action (usually
 * cached from the fund's page). Members are searched on the server (the old select listed
 * the first 10 members only). The body is unchanged: `{ globalMemberId, contribution }`
 * to the consolidated add-member action.
 */
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { toast } from '@/lib/toast';
import { apiFetch, ApiError } from '@/lib/query/fetcher';
import { chitFundDetailTag, chitFundWrites, invalidateChitFundMembership, useChitFund } from '@/lib/query/chit-funds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { EmptyState } from '@/components/kit/empty-state';
import { EntityCombobox } from '@/components/kit/entity-combobox';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { FormActions } from '@/components/kit/form-actions';
import { FormField } from '@/components/kit/form-field';
import { FormSection } from '@/components/kit/form-section';
import { Money } from '@/components/kit/money';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';

interface MemberOption {
  id: number;
  name: string;
  contact: string;
}

const SEARCH_PAGE_SIZE = 25;

function FormSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-56 w-full max-w-3xl rounded-xl" />
    </div>
  );
}

export default function AssignMemberPage() {
  return (
    <PageContainer fallback={<FormSkeleton />}>
      <AssignMember />
    </PageContainer>
  );
}

function AssignMember() {
  const params = useParams<{ id: string }>();
  const chitFundId = parseInt(params.id, 10) || 0;
  const router = useRouter();
  const fundQuery = useChitFund(chitFundId || null);
  const fund = fundQuery.data;
  useBreadcrumbLabel(chitFundId ? `/chit-funds/${chitFundId}` : null, fund?.name);

  const [member, setMember] = React.useState<MemberOption | null>(null);
  const [contribution, setContribution] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<{ member?: string; contribution?: string; submit?: string }>({});
  const [submitting, setSubmitting] = React.useState(false);

  // Enrolled global members (the server refuses them: "already part of this chit fund").
  const enrolled = React.useMemo(() => new Set((fund?.members ?? []).map((m) => m.globalMemberId)), [fund]);

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
      return <ErrorState title="Failed to fetch chit fund details" error={fundQuery.error} onRetry={() => void fundQuery.mutate()} />;
    }
    return <FormSkeleton />;
  }

  // Defaults to the fund's monthly contribution until the user types, as before.
  const contributionValue = contribution ?? fund.monthlyContribution.toString();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const found: typeof errors = {};
    if (!member) found.member = 'Please select a member';
    if (!contributionValue) found.contribution = 'Contribution amount is required';
    else if (isNaN(Number(contributionValue)) || Number(contributionValue) <= 0) found.contribution = 'Contribution must be a positive number';
    setErrors(found);
    if (found.member || found.contribution) {
      document.getElementById(found.member ? 'member' : 'contribution')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await chitFundWrites.addMember(chitFundId, { globalMemberId: Number(member!.id), contribution: Number(contributionValue) });
      toast.success(`${member!.name} added to ${fund.name}`);
      void invalidateChitFundMembership(chitFundId, member!.id, [chitFundDetailTag(chitFundId)]);
      router.push(`/chit-funds/${chitFundId}/members`);
    } catch (err) {
      const message = errorMessage(err) ?? 'Failed to assign member to chit fund. Please try again.';
      setErrors({ submit: message });
      toast.error("Couldn't assign the member", { description: message });
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={`Chit fund #${fund.id}`}
        title={`Assign member to ${fund.name}`}
        description={
          <>
            Monthly contribution <Money value={fund.monthlyContribution} tone="plain" /> · Total amount <Money value={fund.totalAmount} tone="plain" />
          </>
        }
      />
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6" noValidate>
        <FormSection title="Member">
          <FormField
            label="Select member"
            required
            nativeRequired={false}
            id="member"
            error={errors.member}
            className="md:col-span-2"
            description={
              <>
                Search by name or phone.{' '}
                <Link href="/members" className="font-medium text-primary-text hover:underline">
                  + Create new member
                </Link>{' '}
                on the Members page if they are not listed.
              </>
            }
          >
            <EntityCombobox<MemberOption>
              value={member}
              onChange={(next) => {
                setMember(next);
                setErrors((prev) => ({ ...prev, member: undefined }));
              }}
              loadOptions={async (q, signal) => {
                const search = new URLSearchParams({ action: 'list', page: '1', pageSize: String(SEARCH_PAGE_SIZE) });
                if (q) search.set('q', q);
                const data = await apiFetch<{ members?: MemberOption[] }>(`/members/consolidated?${search.toString()}`, { signal });
                return data.members ?? [];
              }}
              getOptionValue={(m) => m.id}
              getOptionLabel={(m) => `${m.name} - ${m.contact}`}
              renderOption={(m) => (
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="truncate">
                    {m.name}
                    {enrolled.has(m.id) ? <span className="text-muted-foreground"> · already a member</span> : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{m.contact}</span>
                </span>
              )}
              placeholder="Select a member"
              searchPlaceholder="Search by name or phone"
            />
          </FormField>
          <FormField label="Monthly contribution (₹)" required nativeRequired={false} id="contribution" error={errors.contribution}>
            <Input type="number" inputMode="decimal" value={contributionValue} onChange={(event) => setContribution(event.target.value)} />
          </FormField>
        </FormSection>
        {errors.submit ? (
          <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
            {errors.submit}
          </p>
        ) : null}
        <FormActions>
          <Button variant="outline" asChild>
            <Link href={`/chit-funds/${chitFundId}/members`}>Cancel</Link>
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
