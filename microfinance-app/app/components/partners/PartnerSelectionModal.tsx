'use client';

import React, { useState, useEffect } from 'react';
import { usePartner } from '../../contexts/PartnerContext';

interface PartnerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPartnerSelected: () => void;
}

export default function PartnerSelectionModal({ 
  isOpen, 
  onClose, 
  onPartnerSelected 
}: PartnerSelectionModalProps) {
  const { partners, selectedPartner, setSelectedPartner, loading } = usePartner();
  const [tempSelectedPartner, setTempSelectedPartner] = useState<number | null>(null);

  useEffect(() => {
    if (selectedPartner) {
      setTempSelectedPartner(selectedPartner.id);
    }
  }, [selectedPartner]);

  const handleConfirm = () => {
    if (tempSelectedPartner) {
      const partner = partners.find(p => p.id === tempSelectedPartner);
      if (partner) {
        setSelectedPartner(partner);
        onPartnerSelected();
        onClose();
      }
    }
  };

  const handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Select Active Partner</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Please select which partner you are working as. This will determine how transactions and financial activities are tracked.
          </p>

          {loading ? (
            <div className="animate-pulse bg-gray-200 rounded-lg h-12 w-full"></div>
          ) : (
            <div className="space-y-3">
              {partners.map((partner) => (
                <label
                  key={partner.id}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    tempSelectedPartner === partner.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="partner"
                    value={partner.id}
                    checked={tempSelectedPartner === partner.id}
                    onChange={(e) => setTempSelectedPartner(parseInt(e.target.value))}
                    className="mr-3 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{partner.name}</div>
                    <div className="text-sm text-gray-500">
                      {partner.isActive ? 'Active Partner' : 'Inactive Partner'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {partners.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No partners found.</p>
              <p className="text-sm text-gray-400">
                You'll need to create a partner first before proceeding.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-300"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!tempSelectedPartner || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Selection
          </button>
        </div>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            <strong>Note:</strong> You can change the active partner anytime from the header dropdown or partner management page.
          </p>
        </div>
      </div>
    </div>
  );
}
