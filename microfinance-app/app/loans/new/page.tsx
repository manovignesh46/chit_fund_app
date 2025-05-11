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
  documentCharge: string;
  duration: string;
  purpose: string;
  disbursementDate: string;
  installmentAmount: string;
}

interface LoanFormErrors {
  borrowerName?: string;
  contact?: string;
  loanType?: string;
  amount?: string;
  interestRate?: string;
  documentCharge?: string;
  duration?: string;
  purpose?: string;
  disbursementDate?: string;
  installmentAmount?: string;
}

interface LoanType {
  value: string;
  label: string;
}

export default function NewLoanPage() {
  const router = useRouter();
  // Get today's date in YYYY-MM-DD format for the date input
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState<LoanFormData>({
    borrowerName: '',
    contact: '',
    loanType: 'Monthly',
    amount: '',
    interestRate: '',
    documentCharge: '0',
    duration: '',
    purpose: '',
    disbursementDate: today,
    installmentAmount: '0',
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<LoanFormErrors>({});

  const loanTypes: LoanType[] = [
    { value: 'Monthly', label: 'Monthly' },
    { value: 'Weekly', label: 'Weekly' },
  ];

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
      // Parse the disbursement date from the form
      const disbursementDate = new Date(formData.disbursementDate);
      const disbursementDateISOString = disbursementDate.toISOString();

      // We no longer need to calculate the next payment date here
      // It will be calculated on the server based on the loan details

      // We no longer need to calculate the current month
      // as we've removed it from the schema temporarily
      const today = new Date();

      console.log('Preparing loan data with dates:', {
        disbursementDate
      });

      // Create loan data with all fields
      const loanData = {
        borrowerName: formData.borrowerName,
        contact: formData.contact,
        loanType: formData.loanType,
        amount: formData.amount,
        interestRate: formData.interestRate,
        documentCharge: formData.documentCharge,
        duration: formData.duration,
        installmentAmount: formData.installmentAmount,
        purpose: formData.purpose,
        disbursementDate: disbursementDateISOString,
        repaymentType: formData.loanType, // Set repaymentType to match loanType
        status: 'Active',
      };

      // Log the data being sent to the API
      console.log('Sending loan data to API:', JSON.stringify(loanData, null, 2));

      // Make the actual API call to create a loan
      const response = await fetch('/api/loans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loanData),
      });

      console.log('API response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = 'Failed to create loan';
        try {
          const errorData = await response.json();
          console.error('API error response:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          // Try to get the text content
          const textContent = await response.text().catch(() => '');
          console.error('Response text content:', textContent);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Loan created successfully:', data);

      // Redirect to loans page after successful submission
      router.push('/loans');
    } catch (error) {
      console.error('Error creating loan:', error);

      // Get a more user-friendly error message
      const errorMessage = error instanceof Error
        ? error.message
        : 'An unknown error occurred';

      setIsSubmitting(false);

      // Show a more specific error message to the user
      alert(`Failed to create loan: ${errorMessage}. Please try again.`);
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
