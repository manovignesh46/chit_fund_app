'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { memberAPI } from '@/lib/api';
import dynamic from 'next/dynamic';
import { MembersListSkeleton } from '../components/skeletons/ListSkeletons';

interface GlobalMember {
  id: number;
  name: string;
  contact: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    chitFundMembers: number;
    loans: number;
  };
}

// This component has been optimized for performance
export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<GlobalMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For adding/editing member
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentMember, setCurrentMember] = useState<Partial<GlobalMember>>({
    id: 0,
    name: '',
    contact: '',
    email: '',
    address: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // For deleting member
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // For bulk deleting members
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [bulkDeleteSuccess, setBulkDeleteSuccess] = useState<string | null>(null);

  // For selecting members
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // For pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // For assigning members to chit fund
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [chitFunds, setChitFunds] = useState<{id: number, name: string, monthlyContribution: number}[]>([]);
  const [selectedChitFund, setSelectedChitFund] = useState<string>('');
  const [contribution, setContribution] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, [currentPage, pageSize]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      console.log('Fetching members...');

      // Add a small delay to ensure the API route is ready
      await new Promise(resolve => setTimeout(resolve, 500));

      const data = await memberAPI.getAll(currentPage, pageSize);
      console.log('Members data received:', data);

      // Check if the response has pagination metadata
      if (data.members && Array.isArray(data.members)) {
        setMembers(data.members);
        setTotalPages(data.totalPages || Math.ceil(data.totalCount / pageSize));
      } else {
        // Fallback for backward compatibility
        setMembers(Array.isArray(data) ? data : []);
        setTotalPages(1);
      }

      // Clear selected members when page changes
      setSelectedMembers([]);
      setSelectAll(false);

      setError(null);
    } catch (err: any) {
      console.error('Error fetching members:', err);
      setError(err.message || 'Failed to load members. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentMember({
      ...currentMember,
      [name]: value,
    });
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    if (!currentMember.name?.trim()) {
      errors.name = 'Name is required';
    }

    if (!currentMember.contact?.trim()) {
      errors.contact = 'Contact information is required';
    } else if (!/^[0-9+\s-]{10,15}$/.test(currentMember.contact.trim())) {
      errors.contact = 'Please enter a valid phone number';
    }

    if (currentMember.email && !/\S+@\S+\.\S+/.test(currentMember.email)) {
      errors.email = 'Please enter a valid email address';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddEditMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && currentMember.id) {
        // Update existing member
        await memberAPI.update(currentMember.id, currentMember);
      } else {
        // Create new member
        await memberAPI.create(currentMember);
      }

      // Reset form and refresh members list
      setCurrentMember({
        id: 0,
        name: '',
        contact: '',
        email: '',
        address: '',
        notes: '',
      });
      setShowForm(false);
      setIsEditing(false);
      fetchMembers();
    } catch (error: any) {
      console.error('Error saving member:', error);
      setFormErrors({ submit: error.message || 'Failed to save member. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMember = (member: GlobalMember) => {
    setCurrentMember(member);
    setIsEditing(true);
    setShowForm(true);
    setFormErrors({});
  };

  const handleDeleteMember = (id: number) => {
    setMemberToDelete(id);
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await memberAPI.delete(memberToDelete);

      // Remove the deleted member from the state
      setMembers(members.filter(m => m.id !== memberToDelete));

      // Remove from selected members if present
      if (selectedMembers.includes(memberToDelete)) {
        setSelectedMembers(selectedMembers.filter(id => id !== memberToDelete));
        if (selectAll) setSelectAll(false);
      }

      // Close the modal
      setShowDeleteModal(false);
      setMemberToDelete(null);
    } catch (error: any) {
      console.error('Error deleting member:', error);
      setDeleteError(error.message || 'Failed to delete member. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle selecting/deselecting a member
  const handleSelectMember = (memberId: number) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== memberId));
      setSelectAll(false);
    } else {
      setSelectedMembers([...selectedMembers, memberId]);
      if (selectedMembers.length + 1 === members.length) {
        setSelectAll(true);
      }
    }
  };

  // Handle bulk delete members
  const handleBulkDeleteClick = () => {
    if (selectedMembers.length === 0) return;
    setShowBulkDeleteModal(true);
    setBulkDeleteError(null);
    setBulkDeleteSuccess(null);
  };

  // Confirm bulk delete members
  const confirmBulkDeleteMembers = async () => {
    if (selectedMembers.length === 0) return;

    setIsBulkDeleting(true);
    setBulkDeleteError(null);
    setBulkDeleteSuccess(null);

    try {
      let successCount = 0;
      let errorCount = 0;

      // Process each selected member
      for (const memberId of selectedMembers) {
        try {
          await memberAPI.delete(memberId);
          successCount++;
        } catch (error) {
          console.error(`Error deleting member ${memberId}:`, error);
          errorCount++;
        }
      }

      // Update the members list
      if (successCount > 0) {
        setMembers(members.filter(m => !selectedMembers.includes(m.id)));
        setBulkDeleteSuccess(`Successfully deleted ${successCount} member${successCount > 1 ? 's' : ''}.`);

        // Clear selection
        setSelectedMembers([]);
        setSelectAll(false);

        // Close modal after a delay
        setTimeout(() => {
          setShowBulkDeleteModal(false);
        }, 2000);
      }

      if (errorCount > 0) {
        setBulkDeleteError(`Failed to delete ${errorCount} member${errorCount > 1 ? 's' : ''}. They may be associated with chit funds or loans.`);
      }

    } catch (error: any) {
      console.error('Error bulk deleting members:', error);
      setBulkDeleteError(error.message || 'Failed to delete members. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Handle select all members
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedMembers([]);
      setSelectAll(false);
    } else {
      setSelectedMembers(members.map(member => member.id));
      setSelectAll(true);
    }
  };

  // Open assign modal and fetch chit funds
  const handleOpenAssignModal = async () => {
    if (selectedMembers.length === 0) return;

    setShowAssignModal(true);
    setSelectedChitFund('');
    setContribution('');
    setAssignError(null);
    setAssignSuccess(null);

    try {
      const response = await fetch('/api/chit-funds');
      if (!response.ok) {
        throw new Error('Failed to fetch chit funds');
      }

      const data = await response.json();
      setChitFunds(data);

    } catch (error: any) {
      console.error('Error fetching chit funds:', error);
      setAssignError(error.message || 'Failed to fetch chit funds. Please try again.');
    }
  };

  // Handle chit fund selection
  const handleChitFundChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fundId = e.target.value;
    setSelectedChitFund(fundId);

    if (fundId) {
      const fund = chitFunds.find(f => f.id === parseInt(fundId));
      if (fund) {
        setContribution(fund.monthlyContribution.toString());
      }
    } else {
      setContribution('');
    }
  };

  // Validate assign form
  const validateAssignForm = () => {
    const errors: {[key: string]: string} = {};

    if (!selectedChitFund) {
      errors.chitFund = 'Please select a chit fund';
    }

    if (!contribution) {
      errors.contribution = 'Contribution amount is required';
    } else if (isNaN(Number(contribution)) || Number(contribution) <= 0) {
      errors.contribution = 'Contribution must be a positive number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle assigning members to chit fund
  const handleAssignMembers = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAssignForm()) {
      return;
    }

    setIsAssigning(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      let successCount = 0;
      let errorCount = 0;

      // Process each selected member
      for (const memberId of selectedMembers) {
        const response = await fetch(`/api/chit-funds/${selectedChitFund}/members`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            globalMemberId: memberId,
            contribution: Number(contribution),
          }),
        });

        if (response.ok) {
          successCount++;
        } else {
          const errorData = await response.json();
          console.error('Error assigning member:', errorData);
          errorCount++;
        }
      }

      // Show appropriate message
      if (successCount > 0) {
        setAssignSuccess(`Successfully assigned ${successCount} member${successCount > 1 ? 's' : ''} to the chit fund.`);

        // Clear selection after successful assignment
        setSelectedMembers([]);
        setSelectAll(false);

        // Close modal after a delay
        setTimeout(() => {
          setShowAssignModal(false);
        }, 2000);
      }

      if (errorCount > 0) {
        setAssignError(`Failed to assign ${errorCount} member${errorCount > 1 ? 's' : ''}. They may already be part of this chit fund.`);
      }

    } catch (error: any) {
      console.error('Error assigning members:', error);
      setAssignError(error.message || 'Failed to assign members. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  };

  if (loading) {
    return <MembersListSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-700">Members</h1>
        <div className="flex space-x-4">
          <Link href="/dashboard" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
            Back to Dashboard
          </Link>
          <button
            onClick={() => {
              setCurrentMember({
                id: 0,
                name: '',
                contact: '',
                email: '',
                address: '',
                notes: '',
              });
              setIsEditing(false);
              setShowForm(true);
              setFormErrors({});
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
          >
            Add New Member
          </button>
          {selectedMembers.length > 0 && (
            <>
              <button
                onClick={handleOpenAssignModal}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-300"
              >
                Assign Selected to Chit Fund ({selectedMembers.length})
              </button>
              <button
                onClick={handleBulkDeleteClick}
                disabled={isBulkDeleting}
                className={`px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 ${
                  isBulkDeleting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isBulkDeleting
                  ? 'Deleting...'
                  : `Delete Selected (${selectedMembers.length})`}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2">Select</span>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chit Funds
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loans
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No members found. Add members to get started.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => handleSelectMember(member.id)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">{member.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.contact}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.email || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member._count.chitFundMembers}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member._count.loans}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-4">
                        <Link href={`/members/${member.id}`} className="text-blue-600 hover:text-blue-900">
                          View
                        </Link>
                        <button
                          onClick={() => handleEditMember(member)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Edit
                        </button>
                        {member._count.chitFundMembers === 0 && member._count.loans === 0 && (
                          <button
                            onClick={() => handleDeleteMember(member.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium ${
                  currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium ${
                  currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div className="flex items-center">
                <p className="text-sm text-gray-700 mr-4">
                  Showing <span className="font-medium">{members.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * pageSize, (currentPage - 1) * pageSize + members.length)}</span> of{' '}
                  <span className="font-medium">{totalPages * pageSize}</span> results
                </p>
                <div className="flex items-center">
                  <label htmlFor="pageSize" className="text-sm text-gray-700 mr-2">
                    Show:
                  </label>
                  <select
                    id="pageSize"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1); // Reset to first page when changing page size
                    }}
                    className="border border-gray-300 rounded-md text-sm py-1 pl-2 pr-8"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center rounded-l-md px-2 py-2 ${
                      currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">First</span>
                    <span className="text-xs">First</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-2 py-2 ${
                      currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Previous</span>
                    <span>←</span>
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                          currentPage === pageNum
                            ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                            : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center px-2 py-2 ${
                      currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Next</span>
                    <span>→</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center rounded-r-md px-2 py-2 ${
                      currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Last</span>
                    <span className="text-xs">Last</span>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Member Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-blue-700 mb-4">
              {isEditing ? 'Edit Member' : 'Add New Member'}
            </h2>
            <form onSubmit={handleAddEditMember}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={currentMember.name || ''}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="contact"
                  name="contact"
                  value={currentMember.contact || ''}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.contact ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.contact && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.contact}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={currentMember.email || ''}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.email && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.email}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={currentMember.address || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={currentMember.notes || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                />
              </div>
              {formErrors.submit && (
                <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  <p>{formErrors.submit}</p>
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : isEditing ? 'Update Member' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-red-700 mb-4">Confirm Deletion</h2>
            <p className="mb-6">Are you sure you want to delete this member? This action cannot be undone.</p>
            {deleteError && (
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p>{deleteError}</p>
              </div>
            )}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setMemberToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
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

      {/* Assign to Chit Fund Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-blue-700 mb-4">
              Assign {selectedMembers.length} Member{selectedMembers.length > 1 ? 's' : ''} to Chit Fund
            </h2>

            {assignSuccess && (
              <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                <p>{assignSuccess}</p>
              </div>
            )}

            {assignError && (
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p>{assignError}</p>
              </div>
            )}

            <form onSubmit={handleAssignMembers}>
              <div className="mb-4">
                <label htmlFor="chitFund" className="block text-sm font-medium text-gray-700 mb-1">
                  Select Chit Fund <span className="text-red-500">*</span>
                </label>
                <select
                  id="chitFund"
                  value={selectedChitFund}
                  onChange={handleChitFundChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.chitFund ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a chit fund</option>
                  {chitFunds.map((fund) => (
                    <option key={fund.id} value={fund.id}>
                      {fund.name} - {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        maximumFractionDigits: 0,
                      }).format(fund.monthlyContribution)}
                    </option>
                  ))}
                </select>
                {formErrors.chitFund && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.chitFund}</p>
                )}
              </div>

              <div className="mb-6">
                <label htmlFor="contribution" className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Contribution <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="contribution"
                  value={contribution}
                  onChange={(e) => setContribution(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.contribution ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.contribution && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.contribution}</p>
                )}
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssignError(null);
                    setAssignSuccess(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50"
                >
                  {isAssigning ? 'Assigning...' : 'Assign Members'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-red-700 mb-4">Confirm Bulk Deletion</h2>
            <p className="mb-2">Are you sure you want to delete {selectedMembers.length} selected member{selectedMembers.length > 1 ? 's' : ''}? This action cannot be undone.</p>
            <div className="mb-6 bg-yellow-50 border border-yellow-400 text-yellow-700 p-3 rounded">
              <p className="font-bold">Warning:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>Only members not associated with any chit funds or loans will be deleted</li>
                <li>Members that are part of active chit funds or loans cannot be deleted</li>
              </ul>
            </div>

            {bulkDeleteSuccess && (
              <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                <p>{bulkDeleteSuccess}</p>
              </div>
            )}

            {bulkDeleteError && (
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p>{bulkDeleteError}</p>
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setBulkDeleteError(null);
                  setBulkDeleteSuccess(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDeleteMembers}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 disabled:opacity-50"
                disabled={isBulkDeleting || bulkDeleteSuccess !== null}
              >
                {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
