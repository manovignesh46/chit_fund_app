'use client';

import React, { useState } from 'react';
import { formatCurrency } from '../../../lib/formatUtils';

interface PartnerBalanceCardProps {
  partner: {
    id: number;
    name: string;
    balance?: number;
    createdAt: string;
    isActive: boolean;
  };
  onDelete?: (partnerId: number) => void;
}

export default function PartnerBalanceCard({ partner, onDelete }: PartnerBalanceCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const balance = partner.balance || 0;
  const isPositive = balance >= 0;

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/partners/${partner.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete partner');
      }

      setShowDeleteModal(false);
      if (onDelete) {
        onDelete(partner.id);
      }
    } catch (error: any) {
      console.error('Error deleting partner:', error);
      setDeleteError(error.message || 'Failed to delete partner');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>

      <div className="themed-card p-3 border-l-4 border-blue-500 flex flex-col items-start gap-2 min-w-[180px] max-w-xs h-32 sm:h-32 md:h-32 justify-between">
        <div className="flex items-center justify-between w-full mb-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-theme-primary truncate">{partner.name}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            partner.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-900 dark:text-theme-primary'
          }`}>
            {partner.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="flex items-center justify-between w-full mt-2">
          <span className="text-xs text-gray-700 dark:text-theme-secondary">Balance:</span>
          <span className={`text-base font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>{isPositive ? '+' : ''}{formatCurrency(balance)}</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay flex items-center justify-center z-50">
          <div className="themed-card rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-theme-primary mb-4">Delete Partner</h3>
            <p className="text-gray-700 dark:text-theme-secondary mb-6">
              Are you sure you want to delete <strong>{partner.name}</strong>? This action cannot be undone.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 alert-error rounded">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 dark:text-theme-secondary border border-gray-200 dark:border-surface-border rounded-lg hover:bg-gray-50 dark:hover:bg-surface-hover transition duration-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
