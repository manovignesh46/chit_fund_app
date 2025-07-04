'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  // For transaction components compatibility
  activePartner: string;
  otherPartner: string;
}

const PartnerContext = createContext<PartnerContextType | undefined>(undefined);

interface PartnerProviderProps {
  children: React.ReactNode;
}

export function PartnerProvider({ children }: PartnerProviderProps) {
  const router = useRouter();
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  const refreshPartners = async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/partners');
      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        // Try to parse error as JSON, fallback to text
        let errorMsg = 'Failed to fetch partners';
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } else {
          const text = await response.text();
          if (text.startsWith('<!DOCTYPE')) {
            errorMsg = 'Server returned HTML (possible server error or not authenticated)';
          } else {
            errorMsg = text;
          }
        }
        throw new Error(errorMsg);
      }
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server did not return JSON. Possible session timeout or server error.');
      }
      const data = await response.json();
      setPartners(data.partners || []);

      // Try to restore selected partner from localStorage
      const savedPartnerId = localStorage.getItem('selectedPartnerId');
      if (savedPartnerId) {
        const savedPartner = data.partners.find(
          (p: Partner) => p.id === parseInt(savedPartnerId)
        );
        if (savedPartner) {
          setSelectedPartner(savedPartner);
        } else {
          // Clear invalid localStorage if partner not found
          localStorage.removeItem('selectedPartnerId');
          localStorage.removeItem('selectedPartnerName');
          setSelectedPartner(null);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch partners';
      // Auto-retry if the error is about not getting JSON and we haven't retried too many times
      if (errMsg.includes('Server did not return JSON') && retryCount < 3) {
        setTimeout(() => {
          refreshPartners(retryCount + 1);
        }, 700); // 700ms delay between retries
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

  // Save selected partner to localStorage when it changes
  useEffect(() => {
    if (selectedPartner) {
      localStorage.setItem('selectedPartnerId', selectedPartner.id.toString());
      localStorage.setItem('selectedPartnerName', selectedPartner.name);
    }
  }, [selectedPartner]);

  // Show partner selection modal when partners are loaded but no partner is selected
  useEffect(() => {
    if (!loading && partners.length > 0 && !selectedPartner) {
      // Only show modal if we're not on the login page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        // Add a small delay to ensure the page has fully loaded after login
        const timer = setTimeout(() => {
          setShowPartnerModal(true);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, partners, selectedPartner]);

  // Fallback: If partners are loaded and still no partner is selected, always show modal
  useEffect(() => {
    if (!loading && partners.length > 0 && !selectedPartner && !showPartnerModal) {
      setShowPartnerModal(true);
    }
  }, [loading, partners, selectedPartner, showPartnerModal]);

  // Calculate activePartner and otherPartner for transaction components
  const activePartner = selectedPartner?.name || 'Me';
  const otherPartner = partners.find(p => p.name !== activePartner)?.name || 'My Friend';

  const value: PartnerContextType = {
    selectedPartner,
    setSelectedPartner,
    partners,
    loading,
    error,
    refreshPartners,
    activePartner,
    otherPartner,
  };

  return (
    <PartnerContext.Provider value={value}>
      {children}
      <PartnerSelectionModal
        isOpen={showPartnerModal}
        onClose={() => setShowPartnerModal(false)}
        onPartnerSelected={() => setShowPartnerModal(false)}
      />
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

// Partner selector component
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
  const { selectedPartner, setSelectedPartner, partners, loading } = usePartner();

  if (loading) {
    return null;
  }

  const selectPartnerHandler = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = parseInt(e.target.value);
    const partner = partners.find(p => p.id === selectedId);
    setSelectedPartner(partner || null);
  };

  if (variant === 'header') {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-white mb-1">
          {label}
        </label>
        <select
          value={selectedPartner?.id || ''}
          onChange={selectPartnerHandler}
          className="block w-full px-3 py-1.5 bg-blue-700 border border-blue-500 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
        >
          {partners.map(partner => (
            <option key={partner.id} value={partner.id}>
              {partner.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={className}>
        <select
          value={selectedPartner?.id || ''}
          onChange={selectPartnerHandler}
          className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <select
        value={selectedPartner?.id || ''}
        onChange={selectPartnerHandler}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      >
        {partners.map(partner => (
          <option key={partner.id} value={partner.id}>
            {partner.name}
          </option>
        ))}
      </select>
    </div>
  );
}
