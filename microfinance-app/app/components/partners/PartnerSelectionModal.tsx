'use client';

/**
 * "Select Active Partner": shown by PartnerContext to the primary admin when no partner is
 * selected (e.g. after a fresh login). Confirming calls `setSelectedPartner`, which stores
 * `selectedPartnerId` / `selectedPartnerName` in localStorage, exactly as before.
 * A kit dialog (bottom sheet on phones): Escape, the close button and Cancel all close it.
 * PartnerContext loads this module on first use, so it is not part of first paint.
 */
import React, { useEffect, useId, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePartner } from '../../contexts/PartnerContext';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';

interface PartnerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPartnerSelected: () => void;
}

export default function PartnerSelectionModal({ isOpen, onClose, onPartnerSelected }: PartnerSelectionModalProps) {
  const { partners, selectedPartner, setSelectedPartner, loading, error, refreshPartners } = usePartner();
  const [tempSelectedPartner, setTempSelectedPartner] = useState<number | null>(null);
  const baseId = useId();

  useEffect(() => {
    if (selectedPartner) {
      setTempSelectedPartner(selectedPartner.id);
    }
  }, [selectedPartner]);

  const handleConfirm = () => {
    if (tempSelectedPartner) {
      const partner = partners.find((p) => p.id === tempSelectedPartner);
      if (partner) {
        setSelectedPartner(partner);
        onPartnerSelected();
        onClose();
      }
    }
  };

  return (
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Select Active Partner"
      description="Please select which partner you are working as. This will determine how transactions and financial activities are tracked."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!tempSelectedPartner || loading}>
            Confirm Selection
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-destructive-border bg-destructive-subtle p-3 text-sm text-destructive-text">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void refreshPartners()} disabled={loading}>
              Retry
            </Button>
          </div>
        ) : null}

        {loading ? (
          <Skeleton className="h-12 w-full" />
        ) : partners.length === 0 ? (
          <div className="py-6 text-center">
            <p className="mb-2 text-sm text-muted-foreground">No partners found.</p>
            <p className="text-sm text-muted-foreground">You&apos;ll need to create a partner first before proceeding.</p>
          </div>
        ) : (
          <RadioGroup
            aria-label="Partner"
            value={tempSelectedPartner ? String(tempSelectedPartner) : ''}
            onValueChange={(value) => setTempSelectedPartner(parseInt(value))}
            className="gap-3"
          >
            {partners.map((partner) => {
              const id = `${baseId}-${partner.id}`;
              const checked = tempSelectedPartner === partner.id;
              return (
                <label
                  key={partner.id}
                  htmlFor={id}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                    checked ? 'border-primary bg-primary-subtle' : 'hover:bg-accent'
                  )}
                >
                  <RadioGroupItem id={id} value={String(partner.id)} />
                  <span>
                    <span className="block font-medium text-foreground">{partner.name}</span>
                    <span className="block text-sm text-muted-foreground">{partner.isActive ? 'Active Partner' : 'Inactive Partner'}</span>
                  </span>
                </label>
              );
            })}
          </RadioGroup>
        )}

        <p className="flex gap-2 rounded-lg border border-info-border bg-info-subtle p-3 text-xs text-info-text">
          <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>
            <strong>Note:</strong> You can change the active partner anytime from the header dropdown or partner management page.
          </span>
        </p>
      </div>
    </ResponsiveDialog>
  );
}
