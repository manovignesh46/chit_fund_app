'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import PartnerSelectionModal from '../components/partners/PartnerSelectionModal';

interface Partner {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

interface PartnerContextType {
  selectedPartner: Partner | null;
  setSelectedPartner: (partner: Partner | null) => void;
  partners: Partner[];
  loading: boolean;
  error: string | null;
  refreshPartners: () => Promise<void>;
  activePartner: string;
  otherPartner: string;
  partnerLocked: boolean;
  isPrimaryAdmin: boolean;
}

const PartnerContext = createContext(undefined);

interface PartnerProviderProps {
  children: React.ReactNode;
}

export function PartnerProvider({ children }: PartnerProviderProps) {
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [partnerLocked, setPartnerLocked] = useState(false);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [userProfileLoaded, setUserProfileLoaded] = useState(false);

  const refreshPartners = async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/partners');
      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        let errorMsg = 'Failed to fetch partners';
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        }
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setPartners(data.partners || []);

      const profileResponse = await fetch('/api/user?action=me');
      let profileIsPrimaryAdmin = false;
      let profilePartnerLocked = false;

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        profilePartnerLocked = !!profile.partnerLocked;
        profileIsPrimaryAdmin = !!profile.isPrimaryAdmin;
        setPartnerLocked(profilePartnerLocked);
        setIsPrimaryAdmin(profileIsPrimaryAdmin);

        if (profile.partner?.id) {
          const linkedPartner = data.partners.find(
            (p: Partner) => p.id === profile.partner.id
          );
          if (linkedPartner) {
            setSelectedPartner(linkedPartner);
            setUserProfileLoaded(true);
            return;
          }
        }
      }

      setUserProfileLoaded(true);

      // Primary admin: restore saved partner or prompt selection
      if (profileIsPrimaryAdmin && !profilePartnerLocked) {
        const savedPartnerId = localStorage.getItem('selectedPartnerId');
        if (savedPartnerId) {
          const savedPartner = data.partners.find(
            (p: Partner) => p.id === parseInt(savedPartnerId)
          );
          if (savedPartner) {
            setSelectedPartner(savedPartner);
          } else {
            localStorage.removeItem('selectedPartnerId');
            localStorage.removeItem('selectedPartnerName');
          }
        }
      } else if (!profilePartnerLocked) {
        const savedPartnerId = localStorage.getItem('selectedPartnerId');
        if (savedPartnerId) {
          const savedPartner = data.partners.find(
            (p: Partner) => p.id === parseInt(savedPartnerId)
          );
          if (savedPartner) {
            setSelectedPartner(savedPartner);
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch partners';
      if (errMsg.includes('Server did not return JSON') && retryCount < 3) {
        setTimeout(() => refreshPartners(retryCount + 1), 700);
        return;
      }
      console.error('Error fetching partners:', err);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPartners();
  }, []);

  useEffect(() => {
    if (selectedPartner) {
      localStorage.setItem('selectedPartnerId', selectedPartner.id.toString());
      localStorage.setItem('selectedPartnerName', selectedPartner.name);
    }
  }, [selectedPartner]);

  // Show partner selection modal for primary admin when no partner is selected
  useEffect(() => {
    if (
      !loading &&
      userProfileLoaded &&
      isPrimaryAdmin &&
      !partnerLocked &&
      partners.length > 0 &&
      !selectedPartner
    ) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        setShowPartnerModal(true);
      }
    }
  }, [loading, userProfileLoaded, isPrimaryAdmin, partnerLocked, partners, selectedPartner]);

  const activePartner = selectedPartner?.name || 'Me';
  const otherPartner = partners.find(p => p.name !== activePartner)?.name || '';

  const value: PartnerContextType = {
    selectedPartner,
    setSelectedPartner,
    partners,
    loading,
    error,
    refreshPartners,
    activePartner,
    otherPartner,
    partnerLocked,
    isPrimaryAdmin,
  };

  return (
    <PartnerContext.Provider value={value}>
      {children}
      {isPrimaryAdmin && !partnerLocked && (
        <PartnerSelectionModal
          isOpen={showPartnerModal}
          onClose={() => setShowPartnerModal(false)}
          onPartnerSelected={() => setShowPartnerModal(false)}
        />
      )}
    </PartnerContext.Provider>
  );
}

export function usePartner() {
  const context = useContext(PartnerContext);
  if (context === undefined) {
    throw new Error('usePartner must be used within a PartnerProvider');
  }
  return context;
}

interface PartnerSelectorProps {
  className?: string;
  label?: string;
  variant?: 'default' | 'header' | 'sidebar';
}

export function PartnerSelector({
  className = '',
  label = 'Active Partner',
  variant = 'default'
}: PartnerSelectorProps) {
  const { selectedPartner, setSelectedPartner, partners, loading, partnerLocked } = usePartner();

  if (loading) {
    return null;
  }

  // Partner accounts: read-only badge
  if (partnerLocked && selectedPartner) {
    return (
      <div className={`flex flex-row items-center gap-2 ${className}`.trim()}>
        <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">Logged in as</span>
        <span className="px-3 py-1.5 bg-blue-50 text-blue-800 dark:bg-transparent dark:text-blue-400 text-sm font-medium rounded-lg border border-blue-200 dark:border-blue-500">
          {selectedPartner.name}
        </span>
      </div>
    );
  }

  const selectPartnerHandler = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = parseInt(e.target.value);
    const partner = partners.find(p => p.id === selectedId);
    setSelectedPartner(partner || null);
  };

  if (variant === 'sidebar') {
    return (
      <div className={className}>
        <select
          value={selectedPartner?.id || ''}
          onChange={selectPartnerHandler}
          className="block w-full px-3 py-2 bg-white dark:bg-surface-card border border-gray-300 dark:border-surface-border rounded-md text-gray-900 dark:text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select Partner</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={`flex flex-row items-center gap-2 ${className}`.trim()}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mr-1 mb-0 whitespace-nowrap">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={selectedPartner?.id || ''}
          onChange={selectPartnerHandler}
          className="block px-3 py-2 pr-8 border border-blue-500 dark:border-surface-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-600 bg-white dark:bg-surface-elevated text-gray-900 dark:text-theme-primary font-medium transition-all duration-150 appearance-none hover:border-blue-600 dark:hover:border-blue-500"
          style={{ minWidth: 160 }}
        >
          <option value="">Select Partner</option>
          {partners.map(partner => (
            <option key={partner.id} value={partner.id}>
              {partner.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-blue-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>
    </div>
  );
}
