"use client";
import { useState, useEffect, useMemo } from "react";
import { usePartner } from "../contexts/PartnerContext";
import { TRANSACTION_TYPES_CONFIG } from "../../config/config";
import {
  validateManualTransaction,
  parseAmount,
  normalizeNote,
  NOTE_MAX_LENGTH,
  NOTE_MIN_LENGTH,
  NOTE_SUGGESTIONS,
  type FieldErrors,
} from "../../lib/transactionValidation";

const TRANSACTION_TYPES = [
  {
    value: TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER,
    label: "Partner Transfer",
    description: "Move cash from one partner to another. Total balance is unchanged.",
  },
  {
    value: TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT,
    label: "Record Amount",
    description: "Credit or debit cash for the active partner. Changes the total balance.",
  },
];

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const formatINR = (n: number) => inr.format(n);
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface TransactionFormProps {
  onSuccess?: () => void;
}

type Step = "edit" | "review" | "done";

interface BalanceImpact {
  name: string;
  before: number | null;
  after: number | null;
  change: number;
}

export default function TransactionForm({ onSuccess }: TransactionFormProps) {
  const { selectedPartner, partners } = usePartner();

  const [type, setType] = useState(TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER);
  const [amount, setAmount] = useState("");
  const [fromPartnerId, setFromPartnerId] = useState(selectedPartner?.id?.toString() || "");
  const [toPartnerId, setToPartnerId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("credit" as "credit" | "debit");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  const [balances, setBalances] = useState({} as Record<number, number>);
  const [step, setStep] = useState("edit" as Step);
  const [showErrors, setShowErrors] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState({} as FieldErrors);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastSummary, setLastSummary] = useState(null as null | { title: string; impacts: BalanceImpact[]; note: string });

  const isTransfer = type === TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER;

  async function fetchBalances() {
    try {
      const res = await fetch("/api/partners?includeBalances=true");
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<number, number> = {};
      for (const p of data.partners || []) map[p.id] = p.balance ?? 0;
      setBalances(map);
    } catch {
      // Balances are informational only; the form still works without them.
    }
  }

  useEffect(() => {
    fetchBalances();
  }, [partners]);

  function pickDefaultTo(fromId: string, currentTo: string) {
    if (currentTo && currentTo !== fromId) return currentTo;
    const other = partners.find((p) => p.id.toString() !== fromId);
    return other ? other.id.toString() : "";
  }

  useEffect(() => {
    handleTypeChange(type);
  }, [selectedPartner, partners]);

  function resetFeedback() {
    setError("");
    setServerFieldErrors({});
  }

  function handleTypeChange(newType: string) {
    setType(newType);
    resetFeedback();
    setShowErrors(false);
    if (newType === TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER) {
      const fromId = selectedPartner?.id?.toString() || "";
      setFromPartnerId(fromId);
      setToPartnerId(fromId ? pickDefaultTo(fromId, "") : "");
    } else {
      setAdjustmentType("credit");
    }
  }

  function handleFromPartnerChange(newFromId: string) {
    setFromPartnerId(newFromId);
    setToPartnerId(newFromId ? pickDefaultTo(newFromId, toPartnerId) : "");
  }

  function swapPartners() {
    if (!fromPartnerId || !toPartnerId) return;
    setFromPartnerId(toPartnerId);
    setToPartnerId(fromPartnerId);
  }

  const payload = useMemo(() => {
    if (isTransfer) {
      return { type, amount, date, note, from_partner_id: fromPartnerId, to_partner_id: toPartnerId };
    }
    const id = selectedPartner?.id ?? null;
    return {
      type,
      amount,
      date,
      note,
      from_partner_id: adjustmentType === "debit" ? id : null,
      to_partner_id: adjustmentType === "credit" ? id : null,
    };
  }, [isTransfer, type, amount, date, note, fromPartnerId, toPartnerId, adjustmentType, selectedPartner]);

  const validation = useMemo(() => validateManualTransaction(payload), [payload]);
  const clientErrors: FieldErrors = validation.ok ? {} : validation.errors;
  const errors: FieldErrors = { ...(showErrors ? clientErrors : {}), ...serverFieldErrors };

  const partnerName = (id: string | number | null | undefined) =>
    partners.find((p) => p.id.toString() === String(id))?.name || "—";

  const parsedAmount = parseAmount(amount);
  const amountValue = parsedAmount && parsedAmount > 0 ? parsedAmount : 0;

  const impacts: BalanceImpact[] = useMemo(() => {
    const impact = (id: string | number | null | undefined, change: number): BalanceImpact => {
      const before = id != null && balances[Number(id)] !== undefined ? balances[Number(id)] : null;
      return { name: partnerName(id), before, after: before === null ? null : before + change, change };
    };
    if (isTransfer) {
      return [impact(fromPartnerId, -amountValue), impact(toPartnerId, amountValue)];
    }
    return [impact(selectedPartner?.id, adjustmentType === "credit" ? amountValue : -amountValue)];
  }, [isTransfer, fromPartnerId, toPartnerId, selectedPartner, adjustmentType, amountValue, balances, partners]);

  const goesNegative = impacts.some((i) => i.change < 0 && i.after !== null && i.after < 0);

  const summaryTitle = isTransfer
    ? `Transfer ${formatINR(amountValue)} from ${partnerName(fromPartnerId)} to ${partnerName(toPartnerId)}`
    : `${adjustmentType === "credit" ? "Credit" : "Debit"} ${formatINR(amountValue)} ${adjustmentType === "credit" ? "to" : "from"} ${selectedPartner?.name || "—"}`;

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    setShowErrors(true);
    if (!isTransfer && !selectedPartner) {
      setError("Select an active partner before recording an amount.");
      return;
    }
    if (!validation.ok) return;
    setStep("review");
  }

  async function handleConfirm() {
    if (loading) return;
    setLoading(true);
    resetFeedback();
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-active-partner": selectedPartner?.name || "",
        },
        body: JSON.stringify({ ...payload, note: normalizeNote(note) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fieldErrors) setServerFieldErrors(data.fieldErrors);
        setStep("edit");
        throw new Error(data.error || "Failed to record transaction");
      }
      setLastSummary({ title: summaryTitle, impacts, note: normalizeNote(note) });
      setStep("done");
      setAmount("");
      setNote("");
      setShowErrors(false);
      fetchBalances();
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const fieldError = (key: keyof FieldErrors) =>
    errors[key] ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[key]}</p> : null;

  const inputClass = (key: keyof FieldErrors) =>
    `themed-input w-full mt-1 ${errors[key] ? "border-red-500 focus:ring-red-500" : ""}`;

  if (step === "done" && lastSummary) {
    return (
      <div className="space-y-4" role="status">
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-4">
          <p className="font-semibold text-green-800 dark:text-green-300">Transaction recorded</p>
          <p className="text-sm text-green-800 dark:text-green-300 mt-1">{lastSummary.title}</p>
          <p className="text-xs text-gray-600 dark:text-theme-muted mt-2">Reason: {lastSummary.note}</p>
        </div>
        <ImpactTable impacts={lastSummary.impacts} />
        <button type="button" className="btn-primary w-full justify-center" onClick={() => setStep("edit")}>
          Record another transaction
        </button>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-theme-muted">Review before saving</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-theme-primary mt-1">{summaryTitle}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <dt className="text-gray-500 dark:text-theme-muted">Date</dt>
          <dd className="col-span-2 text-gray-900 dark:text-theme-primary">{new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</dd>
          <dt className="text-gray-500 dark:text-theme-muted">Reason</dt>
          <dd className="col-span-2 text-gray-900 dark:text-theme-primary break-words">{normalizeNote(note)}</dd>
          <dt className="text-gray-500 dark:text-theme-muted">Entered by</dt>
          <dd className="col-span-2 text-gray-900 dark:text-theme-primary">{selectedPartner?.name || "—"}</dd>
        </dl>
        <ImpactTable impacts={impacts} />
        {goesNegative && (
          <p className="text-sm rounded-md p-3 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            This will leave a partner with a negative balance. Confirm only if that is intended.
          </p>
        )}
        {error && <div className="text-red-600 font-medium p-3 bg-red-50 dark:bg-red-900/20 rounded-md">{error}</div>}
        <div className="flex gap-3">
          <button type="button" className="btn-neutral flex-1 px-4 py-2 rounded-md" onClick={() => setStep("edit")} disabled={loading}>
            Edit
          </button>
          <button
            type="button"
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            onClick={handleConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? "Saving..." : "Confirm & Record"}
          </button>
        </div>
      </div>
    );
  }

  const noteLength = normalizeNote(note).length;
  const suggestions = NOTE_SUGGESTIONS[type] || [];

  return (
    <form className="space-y-5" onSubmit={handleReview} noValidate>
      {/* Type selector */}
      <div>
        <span className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-2">Transaction type</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Transaction type">
          {TRANSACTION_TYPES.map((t) => {
            const active = type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleTypeChange(t.value)}
                className={`text-left rounded-lg border-2 p-3 transition-colors ${
                  active
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-surface-border hover:border-gray-300"
                }`}
              >
                <span className={`block text-sm font-semibold ${active ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-theme-primary"}`}>{t.label}</span>
                <span className="block text-xs text-gray-500 dark:text-theme-muted mt-0.5">{t.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isTransfer ? (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:items-start">
          <div>
            <label htmlFor="tf-from" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary">From partner</label>
            <select id="tf-from" className={inputClass("from_partner_id")} value={fromPartnerId} onChange={(e) => handleFromPartnerChange(e.target.value)}>
              <option value="">Select partner</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <BalanceHint balance={balances[Number(fromPartnerId)]} />
            {fieldError("from_partner_id")}
          </div>
          <button
            type="button"
            onClick={swapPartners}
            className="self-center sm:mt-6 mx-auto p-2 rounded-full border border-gray-200 dark:border-surface-border text-gray-500 hover:text-blue-600 hover:border-blue-400"
            aria-label="Swap from and to partners"
            title="Swap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 rotate-90 sm:rotate-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
          <div>
            <label htmlFor="tf-to" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary">To partner</label>
            <select id="tf-to" className={inputClass("to_partner_id")} value={toPartnerId} onChange={(e) => setToPartnerId(e.target.value)}>
              <option value="">Select partner</option>
              {partners
                .filter((p) => p.id.toString() !== fromPartnerId)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
            <BalanceHint balance={balances[Number(toPartnerId)]} />
            {fieldError("to_partner_id")}
          </div>
        </div>
      ) : (
        <div>
          <span className="block text-sm font-medium text-gray-700 dark:text-theme-secondary">
            Adjustment for <span className="font-semibold">{selectedPartner?.name || "— select an active partner —"}</span>
          </span>
          <BalanceHint balance={selectedPartner ? balances[selectedPartner.id] : undefined} />
          <div className="grid grid-cols-2 gap-2 mt-2" role="radiogroup" aria-label="Credit or debit">
            {([
              { key: "credit", label: "Credit", hint: "Add cash", color: "green" },
              { key: "debit", label: "Debit", hint: "Remove cash", color: "red" },
            ] as const).map((o) => {
              const active = adjustmentType === o.key;
              const activeCls = o.color === "green"
                ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                : "border-red-600 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300";
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setAdjustmentType(o.key)}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${active ? activeCls : "border-gray-200 dark:border-surface-border text-gray-700 dark:text-theme-secondary"}`}
                >
                  <span className="block text-sm font-semibold">{o.key === "credit" ? "+ " : "− "}{o.label}</span>
                  <span className="block text-xs opacity-80">{o.hint}</span>
                </button>
              );
            })}
          </div>
          {fieldError("to_partner_id")}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="tf-amount" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 mt-0.5 text-gray-500">₹</span>
            <input
              id="tf-amount"
              type="number"
              inputMode="decimal"
              className={`${inputClass("amount")} pl-7`}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setServerFieldErrors({}); }}
              min="0.01"
              step="0.01"
              placeholder="0.00"
            />
          </div>
          {amountValue > 0 && !errors.amount && (
            <p className="mt-1 text-xs text-gray-500 dark:text-theme-muted">{formatINR(amountValue)}</p>
          )}
          {fieldError("amount")}
        </div>
        <div>
          <label htmlFor="tf-date" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary">Date</label>
          <input
            id="tf-date"
            type="date"
            className={inputClass("date")}
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
          {fieldError("date")}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="tf-note" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary">
            Reason <span className="text-red-600" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <span className={`text-xs ${noteLength > NOTE_MAX_LENGTH ? "text-red-600" : "text-gray-400"}`}>
            {noteLength}/{NOTE_MAX_LENGTH}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setNote((prev) => (prev.trim() ? prev : `${s}: `))}
              className="text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-surface-border text-gray-600 dark:text-theme-secondary hover:border-blue-400 hover:text-blue-600"
            >
              {s}
            </button>
          ))}
        </div>
        <textarea
          id="tf-note"
          className={inputClass("note")}
          value={note}
          onChange={(e) => { setNote(e.target.value); setServerFieldErrors({}); }}
          rows={3}
          maxLength={NOTE_MAX_LENGTH + 50}
          aria-required="true"
          aria-invalid={!!errors.note}
          placeholder="Why is this money moving? e.g. Cash handover after Sunday collections"
        />
        {errors.note ? fieldError("note") : (
          <p className="mt-1 text-xs text-gray-500 dark:text-theme-muted">
            Required (min {NOTE_MIN_LENGTH} characters). Saved permanently with the transaction for audit.
          </p>
        )}
      </div>

      {error && <div className="text-red-600 font-medium p-3 bg-red-50 dark:bg-red-900/20 rounded-md">{error}</div>}

      <button
        type="submit"
        className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        Review transaction
      </button>
    </form>
  );
}

function BalanceHint({ balance }: { balance?: number }) {
  if (balance === undefined || balance === null || isNaN(balance)) return null;
  return (
    <p className="mt-1 text-xs text-gray-500 dark:text-theme-muted">
      Current balance:{" "}
      <span className={balance < 0 ? "text-red-600 font-medium" : "text-gray-700 dark:text-theme-secondary font-medium"}>
        {formatINR(balance)}
      </span>
    </p>
  );
}

function ImpactTable({ impacts }: { impacts: BalanceImpact[] }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-surface-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-surface-elevated text-xs text-gray-500 dark:text-theme-muted">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Partner</th>
            <th className="text-right px-3 py-2 font-medium">Before</th>
            <th className="text-right px-3 py-2 font-medium">Change</th>
            <th className="text-right px-3 py-2 font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {impacts.map((i) => (
            <tr key={i.name} className="border-t border-gray-100 dark:border-surface-border">
              <td className="px-3 py-2 text-gray-900 dark:text-theme-primary">{i.name}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-theme-secondary">{i.before === null ? "—" : formatINR(i.before)}</td>
              <td className={`px-3 py-2 text-right tabular-nums font-medium ${i.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                {i.change >= 0 ? "+" : "−"}{formatINR(Math.abs(i.change))}
              </td>
              <td className={`px-3 py-2 text-right tabular-nums font-semibold ${i.after !== null && i.after < 0 ? "text-red-600" : "text-gray-900 dark:text-theme-primary"}`}>
                {i.after === null ? "—" : formatINR(i.after)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
