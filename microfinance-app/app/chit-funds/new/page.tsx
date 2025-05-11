'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewChitFundPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    totalAmount: '',
    monthlyContribution: '',
    duration: '',
    membersCount: '',
    startDate: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Auto-calculate members count only (removed monthly contribution auto-calculation)
    if (name === 'duration') {
      if (formData.duration) {
        const duration = parseInt(formData.duration);
        if (!isNaN(duration) && duration > 0) {
          const membersCount = duration;

          setFormData(prev => ({
            ...prev,
            membersCount: membersCount.toString(),
          }));
        }
      }
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Chit fund name is required';
    }

    if (!formData.totalAmount) {
      newErrors.totalAmount = 'Total amount is required';
    } else if (isNaN(Number(formData.totalAmount)) || Number(formData.totalAmount) <= 0) {
      newErrors.totalAmount = 'Please enter a valid amount';
    }

    if (!formData.monthlyContribution) {
      newErrors.monthlyContribution = 'Monthly contribution is required';
    } else if (isNaN(Number(formData.monthlyContribution)) || Number(formData.monthlyContribution) <= 0) {
      newErrors.monthlyContribution = 'Please enter a valid amount';
    }

    if (!formData.duration) {
      newErrors.duration = 'Duration is required';
    } else if (isNaN(Number(formData.duration)) || Number(formData.duration) <= 0 || Number(formData.duration) > 60) {
      newErrors.duration = 'Please enter a valid duration (1-60 months)';
    }

    if (!formData.membersCount) {
      newErrors.membersCount = 'Members count is required';
    } else if (isNaN(Number(formData.membersCount)) || Number(formData.membersCount) <= 0) {
      newErrors.membersCount = 'Please enter a valid number of members';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Make the actual API call to create a chit fund
      const response = await fetch('/api/chit-funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create chit fund');
      }

      const data = await response.json();
      console.log('Chit fund created successfully:', data);

      // Redirect to chit funds page after successful submission
      router.push('/chit-funds');
    } catch (error) {
      console.error('Error creating chit fund:', error);
      setIsSubmitting(false);
      alert('Failed to create chit fund. Please try again.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-700">Create New Chit Fund</h1>
        <Link href="/chit-funds" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
          Cancel
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Chit Fund Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Gold Chit Fund"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-1">
                Total Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="totalAmount"
                name="totalAmount"
                value={formData.totalAmount}
                onChange={handleChange}
                min="1"
                step="1"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.totalAmount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., 1200000"
              />
              {errors.totalAmount && (
                <p className="mt-1 text-sm text-red-500">{errors.totalAmount}</p>
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
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.duration ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., 1-60"
              />
              {errors.duration && (
                <p className="mt-1 text-sm text-red-500">{errors.duration}</p>
              )}
            </div>

            <div>
              <label htmlFor="membersCount" className="block text-sm font-medium text-gray-700 mb-1">
                Number of Members <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="membersCount"
                name="membersCount"
                value={formData.membersCount}
                onChange={handleChange}
                min="1"
                max="50"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.membersCount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., 20"
              />
              {errors.membersCount && (
                <p className="mt-1 text-sm text-red-500">{errors.membersCount}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Typically equal to the duration in months</p>
            </div>

            <div>
              <label htmlFor="monthlyContribution" className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Contribution (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="monthlyContribution"
                name="monthlyContribution"
                value={formData.monthlyContribution}
                onChange={handleChange}
                min="1"
                step="1"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.monthlyContribution ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., 10000"
              />
              {errors.monthlyContribution && (
                <p className="mt-1 text-sm text-red-500">{errors.monthlyContribution}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Enter the monthly contribution amount</p>
            </div>

            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.startDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-500">{errors.startDate}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Additional details about this chit fund..."
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Link href="/chit-funds" className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300 mr-4">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Chit Fund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
