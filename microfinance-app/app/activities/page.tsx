// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency } from '../../lib/formatUtils';
import BackTitle from '../components/common/BackTitle';

// Define activity interface
interface Activity {
  id: string | number;
  type: 'Loan' | 'Chit Fund';
  action: string;
  details: string;
  date: string;
  amount?: number;
  entityId?: number;
  entityType?: string;
}

export default function ActivitiesPage() {
  // State for activities and pagination
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalActivities, setTotalActivities] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch activities from API
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);

        // Fetch activities with pagination
        const response = await fetch(`/api/dashboard/consolidated?action=activities&page=${currentPage}&pageSize=${pageSize}&filter=${filter}`);
        const data = await response.json();

        if (data.activities && Array.isArray(data.activities)) {
          setActivities(data.activities);
          setTotalActivities(data.totalCount || data.activities.length);
          setTotalPages(Math.ceil((data.totalCount || data.activities.length) / pageSize));
        } else {
          setActivities([]);
          setTotalActivities(0);
          setTotalPages(1);
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching activities:', err);
        const errorMessage = err && typeof err === 'object' && 'message' in err
          ? err.message
          : 'Failed to load activities';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [currentPage, pageSize, filter]);

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Loading state
  if (loading && activities.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <BackTitle title="Recent Activities" href="/dashboard" ariaLabel="Back to Dashboard" />
        </div>
        <div className="themed-card p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <BackTitle title="Recent Activities" href="/dashboard" ariaLabel="Back to Dashboard" />
        </div>
        <div className="alert-error px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-6 sm:mb-8">
        <BackTitle title="Recent Activities" href="/dashboard" ariaLabel="Back to Dashboard" />
      </div>

      <div className="themed-card p-2 sm:p-6">
        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 mb-6">
          <div className="flex flex-row gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'btn-neutral'
              }`}
              aria-label="Show All Activities"
            >
              {/* AdjustmentsHorizontal icon: icon-only on mobile, icon+text on desktop */}
              <svg className="h-5 w-5 block sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
              <span className="hidden sm:inline-flex items-center">
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
                </svg>
                All
              </span>
            </button>
            <button
              onClick={() => setFilter('Loan')}
              className={`p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center ${
                filter === 'Loan' ? 'filter-chip-active-blue' : 'filter-chip'
              }`}
              aria-label="Show Loan Activities"
            >
              {/* AdjustmentsHorizontal icon: icon-only on mobile, icon+text on desktop */}
              <svg className="h-5 w-5 block sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
              <span className="hidden sm:inline-flex items-center">
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
                </svg>
                Loans
              </span>
            </button>
            <button
              onClick={() => setFilter('Chit Fund')}
              className={`p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center ${
                filter === 'Chit Fund' ? 'bg-blue-600 text-white' : 'btn-neutral'
              }`}
              aria-label="Show Chit Fund Activities"
            >
              {/* AdjustmentsHorizontal icon: icon-only on mobile, icon+text on desktop */}
              <svg className="h-5 w-5 block sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
              <span className="hidden sm:inline-flex items-center">
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
                </svg>
                Chit Funds
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm text-gray-700 dark:text-theme-secondary">Show:</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="border rounded p-1 text-sm w-full sm:w-auto"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Activities Table */}
        <div className="themed-card overflow-x-auto w-full">
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-theme-secondary mb-2">No activities found</h3>
              <p className="text-gray-500">There are no recent activities to display.</p>
            </div>
          ) : (
            <div className="table-shell" style={{maxWidth: '85vw'}}>
              <table className="themed-table text-xs sm:text-sm" style={{minWidth: '600px'}}>
              <thead className="bg-gray-50 dark:bg-surface-elevated">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">
                    Action
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">
                    Details
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => {
                  // Generate link based on entity type
                  let entityLink = '#';
                  if (activity.entityType === 'loan' && activity.entityId) {
                    entityLink = `/loans/${activity.entityId}`;
                  } else if (activity.entityType === 'chitFund' && activity.entityId) {
                    entityLink = `/chit-funds/${activity.entityId}`;
                  }

                  return (
                    <tr
                      key={activity.id}
                      className="hover:bg-gray-50 dark:hover:bg-surface-hover cursor-pointer"
                      onClick={e => {
                        // Prevent navigation when clicking on action buttons/links in the Actions column
                        if (
                          e.target instanceof HTMLButtonElement ||
                          (e.target instanceof HTMLElement && e.target.closest('button')) ||
                          (e.target instanceof HTMLElement && e.target.closest('a'))
                        ) {
                          return;
                        }
                        if (entityLink !== '#') {
                          window.location.href = entityLink;
                        }
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          activity.type === 'Chit Fund' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {activity.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">
                        {activity.action}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {activity.details}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">
                        {activity.amount ? formatCurrency(activity.amount) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {activity.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {entityLink !== '#' ? (
                          <Link
                            href={entityLink}
                            className="text-blue-600 hover:text-blue-900"
                            onClick={e => e.stopPropagation()}
                          >
                            View
                          </Link>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-6 gap-2 sm:gap-0">
            <div className="text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">
              Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * pageSize, totalActivities)}</span> of{' '}
              <span className="font-medium">{totalActivities}</span> results
            </div>
            <div className="flex flex-row gap-2 flex-wrap">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'btn-neutral'
                }`}
                aria-label="Previous Page"
              >
                {/* ChevronLeft icon: icon-only on mobile, icon+text on desktop */}
                <svg className="h-5 w-5 block sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline-flex items-center">Previous</span>
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => handlePageChange(i + 1)}
                  className={`p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center ${
                    currentPage === i + 1
                      ? 'bg-blue-600 text-white'
                      : 'btn-neutral'
                  }`}
                  aria-label={`Go to page ${i + 1}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'btn-neutral'
                }`}
                aria-label="Next Page"
              >
                {/* ChevronRight icon: icon-only on mobile, icon+text on desktop */}
                <svg className="h-5 w-5 block sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                <span className="hidden sm:inline-flex items-center">Next</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
