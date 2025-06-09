"use client";
import { useState, useEffect } from "react";
import { usePartner, type Partner } from "../contexts/PartnerContext";

const PARTNERS: Partner[] = ["Me", "My Friend"];
const TRANSACTION_TYPES = [
  { value: "collection", label: "Collection from Member", icon: "💰", description: "Money collected from a member" },
  { value: "transfer", label: "Partner Transfer", icon: "🔄", description: "Transfer between partners" },
  { value: "loan_given", label: "Loan Given", icon: "📤", description: "Loan amount given to a member" },
  { value: "loan_repaid", label: "Loan Repayment", icon: "📥", description: "Loan repayment received from a member" },
];

interface TransactionFormProps {
  onSuccess?: () => void;
}

interface FormData {
  type: string;
  amount: string;
  member: string;
  fromPartner: string;
  toPartner: string;
  actionPerformer: string;
  date: string;
  note: string;
}

interface FormErrors {
  amount?: string;
  member?: string;
  general?: string;
}

export default function EnhancedTransactionForm({ onSuccess }: TransactionFormProps) {
  const { activePartner, otherPartner } = usePartner();
  
  const [formData, setFormData] = useState<FormData>({
    type: "collection",
    amount: "",
    member: "",
    fromPartner: "",
    toPartner: "",
    actionPerformer: activePartner,
    date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  // Update action performer when active partner changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      actionPerformer: activePartner
    }));
  }, [activePartner]);

  // Set partner defaults based on type
  function setDefaults(type: string) {
    let defaults: Partial<FormData> = {
      type,
      fromPartner: "",
      toPartner: "",
      actionPerformer: activePartner,
    };

    switch (type) {
      case 'collection':
        defaults.fromPartner = "";
        defaults.toPartner = activePartner;
        break;
      case 'transfer':
        defaults.fromPartner = activePartner;
        defaults.toPartner = otherPartner;
        break;
      case 'loan_given':
        defaults.fromPartner = activePartner;
        defaults.toPartner = "";
        break;
      case 'loan_repaid':
        defaults.fromPartner = "";
        defaults.toPartner = activePartner;
        break;
    }

    setFormData(prev => ({ ...prev, ...defaults }));
    setErrors({});
    setSuccess("");
  }

  function validateForm(): boolean {
    const newErrors: FormErrors = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    if ((formData.type === "collection" || formData.type === "loan_given" || formData.type === "loan_repaid") && !formData.member.trim()) {
      newErrors.member = "Member name is required for this transaction type";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccess("");

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-active-partner": activePartner,
        },
        body: JSON.stringify({
          type: formData.type,
          amount: parseFloat(formData.amount),
          member: formData.member || null,
          from_partner: formData.fromPartner || null,
          to_partner: formData.toPartner || null,
          action_performer: formData.actionPerformer,
          entered_by: activePartner,
          date: formData.date,
          note: formData.note,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to record transaction");
      }

      setSuccess("Transaction recorded successfully!");
      
      // Reset form
      setFormData({
        type: "collection",
        amount: "",
        member: "",
        fromPartner: "",
        toPartner: "",
        actionPerformer: activePartner,
        date: new Date().toISOString().slice(0, 10),
        note: "",
      });
      
      // Set defaults for the current type
      setDefaults(formData.type);
      
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  }

  function updateFormData(field: keyof FormData, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear related errors
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }

  const selectedType = TRANSACTION_TYPES.find(t => t.value === formData.type);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Record New Transaction</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transaction Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transaction Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TRANSACTION_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setDefaults(type.value)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  formData.type === type.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{type.icon}</span>
                  <div>
                    <div className="font-medium">{type.label}</div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => updateFormData('amount', e.target.value)}
              className={`w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.amount ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>
          {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
        </div>

        {/* Member Name (conditional) */}
        {(formData.type === "collection" || formData.type === "loan_given" || formData.type === "loan_repaid") && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Member Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.member}
              onChange={(e) => updateFormData('member', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.member ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter member name"
              required
            />
            {errors.member && <p className="text-red-500 text-sm mt-1">{errors.member}</p>}
          </div>
        )}

        {/* Partner Override Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Partner Details (Optional Override)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(formData.type === "transfer" || formData.type === "loan_given") && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From Partner</label>
                <select
                  value={formData.fromPartner}
                  onChange={(e) => updateFormData('fromPartner', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">(default: {activePartner})</option>
                  {PARTNERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}
            
            {(formData.type === "transfer" || formData.type === "collection" || formData.type === "loan_repaid") && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To Partner</label>
                <select
                  value={formData.toPartner}
                  onChange={(e) => updateFormData('toPartner', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">(default: {formData.type === "transfer" ? otherPartner : activePartner})</option>
                  {PARTNERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Action Performer</label>
              <select
                value={formData.actionPerformer}
                onChange={(e) => updateFormData('actionPerformer', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PARTNERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => updateFormData('date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note (Optional)
          </label>
          <textarea
            value={formData.note}
            onChange={(e) => updateFormData('note', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="Add any additional details..."
          />
        </div>

        {/* Error and Success Messages */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-600 text-sm">{errors.general}</p>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Recording...
            </span>
          ) : (
            `Record ${selectedType?.label}`
          )}
        </button>
      </form>
    </div>
  );
}
