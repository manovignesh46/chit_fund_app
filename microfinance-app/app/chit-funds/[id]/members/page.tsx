// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
// import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/apiUtils';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/apiUtils';
import { UserGroupIcon, PlusCircleIcon, ArrowUturnLeftIcon, DocumentArrowDownIcon, TrashIcon, UserPlusIcon, UsersIcon, BanknotesIcon } from '@heroicons/react/24/outline';

interface GlobalMember {
  id: number;
  name: string;
  contact: string;
  email: string | null;
  address: string | null;
}

interface Member {
  id: number;
  globalMemberId: number;
  globalMember: GlobalMember;
  joinDate: string;
  auctionWon: boolean;
  auctionMonth: number | null;
  contribution: number;
  missedContributions: number;
  pendingAmount: number;
}

interface ChitFund {
  id: number;
  name: string;
  totalAmount: number;
  monthlyContribution: number;
  duration: number;
  membersCount: number;
  status: string;
  currentMonth: number;
}

// This component has been optimized for performance
export default function ChitFundMembersPage() {
  const params = useParams();
  const router = useRouter();
  const chitFundId = params.id;

  const [chitFund, setChitFund] = useState<ChitFund | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allContributions, setAllContributions] = useState<{memberId: number, month: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For adding new member
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    contact: '',
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // For selecting global members
  const [globalMembers, setGlobalMembers] = useState<GlobalMember[]>([]);
  const [selectedGlobalMembers, setSelectedGlobalMembers] = useState<number[]>([]);
  const [selectAllGlobal, setSelectAllGlobal] = useState(false);
  const [loadingGlobalMembers, setLoadingGlobalMembers] = useState(false);

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

  // For adding current month contribution
  const [isAddingContribution, setIsAddingContribution] = useState(false);
  const [contributionMemberId, setContributionMemberId] = useState<number | null>(null);
  const [contributionSuccess, setContributionSuccess] = useState<string | null>(null);
  const [contributionError, setContributionError] = useState<string | null>(null);

  // For recording a specific contribution
  const [showRecordContributionModal, setShowRecordContributionModal] = useState(false);
  const [selectedMemberForContribution, setSelectedMemberForContribution] = useState<Member | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [newContribution, setNewContribution] = useState({
    amount: '',
    paidDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [isSubmittingContribution, setIsSubmittingContribution] = useState(false);
  const [submitContributionError, setSubmitContributionError] = useState<string | null>(null);
  const [submitContributionSuccess, setSubmitContributionSuccess] = useState<string | null>(null);

  // For selecting members
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // For pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // For exporting members
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Fetch global members
  const fetchGlobalMembers = async () => {
    try {
      setLoadingGlobalMembers(true);

      // Use the apiGet utility function
      const data = await apiGet(
        '/api/members/consolidated?action=list',
        'Failed to fetch global members'
      );

      // Filter out members that are already in this chit fund
      const existingMemberIds = members.map(member => member.globalMemberId);

      // Check if the response has a members property (new format) or is an array (old format)
      const membersArray = data.members && Array.isArray(data.members)
        ? data.members
        : (Array.isArray(data) ? data : []);

      const filteredGlobalMembers = membersArray.filter((member: GlobalMember) =>
        !existingMemberIds.includes(member.id)
      );

      setGlobalMembers(filteredGlobalMembers);
      setError(null);
    } catch (err) {
      console.error('Error fetching global members:', err);
      setError(`Failed to load global members: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again later.`);
    } finally {
      setLoadingGlobalMembers(false);
    }
  };

  useEffect(() => {
    const fetchChitFundAndMembers = async () => {
      try {
        setLoading(true);

        // Fetch chit fund details using the apiGet utility function
        const chitFundData = await apiGet(
          `/api/chit-funds/consolidated?action=detail&id=${chitFundId}`,
          'Failed to fetch chit fund details'
        );
        setChitFund(chitFundData);

        // Fetch members with pagination using the apiGet utility function
        const membersData = await apiGet(
          `/api/chit-funds/consolidated?action=members&id=${chitFundId}&page=${currentPage}&pageSize=${pageSize}`,
          'Failed to fetch members'
        );

        // Check if the response has pagination metadata
        if (membersData.members && membersData.totalCount !== undefined) {
          setMembers(membersData.members);
          setTotalPages(Math.ceil(membersData.totalCount / pageSize));
        } else {
          // Fallback for backward compatibility
          setMembers(membersData);
          setTotalPages(Math.ceil(membersData.length / pageSize));
        }

        // Clear selected members when page changes
        setSelectedMembers([]);
        setSelectAll(false);

        // Fetch all contributions for this chit fund using the apiGet utility function
        const contributionsData = await apiGet(
          `/api/chit-funds/consolidated?action=contributions&id=${chitFundId}`,
          'Failed to fetch contributions'
        );

        // Extract contributions array from the response
        const contributionsArray = contributionsData.contributions && Array.isArray(contributionsData.contributions)
          ? contributionsData.contributions
          : (Array.isArray(contributionsData) ? contributionsData : []);

        // Create a simplified array of member IDs and months for easy checking
        const contributionMap = contributionsArray.map((contribution: any) => ({
          memberId: contribution.memberId,
          month: contribution.month
        }));
        setAllContributions(contributionMap);

        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(`Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again later.`);
      } finally {
        setLoading(false);
      }
    };

    if (chitFundId) {
      fetchChitFundAndMembers();
    }
  }, [chitFundId, currentPage, pageSize]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewMember({
      ...newMember,
      [name]: value,
    });
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    if (!newMember.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!newMember.contact.trim()) {
      errors.contact = 'Contact information is required';
    } else if (!/^[0-9+\s-]{10,15}$/.test(newMember.contact.trim())) {
      errors.contact = 'Please enter a valid phone number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the apiPost utility function
      const newMemberData = await apiPost(
        `/api/chit-funds/consolidated?action=add-member&id=${chitFundId}`,
        {
          name: newMember.name,
          contact: newMember.contact,
          contribution: chitFund?.monthlyContribution || 0,
        },
        'Failed to add member'
      );

      // Update the members list
      setMembers([...members, newMemberData]);

      // Reset form
      setNewMember({
        name: '',
        contact: '',
      });
      setShowAddForm(false);

      // Refresh the page to get updated data
      window.location.reload();
    } catch (error: any) {
      console.error('Error adding member:', error);
      setFormErrors({ submit: error.message || 'Failed to add member. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // Handle delete member
  const handleDeleteMember = (id: number) => {
    setMemberToDelete(id);
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  // Confirm delete member
  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Use the apiDelete utility function
      await apiDelete(
        `/api/chit-funds/consolidated?action=remove-member&id=${chitFundId}&memberId=${memberToDelete}`,
        {},
        'Failed to delete member'
      );  

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
          // Use the apiDelete utility function
          await apiDelete(
            `/api/chit-funds/consolidated?action=remove-member&id=${chitFundId}&memberId=${memberId}`,
            {},
            'Failed to delete member'
          );  
          successCount++;
        } catch (error) {
          console.error(`Error removing member ${memberId}:`, error);
          errorCount++;
        }
      }

      // Update the members list
      if (successCount > 0) {
        setMembers(members.filter(m => !selectedMembers.includes(m.id)));
        setBulkDeleteSuccess(`Successfully removed ${successCount} member${successCount > 1 ? 's' : ''} from the chit fund.`);

        // Clear selection
        setSelectedMembers([]);
        setSelectAll(false);

        // Close modal after a delay
        setTimeout(() => {
          setShowBulkDeleteModal(false);
        }, 2000);
      }

      if (errorCount > 0) {
        setBulkDeleteError(`Failed to remove ${errorCount} member${errorCount > 1 ? 's' : ''} from the chit fund.`);
      }

    } catch (error: any) {
      console.error('Error removing members:', error);
      setBulkDeleteError(error.message || 'Failed to remove members. Please try again.');
    } finally {
      setIsBulkDeleting(false);
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

  // Handle selecting/deselecting a global member
  const handleSelectGlobalMember = (memberId: number) => {
    if (selectedGlobalMembers.includes(memberId)) {
      setSelectedGlobalMembers(selectedGlobalMembers.filter(id => id !== memberId));
      setSelectAllGlobal(false);
    } else {
      setSelectedGlobalMembers([...selectedGlobalMembers, memberId]);
      if (selectedGlobalMembers.length + 1 === globalMembers.length) {
        setSelectAllGlobal(true);
      }
    }
  };

  // Handle select all global members
  const handleSelectAllGlobalMembers = () => {
    if (selectAllGlobal) {
      setSelectedGlobalMembers([]);
      setSelectAllGlobal(false);
    } else {
      setSelectedGlobalMembers(globalMembers.map(member => member.id));
      setSelectAllGlobal(true);
    }
  };

  // Handle assigning multiple global members to the chit fund
  const handleAssignGlobalMembers = async () => {
    if (selectedGlobalMembers.length === 0) {
      setFormErrors({ submit: 'Please select at least one member to assign' });
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      let successCount = 0;
      let errorCount = 0;

      // Process each selected member
      for (const memberId of selectedGlobalMembers) {
        try {
          // Use the apiPost utility function
          await apiPost(
            `/api/chit-funds/consolidated?action=add-member&id=${chitFundId}`,
            {
              globalMemberId: memberId,
              // No need to specify contribution as it will use the chit fund's monthlyContribution
            },
            'Failed to assign member'
          );
          successCount++;
        } catch (error) {
          console.error(`Error assigning member ${memberId}:`, error);
          errorCount++;
        }
      }

      // Show appropriate message
      if (successCount > 0) {
        // Reset selection
        setSelectedGlobalMembers([]);
        setSelectAllGlobal(false);

        // Refresh the page to get updated data
        window.location.reload();
      }

      if (errorCount > 0) {
        setFormErrors({ submit: `Failed to assign ${errorCount} member${errorCount > 1 ? 's' : ''}. They may already be part of this chit fund.` });
      }
    } catch (error: any) {
      console.error('Error assigning members:', error);
      setFormErrors({ submit: error.message || 'Failed to assign members. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle exporting a single member
  const handleExportMember = async (memberId: number) => {
    try {
      setIsExporting(true);
      setExportError(null);

      // Create a form to submit as POST
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/api/chit-funds/${chitFundId}/members/export`;
      form.target = '_blank'; // Open in new tab

      // Add member ID as hidden input
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'memberIds';
      input.value = JSON.stringify([memberId]);
      form.appendChild(input);

      // Add CSRF token if needed
      // const csrfToken = document.createElement('input');
      // csrfToken.type = 'hidden';
      // csrfToken.name = 'csrfToken';
      // csrfToken.value = 'your-csrf-token';
      // form.appendChild(csrfToken);

      // Submit the form
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch (error: any) {
      console.error('Error exporting member:', error);
      setExportError(error.message || 'Failed to export member');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle exporting selected members
  const handleExportSelectedMembers = async () => {
    if (selectedMembers.length === 0) {
      setExportError('Please select at least one member to export');
      return;
    }

    try {
      setIsExporting(true);
      setExportError(null);

      // Create a form to submit as POST
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/api/chit-funds/${chitFundId}/members/export`;
      form.target = '_blank'; // Open in new tab

      // Add member IDs as hidden input
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'memberIds';
      input.value = JSON.stringify(selectedMembers);
      form.appendChild(input);

      // Submit the form
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch (error: any) {
      console.error('Error exporting members:', error);
      setExportError(error.message || 'Failed to export members');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle adding current month contribution for selected members
  const handleAddCurrentMonthContributionForSelected = async () => {
    if (!chitFund || selectedMembers.length === 0) return;

    const currentMonth = chitFund.currentMonth;

    // Clear previous messages
    setContributionSuccess(null);
    setContributionError(null);

    // Set loading state
    setIsAddingContribution(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      // Process each selected member
      for (const memberId of selectedMembers) {
        // Skip if contribution already exists
        if (allContributions.some(c => c.memberId === memberId && c.month === currentMonth)) {
          errorCount++;
          continue;
        }

        // Create the contribution using the apiPost utility function
        try {
          await apiPost(
            `/api/chit-funds/consolidated?action=add-contribution&id=${chitFundId}`,
            {
              memberId: memberId,
              month: currentMonth,
              amount: chitFund.monthlyContribution, // Default to full amount
              paidDate: new Date().toISOString().split('T')[0], // Today's date
              notes: null, // Add notes field with null value
            },
            'Failed to add contribution'
          );

          // Update the contributions list
          setAllContributions(prev => [...prev, { memberId, month: currentMonth }]);
          successCount++;
        } catch (error) {
          console.error(`Error adding contribution for member ${memberId}:`, error);
          errorCount++;
        }
      }

      // Show appropriate message
      if (successCount > 0) {
        setContributionSuccess(`Added month ${currentMonth} contribution for ${successCount} member${successCount > 1 ? 's' : ''}`);
      }

      if (errorCount > 0) {
        setContributionError(`Failed to add contribution for ${errorCount} member${errorCount > 1 ? 's' : ''}`);
      }

      // Auto-hide messages after 3 seconds
      setTimeout(() => {
        setContributionSuccess(null);
        setContributionError(null);
      }, 3000);

    } catch (error: any) {
      console.error('Error adding contributions:', error);
      setContributionError(error.message || 'Failed to add contributions. Please try again.');

      // Auto-hide error message after 3 seconds
      setTimeout(() => {
        setContributionError(null);
      }, 3000);
    } finally {
      setIsAddingContribution(false);
      setContributionMemberId(null);
    }
  };

  // Handle adding current month contribution for a single member
  const handleAddCurrentMonthContribution = async (memberId: number) => {
    if (!chitFund) return;

    const currentMonth = chitFund.currentMonth;

    // Clear previous messages
    setContributionSuccess(null);
    setContributionError(null);

    // Set the current member ID and loading state
    setContributionMemberId(memberId);
    setIsAddingContribution(true);

    try {
      // We're already checking in the UI if a contribution exists, but double-check here as well
      if (allContributions.some(c => c.memberId === memberId && c.month === currentMonth)) {
        throw new Error(`Contribution for month ${currentMonth} already exists for this member`);
      }

      // Create the contribution using the apiPost utility function
      await apiPost(
        `/api/chit-funds/consolidated?action=add-contribution&id=${chitFundId}`,
        {
          memberId: memberId,
          month: currentMonth,
          amount: chitFund.monthlyContribution, // Default to full amount
          paidDate: new Date().toISOString().split('T')[0], // Today's date
          notes: null, // Add notes field with null value
        },
        'Failed to create contribution'
      );

      // Show success message
      const member = members.find(m => m.id === memberId);
      setContributionSuccess(`Added month ${currentMonth} contribution for ${member?.globalMember.name}`);

      // Update the contributions list
      setAllContributions([...allContributions, { memberId, month: currentMonth }]);

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setContributionSuccess(null);
      }, 3000);

    } catch (error: any) {
      console.error('Error adding contribution:', error);
      setContributionError(error.message || 'Failed to add contribution. Please try again.');

      // Auto-hide error message after 3 seconds
      setTimeout(() => {
        setContributionError(null);
      }, 3000);
    } finally {
      setIsAddingContribution(false);
      setContributionMemberId(null);
    }
  };

  // Handle recording a contribution
  const handleRecordContribution = () => {
    if (!selectedMemberForContribution || selectedMonth === null || !chitFund) {
      setSubmitContributionError('Missing required information');
      return;
    }

    // Validate the form
    if (!newContribution.amount || parseFloat(newContribution.amount) <= 0) {
      setSubmitContributionError('Please enter a valid amount');
      return;
    }

    if (!newContribution.paidDate) {
      setSubmitContributionError('Please select a payment date');
      return;
    }

    setIsSubmittingContribution(true);
    setSubmitContributionError(null);
    setSubmitContributionSuccess(null);

    // Create the contribution using the apiPost utility function
    apiPost(
      `/api/chit-funds/consolidated?action=add-contribution&id=${chitFundId}`,
      {
        memberId: selectedMemberForContribution.id,
        month: selectedMonth,
        amount: parseFloat(newContribution.amount),
        paidDate: newContribution.paidDate,
        notes: newContribution.notes || null,
      },
      'Failed to record contribution'
    )
      .then(() => {
        // Update the contributions list
        setAllContributions(prev => [...prev, {
          memberId: selectedMemberForContribution.id,
          month: selectedMonth
        }]);

        // Show success message
        setSubmitContributionSuccess(`Successfully recorded contribution for ${selectedMemberForContribution.globalMember.name} for month ${selectedMonth}`);

        // Close the modal after a delay
        setTimeout(() => {
          setShowRecordContributionModal(false);

          // Refresh the page to get updated data
          window.location.reload();
        }, 2000);
      })
      .catch((error) => {
        console.error('Error recording contribution:', error);
        setSubmitContributionError(error.message || 'Failed to record contribution. Please try again.');
      })
      .finally(() => {
        setIsSubmittingContribution(false);
      });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading members data...</p>
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

  if (!chitFund) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">Chit Fund Not Found</p>
          <p>The chit fund you are looking for does not exist or has been removed.</p>
          <Link href="/chit-funds" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            Back to Chit Funds
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container w-full max-w-screen-lg mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-700 break-words flex-shrink-0">{chitFund.name} - Members</h1>
        <div className="flex flex-row flex-wrap gap-1 sm:gap-2 w-auto">
          {/* Back to Chit Fund */}
          <Link
            href={`/chit-funds/${chitFundId}`}
            aria-label="Back to Chit Fund"
            className="p-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition flex items-center justify-center sm:px-4 sm:py-2"
          >
            <ArrowUturnLeftIcon className="h-5 w-5 block sm:hidden" />
            <span className="hidden sm:inline-flex items-center space-x-1 text-sm">
              <ArrowUturnLeftIcon className="h-5 w-5 mr-1" />
              <span>Back to Chit Fund</span>
            </span>
          </Link>
          {/* View Contributions */}
          <Link
            href={`/chit-funds/${chitFundId}/contributions`}
            aria-label="View Contributions"
            className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition flex items-center justify-center sm:px-4 sm:py-2"
          >
            <UsersIcon className="h-5 w-5 block sm:hidden" />
            <span className="hidden sm:inline-flex items-center space-x-1 text-sm">
              <UsersIcon className="h-5 w-5 mr-1" />
              <span>View Contributions</span>
            </span>
          </Link>
          {/* Add Member */}
          <button
            onClick={() => setShowAddForm(true)}
            aria-label="Add Member"
            className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center sm:px-4 sm:py-2"
          >
            <UserPlusIcon className="h-5 w-5 block sm:hidden" />
            <span className="hidden sm:inline-flex items-center space-x-1 text-sm">
              <UserPlusIcon className="h-5 w-5 mr-1" />
              <span>Add Member</span>
            </span>
          </button>
          {/* Bulk Actions (only if selectedMembers.length > 0) */}
          {selectedMembers.length > 0 && chitFund && (
            <>
              <button
                onClick={handleAddCurrentMonthContributionForSelected}
                aria-label={`Add Month ${chitFund.currentMonth} Due for Selected`}
                disabled={isAddingContribution}
                className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed sm:px-4 sm:py-2"
              >
                <PlusCircleIcon className="h-5 w-5 block sm:hidden" />
                <span className="hidden sm:inline-flex items-center space-x-1 text-sm">
                  <PlusCircleIcon className="h-5 w-5 mr-1" />
                  <span>{isAddingContribution ? 'Processing...' : `Add Month ${chitFund.currentMonth} Due for Selected (${selectedMembers.length})`}</span>
                </span>
              </button>
              <button
                onClick={handleExportSelectedMembers}
                aria-label="Export Selected"
                disabled={isExporting}
                className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed sm:px-4 sm:py-2"
              >
                <DocumentArrowDownIcon className="h-5 w-5 block sm:hidden" />
                <span className="hidden sm:inline-flex items-center space-x-1 text-sm">
                  <DocumentArrowDownIcon className="h-5 w-5 mr-1" />
                  <span>{isExporting ? 'Exporting...' : `Export Selected (${selectedMembers.length})`}</span>
                </span>
              </button>
              <button
                onClick={handleBulkDeleteClick}
                aria-label="Remove Selected"
                disabled={isBulkDeleting}
                className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed sm:px-4 sm:py-2"
              >
                <TrashIcon className="h-5 w-5 block sm:hidden" />
                <span className="hidden sm:inline-flex items-center space-x-1 text-sm">
                  <TrashIcon className="h-5 w-5 mr-1" />
                  <span>{isBulkDeleting ? 'Removing...' : `Remove Selected (${selectedMembers.length})`}</span>
                </span>
              </button>
            </>
          )}
        </div>
      </div>
      <p className="text-gray-600 text-xs sm:text-sm w-full sm:w-auto mt-2 sm:mt-0">
        Month {chitFund.currentMonth} of {chitFund.duration} |
        Monthly Contribution: {formatCurrency(chitFund.monthlyContribution)}
      </p>

      {/* Notification Messages */}
      {contributionSuccess && (
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-2 sm:px-4 py-2 sm:py-3 rounded text-xs sm:text-sm">
          <span className="block sm:inline">{contributionSuccess}</span>
        </div>
      )}
      {contributionError && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-2 sm:px-4 py-2 sm:py-3 rounded text-xs sm:text-sm">
          <span className="block sm:inline">{contributionError}</span>
        </div>
      )}
      {exportError && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-2 sm:px-4 py-2 sm:py-3 rounded text-xs sm:text-sm">
          <span className="block sm:inline">{exportError}</span>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
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
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  Contribution
                </th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  Missed Contributions
                </th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  Pending Amount
                </th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  Auction Status
                </th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    No members found. Add members to this chit fund.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => handleSelectMember(member.id)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </div>
                    </td>
                    <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">{member.globalMember.name}</div>
                    </td>
                    <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.globalMember.contact}</div>
                    </td>
                    <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(member.joinDate)}</div>
                    </td>
                    <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(member.contribution)}</div>
                    </td>
                    <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className={`text-xs sm:text-sm ${member.missedContributions > 0 ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>{member.missedContributions}</div>
                        {member.missedContributions > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Find the next missing month
                              const currentMonth = chitFund?.currentMonth || 1;
                              const contributedMonths = allContributions
                                .filter(c => c.memberId === member.id)
                                .map(c => c.month);

                              // Find the first month that doesn't have a contribution
                              let missingMonth = 1;
                              for (let month = 1; month <= currentMonth; month++) {
                                if (!contributedMonths.includes(month)) {
                                  missingMonth = month;
                                  break;
                                }
                              }

                              // Open the record contribution modal
                              handleOpenRecordModal(
                                member,
                                missingMonth,
                                setSelectedMemberForContribution,
                                setSelectedMonth,
                                setNewContribution,
                                chitFund,
                                setShowRecordContributionModal,
                                setSubmitContributionError,
                                setSubmitContributionSuccess
                              );
                            }}
                            className="mt-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition duration-300"
                          >
                            Record Contribution
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className={`text-sm ${member.pendingAmount > 0 ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                        {formatCurrency(member.pendingAmount)}
                      </div>
                    </td>
                    <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      {member.auctionWon ? (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Won in Month {member.auctionMonth}
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Not Won Yet
                        </span>
                      )}
                    </td>
                    <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2 sm:space-x-4">
                        <Link href={`/chit-funds/${chitFundId}/members/${member.id}/contributions`} className="text-blue-600 hover:text-blue-900">
                          Contributions
                        </Link>
                        {/* Only show the Add Month Due button if no contribution exists for the current month */}
                        {chitFund && !allContributions.some(c => c.memberId === member.id && c.month === chitFund.currentMonth) && (
                          <button
                            onClick={() => handleAddCurrentMonthContribution(member.id)}
                            className={`${isAddingContribution && contributionMemberId === member.id
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-green-600 hover:text-green-900'}`}
                            title="Add current month contribution"
                            disabled={isAddingContribution && contributionMemberId === member.id}
                          >
                            {isAddingContribution && contributionMemberId === member.id
                              ? 'Adding...'
                              : `Add Month ${chitFund.currentMonth} Due`}
                          </button>
                        )}
                        <button
                          onClick={() => handleExportMember(member.id)}
                          className={`text-blue-600 hover:text-blue-900 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Export member data"
                          disabled={isExporting}
                        >
                          {isExporting ? 'Exporting...' : 'Export'}
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Remove member"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 bg-white px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium ${
                  currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium ${
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs sm:max-w-md">
            <h2 className="text-xl font-bold text-red-700 mb-4">Confirm Removal</h2>
            <p className="mb-2">Are you sure you want to remove this member from the chit fund? This action cannot be undone.</p>
            <div className="mb-6 bg-yellow-50 border border-yellow-400 text-yellow-700 p-3 rounded">
              <p className="font-bold">Warning:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>All contributions made by this member will be removed</li>
                <li>Any auctions won by this member will be affected</li>
                <li>This may affect the chit fund's financial records</li>
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
                {isDeleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs sm:max-w-md">
            <h2 className="text-xl font-bold text-red-700 mb-4">Confirm Bulk Removal</h2>
            <p className="mb-2">Are you sure you want to remove {selectedMembers.length} selected member{selectedMembers.length > 1 ? 's' : ''} from the chit fund? This action cannot be undone.</p>
            <div className="mb-6 bg-yellow-50 border border-yellow-400 text-yellow-700 p-3 rounded">
              <p className="font-bold">Warning:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>All contributions made by these members will be removed</li>
                <li>Any auctions won by these members will be affected</li>
                <li>This may affect the chit fund's financial records</li>
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
                {isBulkDeleting ? 'Removing...' : 'Remove Selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-2">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-xs sm:max-w-md px-2 sm:px-6 py-4 sm:py-6">
            <h2 className="text-xl font-bold text-blue-700 mb-4">Add Member to Chit Fund</h2>

            <div className="mb-6">
              <button
                type="button"
                onClick={fetchGlobalMembers}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-300 flex items-center justify-center"
              >
                <span className="mr-2">📋</span> Select from Global Members
              </button>

              {loadingGlobalMembers ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading global members...</p>
                </div>
              ) : globalMembers.length > 0 ? (
                <div className="border rounded-lg overflow-hidden mt-4">
                  <div className="bg-gray-50 p-3 border-b">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectAllGlobal}
                        onChange={handleSelectAllGlobalMembers}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 font-medium">Select All</span>

                      {selectedGlobalMembers.length > 0 && (
                        <button
                          type="button"
                          onClick={handleAssignGlobalMembers}
                          disabled={isSubmitting}
                          className={`ml-auto px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 ${
                            isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {isSubmitting ? 'Assigning...' : `Assign Selected (${selectedGlobalMembers.length})`}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Select
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contact
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {globalMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedGlobalMembers.includes(member.id)}
                                onChange={() => handleSelectGlobalMember(member.id)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{member.name}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{member.contact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 mt-2">Click to load global members that are not yet part of this chit fund.</p>
              )}

              <div className="text-center my-4 relative">
                <hr className="my-4" />
                <span className="px-3 bg-white text-gray-500 text-sm absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">OR</span>
              </div>

              <p className="text-sm text-gray-600 mb-4">Create a new member and add them to this chit fund:</p>
            </div>

            <form onSubmit={handleAddMember}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newMember.name}
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
                  value={newMember.contact}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.contact ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.contact && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.contact}</p>
                )}
              </div>
              {formErrors.submit && (
                <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  <p>{formErrors.submit}</p>
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Contribution Modal */}
      {showRecordContributionModal && selectedMemberForContribution && selectedMonth !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs sm:max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-blue-700">Record Contribution for {selectedMemberForContribution.globalMember.name}</h2>
              <button
                onClick={() => setShowRecordContributionModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Member</p>
                  <p className="text-md font-semibold">{selectedMemberForContribution.globalMember.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Month</p>
                  <p className="text-md font-semibold">Month {selectedMonth}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expected Amount</p>
                  <p className="text-md font-semibold">{formatCurrency(chitFund?.monthlyContribution || 0)}</p>
                </div>
              </div>
            </div>

            {submitContributionSuccess && (
              <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                <p>{submitContributionSuccess}</p>
              </div>
            )}

            {submitContributionError && (
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p>{submitContributionError}</p>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="amount"
                value={newContribution.amount}
                onChange={(e) => setNewContribution({...newContribution, amount: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter amount"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="paidDate" className="block text-sm font-medium text-gray-700 mb-1">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="paidDate"
                value={newContribution.paidDate}
                onChange={(e) => setNewContribution({...newContribution, paidDate: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                value={newContribution.notes}
                onChange={(e) => setNewContribution({...newContribution, notes: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Optional notes about this contribution"
              ></textarea>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowRecordContributionModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordContribution}
                disabled={isSubmittingContribution}
                className={`px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 ${
                  isSubmittingContribution ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isSubmittingContribution ? 'Recording...' : 'Record Contribution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// Handle opening the record contribution modal
function handleOpenRecordModal(member: any, month: number, setSelectedMemberForContribution: any, setSelectedMonth: any, setNewContribution: any, chitFund: any, setShowRecordContributionModal: any, setSubmitContributionError: any, setSubmitContributionSuccess: any) {
  setSelectedMemberForContribution(member);
  setSelectedMonth(month);
  setNewContribution({
    amount: chitFund ? chitFund.monthlyContribution.toString() : '',
    paidDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  setShowRecordContributionModal(true);
  setSubmitContributionError(null);
  setSubmitContributionSuccess(null);
}