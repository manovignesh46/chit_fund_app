'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { loanAPI } from '@/lib/api';

// Define interfaces for form data and errors
interface LoanFormData {
  borrowerName: string;
  contact: string;
  loanType: string;
  amount: string;
  interestRate: string;
  documentCharge: string;
  installmentAmount: string;
  duration: string;
  purpose: string;
  disbursementDate: string;
  status: string;
}

interface LoanFormErrors {
  borrowerName?: string;
  contact?: string;
  loanType?: string;
  amount?: string;
  interestRate?: string;
  documentCharge?: string;
  installmentAmount?: string;
  duration?: string;
  purpose?: string;
  disbursementDate?: string;
  status?: string;
}

interface LoanType {
  value: string;
  label: string;
}

interface LoanStatus {
  value: string;
  label: string;
}

export default function EditLoanPage() {
  const params = useParams();
  const id = params.id;
  const router = useRouter();

  // Convert id to number for Prisma
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

  const [formData, setFormData] = useState<LoanFormData>({
    borrowerName: '',
    contact: '',
    loanType: 'Monthly',
    amount: '',
    interestRate: '',
    documentCharge: '0',
    installmentAmount: '0',
    duration: '',
    purpose: '',
    disbursementDate: '',
    status: 'Active',
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errors, setErrors] = useState<LoanFormErrors>({});

  const loanTypes: LoanType[] = [
    { value: 'Monthly', label: 'Monthly' },
    { value: 'Weekly', label: 'Weekly' },
  ];

  const loanStatuses: LoanStatus[] = [
    { value: 'Active', label: 'Active' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Defaulted', label: 'Defaulted' },
  ];

  // Fetch loan data
  useEffect(() => {
    const fetchLoanData = async () => {
      try {
        setLoading(true);
        console.log(`Fetching loan data for ID: ${numericId}`);

        // Use the API client to fetch loan data
        const loanData = await loanAPI.getById(numericId);
        console.log('Loan data fetched successfully:', loanData);

        // Format date to YYYY-MM-DD for input
        const formatDateForInput = (dateString: string) => {
          if (!dateString) return '';
          const date = new Date(dateString);
          return date.toISOString().split('T')[0];
        };

        setFormData({
          borrowerName: loanData.borrower?.name || '',
          contact: loanData.borrower?.contact || '',
          loanType: loanData.loanType || 'Monthly',
          amount: loanData.amount?.toString() || '',
          interestRate: loanData.interestRate?.toString() || '',
          documentCharge: (loanData.documentCharge || 0).toString(),
          installmentAmount: (loanData.installmentAmount || 0).toString(),
          duration: loanData.duration?.toString() || '',
          purpose: loanData.purpose || '',
          disbursementDate: formatDateForInput(loanData.disbursementDate),
          status: loanData.status || 'Active',
        });
      } catch (error) {
        console.error('Error fetching loan data:', error);
        alert('Failed to load loan data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (numericId) {
      fetchLoanData();
    }
  }, [numericId]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const updatedFormData = {
      ...formData,
      [name]: value,
    };

    // Recalculate installment amount when loan type changes
    if (name === 'loanType') {
      // Reset duration to a reasonable default when switching between weekly and monthly
      if (value === 'Weekly') {
        // If switching to weekly, multiply current duration by ~4.3 (weeks in a month)
        const currentDuration = parseInt(updatedFormData.duration) || 0;
        if (currentDuration > 0 && currentDuration <= 60) { // Only convert if it's a reasonable monthly value
          updatedFormData.duration = Math.round(currentDuration * 4.3).toString();
        } else {
          updatedFormData.duration = '4'; // Default to 4 weeks if no valid duration
        }

        // For Weekly loans, set interest rate and document charge to 0
        updatedFormData.interestRate = '0';
        updatedFormData.documentCharge = '0';
      } else {
        // If switching to monthly, divide current duration by ~4.3
        const currentDuration = parseInt(updatedFormData.duration) || 0;
        if (currentDuration > 4 && currentDuration <= 260) { // Only convert if it's a reasonable weekly value
          updatedFormData.duration = Math.round(currentDuration / 4.3).toString();
        } else {
          updatedFormData.duration = '1'; // Default to 1 month if no valid duration
        }
      }
    }

    // Calculate installment amount when amount, interest, duration, or loan type changes
    if (name === 'amount' || name === 'interestRate' || name === 'duration' || name === 'loanType') {
      const amount = parseFloat(updatedFormData.amount) || 0;
      const interestAmount = parseFloat(updatedFormData.interestRate) || 0;
      const duration = parseInt(updatedFormData.duration) || 1;
      let installmentAmount = 0;

      if (updatedFormData.loanType === 'Monthly') {
        // For monthly loans: Principal/Duration + Interest
        // Example: 10000/10 = 1000 + 200 = 1200
        const principalPerMonth = amount / duration;
        installmentAmount = principalPerMonth + interestAmount;
      } else {
        // For weekly loans: Principal/(Duration-1)
        // Example: 5000/(11-1) = 500
        // Ensure we don't divide by zero
        const effectiveDuration = Math.max(1, duration - 1);
        installmentAmount = amount / effectiveDuration;
      }

      // Update the installment amount field
      updatedFormData.installmentAmount = installmentAmount.toFixed(2);
    }

    setFormData(updatedFormData);
  };

  const validateForm = (): boolean => {
    const newErrors: LoanFormErrors = {};

    if (!formData.borrowerName.trim()) {
      newErrors.borrowerName = 'Borrower name is required';
    }

    if (!formData.contact.trim()) {
      newErrors.contact = 'Contact information is required';
    } else if (!/^[0-9+\s-]{10,15}$/.test(formData.contact.trim())) {
      newErrors.contact = 'Please enter a valid phone number';
    }

    if (!formData.amount) {
      newErrors.amount = 'Loan amount is required';
    } else if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    // Only validate interest rate for Monthly loans
    if (formData.loanType === 'Monthly') {
      if (!formData.interestRate) {
        newErrors.interestRate = 'Interest amount is required';
      } else if (isNaN(Number(formData.interestRate)) || Number(formData.interestRate) < 0) {
        newErrors.interestRate = 'Please enter a valid interest amount';
      }
    }

    if (formData.documentCharge && (isNaN(Number(formData.documentCharge)) || Number(formData.documentCharge) < 0)) {
      newErrors.documentCharge = 'Please enter a valid document charge amount';
    }

    if (!formData.duration) {
      newErrors.duration = 'Loan duration is required';
    } else if (isNaN(Number(formData.duration)) || Number(formData.duration) <= 0) {
      newErrors.duration = 'Please enter a valid duration greater than 0';
    } else if (formData.loanType === 'Monthly' && Number(formData.duration) > 60) {
      newErrors.duration = 'Monthly duration cannot exceed 60 months (5 years)';
    } else if (formData.loanType === 'Weekly' && Number(formData.duration) > 260) {
      newErrors.duration = 'Weekly duration cannot exceed 260 weeks (5 years)';
    }

    if (!formData.purpose.trim()) {
      newErrors.purpose = 'Loan purpose is required';
    }

    if (!formData.disbursementDate) {
      newErrors.disbursementDate = 'Disbursement date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare the data for API submission
      const loanData = {
        id: numericId, // Use the numeric ID for Prisma
        borrowerName: formData.borrowerName,
        contact: formData.contact,
        loanType: formData.loanType,
        amount: formData.amount,
        interestRate: formData.interestRate,
        documentCharge: formData.documentCharge,
        installmentAmount: formData.installmentAmount,
        duration: formData.duration,
        purpose: formData.purpose,
        disbursementDate: new Date(formData.disbursementDate).toISOString(),
        status: formData.status,
        repaymentType: formData.loanType, // Set repaymentType to match loanType
      };

      // Make the API call to update the loan using the API client
      console.log('Updating loan with data:', loanData);
      await loanAPI.update(numericId, loanData);

      // Redirect to loan details page after successful update
      router.push(`/loans/${id}`);
    } catch (error) {
      console.error('Error updating loan:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : 'An unknown error occurred';
      alert(`Failed to update loan: ${errorMessage}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading loan data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-green-700">Edit Loan</h1>
        <Link href={`/loans/${id}`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
          Cancel
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="borrowerName" className="block text-sm font-medium text-gray-700 mb-1">
                Borrower Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="borrowerName"
                name="borrowerName"
                value={formData.borrowerName}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.borrowerName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.borrowerName && (
                <p className="mt-1 text-sm text-red-500">{errors.borrowerName}</p>
              )}
            </div>

            <div>
              <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-1">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="contact"
                name="contact"
                value={formData.contact}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.contact ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.contact && (
                <p className="mt-1 text-sm text-red-500">{errors.contact}</p>
              )}
            </div>

            <div>
              <label htmlFor="loanType" className="block text-sm font-medium text-gray-700 mb-1">
                Loan Type <span className="text-red-500">*</span>
              </label>
              <select
                id="loanType"
                name="loanType"
                value={formData.loanType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {loanTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Loan Status <span className="text-red-500">*</span>
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {loanStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Loan Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                min="1000"
                step="1000"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
              )}
            </div>

            {formData.loanType === 'Monthly' && (
              <div>
                <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700 mb-1">
                  Interest Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="interestRate"
                  name="interestRate"
                  value={formData.interestRate}
                  onChange={handleChange}
                  min="0"
                  step="100"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.interestRate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.interestRate && (
                  <p className="mt-1 text-sm text-red-500">{errors.interestRate}</p>
                )}
              </div>
            )}

            {formData.loanType === 'Monthly' && (
              <div>
                <label htmlFor="documentCharge" className="block text-sm font-medium text-gray-700 mb-1">
                  Document Charge (₹)
                </label>
                <input
                  type="number"
                  id="documentCharge"
                  name="documentCharge"
                  value={formData.documentCharge}
                  onChange={handleChange}
                  min="0"
                  step="100"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.documentCharge ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.documentCharge && (
                  <p className="mt-1 text-sm text-red-500">{errors.documentCharge}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                Duration ({formData.loanType === 'Weekly' ? 'weeks' : 'months'}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                min="1"
                max={formData.loanType === 'Weekly' ? '260' : '60'} // 5 years in weeks or months
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.duration ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.duration && (
                <p className="mt-1 text-sm text-red-500">{errors.duration}</p>
              )}
            </div>

            <div>
              <label htmlFor="installmentAmount" className="block text-sm font-medium text-gray-700 mb-1">
                Installment Amount (₹)
              </label>
              <input
                type="number"
                id="installmentAmount"
                name="installmentAmount"
                value={formData.installmentAmount}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Auto-calculated but can be manually adjusted if needed</p>
            </div>

            <div>
              <label htmlFor="disbursementDate" className="block text-sm font-medium text-gray-700 mb-1">
                Disbursement Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="disbursementDate"
                name="disbursementDate"
                value={formData.disbursementDate}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.disbursementDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.disbursementDate && (
                <p className="mt-1 text-sm text-red-500">{errors.disbursementDate}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
                Loan Purpose <span className="text-red-500">*</span>
              </label>
              <textarea
                id="purpose"
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                rows={3}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.purpose ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.purpose && (
                <p className="mt-1 text-sm text-red-500">{errors.purpose}</p>
              )}
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Link href={`/loans/${id}`} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300 mr-4">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Updating...' : 'Update Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}