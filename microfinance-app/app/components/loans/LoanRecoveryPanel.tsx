'use client';

import { useEffect, useRef, useState } from 'react';
import { Loan } from '../../../lib/interfaces';
import { formatCurrency, formatDate } from '../../../lib/formatUtils';
import { invalidateDashboardCache } from '../../../lib/dashboardCache';
import { NON_RECOVERABLE } from '../../../lib/loanRecovery';
import { usePartner } from '../../contexts/PartnerContext';
import ActionDropdown from '../ui/ActionDropdown';

type Action = 'mark' | 'collect' | 'settle' | 'restore' | 'reverse';
type RecoveryData = {
  preview: { duesAtMark: number; totalOutstanding: number; overdueAmount: number; overduePeriods: number };
  events: { id: number; action: Action; reason: string; createdAt: string; actor: { name: string }; details: Record<string, any> }[];
  receipts: { id: number; amount: number; principalComponent: number; interestComponent: number; paidDate: string; createdAt: string; notes: string }[];
};
const actionLabels: Record<Action, string> = {
  mark: 'Mark as Non-Recoverable', collect: 'Record Recovery', settle: 'Settle Recovery Case', restore: 'Restore to Active', reverse: 'Reverse Receipt',
};

// Token-styled classes (this file is loaded by tests/test-loan-recovery-ui.js in a VM with a strict
// import allow-list and a hooks-only fake React, so it cannot use the kit components themselves).
const BUTTON = 'inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 md:h-9';
const PRIMARY = `${BUTTON} bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover`;
const DANGER = `${BUTTON} bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90`;
const OUTLINE = `${BUTTON} border border-input bg-card text-foreground shadow-sm hover:bg-accent`;
const FIELD = 'mt-1 block h-11 w-full rounded-md border border-input bg-field px-3 text-base text-foreground shadow-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:text-sm [color-scheme:light] dark:[color-scheme:dark]';
const AREA = 'mt-1 block w-full rounded-md border border-input bg-field px-3 py-2 text-base text-foreground shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:text-sm';
const LABEL = 'block text-sm font-medium text-foreground';
const HINT = 'block text-xs font-normal text-muted-foreground mt-1';
const ERROR = 'rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text';

