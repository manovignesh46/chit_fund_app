'use client';

/**
 * Shared create/edit form for chit fund templates: the shared ChitFundForm in "template"
 * mode. A template captures only the STRUCTURAL fields of a chit fund (no start date or
 * status), with the same auto-calculations as the new-fund form.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';

import { toast } from '@/lib/toast';
import { invalidateTemplates, templateTag, templateWrites, type ChitFundTemplate } from '@/lib/query/chit-fund-templates';
import { ChitFundForm, EMPTY_FUND_FORM, type ChitFundFormSubmit, type FixedAmounts, type FundFormState } from '@/app/components/chit-funds/ChitFundForm';
import { errorMessage } from '@/components/kit/error-state';

/** Form values from a template, as the form always prefilled them. */
function stateFromTemplate(initial?: ChitFundTemplate | null): FundFormState {
  const fixedAmounts: FixedAmounts = {};
  if (initial?.chitFundType === 'Fixed' && initial.fixedAmountsPattern) {
    for (const m of Object.keys(initial.fixedAmountsPattern)) fixedAmounts[Number(m)] = String(initial.fixedAmountsPattern[m]);
  }
  return {
    values: {
      ...EMPTY_FUND_FORM,
      name: initial?.name || '',
      description: initial?.description || '',
      totalAmount: initial?.totalAmount?.toString() || '',
      monthlyContribution: initial?.monthlyContribution?.toString() || '',
      firstMonthContribution: initial?.firstMonthContribution?.toString() || '',
      duration: initial?.duration?.toString() || '',
      membersCount: initial?.membersCount?.toString() || '',
      chitFundType: initial?.chitFundType || 'Auction',
    },
    fixedAmounts,
  };
}

/** The payload the form has always sent (fixedAmountsPattern only for Fixed). */
function templateBody({ values: v, fixedAmounts }: ChitFundFormSubmit) {
  return {
    name: v.name,
    description: v.description,
    totalAmount: v.totalAmount,
    monthlyContribution: v.monthlyContribution,
    firstMonthContribution: v.firstMonthContribution,
    duration: v.duration,
    membersCount: v.membersCount,
    chitFundType: v.chitFundType,
    fixedAmountsPattern: v.chitFundType === 'Fixed' ? fixedAmounts : undefined,
  };
}

export interface TemplateFormProps {
  mode: 'create' | 'edit';
  templateId?: number;
  initial?: ChitFundTemplate | null;
}

export default function TemplateForm({ mode, templateId, initial }: TemplateFormProps) {
  const router = useRouter();
  const [state] = React.useState(() => stateFromTemplate(initial));

  const submit = async (submitted: ChitFundFormSubmit) => {
    try {
      if (mode === 'create') await templateWrites.create(templateBody(submitted));
      else await templateWrites.update(templateId as number, templateBody(submitted));
      void invalidateTemplates(templateId ? [templateTag(templateId)] : []);
      toast.success(mode === 'create' ? 'Template created' : 'Template saved', { description: submitted.values.name });
      router.push('/chit-fund-templates');
    } catch (error) {
      toast.error("Couldn't save the template", { description: errorMessage(error) || 'Failed to save template. Please try again.' });
      throw error;
    }
  };

  return (
    <ChitFundForm
      kind="template"
      mode={mode}
      initial={state}
      onSubmit={submit}
      cancelHref="/chit-fund-templates"
      submitLabel={mode === 'create' ? 'Create template' : 'Save changes'}
      submittingLabel="Saving…"
    />
  );
}
