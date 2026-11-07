'use client';

/**
 * The one chit fund form, shared by /chit-funds/new (mode "create"), /chit-funds/[id]/edit
 * (mode "edit") and the template pages (kind "template"; see TemplateForm). Field rules,
 * auto-calculations and validation messages are the ones each page had before Phase 6a,
 * per mode (they differ: see `applyFundChange` and `validateFundForm`). The page builds
 * the request body from the values and sends it (`onSubmit`).
 *
 * The browser's own constraint checks run first, as on the old pages (amounts min 1 step 1,
 * duration 1–60, members 1–50): the form deliberately has no `noValidate`. Note that a
 * non-whole auto-calculated 1st-month contribution (e.g. 31000 ÷ 3) fails `step="1"` and
 * must be rounded before the form submits, exactly as before.
 */
import * as React from 'react';
import Link from 'next/link';
import { Loader2, Lock } from 'lucide-react';

import { formatMoney } from '@/lib/format';
import { toast } from '@/lib/toast';
import { fetchTemplate, useAllTemplates, type ChitFundTemplate } from '@/lib/query/chit-fund-templates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/kit/date-input';
import { DateText } from '@/components/kit/date-text';
import { DescriptionList } from '@/components/kit/description-list';
import { FormActions } from '@/components/kit/form-actions';
import { FormField } from '@/components/kit/form-field';
import { FormSection } from '@/components/kit/form-section';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { SectionCard } from '@/components/kit/section-card';
import { cn } from '@/lib/utils';

export type FundFormMode = 'create' | 'edit';
/** 'fund' = a chit fund; 'template' = a chit fund template (no start date or status). */
export type FundFormKind = 'fund' | 'template';

export interface FundFormValues {
  name: string;
  totalAmount: string;
  monthlyContribution: string;
  firstMonthContribution: string;
  duration: string;
  membersCount: string;
  startDate: string;
  description: string;
  status: string;
  chitFundType: string;
}

/** Month number → amount as typed. */
export type FixedAmounts = Record<number, string>;

export interface FundFormState {
  values: FundFormValues;
  fixedAmounts: FixedAmounts;
}

export type FundFormErrors = Partial<Record<keyof FundFormValues | `fixedAmount${number}`, string>>;

export const EMPTY_FUND_FORM: FundFormValues = {
  name: '',
  totalAmount: '',
  monthlyContribution: '',
  firstMonthContribution: '',
  duration: '',
  membersCount: '',
  startDate: '',
  description: '',
  status: 'Active',
  chitFundType: 'Auction',
};

const EDIT_STATUSES = ['Active', 'Completed', 'Upcoming', 'Cancelled'];
const TYPE_OPTIONS = [
  { value: 'Auction', label: 'Auction' },
  { value: 'Fixed', label: 'Fixed' },
];

/** The fixed-amounts map resized to months 1..duration, keeping amounts already typed. */
function resizeFixed(current: FixedAmounts, duration: number): FixedAmounts {
  const next: FixedAmounts = {};
  for (let i = 1; i <= duration; i++) next[i] = current[i] || '';
  return next;
}

/** Total ÷ duration as the 1st-month contribution, when both are valid (else null). */
function firstMonthFrom(totalAmount: string, duration: string): string | null {
  const total = parseFloat(totalAmount);
  const months = parseInt(duration);
  return !isNaN(total) && total > 0 && !isNaN(months) && months > 0 ? (total / months).toString() : null;
}

/**
 * One field change with the side effects each page always applied. `rules` is 'create'
 * for /chit-funds/new and both template pages, 'edit' for /chit-funds/[id]/edit.
 */
