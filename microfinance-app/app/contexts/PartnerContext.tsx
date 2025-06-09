'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  const refreshPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/partners');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch partners');
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
        }
      }
    } catch (err) {
      console.error('Error fetching partners:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch partners');
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
    }
  }, [selectedPartner]);

  const value: PartnerContextType = {
    selectedPartner,
    setSelectedPartner,
    partners,
    loading,
    error,
    refreshPartners,
  };

  return (
    <PartnerContext.Provider value={value}>
      {children}
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
  variant?: 'default' | 'header';
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
