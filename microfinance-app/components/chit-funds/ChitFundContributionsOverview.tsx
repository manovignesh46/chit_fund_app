// @ts-nocheck
'use client';

import React from 'react';
import Link from 'next/link';
import { formatCurrency } from '../../lib/formatUtils';

interface ContributionMonthData {
  month: number;
  contributionCount: number;
  memberCount: number;
  pendingCount: number;
  totalExpected: number;
  totalCollected: number;
  totalBalance: number;
  pendingMembers: Array<{
    member: {
      id: number;
      globalMember: {
        name: string;
      };
    };
  }>;
}

interface ChitFundContributionsOverviewProps {
  chitFundId: number;
  contributionsByMonth: ContributionMonthData[];
  maxDisplay?: number;
  showAll?: boolean;
  onViewMore?: () => void;
}

const ChitFundContributionsOverview: React.FC<ChitFundContributionsOverviewProps> = ({
  chitFundId,
  contributionsByMonth,
  maxDisplay = 5,
  showAll = false,
  onViewMore
}) => {
  // Sort months in descending order (latest month first) and limit display if needed
  const sortedMonths = contributionsByMonth
    .sort((a, b) => b.month - a.month)
    .slice(0, showAll ? contributionsByMonth.length : maxDisplay);

  const getStatusColor = (monthData: ContributionMonthData) => {
    if (monthData.totalBalance > 0) {
      return 'text-red-600'; // Outstanding balance
    } else if (monthData.contributionCount === monthData.memberCount) {
      return 'text-green-600'; // Fully collected
    } else {
      return 'text-yellow-600'; // Partial collection
    }
  };

  const getStatusText = (monthData: ContributionMonthData) => {
    if (monthData.totalBalance > 0) {
      return formatCurrency(monthData.totalBalance);
    } else if (monthData.contributionCount === monthData.memberCount) {
      return 'Fully collected';
    } else {
      return 'Partial';
    }
  };

  return (
    <div className="themed-card overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Contributions Overview</h2>
          <Link 
            href={`/chit-funds/${chitFundId}/contributions`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View All →
          </Link>
        </div>
      </div>
      <div className="p-6">
        {sortedMonths.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No contribution data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedMonths.map((monthData) => (
              <Link
                key={monthData.month}
                href={`/chit-funds/${chitFundId}/contributions?month=${monthData.month}`}
                className="block border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <h3 className="text-lg font-semibold text-blue-600">
                      Month {monthData.month}
                    </h3>
                    {monthData.pendingCount > 0 && (
                      <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                        {monthData.pendingCount} pending
                      </span>
                    )}
                  </div>
                  <div className={`text-sm font-semibold ${getStatusColor(monthData)}`}>
                    {getStatusText(monthData)}
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-sm text-gray-700 dark:text-theme-secondary mb-2">
                  <span>
                    {monthData.contributionCount} of {monthData.memberCount} members
                  </span>
                  <span>
                    {formatCurrency(monthData.totalCollected)} / {formatCurrency(monthData.totalExpected)}
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      monthData.totalBalance > 0 
                        ? 'bg-red-500' 
                        : monthData.contributionCount === monthData.memberCount 
                          ? 'bg-green-500' 
                          : 'bg-yellow-500'
                    }`}
                    style={{ 
                      width: `${Math.min((monthData.totalCollected / monthData.totalExpected) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
                
                {/* Show pending members if any */}
                {monthData.pendingCount > 0 && monthData.pendingMembers && (
                  <div className="mt-3 text-xs text-gray-500" onClick={(e) => e.stopPropagation()}>
                    <details>
                      <summary
                        className="cursor-pointer text-blue-600 hover:text-blue-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Show pending members ({monthData.pendingCount})
                      </summary>
                      <div className="mt-2 pl-4">
                        <div className="flex flex-wrap gap-1">
                          {monthData.pendingMembers.map((memberData) => (
                            <span 
                              key={memberData.member.id}
                              className="inline-block px-2 py-1 bg-red-50 text-red-700 rounded text-xs"
                            >
                              {memberData.member.globalMember.name}
                            </span>
                          ))}
                          {monthData.pendingMembers.length > 5 && (
                            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 dark:text-theme-secondary rounded text-xs">
                              +{monthData.pendingMembers.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
        
        {!showAll && contributionsByMonth.length > maxDisplay && (
          <div className="mt-6 text-center">
            <button
              onClick={onViewMore}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
            >
              View All Months ({contributionsByMonth.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChitFundContributionsOverview;
