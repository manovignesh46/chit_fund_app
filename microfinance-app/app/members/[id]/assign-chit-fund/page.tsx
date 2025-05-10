'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { memberAPI, chitFundAPI } from '@/lib/api';

interface GlobalMember {
  id: number;
  name: string;
  contact: string;
}

interface ChitFund {
  id: number;
  name: string;
  totalAmount: number;
  monthlyContribution: number;
  duration: number;
  status: string;
}

export default function AssignChitFundPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id;
  
  const [member, setMember] = useState<GlobalMember | null>(null);
  const [chitFunds, setChitFunds] = useState<ChitFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedChitFund, setSelectedChitFund] = useState<string>('');
  const [contribution, setContribution] = useState<string>('');
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch member details
        const memberData = await memberAPI.getById(Number(memberId));
        setMember(memberData);
        
        // Fetch all active chit funds
        const chitFundsData = await chitFundAPI.getAll();
        // Filter to only show active chit funds
        const activeChitFunds = chitFundsData.filter(cf => cf.status === 'Active');
        setChitFunds(activeChitFunds);
        
        setError(null);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (memberId) {
      fetchData();
    }
  }, [memberId]);

  const handleChitFundChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chitFundId = e.target.value;
    setSelectedChitFund(chitFundId);
    
    // Set default contribution amount based on selected chit fund
    if (chitFundId) {
      const selectedCF = chitFunds.find(cf => cf.id.toString() === chitFundId);
      if (selectedCF) {
        setContribution(selectedCF.monthlyContribution.toString());
      }
    } else {
      setContribution('');
    }
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!selectedChitFund) {
      errors.chitFund = 'Please select a chit fund';
    }
    
    if (!contribution) {
      errors.contribution = 'Contribution amount is required';
    } else if (isNaN(Number(contribution)) || Number(contribution) <= 0) {
      errors.contribution = 'Contribution must be a positive number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Add member to chit fund
      await fetch(`/api/chit-funds/${selectedChitFund}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          globalMemberId: Number(memberId),
          contribution: Number(contribution),
        }),
      });
      
      // Redirect back to member details page
      router.push(`/members/${memberId}`);
    } catch (error: any) {
      console.error('Error assigning member to chit fund:', error);
      setFormErrors({ submit: error.message || 'Failed to assign member to chit fund. Please try again.' });
      setIsSubmitting(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">Member Not Found</p>
          <p>The member you are looking for does not exist or has been removed.</p>
          <Link href="/members" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            Back to Members
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-700">Assign {member.name} to Chit Fund</h1>
        <Link href={`/members/${memberId}`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
          Back to Member
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="chitFund" className="block text-sm font-medium text-gray-700 mb-1">
              Select Chit Fund <span className="text-red-500">*</span>
            </label>
            <select
              id="chitFund"
              value={selectedChitFund}
              onChange={handleChitFundChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                formErrors.chitFund ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a chit fund</option>
              {chitFunds.map((chitFund) => (
                <option key={chitFund.id} value={chitFund.id}>
                  {chitFund.name} - {formatCurrency(chitFund.totalAmount)} ({chitFund.duration} months)
                </option>
              ))}
            </select>
            {formErrors.chitFund && (
              <p className="mt-1 text-sm text-red-500">{formErrors.chitFund}</p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="contribution" className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Contribution <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="contribution"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                formErrors.contribution ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formErrors.contribution && (
              <p className="mt-1 text-sm text-red-500">{formErrors.contribution}</p>
            )}
          </div>

          {formErrors.submit && (
            <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p>{formErrors.submit}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50"
            >
              {isSubmitting ? 'Assigning...' : 'Assign to Chit Fund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
