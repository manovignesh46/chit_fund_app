'use client';

import React, { useState, useEffect } from 'react';
import { usePartner } from '../contexts/PartnerContext';
import PartnerBalanceCard from '../components/partners/PartnerBalanceCard';

interface PartnerWithBalance {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  balance?: number;
}

export default function PartnerManagementPage() {
  const { partners, refreshPartners, loading, error } = usePartner();
  const [partnersWithBalances, setPartnersWithBalances] = useState<PartnerWithBalance[]>([]);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Fetch partners with balances
  const fetchPartnersWithBalances = async () => {
    try {
      setLoadingBalances(true);
      const response = await fetch('/api/partners?includeBalances=true');
      if (!response.ok) {
        throw new Error('Failed to fetch partner balances');
      }
      const data = await response.json();
      setPartnersWithBalances(data.partners || []);
    } catch (err) {
      console.error('Error fetching partner balances:', err);
      // Fallback to partners without balances
      setPartnersWithBalances(partners.map(p => ({ ...p, balance: 0 })));
    } finally {
      setLoadingBalances(false);
    }
  };

  // Fetch balances when partners change
  useEffect(() => {
    if (partners.length > 0) {
      fetchPartnersWithBalances();
    }
  }, [partners]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newPartnerName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to create partner');
      }

      await refreshPartners();
      setNewPartnerName('');
      // Refresh balances after adding new partner
      fetchPartnersWithBalances();
    } catch (err: any) {
      console.error('Error creating partner:', err);
      setSubmitError(err.message || 'Failed to create partner');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
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
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8 max-w-screen-xl w-full">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-700">Partner Management</h1>
      </div>

      {/* Add Partner Form */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8">
        <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-4">Add New Partner</h2>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={newPartnerName}
            onChange={(e) => setNewPartnerName(e.target.value)}
            placeholder="Enter partner name"
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isSubmitting || !newPartnerName.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Partner'}
          </button>
        </form>
        {submitError && (
          <p className="mt-2 text-red-600 text-sm">{submitError}</p>
        )}
      </div>

      {/* Partners Balance Cards */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700">Partner Balances</h2>
          {loadingBalances && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
              <span className="text-sm text-gray-600">Loading balances...</span>
            </div>
          )}
        </div>

        {partnersWithBalances.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">No partners found. Add a partner to get started.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {partnersWithBalances.map((partner) => (
              <PartnerBalanceCard key={partner.id} partner={partner} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
