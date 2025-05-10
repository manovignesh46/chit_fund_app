'use client';

import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Define interfaces for form data and errors
interface LoanFormData {
  borrowerName: string;
  contact: string;
  loanType: string;
  amount: string;
  interestRate: string;
  duration: string;
  purpose: string;
}

interface LoanFormErrors {
  borrowerName?: string;
  contact?: string;
  loanType?: string;
  amount?: string;
  interestRate?: string;
  duration?: string;
  purpose?: string;
}

interface LoanType {
  value: string;
  label: string;
}

export default function NewLoanPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoanFormData>({
    borrowerName: '',
    contact: '',
    loanType: 'Personal',
    amount: '',
    interestRate: '',
    duration: '',
    purpose: '',
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<LoanFormErrors>({});

  const loanTypes: LoanType[] = [
    { value: 'Personal', label: 'Personal Loan' },
    { value: 'Business', label: 'Business Loan' },
    { value: 'Education', label: 'Education Loan' },
    { value: 'Home Improvement', label: 'Home Improvement Loan' },
    { value: 'Medical', label: 'Medical Loan' },
    { value: 'Agriculture', label: 'Agriculture Loan' },
  ];

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
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

    if (!formData.interestRate) {
      newErrors.interestRate = 'Interest rate is required';
    } else if (isNaN(Number(formData.interestRate)) || Number(formData.interestRate) <= 0 || Number(formData.interestRate) > 30) {
      newErrors.interestRate = 'Please enter a valid interest rate (0-30%)';
    }

    if (!formData.duration) {
      newErrors.duration = 'Loan duration is required';
    } else if (isNaN(Number(formData.duration)) || Number(formData.duration) <= 0 || Number(formData.duration) > 60) {
      newErrors.duration = 'Please enter a valid duration (1-60 months)';
    }

    if (!formData.purpose.trim()) {
      newErrors.purpose = 'Loan purpose is required';
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
      const today = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format

      // Calculate next payment date (30 days from today)
      const nextPaymentDate = new Date();
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 30);

      const loanData = {
        ...formData,
        disbursementDate: today,
        repaymentType: 'Monthly',
        nextPaymentDate: nextPaymentDate.toISOString(),
        status: 'Active',
      };

      // Make the actual API call to create a loan
      const response = await fetch('/api/loans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loanData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create loan');
      }

      const data = await response.json();
      console.log('Loan created successfully:', data);

      // Redirect to loans page after successful submission
      router.push('/loans');
    } catch (error) {
      console.error('Error creating loan:', error);
      setIsSubmitting(false);
      alert('Failed to create loan. Please try again.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-green-700">Create New Loan</h1>
        <Link href="/loans" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
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

            <div>
              <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700 mb-1">
                Interest Rate (% per annum) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="interestRate"
                name="interestRate"
                value={formData.interestRate}
                onChange={handleChange}
                min="1"
                max="30"
                step="0.5"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.interestRate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.interestRate && (
                <p className="mt-1 text-sm text-red-500">{errors.interestRate}</p>
              )}
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                Duration (months) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                min="1"
                max="60"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  errors.duration ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.duration && (
                <p className="mt-1 text-sm text-red-500">{errors.duration}</p>
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
            <Link href="/loans" className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300 mr-4">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
