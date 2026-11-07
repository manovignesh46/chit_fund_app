'use client';

/**
 * The partners page's "active partner" select. Choosing a partner calls
 * `setSelectedPartner` (PartnerContext stores `selectedPartnerId` / `selectedPartnerName`),
 * as before. The top bar and the More sheet use `PartnerSelector` from PartnerContext.
 */
import React from 'react';
import { usePartner } from '../../contexts/PartnerContext';
import { Skeleton } from '@/components/ui/skeleton';
import { NativeSelect } from '@/components/kit/native-select';

interface PartnerSelectorProps {
  className?: string;
}

export default function PartnerSelector({ className = '' }: PartnerSelectorProps) {
  const { selectedPartner, setSelectedPartner, partners, loading, error } = usePartner();

  if (loading) {
    return <Skeleton className="h-11 w-full md:h-9" />;
  }

  if (error) {
    return <p className="text-sm text-destructive-text">Failed to load partners</p>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const partnerId = parseInt(e.target.value);
    const partner = partners.find((p) => p.id === partnerId);
    setSelectedPartner(partner || null);
  };

  return (
    <div className={className}>
      <NativeSelect
        aria-label="Active partner"
        value={selectedPartner?.id || ''}
        onChange={handleChange}
        placeholder="Select Partner"
        options={partners.map((partner) => ({ value: String(partner.id), label: partner.name }))}
      />
    </div>
  );
}
