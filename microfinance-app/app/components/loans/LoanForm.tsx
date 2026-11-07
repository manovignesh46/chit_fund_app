'use client';

/**
 * The one loan form, shared by /loans/new (mode "create") and /loans/[id]/edit
 * (mode "edit"). Field rules, auto-calculations and validation messages are the
 * ones each page had before Phase 4, per mode (they differ: see `applyChange`).
 * The page builds the request body and sends it (`onSubmit`).
 */
import * as React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { apiFetch } from '@/lib/query/fetcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/kit/date-input';
import { DateText } from '@/components/kit/date-text';
import { DescriptionList } from '@/components/kit/description-list';
import { EntityCombobox } from '@/components/kit/entity-combobox';
import { FormActions } from '@/components/kit/form-actions';
import { FormField } from '@/components/kit/form-field';
import { FormSection } from '@/components/kit/form-section';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { SectionCard } from '@/components/kit/section-card';
import { cn } from '@/lib/utils';

export type LoanFormMode = 'create' | 'edit';

export interface LoanFormValues {
  globalMemberId: string;
  borrowerName: string;
  contact: string;
  loanType: string;
  amount: string;
  interestRate: string;
  documentCharge: string;
  duration: string;
  purpose: string;
  disbursementDate: string;
  installmentAmount: string;
  interestPercentage: string;
  status: string;
}

export type LoanFormErrors = Partial<Record<keyof LoanFormValues, string>>;

interface Member {
  id: number;
  name: string;
  contact: string;
}

export const EMPTY_LOAN_FORM: LoanFormValues = {
  globalMemberId: '',
  borrowerName: '',
  contact: '',
  loanType: 'Monthly',
  amount: '',
  interestRate: '',
  documentCharge: '0',
  duration: '',
  purpose: '',
  disbursementDate: '',
  installmentAmount: '0',
  interestPercentage: '24',
  status: 'Active',
};

/** Members per picker request (the list endpoint's page size cap). */
const MEMBER_PICKER_PAGE_SIZE = 100;

const CREATE_TYPES = ['Monthly', 'Weekly', 'Reducing Balance'];
const EDIT_TYPES = ['Monthly', 'Weekly'];
const EDIT_STATUSES = ['Active', 'Completed', 'Defaulted'];

/** One field change, with the side effects each page always applied. */
export function applyChange(mode: LoanFormMode, current: LoanFormValues, name: keyof LoanFormValues, value: string, members: Member[] = []): LoanFormValues {
  const next: LoanFormValues = { ...current, [name]: value };

  if (mode === 'create' && name === 'globalMemberId' && value) {
    const member = members.find((m) => m.id.toString() === value);
    if (member) {
      next.borrowerName = member.name;
      next.contact = member.contact;
    }
  }

  if (name === 'loanType') {
    const currentDuration = parseInt(next.duration) || 0;
    if (mode === 'create') {
      if (value === 'Weekly' || value === 'Reducing Balance') {
        if (value === 'Weekly') {
          next.duration = currentDuration > 0 && currentDuration <= 60 ? Math.round(currentDuration * 4.3).toString() : '4';
          next.documentCharge = '0';
        }
        next.interestRate = '0';
      } else {
        next.duration = currentDuration > 4 && currentDuration <= 260 ? Math.round(currentDuration / 4.3).toString() : '1';
      }
      if (value === 'Reducing Balance' && !next.duration) next.duration = '60';
    } else if (value === 'Weekly') {
      next.duration = currentDuration > 0 && currentDuration <= 60 ? Math.round(currentDuration * 4.3).toString() : '4';
      next.interestRate = '0';
      next.documentCharge = '0';
    } else {
      next.duration = currentDuration > 4 && currentDuration <= 260 ? Math.round(currentDuration / 4.3).toString() : '1';
    }
  }

  const recalc =
    mode === 'create'
      ? ['amount', 'interestRate', 'interestPercentage', 'duration', 'loanType'].includes(name)
      : ['amount', 'interestRate', 'duration', 'loanType'].includes(name);
  if (recalc) {
    const amount = parseFloat(next.amount) || 0;
    const interestAmount = parseFloat(next.interestRate) || 0;
    const interestPercentage = parseFloat(next.interestPercentage) || 0;
    const duration = parseInt(next.duration) || 1;
    let installment: number;
    if (next.loanType === 'Monthly') {
      installment = amount / duration + interestAmount;
    } else if (mode === 'create' && next.loanType === 'Reducing Balance') {
      installment = amount / duration + amount * (interestPercentage / 100 / 12);
    } else {
      installment = amount / Math.max(1, duration - 1);
    }
    next.installmentAmount = installment.toFixed(2);
  }
  return next;
}

