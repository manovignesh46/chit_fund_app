'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Loan {
  id: number;
  borrowerId: number;
  borrower: {
    name: string;
  };
  amount: number;
  remainingAmount: number;
  loanType: string;
}

interface FormData {
  amount: string;
  paidDate: string;
  paymentType: 'full' | 'interestOnly';
}

interface FormErrors {
  amount?: string;
  paidDate?: string;
  paymentType?: string;
  general?: string;
}

export default function NewRepaymentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    amount: '',
    paidDate: new Date().toISOString().split('T')[0], // Default to today's date
    paymentType: 'full', // Default to full payment (principal + interest)
  });
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    const fetchLoanDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/loans/${id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch loan details');
        }

        const data = await response.json();
        setLoan(data);
      } catch (error) {
        console.error('Error fetching loan details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchLoanDetails();
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    } else if (loan && Number(formData.amount) > loan.remainingAmount) {
      newErrors.amount = `Amount cannot exceed the remaining balance (${loan.remainingAmount})`;
    }

    if (!formData.paidDate) {
      newErrors.paidDate = 'Payment date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/loans/${id}/repayments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: formData.amount,
          paidDate: formData.paidDate,
          paymentType: formData.paymentType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record payment');
      }

      // Redirect back to the loan details page
      router.push(`/loans/${id}`);
    } catch (error) {
      console.error('Error recording payment:', error);
      setErrors(prev => ({
        ...prev,
        general: error instanceof Error ? error.message : 'An unknown error occurred'
      }));
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
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6">
          {errors.general && (
            <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p>{errors.general}</p>
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
              {errors.amount && (
                <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
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

            <div className="md:col-span-2 mt-4">
              <div className="flex items-center justify-between p-5 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                <div>
                  <h3 className="font-semibold text-lg text-blue-900">Interest Only Payment</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Toggle this if the payment is for interest only and should not reduce the principal amount
                  </p>
                </div>
                <div className="flex items-center">
                  {/* Custom toggle switch */}
                  <div
                    className={`relative w-14 h-7 rounded-full cursor-pointer transition-colors duration-300 ${
                      formData.paymentType === 'interestOnly' ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        paymentType: prev.paymentType === 'interestOnly' ? 'full' : 'interestOnly'
                      }));
                    }}
                  >
                    <div
                      className={`absolute top-1 left-1 bg-white border border-gray-300 rounded-full h-5 w-5 shadow-md transition-transform duration-300 transform ${
                        formData.paymentType === 'interestOnly' ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    ></div>
                  </div>

                  {/* Text label */}
                  <span className="ml-3 text-sm font-medium text-blue-900">
                    {formData.paymentType === 'interestOnly' ? 'ON' : 'OFF'}
                  </span>

                  {/* Hidden input for form submission */}
                  <input
                    type="checkbox"
                    id="paymentType"
                    name="paymentType"
                    className="sr-only"
                    checked={formData.paymentType === 'interestOnly'}
                    onChange={() => {}}
                  />
                </div>
              </div>
              {formData.paymentType === 'interestOnly' && (
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
