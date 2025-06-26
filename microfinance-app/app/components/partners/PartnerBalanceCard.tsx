'use client';

import React from 'react';
import { formatCurrency } from '../../../lib/formatUtils';

interface PartnerBalanceCardProps {
  partner: {
    id: number;
    name: string;
    balance?: number;
    createdAt: string;
    isActive: boolean;
  };
}

export default function PartnerBalanceCard({ partner }: PartnerBalanceCardProps) {
  const balance = partner.balance || 0;
  const isPositive = balance >= 0;

  return (
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
  );
}
