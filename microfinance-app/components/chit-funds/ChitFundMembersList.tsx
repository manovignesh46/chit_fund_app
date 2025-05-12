'use client';

import React from 'react';
import { ChitFundMember, GlobalMember } from '@/lib/interfaces';
import { formatCurrency, formatDate } from '@/lib/formatUtils';

interface ChitFundMembersListProps {
  members: ChitFundMember[];
  showAuctionDetails?: boolean;
  maxDisplay?: number;
  showAll?: boolean;
  onViewMore?: () => void;
}

/**
 * A reusable component for displaying chit fund members
 */
export default function ChitFundMembersList({
  members,
  showAuctionDetails = true,
  maxDisplay = 5,
  showAll = false,
  onViewMore,
}: ChitFundMembersListProps) {
  // Get member name from either the member object or the globalMember object
  const getMemberName = (member: ChitFundMember): string => {
    if (member.name) return member.name;
    if (member.globalMember?.name) return member.globalMember.name;
    return 'Unknown Member';
  };

  // Limit the number of members displayed if not showing all
  const displayMembers = showAll ? members : members.slice(0, maxDisplay);
  const hasMoreMembers = !showAll && members.length > maxDisplay;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold">Members ({members.length})</h2>
      </div>
      <div className="p-6">
        {members.length === 0 ? (
          <p className="text-center text-gray-500">No members found</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {displayMembers.map((member) => (
              <li key={member.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">{getMemberName(member)}</p>
                  {showAuctionDetails && (
                    <p className="text-sm text-gray-500">
                      {member.auctionWon
                        ? `Won auction in month ${member.auctionMonth}`
                        : 'No auction won yet'}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Joined: {formatDate(member.joinDate)}
                  </p>
                </div>
                <div className="text-sm font-semibold">
                  {formatCurrency(member.contribution)}
                </div>
              </li>
            ))}
          </ul>
        )}
        
        {hasMoreMembers && onViewMore && (
          <div className="mt-4 text-center">
            <button
              onClick={onViewMore}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              View All {members.length} Members
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