/** The validation each page always ran, in the same order and with the same messages. */
export function validateLoanForm(mode: LoanFormMode, v: LoanFormValues): LoanFormErrors {
  const e: LoanFormErrors = {};
  if (mode === 'create' && !v.globalMemberId) e.globalMemberId = 'Please select a member';
  if (!v.borrowerName.trim()) e.borrowerName = 'Borrower name is required';
  if (!v.contact.trim()) e.contact = 'Contact information is required';
  else if (!/^[0-9+\s-]{10,15}$/.test(v.contact.trim())) e.contact = 'Please enter a valid phone number';

  if (!v.amount) e.amount = 'Loan amount is required';
  else if (isNaN(Number(v.amount)) || Number(v.amount) <= 0) e.amount = 'Please enter a valid amount';

  if (v.loanType === 'Monthly') {
    if (!v.interestRate) e.interestRate = 'Interest amount is required';
    else if (isNaN(Number(v.interestRate)) || Number(v.interestRate) < 0) e.interestRate = 'Please enter a valid interest amount';
  }
  if (mode === 'create' && v.loanType === 'Reducing Balance') {
    if (!v.interestPercentage) e.interestPercentage = 'Interest percentage is required';
    else if (isNaN(Number(v.interestPercentage)) || Number(v.interestPercentage) < 0) e.interestPercentage = 'Please enter a valid interest percentage';
  }
  if (v.documentCharge && (isNaN(Number(v.documentCharge)) || Number(v.documentCharge) < 0)) {
    e.documentCharge = 'Please enter a valid document charge amount';
  }

  const durationRequired = mode === 'edit' || v.loanType !== 'Reducing Balance';
  if (!v.duration && durationRequired) e.duration = 'Loan duration is required';
  else if (v.duration && (isNaN(Number(v.duration)) || Number(v.duration) <= 0)) e.duration = 'Please enter a valid duration greater than 0';
  else if (v.loanType === 'Monthly' && Number(v.duration) > 60) e.duration = 'Monthly duration cannot exceed 60 months (5 years)';
  else if (v.loanType === 'Weekly' && Number(v.duration) > 260) e.duration = 'Weekly duration cannot exceed 260 weeks (5 years)';

  if (!v.purpose.trim()) e.purpose = 'Loan purpose is required';
  if (!v.disbursementDate) e.disbursementDate = 'Disbursement date is required';
  return e;
}

const FIELD_ORDER: (keyof LoanFormValues)[] = [
  'globalMemberId', 'borrowerName', 'contact', 'loanType', 'status', 'amount', 'interestRate', 'interestPercentage',
  'documentCharge', 'duration', 'installmentAmount', 'disbursementDate', 'purpose',
];

export interface LoanFormProps {
  mode: LoanFormMode;
  initialValues: LoanFormValues;
  /** Sends the request. Throw to keep the form open (the page reports the error). */
  onSubmit: (values: LoanFormValues) => Promise<void>;
  cancelHref: string;
}

