'use client';

import React, { useState, useEffect } from 'react';
import { usePartner } from '../contexts/PartnerContext';
import PartnerBalanceCard from '../components/partners/PartnerBalanceCard';
import PartnerSelector from '../components/partners/PartnerSelector';
import TransactionForm from '../components/TransactionForm';
import TransactionList from '../components/TransactionList';

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

  // Handle partner deletion
  const handlePartnerDelete = (partnerId: number) => {
    // Remove the deleted partner from the state
    setPartnersWithBalances(partnersWithBalances.filter(p => p.id !== partnerId));
    // Refresh the partners list from context
    refreshPartners();
  };

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
        <div className="alert-error px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-6 sm:mb-8">
        <h1 className="page-title">Partner Management</h1>
      </div>

      {/* Partner Selector */}
      <div className="mb-6 max-w-xs">
        <h2 className="section-heading mb-2">Select Partner</h2>
        <PartnerSelector />
      </div>

      {/* Partners Balance Cards */}
      <div className="space-y-6 mb-10">
        <div className="flex items-center justify-between">
          <h2 className="section-heading">Partner Balances</h2>
          {loadingBalances && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
              <span className="text-sm text-gray-700 dark:text-theme-secondary">Loading balances...</span>
            </div>
          )}
        </div>

        {partnersWithBalances.length === 0 ? (
          <div className="themed-card p-8 text-center">
            <p className="text-gray-500">No partners found. Add a partner to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
            {partnersWithBalances.map((partner) => (
              <PartnerBalanceCard
                key={partner.id}
                partner={partner}
                onDelete={handlePartnerDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Record Manual Transaction Form */}
      <div className="themed-card p-6 max-w-xl mb-10">
        <TransactionForm />
      </div>

      {/* Transaction Section removed as per request */}
    </div>
  );
}
