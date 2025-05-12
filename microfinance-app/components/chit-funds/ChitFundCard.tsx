'use client';

import React from 'react';
import Link from 'next/link';
import { ChitFund } from '@/lib/interfaces';
import { formatCurrency, formatDate } from '@/lib/formatUtils';

interface ChitFundCardProps {
  chitFund: ChitFund;
  showActions?: boolean;
}

/**
 * A reusable card component for displaying chit fund information
 */
export default function ChitFundCard({ chitFund, showActions = true }: ChitFundCardProps) {
  // Get status color based on status
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Completed':
        return 'bg-blue-100 text-blue-800';
      case 'Upcoming':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">{chitFund.name}</h2>
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(chitFund.status)}`}>
            {chitFund.status}
          </span>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-lg font-semibold">{formatCurrency(chitFund.totalAmount)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Monthly Contribution</p>
            <p className="text-lg font-semibold">{formatCurrency(chitFund.monthlyContribution)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Duration</p>
            <p className="text-lg font-semibold">{chitFund.duration} months</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Current Month</p>
            <p className="text-lg font-semibold">{chitFund.currentMonth} of {chitFund.duration}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Start Date</p>
            <p className="text-lg font-semibold">{formatDate(chitFund.startDate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Next Auction</p>
            <p className="text-lg font-semibold">{formatDate(chitFund.nextAuctionDate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Members</p>
            <p className="text-lg font-semibold">{chitFund._count?.members || chitFund.members?.length || 0} of {chitFund.membersCount}</p>
          </div>
        </div>
        
        {showActions && (
          <div className="flex justify-end space-x-2 mt-4">
            <Link 
              href={`/chit-funds/${chitFund.id}`} 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              View Details
            </Link>
            <Link 
              href={`/chit-funds/${chitFund.id}/contributions`} 
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Contributions
            </Link>
            <Link 
              href={`/chit-funds/${chitFund.id}/auctions`} 
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              Auctions
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
