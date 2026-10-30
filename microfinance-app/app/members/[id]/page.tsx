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
import SwipeableTabs from '../../components/SwipeableTabs';
import DueAccountCard from '../../components/dues/DueAccountCard';

interface ChitFundMember {
  id: number;
  joinDate: string;
  contribution: number;
  missedContributions?: number;
  pendingAmount?: number;
  pendingMonths?: number[];
  partialMonths?: { month: number; balance: number }[];
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
  installmentAmount?: number;
  nextPaymentDate?: string | null;
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
  const [activeTab, setActiveTab] = useState<"details" | "dues" | "chit-funds" | "loans" | "payments">("details");

  // Pending dues (overdue + next 30 days), same calculation as the Dues Tracker
  const [dues, setDues] = useState(null);
  const [duesLoading, setDuesLoading] = useState(true);
  const [duesError, setDuesError] = useState(null);

  const fetchDues = async () => {
    try {
      setDuesLoading(true);
      setDuesError(null);
      setDues(await memberAPI.getDues(Number(memberId), 30));
    } catch (err: any) {
      setDuesError(err.message || 'Failed to load pending dues');
    } finally {
      setDuesLoading(false);
    }
  };

  // Payment history (contributions + repayments), loaded when the tab is first opened
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyKind, setHistoryKind] = useState('');
  const [historyAccount, setHistoryAccount] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRequested, setHistoryRequested] = useState(false);

  useEffect(() => {
    if (activeTab === 'payments') setHistoryRequested(true);
  }, [activeTab]);

  useEffect(() => {
    if (!historyRequested || !memberId) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    memberAPI
      .getPaymentHistory(Number(memberId), { page: historyPage, pageSize: 20, kind: historyKind, account: historyAccount })
      .then((data) => !cancelled && setHistory(data))
      .catch((err) => !cancelled && setHistoryError(err.message || 'Failed to load payment history'))
      .finally(() => !cancelled && setHistoryLoading(false));
    return () => {
      cancelled = true;
    };
  }, [historyRequested, memberId, historyPage, historyKind, historyAccount]);

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
      fetchDues();
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

      {/* Dues summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 sm:mb-6">
        {[
          { label: 'Overdue', value: dues ? formatCurrency(dues.summary.overdueAmount) : '—', hint: dues ? `${dues.summary.overdueAccounts} account${dues.summary.overdueAccounts === 1 ? '' : 's'}` : '', tone: 'border-red-500', text: (dues?.summary.overdueAmount ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-theme-primary' },
          { label: 'Due in next 7 days', value: dues ? formatCurrency(dues.summary.dueSoonAmount) : '—', hint: 'Includes today', tone: 'border-amber-500', text: 'text-amber-600 dark:text-amber-400' },
          { label: 'Total outstanding', value: dues ? formatCurrency(dues.summary.totalOutstanding) : '—', hint: 'Overdue + next 30 days', tone: 'border-blue-500', text: 'text-gray-900 dark:text-theme-primary' },
          { label: 'Last payment', value: dues?.lastPayment ? formatCurrency(dues.lastPayment.amount) : dues ? 'None' : '—', hint: dues?.lastPayment ? formatDate(dues.lastPayment.date) : '', tone: 'border-gray-400', text: 'text-gray-900 dark:text-theme-primary' },
        ].map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setActiveTab(t.label === 'Last payment' ? 'payments' : 'dues')}
            className={`themed-card p-3 sm:p-4 border-l-4 ${t.tone} text-left hover:shadow-md transition-shadow`}
          >
            <p className="text-xs font-medium text-gray-500 dark:text-theme-muted">{t.label}</p>
            {duesLoading && !dues ? (
              <div className="h-6 mt-1 w-20 rounded bg-gray-100 dark:bg-surface-elevated animate-pulse" />
            ) : (
              <p className={`text-lg sm:text-xl font-bold tabular-nums ${t.text}`}>{t.value}</p>
            )}
            <p className="text-[11px] text-gray-400 dark:text-theme-muted mt-0.5">{t.hint}</p>
          </button>
        ))}
      </div>

      <div>
      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-surface-border mb-4 sm:mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto" aria-label="Member tabs">
          {(["details", "dues", "chit-funds", "loans", "payments"] as const).map((tab) => {
            const labels = {
              "details": "Member Details",
              "dues": `Dues${dues ? ` (${dues.accounts.length})` : ''}`,
              "chit-funds": `Chit Funds (${member._count.chitFundMembers})`,
              "loans": `Loans (${member._count.loans})`,
              "payments": "Payments",
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

      {/* Tab panels (swipeable on mobile) */}
      <SwipeableTabs
        tabs={["details", "dues", "chit-funds", "loans", "payments"] as const}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {/* Details panel */}
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

        {/* Dues panel */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-500 dark:text-theme-muted">
              Unpaid loan installments and chit contributions — overdue and due in the next 30 days.
            </p>
            <button onClick={fetchDues} disabled={duesLoading} className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
              {duesLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {duesError ? (
            <div className="alert-error flex items-center justify-between gap-3">
              <span>{duesError}</span>
              <button onClick={fetchDues} className="underline text-sm">Retry</button>
            </div>
          ) : duesLoading && !dues ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="themed-card h-20 animate-pulse" />)}</div>
          ) : !dues || dues.accounts.length === 0 ? (
            <div className="themed-card p-8 text-center">
              <p className="font-medium text-gray-700 dark:text-theme-secondary">All caught up</p>
              <p className="text-sm text-gray-500 dark:text-theme-muted mt-1">Nothing overdue or due in the next 30 days.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {dues.accounts.map((a) => (
                <DueAccountCard key={a.key} account={a} showMember={false} defaultOpen={dues.accounts.length === 1} />
              ))}
            </ul>
          )}
        </div>

        {/* Chit Funds panel */}
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
                        {(membership.pendingMonths?.length ?? 0) > 0 && (
                          <div className="text-xs text-gray-400 dark:text-theme-muted mt-0.5">
                            Months: {membership.pendingMonths!.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`text-sm ${(membership.pendingAmount ?? 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-900 dark:text-theme-primary'}`}>
                          {formatCurrency(membership.pendingAmount ?? 0)}
                        </span>
                        {(membership.partialMonths?.length ?? 0) > 0 && (
                          <div className="text-xs text-gray-400 dark:text-theme-muted mt-0.5">
                            Incl. {formatCurrency(membership.partialMonths!.reduce((sum, p) => sum + p.balance, 0))} balance
                            {' '}({membership.partialMonths!.map(p => `Month ${p.month}`).join(', ')})
                          </div>
                        )}
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

        {/* Loans panel */}
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
                    {['Loan Type', 'Amount', 'Remaining', 'Pending', 'Overdue Amount', 'Missed Payments', 'Next Due Date', 'Installment Amount', 'Status', 'Disbursement Date', 'Actions'].map((h) => (
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
                        {(() => {
                          const acct = dues?.accounts.find((a) => a.kind === 'loan' && a.entityId === loan.id);
                          if (!dues) return <span className="text-sm text-gray-400">…</span>;
                          if (!acct) return <span className="text-sm text-gray-500 dark:text-theme-muted">—</span>;
                          return (
                            <button type="button" onClick={() => setActiveTab('dues')} className="text-left">
                              <span className={`text-sm font-semibold ${acct.overdueAmount > 0 ? 'text-red-600' : 'text-gray-900 dark:text-theme-primary'}`}>
                                {formatCurrency(acct.totalOutstanding)}
                              </span>
                              <span className="block text-xs text-gray-400 dark:text-theme-muted">
                                {acct.periods.length} payment{acct.periods.length === 1 ? '' : 's'}{acct.maxDaysOverdue > 0 ? ` · ${acct.maxDaysOverdue}d late` : ''}
                              </span>
                            </button>
                          );
                        })()}
                      </td>
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
                        {loan.nextPaymentDate ? (
                          <span className={`text-sm ${loan.status === 'Active' && new Date(loan.nextPaymentDate) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-900 dark:text-theme-primary'}`}>
                            {formatDate(loan.nextPaymentDate)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-theme-muted">-</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">
                        {loan.loanType === 'Reducing Balance' ? 'Dynamic' : formatCurrency(loan.installmentAmount || 0)}
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
        {/* Payments panel */}
        <div className="themed-card overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">Payment History</h2>
              {history && (
                <p className="text-xs text-gray-500 dark:text-theme-muted">
                  {history.totalCount} payment{history.totalCount === 1 ? '' : 's'} · {formatCurrency(history.totalAmount)} received
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={historyKind}
                onChange={(e) => { setHistoryKind(e.target.value); setHistoryAccount(''); setHistoryPage(1); }}
                className="themed-input text-sm"
                aria-label="Payment type"
              >
                <option value="">All payments</option>
                <option value="contribution">Chit contributions</option>
                <option value="repayment">Loan repayments</option>
              </select>
              <select
                value={historyAccount}
                onChange={(e) => { setHistoryAccount(e.target.value); setHistoryPage(1); }}
                className="themed-input text-sm"
                aria-label="Account"
              >
                <option value="">All accounts</option>
                {historyKind !== 'repayment' && member.chitFundMembers.map((m) => (
                  <option key={`chit-${m.chitFund.id}`} value={`chit-${m.chitFund.id}`}>{m.chitFund.name}</option>
                ))}
                {historyKind !== 'contribution' && member.loans.map((l) => (
                  <option key={`loan-${l.id}`} value={`loan-${l.id}`}>Loan #{l.id} · {l.loanType}</option>
                ))}
              </select>
            </div>
          </div>
          {historyError ? (
            <div className="alert-error m-4">{historyError}</div>
          ) : historyLoading && !history ? (
            <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 rounded bg-gray-100 dark:bg-surface-elevated animate-pulse" />)}</div>
          ) : !history || history.items.length === 0 ? (
            <p className="text-gray-500 dark:text-theme-muted text-center py-8 text-sm">No payments recorded{historyKind || historyAccount ? ' for this filter' : ' yet'}.</p>
          ) : (
            <>
              <div className={`overflow-x-auto ${historyLoading ? 'opacity-60' : ''}`}>
                <table className="min-w-full divide-y divide-surface-border text-xs sm:text-sm">
                  <thead className="bg-gray-50 dark:bg-surface-elevated">
                    <tr>
                      {['Date', 'Type', 'Account', 'Period', 'Amount', 'Balance', 'Collected by', ''].map((h) => (
                        <th key={h} scope="col" className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.items.map((item) => (
                      <tr key={item.key} className="hover:bg-gray-50 dark:hover:bg-surface-hover">
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-gray-900 dark:text-theme-primary">{formatDate(item.date)}</td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${item.kind === 'repayment' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'}`}>
                            {item.kind === 'repayment' ? 'Repayment' : 'Contribution'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-gray-900 dark:text-theme-primary">{item.accountName}</td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-gray-700 dark:text-theme-secondary">
                          {item.periodLabel}
                          {item.detail && <span className="block text-[11px] text-gray-400 dark:text-theme-muted max-w-[200px] truncate" title={item.detail}>{item.detail}</span>}
                        </td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap font-semibold text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(item.amount)}</td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap tabular-nums">
                          {item.balance > 0 ? <span className="text-red-600">{formatCurrency(item.balance)}</span> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-gray-700 dark:text-theme-secondary">{item.collectedBy || '—'}</td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                          <Link href={item.href} className="text-blue-600 hover:text-blue-900 dark:text-blue-400">Open</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {history.totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 dark:border-surface-border text-sm">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage === 1 || historyLoading}
                    className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-surface-border disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-gray-600 dark:text-theme-secondary">Page {history.page} of {history.totalPages}</span>
                  <button
                    onClick={() => setHistoryPage((p) => Math.min(history.totalPages, p + 1))}
                    disabled={historyPage >= history.totalPages || historyLoading}
                    className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-surface-border disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </SwipeableTabs>
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
