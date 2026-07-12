// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { memberAPI } from '../../../lib/api';
import {

  EditButton,
  ActionButtonGroup
} from '../../components/buttons/ActionButtons';
import BackTitle from '../../components/common/BackTitle';

interface ChitFundMember {
  id: number;
  joinDate: string;
  contribution: number;
  missedContributions?: number;
  pendingAmount?: number;
  chitFund: {
    id: number;
    name: string;
    status: string;
    currentMonth: number;
    duration: number;
  };
}

interface Loan {
  id: number;
  loanType: string;
  amount: number;
  status: string;
  disbursementDate: string;
  remainingAmount: number;
  overdueAmount: number;
  missedPayments: number;
}

interface GlobalMember {
  id: number;
  name: string;
  contact: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  chitFundMembers: ChitFundMember[];
  loans: Loan[];
  _count: {
    chitFundMembers: number;
    loans: number;
  };
}

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id;

  const [member, setMember] = useState<GlobalMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For exporting member data
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Add state for delete modal and error
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<"details" | "chit-funds" | "loans">("details");

  useEffect(() => {
    const fetchMember = async () => {
      try {
        setLoading(true);
        const data = await memberAPI.getById(Number(memberId));
        setMember(data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching member:', err);
        setError(err.message || 'Failed to load member details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (memberId) {
      fetchMember();
    }
  }, [memberId]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date(dateString).toLocaleDateString('en-IN', options);
  };

  // Handle exporting member data
  const handleExportMember = async () => {
    if (!member) return;

    try {
      setIsExporting(true);
      setExportError(null);

      const response = await fetch('/api/members/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberIds: [member.id] }),
      });

      if (!response.ok) {
        throw new Error('Failed to export member');
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition ?
        contentDisposition.split('filename=')[1].replace(/"/g, '') :
        'member_export.xlsx';

      // Convert the response to a blob
      const blob = await response.blob();

      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Error exporting member:', error);
      setExportError(error.message || 'Failed to export member');
    } finally {
      setIsExporting(false);
    }
  };

  // Handler for delete button (open modal)
  const handleDeleteMember = () => {
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  // Confirm delete action
  const confirmDeleteMember = async () => {
    if (!member) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await memberAPI.delete(member.id);
      router.push('/members');
    } catch (error: any) {
      setDeleteError(error.message || 'Failed to delete member.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-700 dark:text-theme-secondary">Loading member details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert-error px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">Member Not Found</p>
          <p>The member you are looking for does not exist or has been removed.</p>
          <Link href="/members" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            Back to Members
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page header */}
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
        <BackTitle title="Member Information" href="/members" ariaLabel="Back to Members" />
        <div className="flex flex-row flex-wrap gap-1 sm:gap-2 w-auto items-center">
          <button
            onClick={handleDeleteMember}
            aria-label="Delete Member"
            className="p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center bg-red-600 text-white hover:bg-red-700 sm:px-4 sm:py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDeleting}
          >
            <svg className="h-5 w-5 block sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 7h12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m2 0v13a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" /></svg>
            <span className="hidden sm:inline-flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 7h12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m2 0v13a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" /></svg>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </span>
          </button>
          <Link href={`/members/${member.id}/edit`} aria-label="Edit Member"
            className="p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center bg-yellow-500 text-white hover:bg-yellow-600 sm:px-4 sm:py-2">
            <svg className="h-5 w-5 block sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path fill="currentColor" d="M16.862 3.487a2.25 2.25 0 113.182 3.182l-9.193 9.193a2.25 2.25 0 01-.708.471l-3.25 1.3a.75.75 0 01-.97-.97l1.3-3.25a2.25 2.25 0 01.471-.708l9.193-9.193zM19.5 6.75L17.25 4.5" />
            </svg>
            <span className="hidden sm:inline-flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path fill="currentColor" d="M16.862 3.487a2.25 2.25 0 113.182 3.182l-9.193 9.193a2.25 2.25 0 01-.708.471l-3.25 1.3a.75.75 0 01-.97-.97l1.3-3.25a2.25 2.25 0 01.471-.708l9.193-9.193zM19.5 6.75L17.25 4.5" />
              </svg>
              Edit
            </span>
          </Link>
        </div>
      </div>

      {/* Member summary — always visible */}
      <div className="themed-card p-4 sm:p-5 mb-4 sm:mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold">{member.name}</h2>
            <p className="text-gray-500 dark:text-theme-secondary text-sm mt-0.5">{member.contact}</p>
          </div>
          <div className="flex flex-wrap gap-3 text-right">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Chit Funds</div>
              <div className="text-lg font-bold text-blue-600">{member._count.chitFundMembers}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Loans</div>
              <div className="text-lg font-bold text-green-600">{member._count.loans}</div>
            </div>
          </div>
        </div>
      </div>

      <div>
      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-surface-border mb-4 sm:mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto" aria-label="Member tabs">
          {(["details", "chit-funds", "loans"] as const).map((tab) => {
            const labels = {
              "details": "Member Details",
              "chit-funds": `Chit Funds (${member._count.chitFundMembers})`,
              "loans": `Loans (${member._count.loans})`,
            };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors duration-150 whitespace-nowrap focus:outline-none ${
                  isActive
                    ? "border-green-600 text-green-700 dark:text-green-400 dark:border-green-400"
                    : "border-transparent text-gray-500 dark:text-theme-muted hover:text-gray-700 dark:hover:text-theme-secondary hover:border-gray-300"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Member Details tab */}
      {activeTab === "details" && (
        <div className="themed-card p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <p className="text-gray-500 dark:text-theme-secondary text-xs uppercase tracking-wider mb-1">Name</p>
              <p className="text-base sm:text-lg font-semibold">{member.name}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-theme-secondary text-xs uppercase tracking-wider mb-1">Contact</p>
              <p className="text-base sm:text-lg">{member.contact}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-theme-secondary text-xs uppercase tracking-wider mb-1">Email</p>
              <p className="text-base sm:text-lg">{member.email || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-theme-secondary text-xs uppercase tracking-wider mb-1">Address</p>
              <p className="text-base sm:text-lg">{member.address || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-theme-secondary text-xs uppercase tracking-wider mb-1">Member Since</p>
              <p className="text-base sm:text-lg">{formatDate(member.createdAt)}</p>
            </div>
          </div>
          {member.notes && (
            <div className="mt-6">
              <p className="text-gray-500 dark:text-theme-secondary text-xs uppercase tracking-wider mb-1">Notes</p>
              <p className="text-base sm:text-lg mt-1 p-3 bg-gray-50 dark:bg-surface-elevated rounded">{member.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Chit Funds tab */}
      {activeTab === "chit-funds" && (
        <div className="themed-card overflow-hidden">
          <div className="p-4 sm:p-6 border-b flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-semibold">Chit Funds ({member._count.chitFundMembers})</h2>
            <Link href={`/members/${member.id}/assign-chit-fund`} className="text-blue-600 hover:text-blue-900 text-sm">
              + Assign to Chit Fund
            </Link>
          </div>
          {member.chitFundMembers.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">This member is not part of any chit funds yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-xs sm:text-sm">
                <thead className="bg-gray-50 dark:bg-surface-elevated">
                  <tr>
                    {['Chit Fund', 'Status', 'Progress', 'Contribution', 'Missed', 'Pending Amount', 'Join Date', 'Actions'].map((h) => (
                      <th key={h} scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {member.chitFundMembers.map((membership) => (
                    <tr key={membership.id} className="hover:bg-gray-50 dark:hover:bg-surface-hover">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-blue-600">{membership.chitFund.name}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          membership.chitFund.status === 'Active' ? 'bg-green-100 text-green-800' :
                          membership.chitFund.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>{membership.chitFund.status}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">
                        Month {membership.chitFund.currentMonth} of {membership.chitFund.duration}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">{formatCurrency(membership.contribution)}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`text-sm ${(membership.missedContributions ?? 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-900 dark:text-theme-primary'}`}>
                          {membership.missedContributions ?? 0}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`text-sm ${(membership.pendingAmount ?? 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-900 dark:text-theme-primary'}`}>
                          {formatCurrency(membership.pendingAmount ?? 0)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">{formatDate(membership.joinDate)}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium">
                        <Link href={`/chit-funds/${membership.chitFund.id}/members/${membership.id}/contributions`} className="text-blue-600 hover:text-blue-900">
                          View Contributions
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Loans tab */}
      {activeTab === "loans" && (
        <div className="themed-card overflow-hidden">
          <div className="p-4 sm:p-6 border-b flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-semibold">Loans ({member._count.loans})</h2>
            <Link href={`/loans/new?borrowerId=${member.id}`} className="text-blue-600 hover:text-blue-900 text-sm">
              + Create New Loan
            </Link>
          </div>
          {member.loans.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">This member has no loans yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-xs sm:text-sm">
                <thead className="bg-gray-50 dark:bg-surface-elevated">
                  <tr>
                    {['Loan Type', 'Amount', 'Remaining', 'Overdue Amount', 'Missed Payments', 'Status', 'Disbursement Date', 'Actions'].map((h) => (
                      <th key={h} scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {member.loans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-surface-hover">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-blue-600">{loan.loanType}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">{formatCurrency(loan.amount)}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">{formatCurrency(loan.remainingAmount)}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`text-sm ${loan.overdueAmount > 0 ? 'text-red-600 font-semibold' : 'text-gray-900 dark:text-theme-primary'}`}>
                          {formatCurrency(loan.overdueAmount || 0)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`text-sm ${loan.missedPayments > 0 ? 'text-red-600 font-semibold' : 'text-gray-900 dark:text-theme-primary'}`}>
                          {loan.missedPayments || 0}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          loan.status === 'Active' ? 'bg-green-100 text-green-800' :
                          loan.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>{loan.status}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">{formatDate(loan.disbursementDate)}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium">
                        <Link href={`/loans/${loan.id}`} className="text-blue-600 hover:text-blue-900">View Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay flex items-center justify-center z-50">
          <div className="themed-card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-red-700 mb-4">Confirm Deletion</h2>
            <p className="mb-4">Are you sure you want to delete this member? This action cannot be undone.</p>
            <div className="mb-6 bg-yellow-50 border border-yellow-400 text-yellow-700 p-3 rounded">
              <p className="font-bold">Warning:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>Members associated with chit funds or loans cannot be deleted</li>
                <li>You will need to remove the member from all chit funds and loans first</li>
              </ul>
            </div>
            {deleteError && (
              <div className="mb-4 alert-error px-4 py-3 rounded">
                <p>{deleteError}</p>
              </div>
            )}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteError(null); }}
                className="btn-neutral px-4 py-2 rounded-lg transition duration-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMember}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
