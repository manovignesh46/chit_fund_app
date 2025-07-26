"use client";
import { useState, useEffect } from "react";
import { usePartner } from "../contexts/PartnerContext";
import { TRANSACTION_TYPES_CONFIG } from "../../config/config"; // Importing transaction types from config

// Updated transaction types to include the user-friendly "Record Amount"
const TRANSACTION_TYPES = [
  { value: TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER, label: "Partner-to-Partner Transfer" },
  { value: TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT, label: "Record Amount (Credit/Debit)" },
];

interface TransactionFormProps {
  onSuccess?: () => void;
}

export default function TransactionForm({ onSuccess }: TransactionFormProps) {
  const { selectedPartner, partners } = usePartner();

  const [type, setType] = useState(TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER);
  const [amount, setAmount] = useState("");
  const [fromPartnerId, setFromPartnerId] = useState(selectedPartner?.id?.toString() || "");
  const [toPartnerId, setToPartnerId] = useState("");
  
  // New state to manage the Credit/Debit radio buttons for "Record Amount"
  const [adjustmentType, setAdjustmentType] = useState("credit");

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Function to handle From Partner selection and auto-select To Partner
  function handleFromPartnerChange(newFromPartnerId: string) {
    setFromPartnerId(newFromPartnerId);
    
    // Auto-select a different partner for "To Partner" to prevent self-transfers
    if (newFromPartnerId) {
      const availableToPartners = partners.filter(p => p.id.toString() !== newFromPartnerId);
      if (availableToPartners.length > 0) {
        // If current toPartnerId is the same as newFromPartnerId, select a different one
        if (toPartnerId === newFromPartnerId) {
          setToPartnerId(availableToPartners[0].id.toString());
        }
        // If toPartnerId is empty or not set, select the first available partner
        else if (!toPartnerId) {
          setToPartnerId(availableToPartners[0].id.toString());
        }
        // If toPartnerId is already different, keep it as is
      } else {
        // No other partners available, clear toPartnerId
        setToPartnerId("");
      }
    } else {
      // If no fromPartnerId selected, clear toPartnerId
      setToPartnerId("");
    }
  }

  useEffect(() => {
    handleTypeChange(type);
  }, [selectedPartner]);

  function handleTypeChange(newType: string) {
    setType(newType);
    setError("");
    setSuccess("");

    if (newType === TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER) {
      const selectedPartnerId = selectedPartner?.id?.toString() || "";
      setFromPartnerId(selectedPartnerId);
      
      // Auto-select a different partner for "To Partner"
      if (selectedPartnerId) {
        const availableToPartners = partners.filter(p => p.id.toString() !== selectedPartnerId);
        setToPartnerId(availableToPartners.length > 0 ? availableToPartners[0].id.toString() : "");
      } else {
        setToPartnerId("");
      }
    } else if (newType === TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT) {
      // Default to crediting the active partner
      setAdjustmentType("credit");
      setFromPartnerId("");
      setToPartnerId(selectedPartner?.id?.toString() || "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (type === "PARTNER_TO_PARTNER" && (!fromPartnerId || !toPartnerId)) {
      setError("Both 'From' and 'To' partners are required for a PARTNER_TO_PARTNER.");
      setLoading(false);
      return;
    }

    const body: { [key: string]: any } = {
      amount: parseFloat(amount),
      date,
      note,
    };

    // Set the correct type and partner IDs based on the form state
    if (type === TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT) {
      body.type = TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT;

      if (adjustmentType === 'credit') {
        body.to_partner_id = selectedPartner?.id;
        body.from_partner_id = null;
      } else { // debit
        body.from_partner_id = selectedPartner?.id;
        body.to_partner_id = null;
      }
    } else if (type === TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER) { // PARTNER_TO_PARTNER
      body.type = TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER;
      body.from_partner_id = fromPartnerId;
      body.to_partner_id = toPartnerId;
    }

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-active-partner": selectedPartner?.name || "",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record transaction");
      }
      setSuccess("Transaction recorded successfully!");
      setAmount("");
      setNote("");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="max-w-xl mx-auto p-6 bg-white rounded-lg shadow-md space-y-4" onSubmit={handleSubmit}>
      <h2 className="text-xl font-bold mb-4 text-gray-800">Record Manual Transaction</h2>

      <div>
        <label className="block font-medium text-gray-700">Transaction Type</label>
        <select
          className="w-full border-gray-300 rounded-md p-2 mt-1 shadow-sm"
          value={type}
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          {TRANSACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-medium text-gray-700">Amount</label>
        <input
          type="number"
          className="w-full border-gray-300 rounded-md p-2 mt-1 shadow-sm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="0.01"
          step="0.01"
          placeholder="e.g., 5000"
        />
      </div>

      {type === TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-gray-700">From Partner</label>
            <select
              className="w-full border-gray-300 rounded-md p-2 mt-1 shadow-sm"
              value={fromPartnerId}
              onChange={(e) => handleFromPartnerChange(e.target.value)}
              required
            >
              <option value="">Select Partner</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-gray-700">To Partner</label>
            <select
              className="w-full border-gray-300 rounded-md p-2 mt-1 shadow-sm"
              value={toPartnerId}
              onChange={(e) => setToPartnerId(e.target.value)}
              required
            >
              <option value="">Select Partner</option>
              {partners
                .filter(p => p.id.toString() !== fromPartnerId) // Exclude the selected "From Partner"
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>
        </div>
      )}

      {/* --- Restored Radio Button UI for Record Amount --- */}
      {type === TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT && (
        <div>
            <label className="block font-medium text-gray-700">Adjustment Type for <span className="font-bold">{selectedPartner?.name}</span></label>
             <div className="flex gap-6 mt-2 p-3 border border-gray-200 rounded-md">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="adjustmentType"
                  value="credit"
                  checked={adjustmentType === 'credit'}
                  onChange={() => setAdjustmentType('credit')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-gray-700">Credit (Add cash)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="adjustmentType"
                  value="debit"
                  checked={adjustmentType === 'debit'}
                  onChange={() => setAdjustmentType('debit')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-gray-700">Debit (Remove cash)</span>
              </label>
            </div>
        </div>
      )}

      <div>
        <label className="block font-medium text-gray-700">Date</label>
        <input
          type="date"
          className="w-full border-gray-300 rounded-md p-2 mt-1 shadow-sm"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block font-medium text-gray-700">Note</label>
        <textarea
          className="w-full border-gray-300 rounded-md p-2 mt-1 shadow-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional: reason for transaction"
        />
      </div>

      {error && <div className="text-red-600 font-medium p-3 bg-red-50 rounded-md">{error}</div>}
      {success && <div className="text-green-600 font-medium p-3 bg-green-50 rounded-md">{success}</div>}

      <button
        type="submit"
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        disabled={loading || !amount}
      >
        {loading ? "Saving..." : "Record Transaction"}
      </button>
    </form>
  );
}