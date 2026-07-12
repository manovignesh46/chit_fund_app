// @ts-nocheck
'use client';

import React, { useState, useEffect, FormEvent, useCallback } from 'react';
import { loanAPI } from '../../../lib/api';
import { usePartner } from '../../contexts/PartnerContext';
import { formatDate } from '../../../lib/formatUtils';

interface Loan {
  id: number;
  borrowerId: number;
  borrower: {
    name: string;
  };
  amount: number;
  remainingAmount: number;
  loanType: string;
  installmentAmount?: number;
  interestRate?: number;
  repaymentType?: string;
  interestPercentage?: number;
}

interface PaymentSchedule {
  id: number;
  period: number;
  dueDate: string;
  amount: number;
  interestAmount?: number;
  status: string;
}

interface FormData {
  amount: string;
  paidDate: string;
  paymentType: 'REGULAR' | 'INTEREST_ONLY' | 'PARTIAL';
  scheduleId: string;
  collected_by_id?: string;
  collected_by?: string;
  entered_by_id?: string;
  notes?: string;
}

interface FormErrors {
  amount?: string;
  paidDate?: string;
  scheduleId?: string;
  general?: string;
  collected_by_id?: string;
  entered_by_id?: string;
}

interface RepaymentFormProps {
  loanId: number;
  onSuccess: () => void;
  onCancel?: () => void;
  initialLoan?: Loan | null;
}