export function applyFundChange(rules: FundFormMode, state: FundFormState, name: keyof FundFormValues, value: string): FundFormState {
  const v = state.values;
  const values: FundFormValues = { ...v, [name]: value };
  let fixedAmounts = state.fixedAmounts;
  const toFixed = name === 'chitFundType' && value === 'Fixed';
  const toAuction = name === 'chitFundType' && value === 'Auction';

  if (rules === 'create') {
    if (toFixed && v.totalAmount && v.duration) {
      const first = firstMonthFrom(v.totalAmount, v.duration);
      if (first !== null) values.firstMonthContribution = first;
    }
    if ((name === 'totalAmount' || name === 'duration') && v.chitFundType === 'Fixed') {
      const first = firstMonthFrom(name === 'totalAmount' ? value : v.totalAmount, name === 'duration' ? value : v.duration);
      if (first !== null) values.firstMonthContribution = first;
    }
    if (toAuction) values.firstMonthContribution = '';
    // Duration drives the members count and (Fixed) the size of the fixed-amounts grid.
    if (name === 'duration' && value) {
      const duration = parseInt(value);
      if (!isNaN(duration) && duration > 0) {
        values.membersCount = duration.toString();
        if (v.chitFundType === 'Fixed') fixedAmounts = resizeFixed(state.fixedAmounts, duration);
      }
    }
    if (toFixed && v.duration) fixedAmounts = resizeFixed(state.fixedAmounts, parseInt(v.duration));
    if (toAuction) fixedAmounts = {};
  } else {
    if (v.chitFundType === 'Fixed' && (name === 'totalAmount' || name === 'duration')) {
      const first = firstMonthFrom(name === 'totalAmount' ? value : v.totalAmount, name === 'duration' ? value : v.duration);
      if (first !== null) values.firstMonthContribution = first;
    }
    if (toFixed && v.totalAmount && v.duration) {
      const first = firstMonthFrom(v.totalAmount, v.duration);
      if (first !== null) values.firstMonthContribution = first;
    }
    if (toAuction) values.firstMonthContribution = '';
    // Edit never auto-fills the members count; switching to Auction keeps (but no longer sends) fixed amounts.
    if (name === 'duration' && v.chitFundType === 'Fixed' && value) fixedAmounts = resizeFixed(state.fixedAmounts, parseInt(value));
  }
  return { values, fixedAmounts };
}

/** The validation each page always ran, with the same messages. */
export function validateFundForm(kind: FundFormKind, mode: FundFormMode, { values: v, fixedAmounts }: FundFormState): FundFormErrors {
  const e: FundFormErrors = {};
  if (!v.name.trim()) e.name = kind === 'template' ? 'Template name is required' : 'Chit fund name is required';

  if (!v.totalAmount) e.totalAmount = 'Total amount is required';
  else if (isNaN(Number(v.totalAmount)) || Number(v.totalAmount) <= 0) e.totalAmount = 'Please enter a valid amount';

  if (!v.monthlyContribution) e.monthlyContribution = 'Monthly contribution is required';
  else if (isNaN(Number(v.monthlyContribution)) || Number(v.monthlyContribution) <= 0) e.monthlyContribution = 'Please enter a valid amount';

  if (!v.duration) e.duration = 'Duration is required';
  else if (isNaN(Number(v.duration)) || Number(v.duration) <= 0 || Number(v.duration) > 60) e.duration = 'Please enter a valid duration (1-60 months)';

  if (!v.membersCount) e.membersCount = 'Members count is required';
  else if (isNaN(Number(v.membersCount)) || Number(v.membersCount) <= 0) e.membersCount = 'Please enter a valid number of members';

  if (kind === 'fund' && !v.startDate) e.startDate = 'Start date is required';
  if (kind === 'fund' && mode === 'edit' && !v.status) e.status = 'Status is required';

  if (v.chitFundType === 'Fixed') {
    if (!v.firstMonthContribution) {
      e.firstMonthContribution =
        kind === 'template' ? '1st month contribution is required for Fixed type' : '1st month contribution is required for Fixed type chit funds';
    } else if (isNaN(Number(v.firstMonthContribution)) || Number(v.firstMonthContribution) <= 0) {
      e.firstMonthContribution = 'Please enter a valid amount';
    }
    if (v.duration) {
      const duration = parseInt(v.duration);
      for (let i = 1; i <= duration; i++) {
        const amount = fixedAmounts[i];
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
          e[`fixedAmount${i}`] = `Amount for month ${i} is required and must be a valid positive number`;
        }
      }
    }
  }
  return e;
}

const FIELD_ORDER: (keyof FundFormValues)[] = [
  'name', 'totalAmount', 'duration', 'chitFundType', 'membersCount', 'monthlyContribution', 'firstMonthContribution', 'startDate', 'status', 'description',
];