export default function LoanRecoveryPanel({ loan, onChange, mode = 'panel', hideTrigger = false, markRequest, returnFocusRef }: {
  loan: Loan; onChange: () => Promise<void>; mode?: 'menu' | 'panel';
  /** Menu mode: render only the dialog; the page opens it from its own menu via `markRequest`. */
  hideTrigger?: boolean;
  /** Menu mode: increment to open the "Mark as Non-Recoverable" dialog. */
  markRequest?: number;
  /** Menu mode with hideTrigger: where focus returns when the dialog closes (the page's menu button). */
  returnFocusRef?: { current: HTMLElement | null };
}) {
  const { selectedPartner, partners, partnerLocked } = usePartner();
  const [data, setData] = useState(null as RecoveryData | null);
  const [action, setAction] = useState(null as Action | null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('0');
  const [unpaidInterest, setUnpaidInterest] = useState('');
  const [paidDate, setPaidDate] = useState(() => localDate(new Date()));
  const [collectorId, setCollectorId] = useState('');
  const [repaymentId, setRepaymentId] = useState(null as number | null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pending = useRef(null as { signature: string; id: string } | null);
  const submitting = useRef(false);
  const markDialog = useRef(null as HTMLDialogElement | null);
  const markMenu = useRef(null as HTMLSpanElement | null);
  const marked = loan.status === NON_RECOVERABLE;
  const closed = loan.recoveryOutcome === 'Settled';
  const canMark = ['Active', 'Defaulted'].includes(loan.status) && loan.remainingAmount > 0;
  const needsData = mode === 'menu' ? action === 'mark' : marked || !!loan.nonRecoverableAt;

  useEffect(() => {
    if (!needsData) return;
    let ignore = false;
    setData(null);
    setLoadError('');
    fetch(`/api/loans/${loan.id}/recovery`, { cache: 'no-store' })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to load recovery history'); return result; })
      .then((result) => { if (!ignore) setData(result); })
      .catch((err) => { if (!ignore) setLoadError(err.message); });
    return () => { ignore = true; };
  }, [loan.id, loan.updatedAt, needsData]);

  useEffect(() => { setCollectorId(selectedPartner?.id?.toString() || ''); }, [selectedPartner?.id]);

  useEffect(() => { if (mode === 'menu' && markRequest) open('mark'); }, [markRequest]);

  useEffect(() => {
    const dialog = markDialog.current;
    if (action !== 'mark' || !dialog) return;
    const previousFocus = returnFocusRef?.current || markMenu.current?.querySelector('button') || document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [action]);

  function cancel() {
    if (submitting.current) return;
    setAction(null);
    setError('');
  }

  function open(next: Action, receiptId: number | null = null) {
    setAction(next); setRepaymentId(receiptId); setReason(''); setNotes(''); setPrincipal(next === 'settle' ? '0' : '');
    setInterest('0'); setUnpaidInterest(''); setConfirmed(false); setError(''); setSuccess(''); pending.current = null;
  }

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!action || !data || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(''); setSuccess('');
    const body = {
      action, reason, notes, principal, interest, unpaidInterest, paidDate, collectorId, repaymentId,
      confirmRestore: action === 'restore' && confirmed, confirmSettlement: action === 'settle' && confirmed,
      expectedUpdatedAt: loan.updatedAt,
    };
    const signature = JSON.stringify(body);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    try {
      const response = await fetch(`/api/loans/${loan.id}/recovery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-active-partner': selectedPartner?.name || '' },
        body: JSON.stringify({ ...body, requestId: pending.current.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update recovery');
      invalidateDashboardCache();
      setAction(null); pending.current = null;
      await onChange();
      setSuccess(`${actionLabels[action]} saved.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update recovery'); }
    finally { submitting.current = false; setBusy(false); }
  }

  if (mode === 'menu' ? !canMark : !loan.nonRecoverableAt && !marked) return null;
  const waivedPrincipal = Math.max(0, loan.remainingAmount - Number(principal || 0));
  const waivedInterest = Math.max(0, (loan.recoveryInterestOutstanding || 0) - Number(interest || 0));

  const recoveryForm = action ? <form onSubmit={submit} className={action === 'mark' ? 'space-y-4' : 'mt-5 pt-5 border-t space-y-4'}>
        <h3 id={action === 'mark' ? 'mark-loan-title' : undefined} className="text-lg font-semibold text-foreground">{action === 'mark' ? 'Mark this loan as Non-Recoverable?' : actionLabels[action]}</h3>
        {action === 'mark' && <>
          <p id="mark-loan-description" className="text-sm text-muted-foreground">Confirm that this loan should leave pending collections, the Due Tracker and automatic due reminders. You can still record offline recoveries later.</p>
          {!data && !loadError && <p role="status" className="text-sm text-muted-foreground">Loading loan balances…</p>}
          {loadError && <p role="alert" className={ERROR}>{loadError}</p>}
          {error && <p role="alert" className={ERROR}>{error}</p>}
          {data && <p className="text-sm text-foreground">Principal remaining: {formatCurrency(loan.remainingAmount)} · Unpaid installment dues today: {formatCurrency(data?.preview.duesAtMark)}. The balance and payment history will be retained.</p>}
          <label className={LABEL}>Unpaid interest to track (₹)
            <input data-ui="" required type="number" min="0" step="0.01" value={unpaidInterest} onChange={(e) => setUnpaidInterest(e.target.value)} className={FIELD} />
            <span className={HINT}>Enter the unpaid interest separately, or 0 if none. Installment dues include principal. New routine dues stop while the loan is Non-Recoverable.</span>
          </label>
          <label className={LABEL}>Recovery notes (optional)<textarea data-ui="" maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} className={AREA} rows={2} /></label>
        </>}
        {(action === 'collect' || action === 'settle') && <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={LABEL}>Principal received (₹)<input data-ui="" required type="number" min="0" max={loan.remainingAmount} step="0.01" value={principal} onChange={(e) => setPrincipal(e.target.value)} className={FIELD} /></label>
            <label className={LABEL}>Interest received (₹)<input data-ui="" required type="number" min="0" max={loan.recoveryInterestOutstanding || 0} step="0.01" value={interest} onChange={(e) => setInterest(e.target.value)} className={FIELD} /></label>
            <label className={LABEL}>Payment date<input data-ui="" required={Number(principal) + Number(interest) > 0} type="date" min={loan.nonRecoverableAt ? localDate(new Date(loan.nonRecoverableAt)) : undefined} max={localDate(new Date())} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className={FIELD} /></label>
            <label className={LABEL}>Collected by<select data-ui="" required={Number(principal) + Number(interest) > 0} disabled={partnerLocked} value={collectorId} onChange={(e) => setCollectorId(e.target.value)} className={FIELD}>
              <option value="">Select collector</option>{partners.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          </div>
          <p className="text-sm text-foreground">Cash received: {formatCurrency(Number(principal || 0) + Number(interest || 0))}. Principal received reduces the balance; interest received counts as income.</p>
        </>}
        {action === 'restore' && <>
          <p className="text-sm text-foreground">The original schedule will resume, including unpaid periods during the time marked Non-Recoverable. Previous recoveries are credited against the oldest unpaid installments.</p>
          <p className="text-sm text-foreground">Overdue returning to collections: <strong>{formatCurrency(data?.preview.overdueAmount)}</strong> across {data?.preview.overduePeriods} installments. Total through the next 30 days: <strong>{formatCurrency(data?.preview.totalOutstanding)}</strong>.</p>
          <label className="flex gap-2 text-sm items-start text-foreground"><input required type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />I reviewed the returning dues and want to restore this loan to Active.</label>
        </>}
        {action === 'settle' && <label className="flex gap-2 text-sm items-start text-foreground"><input required type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />Close this recovery case and waive the remaining principal of {formatCurrency(waivedPrincipal)} and unpaid interest of {formatCurrency(waivedInterest)}. The waiver will be recorded separately from cash received.</label>}
        {action === 'reverse' && <p className="text-sm text-foreground">This removes the incorrect receipt from cash and repayment totals, restores its principal and interest balances, and retains the receipt details and reversal reason in the audit history.</p>}
        <label className={LABEL}>{action === 'collect' ? 'Recovery notes / reference' : 'Reason'}<textarea data-ui="" required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={AREA} /></label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button disabled={busy} type="button" className={OUTLINE} onClick={cancel}>Cancel</button>
          <button disabled={busy || !data} type="submit" className={action === 'mark' || action === 'reverse' ? DANGER : PRIMARY}>{busy ? 'Saving…' : action === 'mark' ? 'Confirm Non-Recoverable' : actionLabels[action]}</button>
        </div>
      </form> : null;

  if (mode === 'menu') return <>
    {!hideTrigger && <span ref={markMenu} className="inline-flex">
      <ActionDropdown actions={[{ label: actionLabels.mark, onClick: () => open('mark'), className: 'text-destructive-text' }]} />
    </span>}
    {action === 'mark' && <dialog ref={markDialog} role="dialog" aria-modal="true" aria-labelledby="mark-loan-title" aria-describedby="mark-loan-description"
      onCancel={(event) => { event.preventDefault(); cancel(); }}
      className="w-[calc(100%_-_2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl border bg-card p-5 sm:p-6 m-auto text-foreground shadow-lg backdrop:bg-black/60">
      {recoveryForm}
    </dialog>}
  </>;

  return (
    <section id="loan-recovery" aria-label="Loan recovery" className="mb-6 scroll-mt-6 rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{marked ? 'Non-Recoverable · Offline Recovery' : 'Recovery History'}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {marked ? 'Excluded from routine collections, due reminders and unpaid calendar events.' : 'Previous offline recoveries and recovery decisions for this loan.'}
          </p>
        </div>
      </div>

      {marked && <>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 text-sm">
          {[
            ['Principal outstanding', formatCurrency(loan.remainingAmount)],
            ['Unpaid interest tracked', formatCurrency(loan.recoveryInterestOutstanding || 0)],
            ['Recovered since marking', formatCurrency(loan.recoveryAmount || 0)],
            ['Recovery outcome', loan.recoveryOutcome === 'Recovered' ? 'Fully Recovered' : loan.recoveryOutcome || 'Open'],
          ].map(([label, value]) => <div key={label}><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 text-base font-semibold tabular-nums text-foreground">{value}</dd></div>)}
        </dl>
        <p className="text-sm text-foreground mt-4">Marked {formatDate(loan.nonRecoverableAt)} · {loan.nonRecoverableReason}</p>
        {loan.nonRecoverableNotes && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{loan.nonRecoverableNotes}</p>}
        <p className="text-xs text-muted-foreground mt-2">
          At marking: principal {formatCurrency(loan.recoveryPrincipalAtMark)}; unpaid installment dues {formatCurrency(loan.recoveryDuesAtMark)}. Installment dues include principal and are not an additional balance.
        </p>
        {!closed && !action && <div className="flex flex-wrap gap-2 mt-4">
          {(loan.remainingAmount > 0 || (loan.recoveryInterestOutstanding || 0) > 0) && <>
            <button type="button" disabled={!data} className={PRIMARY} onClick={() => open('collect')}>Record Recovery</button>
            <button type="button" disabled={!data} className={OUTLINE} onClick={() => open('settle')}>Settle Case</button>
          </>}
          {loan.remainingAmount > 0 && <button type="button" disabled={!data} className={OUTLINE} onClick={() => open('restore')}>Restore to Active</button>}
        </div>}
      </>}

      {loadError && <p role="alert" className={`${ERROR} mt-3`}>{loadError}</p>}
      {error && <p role="alert" className={`${ERROR} mt-3`}>{error}</p>}
      {success && <p role="status" className="mt-3 rounded-md border border-success-border bg-success-subtle px-3 py-2 text-sm text-success-text">{success}</p>}

      {recoveryForm}

      {!!data?.receipts.length && <div className="mt-5 border-t pt-4">
        <h3 className="font-semibold text-sm mb-2 text-foreground">Offline recovery receipts</h3>
        <ul className="divide-y">
          {data.receipts.map((receipt) => <li key={receipt.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm text-foreground">
            <div>{formatDate(receipt.paidDate)} · <strong className="tabular-nums">{formatCurrency(receipt.amount)}</strong><span className="block text-xs text-muted-foreground mt-1">Principal {formatCurrency(receipt.principalComponent)} · Interest {formatCurrency(receipt.interestComponent)} · {receipt.notes}</span></div>
            {marked && !closed && !action && loan.nonRecoverableAt && new Date(receipt.createdAt) >= new Date(loan.nonRecoverableAt) && <button type="button" onClick={() => open('reverse', receipt.id)} className="rounded-sm text-sm font-medium text-destructive-text underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Reverse receipt #{receipt.id}</button>}
          </li>)}
        </ul>
      </div>}
      {!!data?.events.length && <details className="mt-4 border-t pt-4">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Recovery audit history ({data.events.length})</summary>
        <ol className="mt-3 space-y-3 text-sm text-foreground">
          {data.events.map((event) => <li key={event.id}>
            <p className="font-medium">{actionLabels[event.action]} · {formatDate(event.createdAt)} · {event.actor.name}</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{event.reason}</p>
            {event.details.amountReceived != null && <p className="text-xs mt-1">Received {formatCurrency(event.details.amountReceived)} · Principal {formatCurrency(event.details.principalReceived)} · Interest {formatCurrency(event.details.interestReceived)}</p>}
            {event.action === 'mark' && <p className="text-xs mt-1">Principal {formatCurrency(event.details.principal)} · Installment dues {formatCurrency(event.details.unpaidInstallmentDues)} · Unpaid interest {formatCurrency(event.details.unpaidInterest)}</p>}
            {event.action === 'settle' && <p className="text-xs mt-1">Principal waived {formatCurrency(event.details.principalWaived)} · Interest waived {formatCurrency(event.details.interestWaived)}</p>}
            {event.action === 'reverse' && <p className="text-xs mt-1">Receipt #{event.details.reversedRepaymentId} · Reversed {formatCurrency(event.details.amountReversed)} · Original payment {formatDate(event.details.originalPaidDate)}</p>}
          </li>)}
        </ol>
      </details>}
    </section>
  );
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
