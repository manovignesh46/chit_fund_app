'use client';

import React, { useState } from 'react';
import { apiPost } from '../../lib/apiUtils';
import { formatCurrency, formatDate } from '../../lib/formatUtils';

interface PendingContribution {
  id: number;
  month: number;
  amount: number;
  balance: number;
  paidDate: string;
}

interface PayContributionBalanceModalProps {
  chitFundId: number | string;
  contribution: PendingContribution;
  memberName: string;
  onClose: () => void;
  /** Called with the updated contribution returned by the server. */
  onPaid: (updated: any) => void;
}

const inputClass =
  'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/** Records a later payment (full or part) toward a contribution's pending balance. */
export default function PayContributionBalanceModal({
  chitFundId,
  contribution,
  memberName,
  onClose,
  onPaid,
}: PayContributionBalanceModalProps) {
  const [amount, setAmount] = useState(String(contribution.balance));
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState(null as string | null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const originalPaidDay = new Date(contribution.paidDate).toISOString().split('T')[0];
  const enteredAmount = Number(amount);
  const remaining = Math.round((contribution.balance - enteredAmount) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!amount || isNaN(enteredAmount) || enteredAmount <= 0) {
      setError('Amount must be a positive number');
      return;
    }
    if (enteredAmount > contribution.balance) {
      setError(`Amount cannot be more than the pending balance of ${formatCurrency(contribution.balance)}`);
      return;
    }
    if (!paidDate) {
      setError('Paid date is required');
      return;
    }
    if (paidDate < originalPaidDay) {
      setError('Paid date cannot be before the original payment date');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await apiPost(
        `/api/chit-funds/consolidated?action=pay-contribution-balance&id=${chitFundId}`,
        { contributionId: contribution.id, amount: enteredAmount, paidDate },
        'Failed to record balance payment'
      );
      onPaid(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to record balance payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-balance-title"
    >
      <div className="themed-card p-6 w-full max-w-md">
        <h2 id="pay-balance-title" className="section-heading mb-4">
          Pay Balance
        </h2>

        <div className="bg-gray-50 dark:bg-surface-elevated p-4 rounded-lg mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Member</p>
              <p className="text-md font-semibold">{memberName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Month</p>
              <p className="text-md font-semibold">Month {contribution.month}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Already Paid</p>
              <p className="text-md font-semibold">
                {formatCurrency(contribution.amount)}
                <span className="block text-xs font-normal text-gray-500">
                  on {formatDate(contribution.paidDate)}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Balance</p>
              <p className="text-md font-semibold text-red-600">{formatCurrency(contribution.balance)}</p>
            </div>
          </div>
        </div>

        {/* noValidate: show the inline messages below instead of the browser's own bubbles */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="balanceAmount"
              className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1"
            >
              Amount Received <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center">
              <input
                type="number"
                id="balanceAmount"
                name="balanceAmount"
                value={amount}
                min="0"
                max={contribution.balance}
                step="0.01"
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputClass} border-gray-200 dark:border-surface-border`}
              />
              <button
                type="button"
                onClick={() => setAmount(String(contribution.balance))}
                className="btn-neutral ml-2 px-3 py-2 rounded-lg transition duration-300 whitespace-nowrap"
              >
                Full Balance
              </button>
            </div>
            {enteredAmount > 0 && remaining > 0 && (
              <p className="mt-1 text-sm text-orange-500">
                This is a part payment. {formatCurrency(remaining)} will stay pending.
              </p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="balancePaidDate"
              className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1"
            >
              Paid Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="balancePaidDate"
              name="balancePaidDate"
              value={paidDate}
              min={originalPaidDay}
              onChange={(e) => setPaidDate(e.target.value)}
              className={`${inputClass} border-gray-200 dark:border-surface-border`}
            />
          </div>

          {error && (
            <div className="mb-4 alert-error px-4 py-3 rounded" role="alert">
              <p>{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-neutral px-4 py-2 rounded-lg transition duration-300"
            >
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary disabled:opacity-50">
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