/** The fixed amounts and type a template prescribes (as the new-fund page applied them). */
export function stateFromTemplate(prev: FundFormValues, t: ChitFundTemplate): FundFormState {
  const fixedAmounts: FixedAmounts = {};
  if (t.chitFundType === 'Fixed' && t.fixedAmountsPattern) {
    for (const m of Object.keys(t.fixedAmountsPattern)) fixedAmounts[Number(m)] = String(t.fixedAmountsPattern[m]);
  }
  return {
    values: {
      ...prev,
      totalAmount: t.totalAmount.toString(),
      monthlyContribution: t.monthlyContribution.toString(),
      firstMonthContribution: t.firstMonthContribution?.toString() || '',
      duration: t.duration.toString(),
      membersCount: t.membersCount.toString(),
      chitFundType: t.chitFundType,
    },
    fixedAmounts,
  };
}

/** Expected end date: start + duration − 1 months (month 1 is the start month), as the fund page shows it. */
export function expectedEndDate(startDate: string | Date | null | undefined, duration: number): string | null {
  if (!startDate || !duration) return null;
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  if (isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setMonth(start.getMonth() + duration - 1);
  return end.toISOString();
}

export interface ChitFundFormSubmit {
  values: FundFormValues;
  fixedAmounts: FixedAmounts;
  /** The template the fund is created from (create mode only), or null. */
  templateId: number | null;
}

export interface ChitFundFormProps {
  kind?: FundFormKind;
  mode: FundFormMode;
  initial: FundFormState;
  /** Create: the template already applied (from ?template=). */
  initialTemplateId?: number | null;
  /** Create: copying a fund (?copy=); the template picker is hidden, as before. */
  copyMode?: boolean;
  /** Edit: the fund's stored type (a Fixed fund's type cannot be changed). */
  originalType?: string;
  /** Sends the request. Throw to keep the form open (the page reports the error). */
  onSubmit: (submit: ChitFundFormSubmit) => Promise<void>;
  /** Create: told when a template is picked or cleared (the page title changes). */
  onTemplateChange?: (templateId: number | null) => void;
  cancelHref: string;
  submitLabel: string;
  submittingLabel: string;
}

export function ChitFundForm({
  kind = 'fund',
  mode,
  initial,
  initialTemplateId = null,
  copyMode = false,
  originalType,
  onSubmit,
  onTemplateChange,
  cancelHref,
  submitLabel,
  submittingLabel,
}: ChitFundFormProps) {
  const rules: FundFormMode = kind === 'template' ? 'create' : mode;
  const [state, setState] = React.useState<FundFormState>(initial);
  const [errors, setErrors] = React.useState<FundFormErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [templateId, setTemplateId] = React.useState<number | null>(initialTemplateId);
  const [applying, setApplying] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const showTemplatePicker = kind === 'fund' && mode === 'create' && !copyMode;
  const templatesQuery = useAllTemplates(showTemplatePicker);
  const templates = templatesQuery.data?.templates ?? [];
  const locked = kind === 'fund' && mode === 'create' && templateId !== null;
  const { values, fixedAmounts } = state;
  const isFixed = values.chitFundType === 'Fixed';
  const typeLocked = locked || (kind === 'fund' && mode === 'edit' && originalType === 'Fixed');
  const months = isFixed && values.duration ? Math.max(0, parseInt(values.duration) || 0) : 0;

  const change = (name: keyof FundFormValues, value: string) => setState((prev) => applyFundChange(rules, prev, name, value));
  const bind = (name: keyof FundFormValues) => ({
    name,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => change(name, event.target.value),
  });

  const pickTemplate = async (value: string) => {
    if (!value) {
      // Blank: unlock the fields for manual entry (they keep the template's values).
      setTemplateId(null);
      onTemplateChange?.(null);
      return;
    }
    setApplying(true);
    try {
      const template = await fetchTemplate(Number(value));
      setState((prev) => stateFromTemplate(prev.values, template));
      setTemplateId(template.id);
      onTemplateChange?.(template.id);
    } catch {
      toast.error('Failed to load template data');
    } finally {
      setApplying(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const found = validateFundForm(kind, mode, state);
    setErrors(found);
    const firstField = FIELD_ORDER.find((name) => found[name]);
    const firstMonth = Object.keys(found).find((key) => key.startsWith('fixedAmount'));
    const focusId = firstField ?? firstMonth;
    if (focusId) {
      formRef.current?.querySelector<HTMLElement>(`#${focusId}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ values, fixedAmounts, templateId });
    } catch {
      setSubmitting(false);
    }
  };

  const lockedClass = 'bg-muted text-muted-foreground';
  const typeHelp =
    kind === 'fund' && mode === 'edit' && originalType === 'Fixed'
      ? 'Chit fund type cannot be changed for Fixed type chit funds'
      : 'Auction: Members bid for the amount each month. Fixed: Predefined amounts for each month.';
  const endDate = kind === 'fund' ? expectedEndDate(values.startDate || null, parseInt(values.duration) || 0) : null;
  const fixedTotal = months > 0 ? Array.from({ length: months }, (_, i) => parseFloat(fixedAmounts[i + 1]) || 0).reduce((a, b) => a + b, 0) : 0;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        {showTemplatePicker ? (
          <FormSection title="Template" columns={1}>
            <FormField
              label="Start from template"
              id="templateSelect"
              description={
                locked
                  ? 'Financial fields are locked to the selected template. Choose "Blank" to enter them manually.'
                  : templates.length === 0
                    ? 'No templates yet — create one under Chit Fund Templates in the left nav.'
                    : 'Pick a template to auto-fill and lock the financial fields.'
              }
            >
              <NativeSelect
                value={templateId === null ? '' : String(templateId)}
                onValueChange={(value) => void pickTemplate(value)}
                disabled={applying}
                options={[
                  { value: '', label: 'Blank — enter all details manually' },
                  ...templates.map((t) => ({
                    value: String(t.id),
                    label: `${t.name} · ${t.chitFundType} · ${t.duration} mo · ${formatMoney(t.totalAmount)}`,
                  })),
                  // A template applied from ?template= that is not in the list (e.g. archived).
                  ...(templateId !== null && !templates.some((t) => t.id === templateId)
                    ? [{ value: String(templateId), label: `Template #${templateId}` }]
                    : []),
                ]}
              />
            </FormField>
            {locked ? (
              <p className="flex items-start gap-2 rounded-md border border-info-border bg-info-subtle px-3 py-2 text-sm text-info-text">
                <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Financial fields are <strong>locked to the template</strong>. Enter only the name, start date, and (optionally) a description. To
                  change amounts, edit the template instead.
                </span>
              </p>
            ) : null}
          </FormSection>
        ) : null}

        <FormSection title={kind === 'template' ? 'Template' : 'Chit fund'}>
          <FormField
            label={kind === 'template' ? 'Template name' : 'Chit fund name'}
            required
            nativeRequired={false}
            id="name"
            error={errors.name}
            className="md:col-span-2"
          >
            <Input type="text" {...bind('name')} placeholder={kind === 'template' ? 'e.g., Standard 20-Month Fixed' : 'e.g., Gold Chit Fund'} />
          </FormField>
          <FormField label="Chit fund type" required nativeRequired={false} id="chitFundType" description={typeHelp}>
            <NativeSelect {...bind('chitFundType')} options={TYPE_OPTIONS} disabled={typeLocked} />
          </FormField>
          {kind === 'fund' && mode === 'edit' ? (
            <FormField label="Status" required nativeRequired={false} id="status" error={errors.status}>
              <NativeSelect
                {...bind('status')}
                options={(EDIT_STATUSES.includes(values.status) || !values.status ? EDIT_STATUSES : [...EDIT_STATUSES, values.status]).map((s) => ({ value: s, label: s }))}
              />
            </FormField>
          ) : null}
          {kind === 'fund' ? (
            <FormField label="Start date" required nativeRequired={false} id="startDate" error={errors.startDate}>
              <DateInput value={values.startDate} name="startDate" onValueChange={(v) => change('startDate', v)} />
            </FormField>
          ) : null}
        </FormSection>

        <FormSection title="Amounts and duration" description={locked ? 'Set by the template.' : undefined}>
          <FormField label="Total amount (₹)" required nativeRequired={false} id="totalAmount" error={errors.totalAmount}>
            <Input type="number" inputMode="decimal" min="1" step="1" {...bind('totalAmount')} readOnly={locked} className={cn(locked && lockedClass)} placeholder="e.g., 1200000" />
          </FormField>
          <FormField label="Duration (months)" required nativeRequired={false} id="duration" error={errors.duration}>
            <Input type="number" inputMode="numeric" min="1" max="60" {...bind('duration')} readOnly={locked} className={cn(locked && lockedClass)} placeholder="e.g., 1-60" />
          </FormField>
          <FormField label="Number of members" required nativeRequired={false} id="membersCount" error={errors.membersCount} description="Typically equal to the duration in months">
            <Input type="number" inputMode="numeric" min="1" max="50" {...bind('membersCount')} readOnly={locked} className={cn(locked && lockedClass)} placeholder="e.g., 20" />
          </FormField>
          <FormField
            label="Monthly contribution (₹)"
            required
            nativeRequired={false}
            id="monthlyContribution"
            error={errors.monthlyContribution}
            description={isFixed ? 'Monthly contribution for months 2 onwards' : 'Enter the monthly contribution amount'}
          >
            <Input type="number" inputMode="decimal" min="1" step="1" {...bind('monthlyContribution')} readOnly={locked} className={cn(locked && lockedClass)} placeholder="e.g., 10000" />
          </FormField>
          {isFixed ? (
            <FormField
              label="1st month contribution (₹)"
              required
              nativeRequired={false}
              id="firstMonthContribution"
              error={errors.firstMonthContribution}
              description={`Default: Total Amount ÷ Duration = ₹${values.totalAmount || '0'} ÷ ${values.duration || '0'} = ₹${values.firstMonthContribution || '0'}`}
            >
              <Input
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                {...bind('firstMonthContribution')}
                readOnly={locked}
                className={cn(locked && lockedClass)}
                placeholder="Auto-calculated from total amount"
              />
            </FormField>
          ) : null}
          <FormField label="Description" id="description" className="md:col-span-2">
            <Textarea
              rows={3}
              {...bind('description')}
              placeholder={kind === 'template' ? 'What this template is for...' : 'Additional details about this chit fund...'}
            />
          </FormField>
        </FormSection>

        {months > 0 ? (
          <FormSection
            title={
              <>
                Fixed amounts for each month
                <span aria-hidden="true" className="ml-0.5 text-destructive-text">
                  *
                </span>
              </>
            }
            description={
              kind === 'template'
                ? 'Define the amount to be given to the winner for each month.'
                : mode === 'edit'
                  ? 'These amounts will be used as the fixed auction amounts for each respective month.'
                  : 'Define the amount to be given to the winner for each month. Example: Month 1: ₹40,000, Month 2: ₹45,000, etc.'
            }
            columns={1}
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: months }, (_, index) => {
                const month = index + 1;
                const key = `fixedAmount${month}` as const;
                return (
                  <FormField key={month} label={`Month ${month} amount (₹)`} required nativeRequired={false} id={key} error={errors[key]}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="1"
                      value={fixedAmounts[month] || ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setState((prev) => ({ ...prev, fixedAmounts: { ...prev.fixedAmounts, [month]: value } }));
                      }}
                      readOnly={locked}
                      className={cn(locked && lockedClass)}
                      placeholder={mode === 'edit' && kind === 'fund' ? 'Enter amount' : `e.g., ${40000 + (month - 1) * 5000}`}
                    />
                  </FormField>
                );
              })}
            </div>
          </FormSection>
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-[calc(var(--topbar-height,3.5rem)+1.5rem)] lg:self-start">
        <SectionCard title="Summary">
          <DescriptionList
            layout="inline"
            items={[
              { label: 'Name', value: values.name || '—' },
              { label: 'Type', value: values.chitFundType || '—' },
              { label: 'Total amount', value: <Money value={values.totalAmount || null} tone="plain" />, numeric: true },
              { label: isFixed ? 'Monthly (2nd+)' : 'Monthly', value: <Money value={values.monthlyContribution || null} tone="plain" />, numeric: true },
              ...(isFixed ? [{ label: '1st month', value: <Money value={values.firstMonthContribution || null} decimals={2} tone="plain" />, numeric: true }] : []),
              { label: 'Duration', value: values.duration ? `${values.duration} months` : '—', numeric: true },
              { label: 'Members', value: values.membersCount || '—', numeric: true },
              ...(months > 0 ? [{ label: 'Fixed amounts total', value: <Money value={fixedTotal} tone="plain" />, numeric: true }] : []),
              ...(kind === 'fund'
                ? [
                    { label: 'Start date', value: <DateText value={values.startDate || null} /> },
                    { label: 'Expected end', value: <DateText value={endDate} /> },
                  ]
                : []),
            ]}
          />
        </SectionCard>
      </aside>

      <FormActions className="lg:col-span-2">
        <Button variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={submitting || applying} aria-busy={submitting || undefined}>
          {submitting ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </FormActions>
    </form>
  );
}
