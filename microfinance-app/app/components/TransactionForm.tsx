'use client';

/**
 * Manual transaction entry: a partner transfer, or a credit/debit for the active partner.
 * Three steps: edit → review (balance impact) → done. Used in the transactions page's
 * "Record transaction" dialog and inline on the partners page.
 *
 * The POST body and the x-active-partner header are exactly what this form always sent;
 * validation is lib/transactionValidation.ts (shared with the server).
 */
import * as React from 'react';
import { ArrowLeftRight, CheckCircle2, Loader2, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatMoney } from '@/lib/format';
import { toast } from '@/lib/toast';
import { usePartner } from '../contexts/PartnerContext';
import { TRANSACTION_TYPES_CONFIG } from '../../config/config';
import {
  validateManualTransaction,
  parseAmount,
  normalizeNote,
  NOTE_MAX_LENGTH,
  NOTE_MIN_LENGTH,
  NOTE_SUGGESTIONS,
  type FieldErrors,
} from '../../lib/transactionValidation';
import { usePartnerBalances } from '@/lib/query/dashboard';
import { invalidateTransactions, transactionWrites, type ManualTransactionBody } from '@/lib/query/transactions';
import { ApiError } from '@/lib/query/fetcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/kit/date-input';
import { FormField } from '@/components/kit/form-field';
import { NativeSelect } from '@/components/kit/native-select';
import { errorMessage } from '@/components/kit/error-state';

const TRANSACTION_TYPES = [
  {
    value: TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER,
    label: 'Partner Transfer',
    description: 'Move cash from one partner to another. Total balance is unchanged.',
  },
  {
    value: TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT,
    label: 'Record Amount',
    description: 'Credit or debit cash for the active partner. Changes the total balance.',
  },
];

const money2 = (n: number) => formatMoney(n, { decimals: 2 });
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface TransactionFormProps {
  onSuccess?: () => void;
  /** Shown as a "Close" button after saving (e.g. when the form is in a dialog). */
  onClose?: () => void;
}

type Step = 'edit' | 'review' | 'done';

interface BalanceImpact {
  name: string;
  before: number | null;
  after: number | null;
  change: number;
}

