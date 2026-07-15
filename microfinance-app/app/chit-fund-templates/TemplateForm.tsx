// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { chitFundTemplateAPI } from '../../lib/api';

// Shared create/edit form for chit fund templates.
// A template captures only the STRUCTURAL fields of a chit fund (no startDate/status),
// mirroring the manual create form at app/chit-funds/new/page.tsx.
export default function TemplateForm({ mode, templateId, initial }) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    totalAmount: initial?.totalAmount?.toString() || '',
    monthlyContribution: initial?.monthlyContribution?.toString() || '',
    firstMonthContribution: initial?.firstMonthContribution?.toString() || '',
    duration: initial?.duration?.toString() || '',
    membersCount: initial?.membersCount?.toString() || '',
    chitFundType: initial?.chitFundType || 'Auction',
  });

  const [fixedAmounts, setFixedAmounts] = useState(() => {
    if (initial?.chitFundType === 'Fixed' && initial?.fixedAmountsPattern) {
      const fa = {};
      Object.keys(initial.fixedAmountsPattern).forEach((m) => {
        fa[Number(m)] = initial.fixedAmountsPattern[m].toString();
      });
      return fa;
    }
    return {};
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let updatedFormData = { ...formData, [name]: value };

    // Auto-calc first month contribution for Fixed (Total ÷ Duration)
    if (name === 'chitFundType' && value === 'Fixed' && formData.totalAmount && formData.duration) {
      const totalAmount = parseFloat(formData.totalAmount);
      const duration = parseInt(formData.duration);
      if (totalAmount > 0 && duration > 0) {
        updatedFormData.firstMonthContribution = (totalAmount / duration).toString();
      }
    }
    if ((name === 'totalAmount' || name === 'duration') && formData.chitFundType === 'Fixed') {
      const totalAmount = parseFloat(name === 'totalAmount' ? value : formData.totalAmount);
      const duration = parseInt(name === 'duration' ? value : formData.duration);
      if (totalAmount > 0 && duration > 0) {
        updatedFormData.firstMonthContribution = (totalAmount / duration).toString();
      }
    }
    if (name === 'chitFundType' && value === 'Auction') {
      updatedFormData.firstMonthContribution = '';
    }

    setFormData(updatedFormData);

    // Duration drives members count and the fixed-amounts grid size
    if (name === 'duration' && value) {
      const duration = parseInt(value);
      if (duration > 0) {
        setFormData((prev) => ({ ...prev, membersCount: duration.toString() }));
        if (formData.chitFundType === 'Fixed') {
          const newFixed = {};
          for (let i = 1; i <= duration; i++) newFixed[i] = fixedAmounts[i] || '';
          setFixedAmounts(newFixed);
        }
      }
    }

    if (name === 'chitFundType' && value === 'Fixed' && formData.duration) {
      const duration = parseInt(formData.duration);
      const newFixed = {};
      for (let i = 1; i <= duration; i++) newFixed[i] = fixedAmounts[i] || '';
      setFixedAmounts(newFixed);
    }
    if (name === 'chitFundType' && value === 'Auction') {
      setFixedAmounts({});
    }
  };

  const handleFixedAmountChange = (month, value) => {
    setFixedAmounts({ ...fixedAmounts, [month]: value });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Template name is required';
    if (!formData.totalAmount) newErrors.totalAmount = 'Total amount is required';
    else if (isNaN(Number(formData.totalAmount)) || Number(formData.totalAmount) <= 0) newErrors.totalAmount = 'Please enter a valid amount';
    if (!formData.monthlyContribution) newErrors.monthlyContribution = 'Monthly contribution is required';
    else if (isNaN(Number(formData.monthlyContribution)) || Number(formData.monthlyContribution) <= 0) newErrors.monthlyContribution = 'Please enter a valid amount';
    if (!formData.duration) newErrors.duration = 'Duration is required';
    else if (isNaN(Number(formData.duration)) || Number(formData.duration) <= 0 || Number(formData.duration) > 60) newErrors.duration = 'Please enter a valid duration (1-60 months)';
    if (!formData.membersCount) newErrors.membersCount = 'Members count is required';
    else if (isNaN(Number(formData.membersCount)) || Number(formData.membersCount) <= 0) newErrors.membersCount = 'Please enter a valid number of members';

    if (formData.chitFundType === 'Fixed') {
      if (!formData.firstMonthContribution) newErrors.firstMonthContribution = '1st month contribution is required for Fixed type';
      else if (isNaN(Number(formData.firstMonthContribution)) || Number(formData.firstMonthContribution) <= 0) newErrors.firstMonthContribution = 'Please enter a valid amount';

      if (formData.duration) {
        const duration = parseInt(formData.duration);
        for (let i = 1; i <= duration; i++) {
          if (!fixedAmounts[i] || isNaN(Number(fixedAmounts[i])) || Number(fixedAmounts[i]) <= 0) {
            newErrors[`fixedAmount${i}`] = `Amount for month ${i} is required and must be a valid positive number`;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        fixedAmountsPattern: formData.chitFundType === 'Fixed' ? fixedAmounts : undefined,
      };
      if (mode === 'create') {
        await chitFundTemplateAPI.create(payload);
      } else {
        await chitFundTemplateAPI.update(templateId, payload);
      }
      router.push('/chit-fund-templates');
    } catch (error) {
      console.error('Error saving template:', error);
      setIsSubmitting(false);
      alert(error?.message || 'Failed to save template. Please try again.');
    }
  };

  const inputClass = (field) =>
    `w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      errors[field] ? 'border-red-500' : 'border-gray-200 dark:border-surface-border'
    }`;

  return (
    <div className="themed-card overflow-hidden">
      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange}
              className={inputClass('name')} placeholder="e.g., Standard 20-Month Fixed" />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">
              Total Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input type="number" id="totalAmount" name="totalAmount" value={formData.totalAmount} onChange={handleChange}
              min="1" step="1" className={inputClass('totalAmount')} placeholder="e.g., 1200000" />
            {errors.totalAmount && <p className="mt-1 text-sm text-red-500">{errors.totalAmount}</p>}
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">
              Duration (months) <span className="text-red-500">*</span>
            </label>
            <input type="number" id="duration" name="duration" value={formData.duration} onChange={handleChange}
              min="1" max="60" className={inputClass('duration')} placeholder="e.g., 1-60" />
            {errors.duration && <p className="mt-1 text-sm text-red-500">{errors.duration}</p>}
          </div>

          <div>
            <label htmlFor="chitFundType" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">
              Chit Fund Type <span className="text-red-500">*</span>
            </label>
            <select id="chitFundType" name="chitFundType" value={formData.chitFundType} onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-200 dark:border-surface-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="Auction">Auction</option>
              <option value="Fixed">Fixed</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Auction: Members bid for the amount each month. Fixed: Predefined amounts for each month.
            </p>
          </div>

          <div>
            <label htmlFor="membersCount" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">
              Number of Members <span className="text-red-500">*</span>
            </label>
            <input type="number" id="membersCount" name="membersCount" value={formData.membersCount} onChange={handleChange}
              min="1" max="50" className={inputClass('membersCount')} placeholder="e.g., 20" />
            {errors.membersCount && <p className="mt-1 text-sm text-red-500">{errors.membersCount}</p>}
            <p className="mt-1 text-xs text-gray-500">Typically equal to the duration in months</p>
          </div>

          <div>
            <label htmlFor="monthlyContribution" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">
              Monthly Contribution (₹) <span className="text-red-500">*</span>
            </label>
            <input type="number" id="monthlyContribution" name="monthlyContribution" value={formData.monthlyContribution} onChange={handleChange}
              min="1" step="1" className={inputClass('monthlyContribution')} placeholder="e.g., 10000" />
            {errors.monthlyContribution && <p className="mt-1 text-sm text-red-500">{errors.monthlyContribution}</p>}
            <p className="mt-1 text-xs text-gray-500">
              {formData.chitFundType === 'Fixed' ? 'Monthly contribution for months 2 onwards' : 'Enter the monthly contribution amount'}
            </p>
          </div>

          {formData.chitFundType === 'Fixed' && (
            <div>
              <label htmlFor="firstMonthContribution" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">
                1st Month Contribution (₹) <span className="text-red-500">*</span>
              </label>
              <input type="number" id="firstMonthContribution" name="firstMonthContribution" value={formData.firstMonthContribution} onChange={handleChange}
                min="1" step="1" className={inputClass('firstMonthContribution')} placeholder="Auto-calculated from total amount" />
              {errors.firstMonthContribution && <p className="mt-1 text-sm text-red-500">{errors.firstMonthContribution}</p>}
              <p className="mt-1 text-xs text-blue-600">
                Default: Total Amount ÷ Duration = ₹{formData.totalAmount || '0'} ÷ {formData.duration || '0'} = ₹{formData.firstMonthContribution || '0'}
              </p>
            </div>
          )}

          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">
              Description
            </label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={3}
              className="w-full px-4 py-2 border border-gray-200 dark:border-surface-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="What this template is for..." />
          </div>

          {formData.chitFundType === 'Fixed' && formData.duration && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-3">
                Fixed Amounts for Each Month <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: parseInt(formData.duration) }, (_, index) => {
                  const month = index + 1;
                  return (
                    <div key={month}>
                      <label htmlFor={`fixedAmount${month}`} className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">
                        Month {month} Amount (₹)
                      </label>
                      <input type="number" id={`fixedAmount${month}`} value={fixedAmounts[month] || ''}
                        onChange={(e) => handleFixedAmountChange(month, e.target.value)} min="1" step="1"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors[`fixedAmount${month}`] ? 'border-red-500' : 'border-gray-200 dark:border-surface-border'
                        }`}
                        placeholder={`e.g., ${40000 + (month - 1) * 5000}`} />
                      {errors[`fixedAmount${month}`] && <p className="mt-1 text-xs text-red-500">{errors[`fixedAmount${month}`]}</p>}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Define the amount to be given to the winner for each month.
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <Link href="/chit-fund-templates" className="btn-neutral px-6 py-2 rounded-lg transition duration-300 mr-4">
            Cancel
          </Link>
          <button type="submit" disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Template' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