export default function RepaymentForm({ loanId, onSuccess, onCancel, initialLoan }: RepaymentFormProps) {
  const { selectedPartner } = usePartner();

  const [loan, setLoan] = useState<Loan | null>(initialLoan || null);
  const [loading, setLoading] = useState(!initialLoan);
  const [submitting, setSubmitting] = useState(false);
  const [pendingSchedules, setPendingSchedules] = useState<PaymentSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  
  const [formData, setFormData] = useState<FormData>(() => ({
    amount: '',
    paidDate: new Date().toISOString().split('T')[0],
    paymentType: 'REGULAR',
    scheduleId: '',
    collected_by_id: selectedPartner?.id?.toString() || undefined,
    collected_by: selectedPartner?.id?.toString() || undefined,
    entered_by_id: selectedPartner?.id?.toString() || undefined,
    notes: ''
  }));
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch payment schedules
  const fetchPendingSchedules = useCallback(async () => {
    if (!loanId) return;

    try {
      setLoadingSchedules(true);
      const data = await loanAPI.getPaymentSchedules(loanId, true);

      if (Array.isArray(data)) {
        const sortedSchedules = [...data].sort((a, b) => a.period - b.period);
        setPendingSchedules(sortedSchedules);
        
        // Find the next unpaid schedule and pre-select it
        const sortedByDueDate = [...sortedSchedules]
          .filter(s => s.status !== 'PAID' && s.status !== 'COMPLETED' && s.status !== 'Interest Only' && s.status !== 'Paid')
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        
        if (sortedByDueDate.length > 0) {
          const nextDue = sortedByDueDate[0];
          setFormData(prev => ({
            ...prev,
            scheduleId: nextDue.id.toString()
          }));
        }
      } else if (data.schedules && Array.isArray(data.schedules)) {
        const sortedSchedules = [...data.schedules].sort((a, b) => a.period - b.period);
        setPendingSchedules(sortedSchedules);
        
        const sortedByDueDate = [...sortedSchedules]
          .filter(s => s.status !== 'PAID' && s.status !== 'COMPLETED' && s.status !== 'Interest Only' && s.status !== 'Paid')
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        
        if (sortedByDueDate.length > 0) {
          const nextDue = sortedByDueDate[0];
          setFormData(prev => ({
            ...prev,
            scheduleId: nextDue.id.toString()
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching payment schedules:', error);
    } finally {
      setLoadingSchedules(false);
    }
  }, [loanId]);

  useEffect(() => {
    const fetchLoanDetails = async () => {
      if (initialLoan) return;
      try {
        setLoading(true);
        const data = await loanAPI.getById(loanId);
        setLoan(data);
      } catch (error) {
        console.error('Error fetching loan details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLoanDetails();
    fetchPendingSchedules();
  }, [loanId, initialLoan, fetchPendingSchedules]);

  // Prefill the payment amount based on the selected schedule, the Interest
  // Only toggle, and the loan type (Reducing Balance always defaults to interest-only).
  useEffect(() => {
    if (!formData.scheduleId || pendingSchedules.length === 0) return;

    const schedule = pendingSchedules.find(s => s.id.toString() === formData.scheduleId);
    if (!schedule) return;

    const useInterestOnly = loan?.loanType === 'Reducing Balance' || formData.paymentType === 'INTEREST_ONLY';
    const newAmount = useInterestOnly ? schedule.interestAmount : schedule.amount;

    setFormData(prev => ({
      ...prev,
      amount: newAmount != null ? newAmount.toString() : prev.amount
    }));
  }, [formData.scheduleId, formData.paymentType, loan?.loanType, pendingSchedules]);

  // Update collector info when partner changes
  useEffect(() => {
    if (selectedPartner?.id) {
      setFormData(prev => ({
        ...prev,
        collected_by_id: selectedPartner.id.toString(),
        collected_by: selectedPartner.id.toString(),
        entered_by_id: selectedPartner.id.toString()
      }));
    }
  }, [selectedPartner]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.amount) {
      newErrors.amount = 'Payment amount is required';
    } else if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    if (!formData.paidDate) {
      newErrors.paidDate = 'Payment date is required';
    }

    if (!formData.scheduleId) {
      newErrors.scheduleId = 'Please select a payment schedule';
    }

    if (!selectedPartner || !selectedPartner.id) {
      newErrors.general = 'Please select a partner from the top dropdown first';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const requestData = {
        amount: parseFloat(formData.amount),
        paidDate: formData.paidDate,
        paymentType: formData.paymentType,
        scheduleId: parseInt(formData.scheduleId),
        collected_by_id: parseInt(selectedPartner.id),
        collected_by: selectedPartner.id.toString(),
        entered_by_id: selectedPartner.id,
        notes: formData.notes?.trim() || undefined
      };

      await loanAPI.addRepayment(loanId, requestData);
      onSuccess();
      
      // Reset form (except collector); amount gets re-derived once the next
      // schedule is auto-selected by fetchPendingSchedules below.
      setFormData(prev => ({
        ...prev,
        amount: '',
        notes: '',
        scheduleId: ''
      }));
      fetchPendingSchedules();
      
    } catch (error) {
      console.error('Error recording payment:', error);
      setErrors({ general: error instanceof Error ? error.message : 'Failed to record payment' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Loading form...</div>;

  return (
    <div className="themed-card overflow-hidden">
      <div className="p-6 border-b bg-gray-50 dark:bg-surface-elevated">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-theme-heading">Record Payment</h2>
      </div>
      <form onSubmit={handleSubmit} className="p-6">
        {errors.general && (
          <div className="mb-6 alert-error px-4 py-3 rounded">
            <p>{errors.general}</p>
          </div>
        )}

        {/* Interest Only Toggle */}
        {(loan?.loanType === 'Monthly' || loan?.loanType === 'Reducing Balance') && (
          <div className="mb-6">
            <div className="flex items-center justify-between p-4 form-panel rounded-lg">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-theme-heading">Interest Only Payment</h3>
                <p className="text-xs text-gray-500 dark:text-theme-muted">No principal reduction</p>
              </div>
              <div className="flex items-center">
                <div
                  className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors duration-300 ${
                    formData.paymentType === 'INTEREST_ONLY' ? 'bg-blue-600' : 'bg-surface-border'
                  }`}
                  onClick={() => {
                    const newType = formData.paymentType === 'INTEREST_ONLY' ? 'REGULAR' : 'INTEREST_ONLY';
                    setFormData(prev => ({ ...prev, paymentType: newType }));
                  }}
                >
                  <div className={`absolute top-0.5 left-0.5 bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-full h-5 w-5 shadow transition-transform duration-300 transform ${
                    formData.paymentType === 'INTEREST_ONLY' ? 'translate-x-6' : 'translate-x-0'
                  }`}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Amount (₹)*</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              className={`themed-input w-full ${errors.amount ? 'border-red-500' : ''}`}
            />
            {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Date*</label>
            <input
              type="date"
              name="paidDate"
              value={formData.paidDate}
              onChange={handleChange}
              className={`themed-input w-full ${errors.paidDate ? 'border-red-500' : ''}`}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Payment Schedule*</label>
            <select
              name="scheduleId"
              value={formData.scheduleId}
              onChange={handleChange}
              className={`themed-input w-full ${errors.scheduleId ? 'border-red-500' : ''}`}
            >
              <option value="">-- Select Schedule --</option>
              {pendingSchedules
                .filter(s => s.status !== 'PAID' && s.status !== 'COMPLETED' && s.status !== 'Interest Only' && s.status !== 'Paid')
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {loan?.repaymentType === 'Weekly' ? `Week ${s.period}` : `Month ${s.period}`} - Due: {formatDate(s.dueDate)} 
                    {loan?.loanType === 'Reducing Balance' 
                      ? ` (Interest: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(s.interestAmount)})`
                      : ` - ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(s.amount)}`
                    }
                  </option>
                ))}
            </select>
            {errors.scheduleId && <p className="mt-1 text-xs text-red-500">{errors.scheduleId}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="themed-input w-full"
              placeholder="Add any additional notes..."
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
