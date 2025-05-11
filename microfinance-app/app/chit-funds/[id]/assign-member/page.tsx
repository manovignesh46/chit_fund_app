'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { memberAPI } from '@/lib/api';

interface GlobalMember {
  id: number;
  name: string;
  contact: string;
  email: string | null;
  address: string | null;
  _count: {
    chitFundMembers: number;
    loans: number;
  };
}

interface ChitFund {
  id: number;
  name: string;
  totalAmount: number;
  monthlyContribution: number;
  duration: number;
  status: string;
}

export default function AssignMemberPage() {
  const params = useParams();
  const router = useRouter();
  const chitFundId = params.id;

  const [chitFund, setChitFund] = useState<ChitFund | null>(null);
  const [members, setMembers] = useState<GlobalMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMember, setSelectedMember] = useState<string>('');
  const [contribution, setContribution] = useState<string>('');
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch chit fund details
        const chitFundResponse = await fetch(`/api/chit-funds/${chitFundId}`);
        if (!chitFundResponse.ok) {
          throw new Error('Failed to fetch chit fund details');
        }
        const chitFundData = await chitFundResponse.json();
        setChitFund(chitFundData);
        setContribution(chitFundData.monthlyContribution.toString());

        // Fetch all global members
        const membersData = await memberAPI.getAll();

        // Check if the response is paginated or a direct array
        if (membersData && membersData.members && Array.isArray(membersData.members)) {
          // Handle paginated response
          setMembers(membersData.members);
        } else if (Array.isArray(membersData)) {
          // Handle direct array response (for backward compatibility)
          setMembers(membersData);
        } else {
          // Handle unexpected response format
          console.error('Unexpected members data format:', membersData);
          setMembers([]);
        }

        setError(null);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (chitFundId) {
      fetchData();
    }
  }, [chitFundId]);

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    if (!selectedMember) {
      errors.member = 'Please select a member';
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
      const response = await fetch(`/api/chit-funds/${chitFundId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          globalMemberId: Number(selectedMember),
          contribution: Number(contribution),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add member to chit fund');
      }

      // Redirect back to members page
      router.push(`/chit-funds/${chitFundId}/members`);
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

  if (!chitFund) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">Chit Fund Not Found</p>
          <p>The chit fund you are looking for does not exist or has been removed.</p>
          <Link href="/chit-funds" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            Back to Chit Funds
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-blue-700">Assign Member to {chitFund.name}</h1>
          <p className="text-gray-600">
            Monthly Contribution: {formatCurrency(chitFund.monthlyContribution)} |
            Total Amount: {formatCurrency(chitFund.totalAmount)}
          </p>
        </div>
        <Link href={`/chit-funds/${chitFundId}/members`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
          Back to Members
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="member" className="block text-sm font-medium text-gray-700 mb-1">
              Select Member <span className="text-red-500">*</span>
            </label>
            <select
              id="member"
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                formErrors.member ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} - {member.contact}
                </option>
              ))}
            </select>
            {formErrors.member && (
              <p className="mt-1 text-sm text-red-500">{formErrors.member}</p>
            )}
            <div className="mt-2 text-right">
              <Link href="/members/new" className="text-blue-600 hover:text-blue-900 text-sm">
                + Create New Member
              </Link>
            </div>
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
