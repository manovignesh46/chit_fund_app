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
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">{partner.name}</h3>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              partner.isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {partner.isActive ? 'Active' : 'Inactive'}
            </span>
            <button
              onClick={handleDeleteClick}
              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
              title="Delete Partner"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Current Balance:</span>
          <span className={`text-lg font-bold ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive ? '+' : ''}{formatCurrency(balance)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Status:</span>
          <span className={`font-medium ${
            isPositive 
              ? 'text-green-600' 
              : balance === 0 
                ? 'text-gray-600' 
                : 'text-red-600'
          }`}>
            {balance > 0 ? 'Has Money' : balance === 0 ? 'Balanced' : 'Owes Money'}
          </span>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            Created: {new Date(partner.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

        {/* Balance explanation */}
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-600">
            {isPositive
              ? `${partner.name} currently holds ${formatCurrency(Math.abs(balance))} from collections and loan repayments.`
              : balance === 0
                ? `${partner.name} has a balanced account with no outstanding amounts.`
                : `${partner.name} owes ${formatCurrency(Math.abs(balance))} from loans given or transfers made.`
            }
          </p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Partner</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{partner.name}</strong>? This action cannot be undone.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-300 disabled:opacity-50"
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
