// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { memberAPI } from '../../../lib/api';
import {

  EditButton,
  BackButton,
  ActionButtonGroup
} from '../../components/buttons/ActionButtons';

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
            <p className="text-gray-600">Loading member details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
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
    <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8 max-w-screen-xl w-full">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-700">Member Information</h1>
        <div className="flex flex-row flex-wrap gap-1 sm:gap-2 w-auto items-center">
          <button
            onClick={handleDeleteMember}
            aria-label="Delete Member"
            className="p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center bg-red-600 text-white hover:bg-red-700 sm:px-4 sm:py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDeleting}
          >
            <svg className="h-5 w-5 block sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            <span className="hidden sm:inline-flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </span>
          </button>
          {/* Edit Button: icon only on mobile, icon+text on desktop */}
          <Link href={`/members/${member.id}/edit`} aria-label="Edit Member"
            className="p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center bg-yellow-500 text-white hover:bg-yellow-600 sm:px-4 sm:py-2">
            <svg className="h-5 w-5 block sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 11l6 6M3 21h6v-6l9-9a2.828 2.828 0 10-4-4l-9 9z"></path></svg>
            <span className="hidden sm:inline-flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 11l6 6M3 21h6v-6l9-9a2.828 2.828 0 10-4-4l-9 9z"></path></svg>
              Edit
            </span>
          </Link>
          {/* Back Button: icon only on mobile, icon+text on desktop */}
          <Link href="/members" aria-label="Back to Members"
            className="p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center bg-gray-200 text-gray-700 hover:bg-gray-300 sm:px-4 sm:py-2">
            <svg className="h-5 w-5 block sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            <span className="hidden sm:inline-flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
              Back
            </span>
          </Link>
        </div>
      </div>

      {/* Member Details */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8">
        <h2 className="text-lg sm:text-xl font-semibold text-blue-700 mb-4">Member Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <p className="text-gray-600 text-xs sm:text-sm">Contact</p>
            <p className="text-base sm:text-lg">{member.contact}</p>
          </div>
          <div>
            <p className="text-gray-600 text-xs sm:text-sm">Email</p>
            <p className="text-base sm:text-lg">{member.email || '-'}</p>
          </div>
          <div>
            <p className="text-gray-600 text-xs sm:text-sm">Address</p>
            <p className="text-base sm:text-lg">{member.address || '-'}</p>
          </div>
          <div>
            <p className="text-gray-600 text-xs sm:text-sm">Member Since</p>
            <p className="text-base sm:text-lg">{formatDate(member.createdAt)}</p>
          </div>
        </div>
        {member.notes && (
          <div className="mt-6">
            <p className="text-gray-600 text-xs sm:text-sm">Notes</p>
            <p className="text-base sm:text-lg mt-1 p-3 bg-gray-50 rounded">{member.notes}</p>
          </div>
        )}
      </div>

      {/* Chit Funds */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700">Chit Funds ({member._count.chitFundMembers})</h2>
          <Link href={`/members/${member.id}/assign-chit-fund`} className="text-blue-600 hover:text-blue-900 text-xs sm:text-sm">
            + Assign to Chit Fund
          </Link>
        </div>
        {member.chitFundMembers.length === 0 ? (
          <p className="text-gray-500 text-center py-4 text-xs sm:text-sm">This member is not part of any chit funds yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chit Fund
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contribution
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Missed Contributions
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pending Amount
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Join Date
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {member.chitFundMembers.map((membership) => (
                  <tr key={membership.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">{membership.chitFund.name}</div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        membership.chitFund.status === 'Active' ? 'bg-green-100 text-green-800' :
                        membership.chitFund.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {membership.chitFund.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        Month {membership.chitFund.currentMonth} of {membership.chitFund.duration}
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(membership.contribution)}</div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className={`text-sm ${(membership.missedContributions ?? 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                        {membership.missedContributions ?? 0}
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className={`text-sm ${(membership.pendingAmount ?? 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                        {formatCurrency(membership.pendingAmount ?? 0)}
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(membership.joinDate)}</div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-sm font-medium">
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

      {/* Loans */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-blue-700">Loans ({member._count.loans})</h2>
          <Link href={`/loans/new?borrowerId=${member.id}`} className="text-blue-600 hover:text-blue-900 text-xs sm:text-sm">
            + Create New Loan
          </Link>
        </div>
        {member.loans.length === 0 ? (
          <p className="text-gray-500 text-center py-4 text-xs sm:text-sm">This member has no loans yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan Type
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remaining
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overdue Amount
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Missed Payments
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Disbursement Date
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {member.loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">{loan.loanType}</div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(loan.amount)}</div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(loan.remainingAmount)}</div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className={`text-sm ${loan.overdueAmount > 0 ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                        {formatCurrency(loan.overdueAmount || 0)}
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className={`text-sm ${loan.missedPayments > 0 ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                        {loan.missedPayments || 0}
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        loan.status === 'Active' ? 'bg-green-100 text-green-800' :
                        loan.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(loan.disbursementDate)}</div>
                    </td>
                    <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-sm font-medium">
                      <Link href={`/loans/${loan.id}`} className="text-blue-600 hover:text-blue-900">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
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
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p>{deleteError}</p>
              </div>
            )}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteError(null); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
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