export function LoanForm({ mode, initialValues, onSubmit, cancelHref }: LoanFormProps) {
  const [values, setValues] = React.useState<LoanFormValues>(initialValues);
  const [errors, setErrors] = React.useState<LoanFormErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  // The member picker searches on the server (first 100 by name, like the old client-side
  // filter over the whole list); picking one fills the borrower name and contact.
  const [selectedMember, setSelectedMember] = React.useState<Member | null>(null);
  const pickMember = (member: Member | null) => {
    setSelectedMember(member);
    setValues((prev) => applyChange(mode, prev, 'globalMemberId', member ? member.id.toString() : '', member ? [member] : []));
  };
  const loadMembers = React.useCallback(async (query: string, signal: AbortSignal) => {
    const search = new URLSearchParams({ action: 'list', pageSize: String(MEMBER_PICKER_PAGE_SIZE) });
    if (query) search.set('search', query);
    const data = await apiFetch<{ members?: Member[] }>(`/members/consolidated?${search.toString()}`, { signal });
    return data.members ?? [];
  }, []);

  const change = (name: keyof LoanFormValues, value: string) => setValues((prev) => applyChange(mode, prev, name, value, selectedMember ? [selectedMember] : []));
  const bind = (name: keyof LoanFormValues) => ({
    name,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => change(name, event.target.value),
  });

  const typeOptions = (mode === 'create' ? CREATE_TYPES : EDIT_TYPES.includes(initialValues.loanType) ? EDIT_TYPES : [...EDIT_TYPES, initialValues.loanType]).map((t) => ({ value: t, label: t }));
  const statusOptions = (EDIT_STATUSES.includes(initialValues.status) ? EDIT_STATUSES : [...EDIT_STATUSES, initialValues.status]).map((s) => ({ value: s, label: s }));

  const isMonthly = values.loanType === 'Monthly';
  const isWeekly = values.loanType === 'Weekly';
  const isReducing = values.loanType === 'Reducing Balance';
  const memberLocked = mode === 'create' && !!values.globalMemberId;
  const firstMonthInterest = parseFloat(values.amount || '0') * (parseFloat(values.interestPercentage || '0') / 100 / 12);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const found = validateLoanForm(mode, values);
    setErrors(found);
    const first = FIELD_ORDER.find((name) => found[name]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#${first}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch {
      setSubmitting(false);
    }
  };

  const submitLabel = mode === 'create' ? (submitting ? 'Creating…' : 'Create loan') : submitting ? 'Updating…' : 'Update loan';

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <FormSection title="Borrower" description={mode === 'create' ? 'Pick an existing member; their name and contact are filled in.' : undefined}>
          {mode === 'create' ? (
            <FormField
              label="Select member"
              required
              id="globalMemberId"
              error={errors.globalMemberId}
              className="md:col-span-2"
              description={
                <>
                  <Link href="/members" className="font-medium text-primary-text hover:underline">
                    + Add a new member
                  </Link>{' '}
                  if not in the list
                </>
              }
            >
              <EntityCombobox<Member>
                value={selectedMember}
                onChange={pickMember}
                loadOptions={loadMembers}
                getOptionValue={(m) => m.id}
                getOptionLabel={(m) => `${m.name} (${m.contact})`}
                renderOption={(m) => (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <span className="truncate">{m.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{m.contact}</span>
                  </span>
                )}
                placeholder="-- Select a member --"
                searchPlaceholder="Search by name or phone"
              />
            </FormField>
          ) : null}
          <FormField label="Borrower name" required nativeRequired={false} id="borrowerName" error={errors.borrowerName}>
            <Input type="text" {...bind('borrowerName')} readOnly={memberLocked} className={cn(memberLocked && 'bg-muted text-muted-foreground')} />
          </FormField>
          <FormField label="Contact number" required nativeRequired={false} id="contact" error={errors.contact}>
            <Input type="text" inputMode="tel" {...bind('contact')} readOnly={memberLocked} className={cn(memberLocked && 'bg-muted text-muted-foreground')} />
          </FormField>
        </FormSection>

        <FormSection title="Loan terms">
          <FormField label="Loan type" required nativeRequired={false} id="loanType">
            <NativeSelect {...bind('loanType')} options={typeOptions} />
          </FormField>
          {mode === 'edit' ? (
            <FormField label="Loan status" required nativeRequired={false} id="status">
              <NativeSelect {...bind('status')} options={statusOptions} />
            </FormField>
          ) : null}
          <FormField label="Loan amount (₹)" required nativeRequired={false} id="amount" error={errors.amount}>
            <Input type="number" inputMode="decimal" min="1" step="1" {...bind('amount')} />
          </FormField>
          {isMonthly ? (
            <FormField label="Interest amount (₹)" required nativeRequired={false} id="interestRate" error={errors.interestRate}>
              <Input type="number" inputMode="decimal" min="0" step="1" {...bind('interestRate')} />
            </FormField>
          ) : null}
          {mode === 'create' && isReducing ? (
            <FormField label="Interest percentage (%)" required nativeRequired={false} id="interestPercentage" error={errors.interestPercentage}>
              <Input type="number" inputMode="decimal" min="0" step="0.1" {...bind('interestPercentage')} />
            </FormField>
          ) : null}
          {isMonthly ? (
            <FormField label="Document charge (₹)" id="documentCharge" error={errors.documentCharge}>
              <Input type="number" inputMode="decimal" min="0" step="1" {...bind('documentCharge')} />
            </FormField>
          ) : null}
          {mode === 'edit' || !isReducing ? (
            <FormField label={`Duration (${isWeekly ? 'weeks' : 'months'})`} required nativeRequired={false} id="duration" error={errors.duration}>
              <Input type="number" inputMode="numeric" min="1" max={isWeekly ? '260' : '60'} {...bind('duration')} />
            </FormField>
          ) : null}
          {mode === 'create' && isReducing ? (
            <FormField label="1st month interest amount (₹)" id="firstMonthInterest" description="Auto-calculated based on amount and percentage">
              <output className="flex h-11 items-center rounded-md border bg-muted px-3 text-base font-semibold tabular-nums text-foreground md:h-9 md:text-sm">
                <Money value={firstMonthInterest} decimals={2} tone="plain" />
              </output>
            </FormField>
          ) : (
            <FormField label="Installment amount (₹)" id="installmentAmount" description="Auto-calculated but can be manually adjusted if needed">
              <Input type="number" inputMode="decimal" {...bind('installmentAmount')} />
            </FormField>
          )}
        </FormSection>

        <FormSection title="Disbursement">
          <FormField label="Disbursement date" required nativeRequired={false} id="disbursementDate" error={errors.disbursementDate}>
            <DateInput value={values.disbursementDate} name="disbursementDate" onValueChange={(v) => change('disbursementDate', v)} />
          </FormField>
          <FormField label="Loan purpose" required nativeRequired={false} id="purpose" error={errors.purpose} className="md:col-span-2">
            <Textarea rows={3} {...bind('purpose')} />
          </FormField>
        </FormSection>
      </div>

      <aside className="lg:sticky lg:top-[calc(var(--topbar-height,3.5rem)+1.5rem)] lg:self-start">
        <SectionCard title="Summary">
          <DescriptionList
            layout="inline"
            items={[
              { label: 'Borrower', value: values.borrowerName || '—' },
              { label: 'Loan type', value: values.loanType },
              { label: 'Amount', value: <Money value={values.amount || null} tone="plain" />, numeric: true },
              ...(isMonthly ? [{ label: 'Interest', value: <Money value={values.interestRate || null} tone="plain" />, numeric: true }] : []),
              ...(isMonthly ? [{ label: 'Document charge', value: <Money value={values.documentCharge || 0} tone="plain" />, numeric: true }] : []),
              ...(mode === 'create' && isReducing
                ? [
                    { label: 'Interest rate', value: `${values.interestPercentage || 0}%`, numeric: true },
                    { label: '1st month interest', value: <Money value={firstMonthInterest} decimals={2} tone="plain" />, numeric: true },
                  ]
                : [
                    { label: 'Duration', value: values.duration ? `${values.duration} ${isWeekly ? 'weeks' : 'months'}` : '—', numeric: true },
                    { label: 'Installment', value: <Money value={values.installmentAmount || null} decimals={2} tone="plain" />, numeric: true },
                  ]),
              { label: 'Disbursement', value: <DateText value={values.disbursementDate || null} /> },
            ]}
          />
        </SectionCard>
      </aside>

      <FormActions className="lg:col-span-2">
        <Button variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={submitting} aria-busy={submitting || undefined}>
          {submitting ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
          {submitLabel}
        </Button>
      </FormActions>
    </form>
  );
}
