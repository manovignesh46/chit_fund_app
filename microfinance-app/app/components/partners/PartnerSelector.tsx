'use client';

import React from 'react';
import { usePartner } from '../../contexts/PartnerContext';

interface PartnerSelectorProps {
  variant?: 'header' | 'form';
  className?: string;
}

export default function PartnerSelector({ variant = 'form', className = '' }: PartnerSelectorProps) {
  const { selectedPartner, setSelectedPartner, partners, loading, error } = usePartner();

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-200 rounded-lg h-9 w-full"></div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm">Failed to load partners</div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const partnerId = parseInt(e.target.value);
    const partner = partners.find(p => p.id === partnerId);
    setSelectedPartner(partner || null);
  };

  return (
    <div className={`${variant === 'header' ? 'flex items-center' : ''} ${className}`}>
      <select
        value={selectedPartner?.id || ''}
        onChange={handleChange}
        className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
          variant === 'header' 
            ? 'border-gray-700 bg-blue-700 text-white placeholder-gray-300' 
            : 'border-gray-300 bg-white'
        }`}
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
