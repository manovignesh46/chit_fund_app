'use client';

/**
 * New chit fund (Form template). ?copy=<id> prefills from a fund ("<name> - Copy", no start
 * date, template picker hidden); ?template=<id> applies a template and locks the financial
 * fields. The URL is read after hydration (the page is prerendered without search params).
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { toast } from '@/lib/toast';
import { useHydrated } from '@/hooks/use-hydrated';
import { CHIT_FUNDS, chitFundWrites, invalidateChitFunds, useChitFund, type ChitFundDetail } from '@/lib/query/chit-funds';
import { fetchTemplate, TEMPLATES } from '@/lib/query/chit-fund-templates';
import {
  ChitFundForm,
  EMPTY_FUND_FORM,
  stateFromTemplate,
  type ChitFundFormSubmit,
  type FixedAmounts,
  type FundFormState,
} from '@/app/components/chit-funds/ChitFundForm';
import { errorMessage, ErrorState } from '@/components/kit/error-state';
import { PageContainer, PageSkeleton } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { Button } from '@/components/ui/button';

/** The request body /chit-funds/new has always sent (strings as typed; fixedAmounts only for Fixed). */
function createBody({ values: v, fixedAmounts, templateId }: ChitFundFormSubmit) {
  return {
    name: v.name,
    totalAmount: v.totalAmount,
    monthlyContribution: v.monthlyContribution,
    firstMonthContribution: v.firstMonthContribution,
    duration: v.duration,
    membersCount: v.membersCount,
    startDate: v.startDate,
    description: v.description,
    chitFundType: v.chitFundType,
    fixedAmounts: v.chitFundType === 'Fixed' ? fixedAmounts : undefined,
    templateId: templateId ?? undefined,
  };
}

/** Prefill from a fund being copied, as the page always did. */
function stateFromCopy(data: ChitFundDetail): FundFormState {
  const fixedAmounts: FixedAmounts = {};
  if (data.chitFundType === 'Fixed') {
    for (const item of data.fixedAmounts ?? []) fixedAmounts[item.month] = item.amount.toString();
  }
  return {
    values: {
      ...EMPTY_FUND_FORM,
      name: `${data.name} - Copy`,
      totalAmount: data.totalAmount.toString(),
      monthlyContribution: data.monthlyContribution.toString(),
      firstMonthContribution: data.firstMonthContribution?.toString() || '',
      duration: data.duration.toString(),
      membersCount: data.membersCount.toString(),
      startDate: '',
      description: data.description || '',
      chitFundType: data.chitFundType,
    },
    fixedAmounts,
  };
}

const BLANK: FundFormState = { values: EMPTY_FUND_FORM, fixedAmounts: {} };

export default function NewChitFundPage() {
  return (
    <PageContainer fallback={<PageSkeleton rows={8} />}>
      <NewChitFund />
    </PageContainer>
  );
}

function NewChitFund() {
  const router = useRouter();
  const hydrated = useHydrated();
  const search = useSearchParams();
  const copyId = hydrated ? parseInt(search.get('copy') ?? '', 10) || null : null;
  const templateParam = hydrated ? parseInt(search.get('template') ?? '', 10) || null : null;

  const copyQuery = useChitFund(copyId);
  const [initial, setInitial] = React.useState<{ state: FundFormState; templateId: number | null } | null>(null);
  const [linkedTemplate, setLinkedTemplate] = React.useState<number | null>(null);

  // Prefill once (copy or template), so background revalidation never overwrites typing.
  React.useEffect(() => {
    if (!hydrated || initial) return;
    if (copyId) {
      if (copyQuery.data) setInitial({ state: stateFromCopy(copyQuery.data), templateId: null });
      return;
    }
    if (templateParam) {
      let live = true;
      fetchTemplate(templateParam)
        .then((template) => {
          if (!live) return;
          setInitial({ state: stateFromTemplate(EMPTY_FUND_FORM, template), templateId: template.id });
          setLinkedTemplate(template.id);
        })
        .catch(() => {
          if (!live) return;
          toast.error('Failed to load template data');
          setInitial({ state: BLANK, templateId: null });
        });
      return () => {
        live = false;
      };
    }
    setInitial({ state: BLANK, templateId: null });
  }, [hydrated, initial, copyId, templateParam, copyQuery.data]);

  const submit = async (submitted: ChitFundFormSubmit) => {
    try {
      await chitFundWrites.create(createBody(submitted));
      // This page's own queries (template list, copied fund) are not refetched on the way out.
      void invalidateChitFunds([TEMPLATES, [CHIT_FUNDS, 'detail']]);
      toast.success('Chit fund created', { description: submitted.values.name });
      router.push('/chit-funds');
    } catch (error) {
      toast.error('Failed to create chit fund', { description: `${errorMessage(error) ?? 'An unknown error occurred'}. Please try again.` });
      throw error;
    }
  };

  const title = linkedTemplate !== null ? 'Create chit fund from template' : copyId ? 'Copy chit fund' : 'New chit fund';

  return (
    <div>
      <PageHeader
        title={title}
        description={copyId && copyQuery.data ? `Copying ${copyQuery.data.name}. Choose a new start date.` : 'Set up a new chit fund scheme.'}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/chit-funds">Cancel</Link>
          </Button>
        }
      />
      {initial ? (
        <ChitFundForm
          mode="create"
          initial={initial.state}
          initialTemplateId={initial.templateId}
          copyMode={!!copyId}
          onTemplateChange={setLinkedTemplate}
          onSubmit={submit}
          cancelHref="/chit-funds"
          submitLabel="Create chit fund"
          submittingLabel="Creating…"
        />
      ) : copyQuery.error ? (
        <ErrorState title="Failed to load chit fund data for copying" error={copyQuery.error} onRetry={() => void copyQuery.mutate()} />
      ) : (
        <PageSkeleton rows={8} />
      )}
    </div>
  );
}
