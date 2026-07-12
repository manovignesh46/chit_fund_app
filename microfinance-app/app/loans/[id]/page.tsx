// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loan, Repayment, PaymentSchedule } from "../../../lib/interfaces";
import {
  formatCurrency,
  formatDate,
  calculateLoanProfit,
} from "../../../lib/formatUtils";
import { loanAPI } from "../../../lib/api"; // Add this import
import dynamic from "next/dynamic";
import ActionDropdown, { ActionItem } from "../../components/ui/ActionDropdown";
import { LoanDetailSkeleton } from "../../components/skeletons/DetailSkeletons";
import { usePartner } from "../../../app/contexts/PartnerContext";
import {
  ActionButtonGroup,
} from "../../components/buttons/ActionButtons";
import RepaymentForm from "../../components/loans/RepaymentForm";

const LoanDetailPage = () => {
  const params = useParams();
  const id = params.id;
  const { selectedPartner, loading: partnerLoading } = usePartner();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Payment schedule state
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>(
    []
  );
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [updatingSchedule, setUpdatingSchedule] = useState<number | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [repaymentToDelete, setRepaymentToDelete] = useState<number | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"loan-details" | "payment-schedule" | "record-payment">("loan-details");

  // Fetch payment schedules
  const fetchPaymentSchedules = async () => {
    if (!id) return;

    try {
      setLoadingSchedules(true);
      setScheduleError(null);

      const response = await loanAPI.getPaymentSchedules(
        parseInt(id as string),
        false
      );

      // Handle the response structure - when includeAll=false, API returns {schedules: [...]}
      // When includeAll=true, API returns [...] directly
      const schedules = Array.isArray(response)
        ? response
        : response.schedules || [];

      setPaymentSchedules(schedules);
    } catch (error) {
      console.error("Error fetching payment schedules:", error);
      setScheduleError(
        error instanceof Error
          ? error.message
          : "Failed to fetch payment schedules"
      );
    } finally {
      setLoadingSchedules(false);
    }
  };

  // Record a payment for a specific period
  const handleRecordPayment = async (period: number, paymentType: string) => {
    try {
      setUpdatingSchedule(period);
      setScheduleError(null);

      // Ensure partner state is fully loaded and valid
      if (partnerLoading) {
        throw new Error("Please wait while we load partner information...");
      }

      if (!selectedPartner) {
        throw new Error(
          "Please select a valid partner from the top dropdown menu first. Your payment will be recorded under their name."
        );
      }

      // Extra validation for partner data
      if (
        !selectedPartner.id ||
        !selectedPartner.name ||
        !selectedPartner.isActive
      ) {
        console.error("Invalid partner data:", selectedPartner);
        throw new Error(
          "Selected partner appears to be invalid. Please try selecting again or refresh the page."
        );
      }

      // Validate period and format
      if (!id || isNaN(period) || period <= 0) {
        throw new Error("Invalid payment period. Please try again.");
      }

      // Get the installment amount and validate it exists
      const scheduleResponse = await loanAPI.getPaymentSchedules(
        parseInt(id as string),
        true
      );
      const schedule = Array.isArray(scheduleResponse)
        ? scheduleResponse
        : scheduleResponse.schedules || [];
      const scheduleItem = schedule.find((s) => s.period === period);
      if (!scheduleItem) {
        throw new Error(
          "Could not find payment schedule for the selected period."
        );
      }

      const amount =
        paymentType === "InterestOnly"
          ? scheduleItem.interestAmount
          : scheduleItem.amount;

      // Make request using loanAPI
      const requestData = {
        amount,
        paidDate: new Date().toISOString(),
        paymentType:
          paymentType === "InterestOnly" ? "INTEREST_ONLY" : "REGULAR",
        scheduleId: period,
        collected_by_id: selectedPartner.id,
        collected_by: selectedPartner.id.toString(),
        entered_by_id: selectedPartner.id,
      };

      const responseData = await loanAPI.addRepayment(
        parseInt(id as string),
        requestData
      );
      if (!responseData || !responseData.loan) {
        throw new Error("Invalid response from server.");
      }

      console.log("Payment recorded successfully:", responseData);

      // Add a small delay before refreshing data
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh loan details and payment schedules
      await fetchLoanDetails();
      schedulesInitialized.current = true;
      await fetchPaymentSchedules();
    } catch (error) {
      console.error("Payment recording failed:", error);
      setScheduleError(
        error instanceof Error ? error.message : "Failed to record payment"
      );
    } finally {
      setUpdatingSchedule(null);
    }
  };

  const fetchLoanDetails = async () => {
    try {
      setLoading(true);

      // Validate the ID parameter
      if (!id) {
        console.error("Invalid loan ID: ID is undefined or null");
        throw new Error("Invalid loan ID");
      }

      // Ensure ID is a valid number
      const numericId =
        typeof id === "string"
          ? parseInt(id, 10)
          : Array.isArray(id)
          ? parseInt(id[0], 10)
          : 0;

      if (!numericId || isNaN(numericId)) {
        console.error(`Invalid loan ID: Unable to parse "${id}" as a number`);
        throw new Error("Invalid loan ID format");
      }

      console.log(`Fetching loan details for ID: ${numericId}`);

      // First, update the overdue amount to ensure it's current
      try {
        console.log("Updating overdue amount...");
        const overdueResponse = await fetch(
          `/api/loans/consolidated?action=update-overdue&id=${numericId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          }
        );

        if (overdueResponse.ok) {
          console.log("Overdue amount updated successfully");
        } else {
          const errorText = await overdueResponse.text();
          console.warn(
            `Failed to update overdue amount: ${overdueResponse.status} ${overdueResponse.statusText}`,
            errorText
          );
        }
      } catch (overdueError) {
        console.error("Error updating overdue amount:", overdueError);
        // Continue with fetching loan details even if updating overdue amount fails
      }

      // Fetch loan details
      const loanResponse = await fetch(
        `/api/loans/consolidated?action=detail&id=${numericId}`
      );
      if (!loanResponse.ok) {
        const errorText = await loanResponse.text();
        console.error(
          `Failed to fetch loan details: ${loanResponse.status} ${loanResponse.statusText}`,
          errorText
        );
        throw new Error(
          `Failed to fetch loan details: ${loanResponse.statusText}`
        );
      }
      const loanData = await loanResponse.json();

      console.log("Loan data from API:", loanData);

      // Fetch paginated repayments for this loan
      const repaymentsResponse = await fetch(
        `/api/loans/consolidated?action=repayments&id=${numericId}&page=${currentPage}&pageSize=${pageSize}`
      );
      if (!repaymentsResponse.ok) {
        const errorText = await repaymentsResponse.text();
        console.error(
          `Failed to fetch repayments: ${repaymentsResponse.status} ${repaymentsResponse.statusText}`,
          errorText
        );
        throw new Error("Failed to fetch repayments");
      }
      const repaymentsData = await repaymentsResponse.json();

      console.log("Repayments data from API:", repaymentsData);

      // Extract repayments and pagination data
      let repaymentsList = [];
      if (
        repaymentsData.repayments &&
        Array.isArray(repaymentsData.repayments)
      ) {
        repaymentsList = repaymentsData.repayments;
      } else {
        // Fallback for backward compatibility
        repaymentsList = Array.isArray(repaymentsData) ? repaymentsData : [];
      }

      console.log("Extracted repayments list:", repaymentsList);

      // Combine the data
      const combinedData = {
        ...loanData,
        repayments: repaymentsList || [],
      };

      console.log("Combined data for loan state:", combinedData);

      // Log specific details about the loan for debugging profit calculation
      console.log("Loan details for profit calculation:", {
        interestRate: combinedData.interestRate,
        documentCharge: combinedData.documentCharge,
        repayments: combinedData.repayments.map((r: Repayment) => ({
          id: r.id,
          amount: r.amount,
          paymentType: r.paymentType,
          paidDate: r.paidDate,
        })),
      });

      setLoan(combinedData);
    } catch (error) {
      console.error("Error fetching loan details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchLoanDetails();
    }
  }, [id]);

  // Lazy-load payment schedules: fetch only when the tab is first opened,
  // then re-fetch when pagination changes while the tab is active.
  const schedulesInitialized = useRef(false);
  useEffect(() => {
    if (activeTab === "payment-schedule" && !schedulesInitialized.current && id && !loading) {
      schedulesInitialized.current = true;
      fetchPaymentSchedules();
    }
  }, [activeTab, id, loading]);

  useEffect(() => {
    if (schedulesInitialized.current && id) {
      fetchPaymentSchedules();
    }
  }, [currentPage, pageSize]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string | Date | null | undefined): string => {
    if (!dateString) return "N/A";
    const date =
      typeof dateString === "string" ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Format period to show month and year
  const formatPeriod = (
    period: number,
    dueDate: string | Date,
    repaymentType: string
  ): string => {
    const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;

    if (repaymentType === "Weekly") {
      return `Week ${period} (${date.toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      })})`;
    } else {
      return date.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });
    }
  };

  // Calculate end date based on disbursement date and duration
  const calculateEndDate = (
    disbursementDate: string | Date,
    duration: number,
    type: "Weekly" | "Monthly"
  ): string => {
    if (!disbursementDate) {
      return "";
    }

    // Ensure we're working with a Date object
    const startDate =
      typeof disbursementDate === "string"
        ? new Date(disbursementDate)
        : disbursementDate;

    const endDate = new Date(startDate);

    if (type === "Weekly") {
      // For weekly loans, add the duration in weeks (duration * 7 days)
      endDate.setDate(startDate.getDate() + duration * 7);
    } else {
      // For monthly loans, add the duration in months
      endDate.setMonth(startDate.getMonth() + duration);
    }

    return endDate.toISOString();
  };

  // Handle delete repayment
  const handleDeleteRepayment = (repaymentId: number) => {
    setRepaymentToDelete(repaymentId);
    setShowDeleteModal(true);
    setDeleteError(null);
    setDeleteSuccess(null);
  };

  // Confirm delete repayment
  const confirmDeleteRepayment = async () => {
    if (!repaymentToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Validate the ID parameter
      if (!id) {
        console.error("Invalid loan ID: ID is undefined or null");
        throw new Error("Invalid loan ID");
      }

      // Ensure ID is a valid number
      const numericId =
        typeof id === "string"
          ? parseInt(id, 10)
          : Array.isArray(id)
          ? parseInt(id[0], 10)
          : 0;

      if (!numericId || isNaN(numericId)) {
        console.error(`Invalid loan ID: Unable to parse "${id}" as a number`);
        throw new Error("Invalid loan ID format");
      }

      const response = await fetch(
        `/api/loans/consolidated?action=delete-repayment&id=${numericId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ repaymentId: repaymentToDelete }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete repayment");
      }

      // Show success message
      setDeleteSuccess("Repayment deleted successfully");

      // Refresh data after a short delay
      setTimeout(() => {
        setShowDeleteModal(false);
        setRepaymentToDelete(null);
        setDeleteSuccess(null);
        fetchLoanDetails();
      }, 1500);
    } catch (error) {
      console.error("Error deleting repayment:", error);
      setDeleteError(
        error instanceof Error ? error.message : "An error occurred"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper function to update the loan's current month
  const updateLoanCurrentMonth = async (monthValue: number) => {
    try {
      // Validate the ID parameter
      if (!id) {
        console.error("Invalid loan ID: ID is undefined or null");
        throw new Error("Invalid loan ID");
      }

      // Ensure ID is a valid number
      const numericId =
        typeof id === "string"
          ? parseInt(id, 10)
          : Array.isArray(id)
          ? parseInt(id[0], 10)
          : 0;

      if (!numericId || isNaN(numericId)) {
        console.error(`Invalid loan ID: Unable to parse "${id}" as a number`);
        throw new Error("Invalid loan ID format");
      }

      console.log(`Updating loan ID ${numericId} to month ${monthValue}`);

      const response = await fetch(
        `/api/loans/consolidated?action=update&id=${numericId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentMonth: monthValue,
          }),
        }
      );

      // Check if the response is OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response text:", errorText);

        // Try to parse as JSON if possible
        let errorDetails = response.statusText;
        try {
          if (errorText) {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error) {
              errorDetails = errorJson.error;
            }
          }
        } catch (e) {
          console.error("Could not parse error response as JSON:", e);
          errorDetails = errorText || errorDetails;
        }

        throw new Error(`Failed to update current month: ${errorDetails}`);
      }

      // Parse the response
      const responseText = await response.text();
      console.log("Raw response:", responseText);

      let updatedLoan;
      try {
        updatedLoan = responseText
          ? JSON.parse(responseText)
          : { currentMonth: monthValue };
      } catch (e) {
        console.error("Error parsing response JSON:", e);
        // If we can't parse the response, just use the month value we sent
        updatedLoan = { currentMonth: monthValue };
      }

      console.log("Updated loan data:", updatedLoan);

      // Update the local state
      setLoan((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentMonth: updatedLoan.currentMonth || monthValue,
        };
      });

      return true;
    } catch (error) {
      console.error("Error updating loan month:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Failed to update current month: ${errorMessage}`);
      return false;
    } finally {
      setUpdating(false);
    }
  };

  // Handle export to Excel
  const handleExport = async () => {
    if (!loan || isExporting) return;

    try {
      setIsExporting(true);

      // Validate the ID parameter
      if (!id) {
        console.error("Invalid loan ID: ID is undefined or null");
        throw new Error("Invalid loan ID");
      }

      // Ensure ID is a valid number
      const numericId =
        typeof id === "string"
          ? parseInt(id, 10)
          : Array.isArray(id)
          ? parseInt(id[0], 10)
          : 0;

      if (!numericId || isNaN(numericId)) {
        console.error(`Invalid loan ID: Unable to parse "${id}" as a number`);
        throw new Error("Invalid loan ID format");
      }

      // Generate filename directly from loan data
      const borrowerName = loan.borrower.name.replace(/[^a-zA-Z0-9]/g, "_");
      const loanAmount = Math.round(loan.amount).toString();
      const disbursementDate = new Date(loan.disbursementDate)
        .toISOString()
        .split("T")[0];

      const filename = `${borrowerName}_${loanAmount}_${disbursementDate}.xlsx`;
      console.log("Generated filename:", filename);

      // Call the export API endpoint
      const response = await fetch(
        `/api/loans/consolidated?action=export&id=${numericId}`
      );

      if (!response.ok) {
        throw new Error("Failed to export loan details");
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link element
      const a = document.createElement("a");
      a.href = url;
      a.download = filename; // Set the filename explicitly

      // Append to the document and trigger a click
      document.body.appendChild(a);
      a.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting loan details:", error);
      alert("Failed to export loan details. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Update the current month/week
  const updateCurrentMonth = async () => {
    if (!loan || updating) return;

    try {
      setUpdating(true);

      // Calculate the current period (month or week) based on the disbursement date
      const startDate = new Date(loan.disbursementDate);
      const currentDate = new Date();

      console.log("Updating current month with dates:", {
        startDate: startDate.toISOString(),
        currentDate: currentDate.toISOString(),
        currentMonth: loan.currentMonth,
        duration: loan.duration,
      });

      // Check if disbursement date is in the future
      if (startDate > currentDate) {
        console.log(
          "Disbursement date is in the future, setting current period to 0"
        );
        // If disbursement date is in the future, current period should be 0 (not started yet)
        if (loan.currentMonth !== 0) {
          // Only update if it's not already 0
          return updateLoanCurrentMonth(0);
        } else {
          // Already at period 0, no need to update
          console.log("Loan is already at period 0, no update needed");
          setUpdating(false);
          return;
        }
      }

      let newCurrentPeriod;

      if (loan.loanType === "Weekly") {
        // Calculate weeks difference for weekly loans
        // Get the start date and current date without time components
        const startDateClean = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate()
        );
        const currentDateClean = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate()
        );

        // Calculate days difference (inclusive of start date)
        const daysDiff = Math.floor(
          (currentDateClean.getTime() - startDateClean.getTime()) /
            (24 * 60 * 60 * 1000)
        );

        // For weekly loans, we consider:
        // Week 1: Days 0-6 (first 7 days including start date)
        // Week 2: Days 7-13
        // And so on...

        // Calculate which week we're in (1-indexed)
        // For weekly loans, we need to be precise about when a week changes

        // For the specific case:
        // - Disbursement Date: April 26, 2025 (Saturday)
        // - Current Date: May 10, 2025 (Saturday, 14 days later)
        // We want this to be week 2, not week 3

        // Calculate weeks by dividing days by 7, but we need to adjust the calculation
        // to ensure we get week 2 for the 14-day case

        // If we're exactly at a multiple of 7 days (like 14 days), we want to be in the week
        // that just completed, not the next week
        const isExactMultipleOfSeven = daysDiff % 7 === 0;

        // Calculate the week number
        // For your specific example:
        // - 14 days = 2 weeks exactly
        // We want to be in week 2, not week 3
        const currentWeek =
          Math.floor(daysDiff / 7) + (isExactMultipleOfSeven ? 0 : 1);

        console.log("Weekly loan calculation:", {
          startDate: startDateClean.toISOString(),
          currentDate: currentDateClean.toISOString(),
          daysDiff,
          isExactMultipleOfSeven,
          currentWeek,
          // For debugging specific dates
          startDay: startDateClean.getDate(),
          currentDay: currentDateClean.getDate(),
          startMonth: startDateClean.getMonth() + 1,
          currentMonth: currentDateClean.getMonth() + 1,
        });

        // Set the current period
        newCurrentPeriod = currentWeek;
      } else {
        // Calculate months difference for monthly loans
        let monthsDiff =
          (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
          (currentDate.getMonth() - startDate.getMonth());

        // Add 1 because first month is month 1
        monthsDiff = monthsDiff + 1;

        // Adjust if we haven't reached the same day of the month yet
        if (currentDate.getDate() < startDate.getDate()) {
          monthsDiff--;
        }

        console.log("Monthly loan calculation:", {
          startDate: startDate.toISOString(),
          currentDate: currentDate.toISOString(),
          startDay: startDate.getDate(),
          currentDay: currentDate.getDate(),
          startMonth: startDate.getMonth() + 1,
          currentMonth: currentDate.getMonth() + 1,
          monthsDiffBeforeAdjustment:
            (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
            (currentDate.getMonth() - startDate.getMonth()) +
            1,
          monthsDiffAfterAdjustment: monthsDiff,
        });

        // Ensure we don't go below 1
        newCurrentPeriod = Math.max(1, monthsDiff);
      }

      // Ensure we don't exceed the duration
      newCurrentPeriod = Math.min(newCurrentPeriod, loan.duration);

      console.log(
        `Calculated current ${loan.loanType === "Weekly" ? "week" : "month"}:`,
        newCurrentPeriod,
        "from disbursement date:",
        loan.disbursementDate
      );

      if (newCurrentPeriod === loan.currentMonth) {
        // Don't show an alert, just silently return
        console.log("Current period is already up to date");
        setUpdating(false);
        return;
      }

      // Call the helper function to update the current period
      console.log(
        `Updating loan current month from ${loan.currentMonth} to ${newCurrentPeriod}`
      );
      await updateLoanCurrentMonth(newCurrentPeriod);
    } catch (error) {
      console.error("Error in updateCurrentMonth:", error);

      // Refresh the page data to ensure we have the latest state
      if (id) {
        try {
          // Ensure ID is a valid number
          const numericId =
            typeof id === "string"
              ? parseInt(id, 10)
              : Array.isArray(id)
              ? parseInt(id[0], 10)
              : 0;

          if (!numericId || isNaN(numericId)) {
            console.error(
              `Invalid loan ID: Unable to parse "${id}" as a number`
            );
            throw new Error("Invalid loan ID format");
          }

          // Fetch loan details
          const refreshResponse = await fetch(
            `/api/loans/consolidated?action=detail&id=${numericId}`
          );
          if (refreshResponse.ok) {
            const refreshedLoanData = await refreshResponse.json();

            // Fetch repayments again
            const refreshRepaymentsResponse = await fetch(
              `/api/loans/consolidated?action=repayments&id=${numericId}&page=${currentPage}&pageSize=${pageSize}`
            );
            if (refreshRepaymentsResponse.ok) {
              const refreshedRepaymentsData =
                await refreshRepaymentsResponse.json();

              // Extract repayments from the paginated response
              const refreshedRepaymentsList = Array.isArray(
                refreshedRepaymentsData
              )
                ? refreshedRepaymentsData
                : refreshedRepaymentsData?.repayments || [];

              // Update the loan state with fresh data
              setLoan({
                ...refreshedLoanData,
                repayments: refreshedRepaymentsList,
                remainingBalance: refreshedLoanData.remainingAmount,
              });
            } else {
              // If we can't get repayments, at least update the loan data
              setLoan((prev) => {
                if (!prev) return refreshedLoanData;
                return {
                  ...refreshedLoanData,
                  repayments: prev.repayments || [],
                  remainingBalance: refreshedLoanData.remainingAmount,
                };
              });
            }
          }
        } catch (refreshError) {
          console.error("Failed to refresh loan data:", refreshError);
        }
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <LoanDetailSkeleton />;
  }

  if (!loan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert-error px-4 py-3 rounded">
          <h2 className="text-xl font-bold mb-2">Loan Not Found</h2>
          <p>
            The loan you are looking for does not exist or has been removed.
          </p>
          <Link
            href="/loans"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Return to Loans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page header: title + action buttons */}
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
        <h1 className="page-title">Loan Details</h1>
        <div className="flex flex-row flex-wrap gap-1 sm:gap-2 w-auto items-center">
          <button
            onClick={() => setShowDeleteModal(true)}
            aria-label="Delete Loan"
            className="p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center bg-red-600 text-white hover:bg-red-700 sm:px-4 sm:py-2"
          >
            <svg className="h-5 w-5 block sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path fill="currentColor" d="M6 7h12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m2 0v13a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" />
            </svg>
            <span className="hidden sm:inline-flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path fill="currentColor" d="M6 7h12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m2 0v13a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" />
              </svg>
              Delete
            </span>
          </button>
          <Link
            href={`/loans/${loan?.id || ""}/edit`}
            aria-label="Edit Loan"
            className="p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center bg-yellow-500 text-white hover:bg-yellow-600 sm:px-4 sm:py-2"
          >
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
          <Link
            href="/loans"
            aria-label="Back to Loans"
            className="p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center btn-neutral sm:px-4 sm:py-2"
          >
            <svg className="h-5 w-5 block sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline-flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </span>
          </Link>
        </div>
      </div>

      {/* Borrower summary — always visible */}
      <div className="themed-card p-4 sm:p-5 mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold">{loan.borrower?.name || "Unknown"}</h2>
            <p className="text-gray-500 dark:text-theme-secondary text-sm mt-0.5">{loan.borrower?.contact || "No contact"}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wider">
                Current {loan.loanType === "Weekly" ? "Week" : "Month"}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-lg font-bold text-green-700">
                  {(() => {
                    const startDate = new Date(loan.disbursementDate);
                    const currentDate = new Date();
                    if (startDate > currentDate) return <span className="text-yellow-600 text-sm">Not Started</span>;
                    let calculatedPeriod;
                    if (loan.loanType === "Weekly") {
                      const startDateClean = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                      const currentDateClean = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                      const daysDiff = Math.floor((currentDateClean.getTime() - startDateClean.getTime()) / (24 * 60 * 60 * 1000));
                      const isExactMultipleOfSeven = daysDiff % 7 === 0;
                      const currentWeek = Math.floor(daysDiff / 7) + (isExactMultipleOfSeven ? 0 : 1);
                      calculatedPeriod = Math.min(Math.max(1, currentWeek), loan.duration);
                    } else {
                      let monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + (currentDate.getMonth() - startDate.getMonth()) + 1;
                      if (currentDate.getDate() < startDate.getDate()) monthsDiff--;
                      calculatedPeriod = Math.min(Math.max(1, monthsDiff), loan.duration);
                    }
                    return <>{calculatedPeriod} <span className="text-sm text-gray-500 font-normal">/ {loan.duration}</span></>;
                  })()}
                </span>
                {(() => {
                  const startDate = new Date(loan.disbursementDate);
                  const currentDate = new Date();
                  if (startDate > currentDate) {
                    return loan.currentMonth !== 0 && (
                      <button onClick={updateCurrentMonth} disabled={updating} className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors disabled:opacity-50">
                        {updating ? "..." : "Update"}
                      </button>
                    );
                  }
                  let calculatedPeriod;
                  if (loan.loanType === "Weekly") {
                    const startDateClean = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                    const currentDateClean = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                    const daysDiff = Math.floor((currentDateClean.getTime() - startDateClean.getTime()) / (24 * 60 * 60 * 1000));
                    const isExactMultipleOfSeven = daysDiff % 7 === 0;
                    calculatedPeriod = Math.min(Math.max(1, Math.floor(daysDiff / 7) + (isExactMultipleOfSeven ? 0 : 1)), loan.duration);
                  } else {
                    let monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + (currentDate.getMonth() - startDate.getMonth()) + 1;
                    if (currentDate.getDate() < startDate.getDate()) monthsDiff--;
                    calculatedPeriod = Math.min(Math.max(1, monthsDiff), loan.duration);
                  }
                  return loan.currentMonth !== calculatedPeriod && (
                    <button onClick={updateCurrentMonth} disabled={updating} className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors disabled:opacity-50">
                      {updating ? "..." : "Update"}
                    </button>
                  );
                })()}
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              loan.status === "Active" ? "bg-green-100 text-green-800" :
              loan.status === "Closed" ? "bg-gray-100 text-gray-700" :
              "bg-yellow-100 text-yellow-800"
            }`}>
              {loan.status}
            </span>
          </div>
        </div>
      </div>

      <div>
      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-surface-border mb-4 sm:mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto" aria-label="Loan tabs">
          {(["loan-details", "payment-schedule", "record-payment"] as const).map((tab) => {
            const labels = {
              "loan-details": "Loan Details",
              "payment-schedule": "Payment Schedule",
              "record-payment": "Record Payment",
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

      {/* Tab panels */}
      {activeTab === "loan-details" && (
        <div className="themed-card overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
              <div>
                <h3 className="detail-label">Loan Amount</h3>
                <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{formatCurrency(loan.amount)}</p>
              </div>
              <div>
                <h3 className="detail-label">Remaining Balance</h3>
                <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{formatCurrency(loan.remainingAmount)}</p>
              </div>
              <div>
                <h3 className="detail-label">Overdue</h3>
                <p className={`text-lg sm:text-xl font-semibold ${loan.missedPayments > 0 ? "text-red-600" : "text-green-600"}`}>
                  {loan.missedPayments > 0 ? `${loan.missedPayments} ${loan.missedPayments === 1 ? "payment" : "payments"}` : "None"}
                </p>
              </div>
              {loan.loanType === "Reducing Balance" ? (
                <div>
                  <h3 className="detail-label">Interest Rate (%)</h3>
                  <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{loan.interestPercentage}%</p>
                </div>
              ) : (
                loan.repaymentType === "Monthly" && (
                  <div>
                    <h3 className="detail-label">Interest Amount</h3>
                    <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{formatCurrency(loan.interestRate)}</p>
                  </div>
                )
              )}
              {loan.repaymentType === "Monthly" && (
                <div>
                  <h3 className="detail-label">Document Charge</h3>
                  <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{formatCurrency(loan.documentCharge || 0)}</p>
                </div>
              )}
              <div>
                <h3
                  className="detail-label flex items-center cursor-pointer"
                  onClick={() => {
                    document.getElementById("loan-profit")?.classList.toggle("hidden");
                    document.getElementById("loan-profit-explanation")?.classList.toggle("hidden");
                  }}
                >
                  Total Profit
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </h3>
                <div>
                  <p id="loan-profit" className="text-lg sm:text-xl font-semibold text-green-600 hidden">
                    {formatCurrency(calculateLoanProfit(loan, loan.repayments || []))}
                  </p>
                  <p id="loan-profit-explanation" className="text-xs text-gray-500 mt-1 hidden">
                    Profit calculated based on interest earned from all repayments and document charges.
                  </p>
                </div>
              </div>
              <div>
                <h3 className="detail-label">Installment Amount</h3>
                <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">
                  {loan.loanType === "Reducing Balance" ? "Dynamic" : formatCurrency(loan.installmentAmount || 0)}
                </p>
              </div>
              <div>
                <h3 className="detail-label">Loan Type</h3>
                <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{loan.loanType}</p>
              </div>
              <div>
                <h3 className="detail-label">Duration</h3>
                <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{loan.duration} {loan.loanType === "Weekly" ? "weeks" : "months"}</p>
              </div>
              <div>
                <h3 className="detail-label">Disbursement Date</h3>
                <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{formatDate(loan.disbursementDate)}</p>
              </div>
              <div>
                <h3 className="detail-label">Next Payment Date</h3>
                <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{formatDate(loan.nextPaymentDate)}</p>
              </div>
              <div>
                <h3 className="detail-label">End Date</h3>
                <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">
                  {formatDate(calculateEndDate(loan.disbursementDate, loan.duration, loan.loanType))}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "payment-schedule" && (
        <div className="themed-card overflow-hidden">
          <div className="p-4 sm:p-6 border-b flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">Payment Schedule</h2>
            <Link href={`/loans/${id}/repayments`} className="text-blue-600 hover:text-blue-800 text-sm">
              View All Repayments
            </Link>
          </div>

          {scheduleError && (
            <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
              <p>{scheduleError}</p>
            </div>
          )}

          <div className="overflow-x-auto w-full">
            <table className="themed-table text-xs sm:text-sm" style={{ minWidth: "500px" }}>
              <thead className="bg-gray-50 dark:bg-surface-elevated">
                <tr>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">Period</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">Due Date</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">Payment Date</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">Status</th>
                  {loan.loanType !== "Reducing Balance" && (
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loadingSchedules ? (
                  <tr>
                    <td colSpan={loan.loanType === "Reducing Balance" ? 5 : 6} className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-700 mr-2"></div>
                        <p>Loading payment schedules...</p>
                      </div>
                    </td>
                  </tr>
                ) : paymentSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={loan.loanType === "Reducing Balance" ? 5 : 6} className="px-6 py-4 text-center text-gray-500">
                      <p className="mb-2">No payment schedules to display.</p>
                      <p className="text-sm">Payment schedules show all past payments (including overdue) and the next upcoming payment if it's due within 3 days.</p>
                    </td>
                  </tr>
                ) : (
                  paymentSchedules.map((schedule) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const dueDate = new Date(schedule.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    const isDueTomorrow = dueDate.getTime() === tomorrow.getTime();
                    const gracePeriodDate = new Date(dueDate);
                    gracePeriodDate.setDate(gracePeriodDate.getDate() + 3);
                    const isOverdue = dueDate < today && today >= gracePeriodDate && (schedule.status === "Pending" || schedule.status === "Overdue") && loan.status !== "Completed";
                    const isSettled = loan.status === "Completed" && schedule.status !== "Paid" && schedule.status !== "Interest Only" && schedule.status !== "InterestOnly";

                    return (
                      <tr key={schedule.id} className={`hover:bg-gray-50 dark:hover:bg-surface-hover ${isOverdue ? "table-row-overdue" : isDueTomorrow ? "table-row-due-soon" : ""}`}>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">{schedule.period}</td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">{formatDate(schedule.dueDate)}</td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">
                          {(() => {
                            if (schedule.repayment && schedule.repayment.paidDate) return formatDate(schedule.repayment.paidDate);
                            if (loan.repayments && Array.isArray(loan.repayments)) {
                              const repayment = loan.repayments.find((r: any) => r.period === schedule.period);
                              return repayment && repayment.paidDate ? formatDate(repayment.paidDate) : "-";
                            }
                            return "-";
                          })()}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">
                          {formatCurrency(
                            schedule.paidAmount !== null && schedule.paidAmount !== undefined
                              ? schedule.paidAmount
                              : (schedule.amount > 0 ? schedule.amount : (schedule.interestAmount || 0))
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full w-fit ${
                              isSettled ? "bg-gray-100 text-gray-500 dark:bg-surface-elevated dark:text-theme-muted" :
                              schedule.status === "Paid" ? "bg-green-100 text-green-800" :
                              schedule.status === "Pending" ? (isOverdue ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800") :
                              schedule.status === "Overdue" ? "bg-red-100 text-red-800" :
                              schedule.status === "Missed" ? "bg-red-100 text-red-800" :
                              (schedule.status === "Interest Only" || schedule.status === "InterestOnly") ? "bg-blue-100 text-blue-800" :
                              "bg-gray-100 text-gray-900 dark:text-theme-primary"
                            }`}>
                              {isSettled ? "Settled" : isOverdue ? "Overdue" : schedule.status}
                            </span>
                            {isDueTomorrow && (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 w-fit">Due Tomorrow</span>
                            )}
                          </div>
                        </td>
                        {loan.loanType !== "Reducing Balance" && (
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1.5">
                              {(schedule.status === "Pending" || schedule.status === "Missed") && !isSettled && (
                                <>
                                  <button
                                    onClick={() => handleRecordPayment(schedule.period, "Paid")}
                                    disabled={updatingSchedule === schedule.period}
                                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    {updatingSchedule === schedule.period ? "Processing..." : "Mark Paid"}
                                  </button>
                                  {loan.repaymentType === "Monthly" && (
                                    <button
                                      onClick={() => handleRecordPayment(schedule.period, "InterestOnly")}
                                      disabled={updatingSchedule === schedule.period}
                                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                      </svg>
                                      {updatingSchedule === schedule.period ? "Processing..." : "Interest Only"}
                                    </button>
                                  )}
                                </>
                              )}
                              {schedule.repayment && (
                                <Link
                                  href={`/loans/${id}/repayments`}
                                  className="inline-flex items-center px-2 py-1 border border-gray-200 dark:border-surface-border text-xs font-medium rounded text-gray-700 dark:text-theme-secondary themed-card hover:bg-gray-50 dark:hover:bg-surface-hover"
                                >
                                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View Payment
                                </Link>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {paymentSchedules.length > 0 && (
            <div className="p-4 sm:p-6 border-t">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="pageSize" className="text-sm text-gray-700 dark:text-theme-secondary">Show:</label>
                  <select
                    id="pageSize"
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="themed-input text-sm py-1 pl-2 pr-8"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="relative inline-flex items-center rounded-l-md px-2 py-2 pagination-nav-btn">
                    <span className="text-xs">First</span>
                  </button>
                  <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 pagination-nav-btn">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold pagination-info">Page {currentPage} of {totalPages}</span>
                  <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 pagination-nav-btn">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="relative inline-flex items-center rounded-r-md px-2 py-2 pagination-nav-btn">
                    <span className="text-xs">Last</span>
                  </button>
                </nav>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "record-payment" && (
        <div>
          <RepaymentForm
            loanId={parseInt(id as string)}
            onSuccess={() => {
              fetchLoanDetails();
              schedulesInitialized.current = true;
              fetchPaymentSchedules();
              setActiveTab("payment-schedule");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            initialLoan={loan}
          />
        </div>
      )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="themed-card-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="mb-6">
              Are you sure you want to delete this repayment? This action cannot
              be undone.
            </p>

            {deleteError && (
              <div className="mb-4 alert-error px-4 py-3 rounded">
                <p>{deleteError}</p>
              </div>
            )}

            {deleteSuccess && (
              <div className="mb-4 alert-success px-4 py-3 rounded">
                <p>{deleteSuccess}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="btn-neutral px-4 py-2 rounded-lg transition duration-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRepayment}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanDetailPage;