function ChoiceCards<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange: (value: V) => void;
  options: { value: V; label: React.ReactNode; description: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-lg border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'border-primary bg-primary-subtle' : 'border-border hover:border-input'
            )}
          >
            <span className={cn('block text-sm font-semibold', active ? 'text-primary-text' : 'text-foreground')}>{o.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{o.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function TransactionForm({ onSuccess, onClose }: TransactionFormProps) {
  const { selectedPartner, partners } = usePartner();
  const balancesQuery = usePartnerBalances();
  const balances = React.useMemo(() => {
    const map: Record<number, number> = {};
    for (const p of balancesQuery.data?.partners ?? []) map[p.id] = p.balance ?? 0;
    return map;
  }, [balancesQuery.data]);

  const [type, setType] = React.useState<string>(TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER);
  const [amount, setAmount] = React.useState('');
  const [fromPartnerId, setFromPartnerId] = React.useState(selectedPartner?.id?.toString() || '');
  const [toPartnerId, setToPartnerId] = React.useState('');
  const [adjustmentType, setAdjustmentType] = React.useState<'credit' | 'debit'>('credit');
  const [date, setDate] = React.useState(todayISO());
  const [note, setNote] = React.useState('');

  const [step, setStep] = React.useState<Step>('edit');
  const [showErrors, setShowErrors] = React.useState(false);
  const [serverFieldErrors, setServerFieldErrors] = React.useState<FieldErrors>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [lastSummary, setLastSummary] = React.useState<null | { title: string; impacts: BalanceImpact[]; note: string }>(null);

  const isTransfer = type === TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER;

  const pickDefaultTo = (fromId: string, currentTo: string) => {
    if (currentTo && currentTo !== fromId) return currentTo;
    const other = partners.find((p) => p.id.toString() !== fromId);
    return other ? other.id.toString() : '';
  };

  const resetFeedback = () => {
    setError('');
    setServerFieldErrors({});
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    resetFeedback();
    setShowErrors(false);
    if (newType === TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER) {
      const fromId = selectedPartner?.id?.toString() || '';
      setFromPartnerId(fromId);
      setToPartnerId(fromId ? pickDefaultTo(fromId, '') : '');
    } else {
      setAdjustmentType('credit');
    }
  };

  // As before: re-apply the type's defaults when the active partner or the partner list changes.
  React.useEffect(() => {
    handleTypeChange(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartner, partners]);

  const handleFromPartnerChange = (newFromId: string) => {
    setFromPartnerId(newFromId);
    setToPartnerId(newFromId ? pickDefaultTo(newFromId, toPartnerId) : '');
  };

  const swapPartners = () => {
    if (!fromPartnerId || !toPartnerId) return;
    setFromPartnerId(toPartnerId);
    setToPartnerId(fromPartnerId);
  };

  const payload: ManualTransactionBody = React.useMemo(() => {
    if (isTransfer) {
      return { type, amount, date, note, from_partner_id: fromPartnerId, to_partner_id: toPartnerId };
    }
    const id = selectedPartner?.id ?? null;
    return {
      type,
      amount,
      date,
      note,
      from_partner_id: adjustmentType === 'debit' ? id : null,
      to_partner_id: adjustmentType === 'credit' ? id : null,
    };
  }, [isTransfer, type, amount, date, note, fromPartnerId, toPartnerId, adjustmentType, selectedPartner]);

  const validation = React.useMemo(() => validateManualTransaction(payload), [payload]);
  const clientErrors: FieldErrors = validation.ok ? {} : (validation as { errors: FieldErrors }).errors;
  const errors: FieldErrors = { ...(showErrors ? clientErrors : {}), ...serverFieldErrors };

  const partnerName = (id: string | number | null | undefined) => partners.find((p) => p.id.toString() === String(id))?.name || '—';

  const parsedAmount = parseAmount(amount);
  const amountValue = parsedAmount && parsedAmount > 0 ? parsedAmount : 0;

  const impacts: BalanceImpact[] = React.useMemo(() => {
    const impact = (id: string | number | null | undefined, change: number): BalanceImpact => {
      const before = id != null && balances[Number(id)] !== undefined ? balances[Number(id)] : null;
      return { name: partnerName(id), before, after: before === null ? null : before + change, change };
    };
    if (isTransfer) return [impact(fromPartnerId, -amountValue), impact(toPartnerId, amountValue)];
    return [impact(selectedPartner?.id, adjustmentType === 'credit' ? amountValue : -amountValue)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTransfer, fromPartnerId, toPartnerId, selectedPartner, adjustmentType, amountValue, balances, partners]);

  const goesNegative = impacts.some((i) => i.change < 0 && i.after !== null && i.after < 0);

  const summaryTitle = isTransfer
    ? `Transfer ${money2(amountValue)} from ${partnerName(fromPartnerId)} to ${partnerName(toPartnerId)}`
    : `${adjustmentType === 'credit' ? 'Credit' : 'Debit'} ${money2(amountValue)} ${adjustmentType === 'credit' ? 'to' : 'from'} ${selectedPartner?.name || '—'}`;

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    setShowErrors(true);
    if (!isTransfer && !selectedPartner) {
      setError('Select an active partner before recording an amount.');
      return;
    }
    if (!validation.ok) return;
    setStep('review');
  };

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    resetFeedback();
    try {
      await transactionWrites.create({ ...payload, note: normalizeNote(note) }, selectedPartner?.name || '');
      setLastSummary({ title: summaryTitle, impacts, note: normalizeNote(note) });
      setStep('done');
      setAmount('');
      setNote('');
      setShowErrors(false);
      toast.success('Transaction recorded', { description: summaryTitle });
      void invalidateTransactions();
      onSuccess?.();
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { fieldErrors?: FieldErrors } | null) : null;
      if (body?.fieldErrors) setServerFieldErrors(body.fieldErrors);
      setStep('edit');
      setError(errorMessage(err) || 'Failed to record transaction');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done' && lastSummary) {
    return (
      <div className="space-y-4" role="status">
        <div className="rounded-lg border border-success-border bg-success-subtle p-4">
          <p className="flex items-center gap-2 font-semibold text-success-text">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            Transaction recorded
          </p>
          <p className="mt-1 text-sm text-foreground">{lastSummary.title}</p>
          <p className="mt-2 text-xs text-muted-foreground">Reason: {lastSummary.note}</p>
        </div>
        <ImpactTable impacts={lastSummary.impacts} />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {onClose ? (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : null}
          <Button onClick={() => setStep('edit')}>Record another transaction</Button>
        </div>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Review before saving</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{summaryTitle}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <dt className="text-muted-foreground">Date</dt>
          <dd className="col-span-2 text-foreground">{formatDate(date)}</dd>
          <dt className="text-muted-foreground">Reason</dt>
          <dd className="col-span-2 break-words text-foreground">{normalizeNote(note)}</dd>
          <dt className="text-muted-foreground">Entered by</dt>
          <dd className="col-span-2 text-foreground">{selectedPartner?.name || '—'}</dd>
        </dl>
        <ImpactTable impacts={impacts} />
        {goesNegative ? (
          <p className="rounded-md border border-warning-border bg-warning-subtle p-3 text-sm text-warning-text">
            This will leave a partner with a negative balance. Confirm only if that is intended.
          </p>
        ) : null}
        {error ? <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle p-3 text-sm text-destructive-text">{error}</p> : null}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setStep('edit')} disabled={loading}>
            Edit
          </Button>
          <Button type="button" className="flex-1" onClick={handleConfirm} disabled={loading} autoFocus>
            {loading ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
            {loading ? 'Saving…' : 'Confirm & record'}
          </Button>
        </div>
      </div>
    );
  }

  const noteLength = normalizeNote(note).length;
  const suggestions = NOTE_SUGGESTIONS[type] || [];
  const BalanceHint = ({ balance }: { balance?: number }) =>
    balance === undefined || balance === null || isNaN(balance) ? null : (
      <p className="mt-1 text-xs text-muted-foreground">
        Current balance: <span className={cn('font-medium tabular-nums', balance < 0 ? 'text-destructive-text' : 'text-foreground')}>{money2(balance)}</span>
      </p>
    );

  return (
    <form className="space-y-5" onSubmit={handleReview} noValidate>
      <div className="space-y-2">
        <span className="block text-sm font-medium text-foreground">Transaction type</span>
        <ChoiceCards label="Transaction type" value={type} onChange={handleTypeChange} options={TRANSACTION_TYPES} />
      </div>

      {isTransfer ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
          <div>
            <FormField label="From partner" error={errors.from_partner_id} id="tf-from">
              <NativeSelect value={fromPartnerId} onValueChange={handleFromPartnerChange} placeholder="Select partner" options={partners.map((p) => ({ value: String(p.id), label: p.name }))} />
            </FormField>
            <BalanceHint balance={balances[Number(fromPartnerId)]} />
          </div>
          <Button type="button" variant="outline" size="icon" onClick={swapPartners} aria-label="Swap from and to partners" className="mx-auto rounded-full sm:mt-7">
            <ArrowLeftRight aria-hidden="true" className="rotate-90 sm:rotate-0" />
          </Button>
          <div>
            <FormField label="To partner" error={errors.to_partner_id} id="tf-to">
              <NativeSelect
                value={toPartnerId}
                onValueChange={setToPartnerId}
                placeholder="Select partner"
                options={partners.filter((p) => p.id.toString() !== fromPartnerId).map((p) => ({ value: String(p.id), label: p.name }))}
              />
            </FormField>
            <BalanceHint balance={balances[Number(toPartnerId)]} />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Adjustment for <span className="font-semibold">{selectedPartner?.name || '— select an active partner —'}</span>
          </p>
          <BalanceHint balance={selectedPartner ? balances[selectedPartner.id] : undefined} />
          <ChoiceCards
            label="Credit or debit"
            value={adjustmentType}
            onChange={(v) => setAdjustmentType(v as 'credit' | 'debit')}
            options={[
              { value: 'credit', label: <span className="inline-flex items-center gap-1"><Plus aria-hidden="true" className="h-3.5 w-3.5" />Credit</span>, description: 'Add cash' },
              { value: 'debit', label: <span className="inline-flex items-center gap-1"><Minus aria-hidden="true" className="h-3.5 w-3.5" />Debit</span>, description: 'Remove cash' },
            ]}
          />
          {errors.to_partner_id ? <p className="text-xs font-medium text-destructive-text">{errors.to_partner_id}</p> : null}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Amount" error={errors.amount} description={amountValue > 0 ? money2(amountValue) : undefined} id="tf-amount">
          <Input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setServerFieldErrors({});
            }}
            min="0.01"
            step="0.01"
            placeholder="₹ 0.00"
          />
        </FormField>
        <FormField label="Date" error={errors.date} id="tf-date">
          <DateInput value={date} max={todayISO()} onValueChange={setDate} />
        </FormField>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="tf-note" className="text-sm font-medium text-foreground">
            Reason <span className="text-destructive-text" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <span className={cn('text-xs tabular-nums', noteLength > NOTE_MAX_LENGTH ? 'text-destructive-text' : 'text-muted-foreground')}>
            {noteLength}/{NOTE_MAX_LENGTH}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setNote((prev) => (prev.trim() ? prev : `${s}: `))}
              className="rounded-full border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {s}
            </button>
          ))}
        </div>
        <Textarea
          id="tf-note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setServerFieldErrors({});
          }}
          rows={3}
          maxLength={NOTE_MAX_LENGTH + 50}
          aria-required="true"
          aria-invalid={!!errors.note}
          aria-describedby="tf-note-help"
          placeholder="Why is this money moving? e.g. Cash handover after Sunday collections"
        />
        <p id="tf-note-help" className={cn('text-xs', errors.note ? 'font-medium text-destructive-text' : 'text-muted-foreground')}>
          {errors.note || `Required (min ${NOTE_MIN_LENGTH} characters). Saved permanently with the transaction for audit.`}
        </p>
      </div>

      {error ? <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle p-3 text-sm text-destructive-text">{error}</p> : null}

      <Button type="submit" className="w-full">
        Review transaction
      </Button>
    </form>
  );
}

function ImpactTable({ impacts }: { impacts: BalanceImpact[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Partner</th>
            <th className="px-3 py-2 text-right font-medium">Before</th>
            <th className="px-3 py-2 text-right font-medium">Change</th>
            <th className="px-3 py-2 text-right font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {impacts.map((i) => (
            <tr key={i.name} className="border-t">
              <td className="px-3 py-2 text-foreground">{i.name}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{i.before === null ? '—' : money2(i.before)}</td>
              <td className={cn('px-3 py-2 text-right font-medium tabular-nums', i.change >= 0 ? 'text-success-text' : 'text-foreground')}>
                {i.change >= 0 ? '+' : '−'}
                {money2(Math.abs(i.change))}
              </td>
              <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', i.after !== null && i.after < 0 ? 'text-destructive-text' : 'text-foreground')}>
                {i.after === null ? '—' : money2(i.after)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
