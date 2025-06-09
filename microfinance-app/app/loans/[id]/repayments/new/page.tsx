// @ts-nocheck
'use client';

import React, { useState, useEffect, FormEvent, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { loanAPI } from '../../../../../lib/api';
import { usePartner } from '../../../../contexts/PartnerContext';

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
}

interface FormData {
  amount: string;
  paidDate: string;
  paymentType: 'REGULAR' | 'INTEREST_ONLY' | 'PARTIAL';
  scheduleId: string;
  collected_by_id?: string;
  collected_by?: string; // Added to ensure API gets correct collector info
  entered_by_id?: string;
  notes?: string; // Optional notes field for additional information
}

interface PaymentSchedule {
  id: number;
  period: number;
  dueDate: string;
  amount: number;
  status: string;
}

interface FormErrors {
  amount?: string;
  paidDate?: string;
  scheduleId?: string;
  general?: string;
}

export default function NewRepaymentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;
  const { selectedPartner } = usePartner();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingSchedules, setPendingSchedules] = useState<PaymentSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  
  // Default form data with active partner
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

  // Update form data when active partner changes
  useEffect(() => {
    if (selectedPartner?.id) {
      setFormData(prev => ({
        ...prev,
        collected_by_id: selectedPartner.id.toString(),
        entered_by_id: selectedPartner.id.toString(),
        collected_by: selectedPartner.id.toString() // Add this to ensure API gets both fields
      }));
    } else {
      // Clear collector fields if no partner is selected
      setFormData(prev => ({
        ...prev,
        collected_by_id: undefined,
        entered_by_id: undefined,
        collected_by: undefined
      }));
    }
  }, [selectedPartner]);

  // Update form data when partner changes
  useEffect(() => {
    if (selectedPartner?.id) {
      console.log('Partner selected, updating form data:', selectedPartner);
      setFormData(prev => ({
        ...prev,
        collected_by_id: selectedPartner.id.toString(),
        collected_by: selectedPartner.id.toString(),
        entered_by_id: selectedPartner.id.toString()
      }));
    } else {
      // Clear collector fields if no partner is selected
      console.log('No partner selected, clearing form data');
      setFormData(prev => ({
        ...prev,
        collected_by_id: undefined,
        collected_by: undefined,
        entered_by_id: undefined
      }));
    }
  }, [selectedPartner]);

  // Fetch payment schedules
  const fetchPendingSchedules = useCallback(async () => {
    if (!id) return;

    try {
      setLoadingSchedules(true);
      console.log('Fetching payment schedules for loan ID:', id);

      // Use the API client to fetch payment schedules with includeAll=true to show all periods
      const numericId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;
      
      if (!numericId) {
        throw new Error('Invalid loan ID');
      }
      
      const data = await loanAPI.getPaymentSchedules(numericId, true); // Pass true to include all periods
      console.log('Payment schedules data:', data);

      if (Array.isArray(data)) {
        // Sort schedules by period to ensure they appear in chronological order
        const sortedSchedules = [...data].sort((a, b) => a.period - b.period);
        console.log('Sorted schedules:', sortedSchedules);
        setPendingSchedules(sortedSchedules);
      } else if (data.schedules && Array.isArray(data.schedules)) {
        // Handle case where API might return an object with schedules property
        const sortedSchedules = [...data.schedules].sort((a, b) => a.period - b.period);
        console.log('Sorted schedules:', sortedSchedules);
        setPendingSchedules(sortedSchedules);
      } else {
        console.warn('No schedules found in response or schedules is not an array:', data);
        setPendingSchedules([]);
      }
    } catch (error) {
      console.error('Error fetching payment schedules:', error);
    } finally {
      setLoadingSchedules(false);
    }
  }, [id]);

  useEffect(() => {
    const fetchLoanDetails = async () => {
      try {
        setLoading(true);
        console.log(`Fetching loan details for ID: ${id}`);

        // Convert id to number for API call
        const numericId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;
        
        if (!numericId) {
          throw new Error('Invalid loan ID');
        }

        // Use the API client to fetch loan details
        const data = await loanAPI.getById(numericId);
        console.log('Loan details fetched successfully:', data);

        setLoan(data);

        // Prepopulate the payment amount with the loan's installment amount if available
        if (data.installmentAmount) {
          setFormData(prev => ({
            ...prev,
            amount: data.installmentAmount.toString()
          }));
        }

        // Fetch pending payment schedules
        await fetchPendingSchedules();
      } catch (error) {
        console.error('Error fetching loan details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchLoanDetails();
    }
  }, [id, fetchPendingSchedules]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Amount validation
    if (!formData.amount) {
      newErrors.amount = 'Payment amount is required';
    } else if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (loan) {
      const amount = Number(formData.amount);
      if (formData.paymentType === 'REGULAR' && amount > loan.remainingAmount) {
        newErrors.amount = `Amount cannot exceed the remaining balance (${loan.remainingAmount})`;
      } else if (formData.paymentType === 'INTEREST_ONLY' && loan.interestRate && amount !== loan.interestRate) {
        newErrors.amount = `Interest-only payment must be exactly ${loan.interestRate}`;
      }
    }

    // Payment date validation
    if (!formData.paidDate) {
      newErrors.paidDate = 'Payment date is required';
    } else {
      const paidDate = new Date(formData.paidDate);
      if (isNaN(paidDate.getTime())) {
        newErrors.paidDate = 'Please enter a valid date';
      }
    }

    // Schedule validation
    if (!formData.scheduleId) {
      newErrors.scheduleId = 'Please select the payment schedule this repayment is for';
    } else if (isNaN(Number(formData.scheduleId)) || Number(formData.scheduleId) <= 0) {
      newErrors.scheduleId = 'Please select a valid payment schedule';
    } else {
      const schedule = pendingSchedules.find(s => s.period === Number(formData.scheduleId));
      if (!schedule) {
        newErrors.scheduleId = 'Selected payment schedule not found';
      }
    }

    // Collector validation
    if (!selectedPartner || !selectedPartner.id || !formData.collected_by_id) {
      newErrors.collected_by_id = 'Please select who collected the payment using the partner selector at the top of the page';
    } else if (!selectedPartner.isActive) {
      newErrors.collected_by_id = 'Selected partner is not active. Please choose an active partner.';
    } else {
      // Ensure both collector fields have the same value
      if (formData.collected_by_id !== formData.collected_by || 
          formData.collected_by_id !== selectedPartner.id.toString()) {
        newErrors.collected_by_id = 'Partner information mismatch. Please try selecting the partner again.';
      }
    } 

    // Entered by ID validation
    if (!formData.entered_by_id) {
      newErrors.entered_by_id = 'Missing entered by information';
    } else if (formData.entered_by_id !== selectedPartner.id.toString()) {
      // Sync entered_by with selected partner
      setFormData(prev => ({
        ...prev,
        entered_by_id: selectedPartner.id.toString()
      }));
    }

    // Payment type validation
    if (!['REGULAR', 'INTEREST_ONLY', 'PARTIAL'].includes(formData.paymentType)) {
      newErrors.general = 'Invalid payment type';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('Form submission started');

    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      // Re-validate to ensure nothing changed during submission
      if (!validateForm()) {
        console.log('Form validation failed during submission');
        return;
      }

      // Format all data for API submission
      const numericAmount = parseFloat(formData.amount);
      const collectorId = parseInt(formData.collected_by_id);
      const periodNumber = parseInt(formData.scheduleId);
      const enteredById = formData.entered_by_id ? parseInt(formData.entered_by_id) : collectorId;

      // Validate amount
      if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error('Please enter a valid payment amount greater than 0');
      }

      // Validate collector
      if (isNaN(collectorId) || collectorId <= 0) {
        throw new Error('Please select a valid collector');
      }

      // Validate period number
      if (isNaN(periodNumber) || periodNumber <= 0) {
        throw new Error('Please select a valid payment schedule');
      }

      // Validate payment date
      if (!formData.paidDate || isNaN(new Date(formData.paidDate).getTime())) {
        throw new Error('Please select a valid payment date');
      }

      // Validate collector information consistency
      if (formData.collected_by_id !== formData.collected_by) {
        throw new Error('Invalid collector information. Please try again.');
      }

      // Prepare data in the format expected by the API
      const requestData = {
        amount: numericAmount,
        paidDate: formData.paidDate, // Keep as ISO string
        paymentType: formData.paymentType,
        scheduleId: periodNumber, // This maps to the period field in the API
        collected_by: formData.collected_by_id, // Use the selected partner ID
        collected_by_id: collectorId, // Ensure both fields are populated
        entered_by: formData.entered_by_id,
        entered_by_id: enteredById,
        notes: formData.notes?.trim() || undefined // Include notes if provided
      };

      const numericId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;
      
      if (!numericId) {
        throw new Error('Invalid loan ID');
      }

      console.log('Adding repayment for loan ID:', numericId, 'with data:', requestData);
      const responseData = await loanAPI.addRepayment(numericId, requestData);
      console.log('Repayment added successfully:', responseData);

      router.push(`/loans/${id}`);
    } catch (error) {
      console.error('Error recording payment:', error);
      
      // Handle specific API error responses
      if (error instanceof Error) {
        const message = error.message;
        if (message.includes('amount')) {
          setErrors(prev => ({ ...prev, amount: message }));
        } else if (message.includes('date')) {
          setErrors(prev => ({ ...prev, paidDate: message }));
        } else if (message.includes('collector')) {
          setErrors(prev => ({ ...prev, collected_by_id: message }));
        } else {
          setErrors(prev => ({ ...prev, general: message }));
        }
      } else {
        setErrors(prev => ({
          ...prev,
          general: 'An unexpected error occurred while recording the payment. Please try again.'
        }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading loan details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <h2 className="text-xl font-bold mb-2">Loan Not Found</h2>
          <p>The loan you are looking for does not exist or has been removed.</p>
          <Link href="/loans" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Loans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-green-700">Record Payment</h1>
        <Link href={`/loans/${id}`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
          Back to Loan Details
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Loan Information</h2>
          <p className="text-gray-600 mt-2">Borrower: {loan.borrower?.name || 'Unknown'}</p>
          <p className="text-gray-600">Remaining Balance: {new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
          }).format(loan.remainingAmount)}</p>
          <p className="text-gray-600">Installment Amount: {new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
          }).format(loan.installmentAmount || 0)}</p>
          {loan.repaymentType === 'Monthly' && loan.interestRate && (
            <p className="text-gray-600">Interest Amount: {new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0,
            }).format(loan.interestRate)}</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6">
          {errors.general && (
            <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p>{errors.general}</p>
            </div>
          )}

          {/* Interest Only Payment Toggle - Moved to the top */}
          {loan.repaymentType === 'Monthly' && (
            <div className="mb-6">
              <div className="flex items-center justify-between p-5 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                <div>
                  <h3 className="font-semibold text-lg text-blue-900">Interest Only Payment</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Toggle this if the payment is for interest only and should not reduce the principal amount
                  </p>
                </div>
                <div className="flex items-center">
                  <div
                    className={`relative w-14 h-7 rounded-full cursor-pointer transition-colors duration-300 ${
                      formData.paymentType === 'INTEREST_ONLY' ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    onClick={() => {
                      const newPaymentType = formData.paymentType === 'INTEREST_ONLY' ? 'REGULAR' : 'INTEREST_ONLY';

                      // Update payment amount based on payment type
                      let newAmount = formData.amount;
                      if (loan.repaymentType === 'Monthly') {
                        if (newPaymentType === 'INTEREST_ONLY' && loan.interestRate) {
                          // Set to interest amount for interest-only payments
                          newAmount = loan.interestRate.toString();
                        } else if (newPaymentType === 'REGULAR' && loan.installmentAmount) {
                          // Set back to installment amount for regular payments
                          newAmount = loan.installmentAmount.toString();
                        }
                      }

                      setFormData(prev => ({
                        ...prev,
                        paymentType: newPaymentType,
                        amount: newAmount
                      }));
                    }}
                  >
                    <div
                      className={`absolute top-1 left-1 bg-white border border-gray-300 rounded-full h-5 w-5 shadow-md transition-transform duration-300 transform ${
                        formData.paymentType === 'INTEREST_ONLY' ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    ></div>
                  </div>

                  <span className="ml-3 text-sm font-medium text-blue-900">
                    {formData.paymentType === 'INTEREST_ONLY' ? 'ON' : 'OFF'}
                  </span>

                  <input
                    type="checkbox"
                    id="paymentType"
                    name="paymentType"
                    className="sr-only"
                    checked={formData.paymentType === 'INTEREST_ONLY'}
                    onChange={() => {}}
                  />
                </div>
              </div>
              {formData.paymentType === 'INTEREST_ONLY' && (
                <div className="mt-3 p-4 bg-yellow-50 border border-yellow-300 rounded-lg shadow-sm">
                  <p className="text-sm text-yellow-800 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <strong>Note:</strong> This payment will be recorded as interest only and will not reduce the principal loan amount.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                min="1"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.amount ? (
                <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  {formData.paymentType === 'interestOnly' && loan.repaymentType === 'Monthly'
                    ? 'Set to the loan\'s interest amount for interest-only payment'
                    : 'Pre-populated with the loan\'s installment amount'}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="paidDate" className="block text-sm font-medium text-gray-700 mb-1">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="paidDate"
                name="paidDate"
                value={formData.paidDate}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.paidDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.paidDate && (
                <p className="mt-1 text-sm text-red-500">{errors.paidDate}</p>
              )}
            </div>

            {/* Payment Schedule Dropdown */}
            <div className="md:col-span-2">
              <label htmlFor="scheduleId" className="block text-sm font-medium text-gray-700 mb-1">
                Payment Schedule <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="scheduleId"
                  name="scheduleId"
                  value={formData.scheduleId}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.scheduleId ? 'border-red-500' : 'border-gray-300'
                  } appearance-none`}
                >
                  <option value="">-- Select a payment schedule --</option>
                  {pendingSchedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {loan?.repaymentType === 'Weekly' ? `Week ${schedule.period}` : `Month ${schedule.period}`} -
                      Due: {new Date(schedule.dueDate).toLocaleDateString()} -
                      Amount: {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        maximumFractionDigits: 0,
                      }).format(schedule.amount)}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
              {errors.scheduleId ? (
                <p className="mt-1 text-sm text-red-500">{errors.scheduleId}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  {loadingSchedules ? 'Loading schedules...' :
                    pendingSchedules.length > 0 ?
                      'Select a payment schedule to link this payment to a specific due date' :
                      'No pending payment schedules available'}
                </p>
              )}
              {formData.scheduleId && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    This payment will be linked to the selected payment schedule and will update its status.
                  </p>
                </div>
              )}
            </div>
          </div>              {/* Notes Field */}
              <div className="md:col-span-2 mt-4">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes || ''}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent border-gray-300"
                  placeholder="Add any additional notes about this payment (optional)"
                />
              </div>

              <div className="mt-8 flex justify-end">
                <Link href={`/loans/${id}`} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300 mr-4">
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
        </form>
      </div>
    </div>
  );
}
