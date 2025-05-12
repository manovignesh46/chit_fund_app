'use client';

import React from 'react';
import Link from 'next/link';
import { ChitFund } from '@/lib/interfaces';
import { formatCurrency, formatDate } from '@/lib/formatUtils';

interface ChitFundTableProps {
  chitFunds: ChitFund[];
  selectedChitFunds?: number[];
  onSelectChitFund?: (id: number) => void;
  selectAll?: boolean;
  onSelectAll?: () => void;
  showCheckboxes?: boolean;
}

/**
 * A reusable table component for displaying chit funds
 */
export default function ChitFundTable({
  chitFunds,
  selectedChitFunds = [],
  onSelectChitFund,
  selectAll = false,
  onSelectAll,
  showCheckboxes = true,
}: ChitFundTableProps) {
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
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {showCheckboxes && (
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={onSelectAll}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </th>
            )}
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Amount
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Monthly Contribution
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duration
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Members
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Next Auction
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {chitFunds.length === 0 ? (
            <tr>
              <td colSpan={showCheckboxes ? 9 : 8} className="px-6 py-4 text-center text-gray-500">
                No chit funds found
              </td>
            </tr>
          ) : (
            chitFunds.map((fund) => (
              <tr key={fund.id} className="hover:bg-gray-50">
                {showCheckboxes && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedChitFunds.includes(fund.id)}
                        onChange={() => onSelectChitFund && onSelectChitFund(fund.id)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-blue-600 hover:underline">
                    <Link href={`/chit-funds/${fund.id}`}>{fund.name}</Link>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatCurrency(fund.totalAmount)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatCurrency(fund.monthlyContribution)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{fund.duration} months</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{fund._count?.members || 0} of {fund.membersCount}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(fund.status)}`}>
                    {fund.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatDate(fund.nextAuctionDate)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <Link
                      href={`/chit-funds/${fund.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </Link>
                    <Link
                      href={`/chit-funds/${fund.id}/contributions`}
                      className="text-green-600 hover:text-green-900"
                    >
                      Contributions
                    </Link>
                    <Link
                      href={`/chit-funds/${fund.id}/auctions`}
                      className="text-purple-600 hover:text-purple-900"
                    >
                      Auctions
                    </Link>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
