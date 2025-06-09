"use client";
import { useState } from "react";
import { usePartner, type Partner } from "../contexts/PartnerContext";

const PARTNERS: Partner[] = ["Me", "My Friend"];
const TRANSACTION_TYPES = [
  { value: "collection", label: "Collection from Member" },
  { value: "transfer", label: "Partner-to-Partner Transfer" },
  { value: "loan_given", label: "Loan Given to Member" },
  { value: "loan_repaid", label: "Loan Repayment from Member" },
];

interface TransactionFormProps {
  onSuccess?: () => void;
}

export default function TransactionForm({ onSuccess }: TransactionFormProps) {
  const { activePartner, otherPartner } = usePartner();
  const [type, setType] = useState("collection");
  const [amount, setAmount] = useState("");
  const [member, setMember] = useState("");
  const [fromPartner, setFromPartner] = useState("");
  const [toPartner, setToPartner] = useState("");
  const [actionPerformer, setActionPerformer] = useState(activePartner);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Set partner defaults based on type
  function setDefaults(t: string) {
    setType(t);
    setError("");
    setSuccess("");
    setFromPartner("");
    setToPartner("");
    setActionPerformer(activePartner);
    if (t === "collection") {
      setFromPartner("");
      setToPartner(activePartner);
    } else if (t === "transfer") {
      setFromPartner(activePartner);
      setToPartner(otherPartner);
    } else if (t === "loan_given") {
      setFromPartner(activePartner);
      setToPartner("");
    } else if (t === "loan_repaid") {
      setFromPartner("");
      setToPartner(activePartner);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-active-partner": activePartner,
        },
        body: JSON.stringify({
          type,
          amount: parseFloat(amount),
          member: member || null,
          from_partner: fromPartner || null,
          to_partner: toPartner || null,
          action_performer: actionPerformer,
          entered_by: activePartner,
          date,
          note,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record transaction");
      }
      setSuccess("Transaction recorded!");
      setAmount("");
      setMember("");
      setNote("");
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="max-w-xl mx-auto p-4 bg-white rounded shadow space-y-4" onSubmit={handleSubmit}>
      <h2 className="text-xl font-bold mb-2">Record Transaction</h2>
      <div>
        <label className="block font-medium">Transaction Type</label>
        <select
          className="w-full border rounded p-2 mt-1"
          value={type}
          onChange={(e) => setDefaults(e.target.value)}
        >
          {TRANSACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block font-medium">Amount</label>
        <input
          type="number"
          className="w-full border rounded p-2 mt-1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="1"
        />
      </div>
      {(type === "collection" || type === "loan_given" || type === "loan_repaid") && (
        <div>
          <label className="block font-medium">Member Name/ID</label>
          <input
            type="text"
            className="w-full border rounded p-2 mt-1"
            value={member}
            onChange={(e) => setMember(e.target.value)}
            required={type !== "transfer"}
          />
        </div>
      )}
      {/* Partner role overrides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {(type === "transfer" || type === "loan_given") && (
          <div>
            <label className="block font-medium">From Partner</label>
            <select
              className="w-full border rounded p-2 mt-1"
              value={fromPartner}
              onChange={(e) => setFromPartner(e.target.value)}
            >
              <option value="">(default)</option>
              {PARTNERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}
        {(type === "transfer" || type === "collection" || type === "loan_repaid") && (
          <div>
            <label className="block font-medium">To Partner</label>
            <select
              className="w-full border rounded p-2 mt-1"
              value={toPartner}
              onChange={(e) => setToPartner(e.target.value)}
            >
              <option value="">(default)</option>
              {PARTNERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block font-medium">Action Performer</label>
          <select
            className="w-full border rounded p-2 mt-1"
            value={actionPerformer}
            onChange={(e) => setActionPerformer(e.target.value)}
          >
            {PARTNERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block font-medium">Date</label>
        <input
          type="date"
          className="w-full border rounded p-2 mt-1"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block font-medium">Note</label>
        <textarea
          className="w-full border rounded p-2 mt-1"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </div>
      {error && <div className="text-red-600 font-medium">{error}</div>}
      {success && <div className="text-green-600 font-medium">{success}</div>}
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Saving..." : "Record Transaction"}
      </button>
    </form>
  );
}
