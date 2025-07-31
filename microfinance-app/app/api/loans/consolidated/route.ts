import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { getCurrentUserId } from "../../../../lib/auth";
import {
  generatePaymentSchedule,
  calculateNextPaymentDate,
  updateOverdueAmountFromRepayments,
} from "../../../../lib/paymentSchedule";
import { TRANSACTION_TYPES_CONFIG } from "../../../../config/config";
import { calculateTransactionBalance, getCurrentPartnerBalance, getCurrentTotalBalance, recalculateBalancesAfterDeletion } from "../../../../lib/balanceCalculator";

/**
 * Check if all periods of a loan have been completed (paid)
 * @param loanId The ID of the loan to check
 * @returns Promise<boolean> True if all periods are completed
 */
async function areAllPeriodsCompleted(loanId: number): Promise<boolean> {
  try {
    // Get the loan details
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { duration: true }
    });

    if (!loan) {
      return false;
    }

    // Get all repayments for this loan (excluding interest-only payments)
    const repayments = await prisma.repayment.findMany({
      where: {
        loanId,
        paymentType: { not: 'interestOnly' }
      },
      select: { period: true }
    });

    // Get unique periods that have been paid
    const paidPeriods = new Set(repayments.map(r => r.period));

    // Check if all periods from 1 to duration have been paid
    for (let period = 1; period <= loan.duration; period++) {
      if (!paidPeriods.has(period)) {
        return false; // Found an unpaid period
      }
    }

    return true; // All periods have been paid
  } catch (error) {
    console.error('Error checking if all periods are completed:', error);
    return false;
  }
}

// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";
    const id = searchParams.get("id")
      ? parseInt(searchParams.get("id")!)
      : null;

    // Get the current user ID
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case "list":
        return await getLoansList(request, currentUserId);
      case "detail":
        if (!id) {
          return NextResponse.json(
            { error: "Loan ID is required" },
            { status: 400 }
          );
        }
        return await getLoanDetail(request, id, currentUserId);
      case "repayments":
        if (!id) {
          return NextResponse.json(
            { error: "Loan ID is required" },
            { status: 400 }
          );
        }
        return await getRepayments(request, id, currentUserId);
      case "payment-schedules":
        if (!id) {
          return NextResponse.json(
            { error: "Loan ID is required" },
            { status: 400 }
          );
        }
        return await getPaymentSchedules(request, id, currentUserId);
      case "export":
        if (!id) {
          return NextResponse.json(
            { error: "Loan ID is required" },
            { status: 400 }
          );
        }
        return await exportLoan(request, id, currentUserId);
      case "export-all":
        return await exportAllLoans(request, currentUserId);
      case "export-selected":
        const idsParam = searchParams.get("ids");
        if (!idsParam) {
          return NextResponse.json(
            { error: "Loan IDs are required" },
            { status: 400 }
          );
        }
        const loanIds = idsParam.split(",").map((id) => parseInt(id));
        return await exportSelectedLoans(request, loanIds, currentUserId);
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in loans API:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "create";
    const id = searchParams.get("id")
      ? parseInt(searchParams.get("id")!)
      : null;

    // Get the current user ID
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case "create":
        return await createLoan(request, currentUserId);
      case "add-repayment":
        if (!id) {
          return NextResponse.json(
            { error: "Loan ID is required" },
            { status: 400 }
          );
        }
        return await addRepayment(request, id, currentUserId);
      case "update-overdue":
        if (id) {
          return await updateOverdue(request, id, currentUserId);
        } else {
          return await updateAllOverdue(request, currentUserId);
        }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in loans API:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "update";
    const id = searchParams.get("id")
      ? parseInt(searchParams.get("id")!)
      : null;

    // Get the current user ID
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case "update":
        if (!id) {
          return NextResponse.json(
            { error: "Loan ID is required" },
            { status: 400 }
          );
        }
        return await updateLoan(request, id, currentUserId);
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in loans API:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "delete";
    const id = searchParams.get("id")
      ? parseInt(searchParams.get("id")!)
      : null;

    // Get the current user ID
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case "delete":
        if (!id) {
          return NextResponse.json(
            { error: "Loan ID is required" },
            { status: 400 }
          );
        }
        return await deleteLoan(request, id, currentUserId);
      case "delete-repayment":
        if (!id) {
          return NextResponse.json(
            { error: "Loan ID is required" },
            { status: 400 }
          );
        }
        return await deleteRepayment(request, id, currentUserId);
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in loans API:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}

// Handler for getting loans list
async function getLoansList(request: NextRequest, currentUserId: number) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const status = searchParams.get("status") || null;

    // Validate pagination parameters
    const validPage = page > 0 ? page : 1;
    const validPageSize = pageSize > 0 ? pageSize : 10;

    // Calculate skip value for pagination
    const skip = (validPage - 1) * validPageSize;

    // Build where clause for filtering
    const where: any = {
      // Only show loans created by the current user
      createdById: currentUserId,
    };

    if (status) {
      where.status = status;
    }

    // Get total count for pagination with filter
    const totalCount = await prismaAny.loan.count({
      where,
    });

    // Get paginated loans with filter
    const loans = await prismaAny.loan.findMany({
      where,
      include: {
        _count: {
          select: { repayments: true },
        },
        borrower: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: validPageSize,
    });

    return NextResponse.json({
      loans,
      totalCount,
      page: validPage,
      pageSize: validPageSize,
      totalPages: Math.ceil(totalCount / validPageSize),
    });
  } catch (error) {
    console.error("Error fetching loans:", error);
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500 }
    );
  }
}

// Handler for getting a single loan
async function getLoanDetail(
  request: NextRequest,
  id: number,
  currentUserId: number
) {
  try {
    // Check if the loan exists
    const loan = await prismaAny.loan.findUnique({
      where: { id },
      include: {
        borrower: true,
        _count: {
          select: { repayments: true },
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Check if the current user is the owner
    if (loan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: "You do not have permission to view this loan" },
        { status: 403 }
      );
    }

    return NextResponse.json(loan);
  } catch (error) {
    console.error("Error fetching loan:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan" },
      { status: 500 }
    );
  }
}

// Handler for getting repayments of a loan
async function getRepayments(
  request: NextRequest,
  id: number,
  currentUserId: number
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");

    // Validate pagination parameters
    const validPage = page > 0 ? page : 1;
    const validPageSize = pageSize > 0 ? pageSize : 10;

    // Calculate skip value for pagination
    const skip = (validPage - 1) * validPageSize;

    // Check if the loan exists and belongs to the current user
    const loan = await prismaAny.loan.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Check if the current user is the owner
    if (loan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: "You do not have permission to view this loan" },
        { status: 403 }
      );
    }

    // Get total count for pagination
    const totalCount = await prismaAny.repayment.count({
      where: { loanId: id },
    });

    // Get paginated repayments
    const repayments = await prismaAny.repayment.findMany({
      where: { loanId: id },
      orderBy: [
        { period: "desc" },
        { paidDate: "desc" }
      ],
      skip,
      take: validPageSize,
    });

    // Fetch loan details to calculate dueDate for each repayment

    const loanForDueDate = await prismaAny.loan.findUnique({ where: { id } });
    let disbursementDate, repaymentType;
    if (loanForDueDate) {
      disbursementDate = new Date(loanForDueDate.disbursementDate);
      repaymentType = loanForDueDate.repaymentType;
    }

    // Add dueDate to each repayment
    const repaymentsWithDueDate = repayments.map((repayment) => {
      let dueDate = null;
      if (disbursementDate && repayment.period) {
        dueDate = new Date(disbursementDate);
        if (repaymentType === "Monthly") {
          dueDate.setMonth(disbursementDate.getMonth() + repayment.period);
        } else if (repaymentType === "Weekly") {
          dueDate.setDate(disbursementDate.getDate() + repayment.period * 7);
        }
      }
      return { ...repayment, dueDate: dueDate ? dueDate.toISOString() : null };
    });

    // No need to sort here since we're already sorting by period in the database query

    return NextResponse.json({
      repayments: repaymentsWithDueDate,
      totalCount,
      page: validPage,
      pageSize: validPageSize,
      totalPages: Math.ceil(totalCount / validPageSize),
    });
  } catch (error) {
    console.error("Error fetching repayments:", error);
    return NextResponse.json(
      { error: "Failed to fetch repayments" },
      { status: 500 }
    );
  }
}

// Handler for getting payment schedules of a loan
async function getPaymentSchedules(
  request: NextRequest,
  id: number,
  currentUserId: number
) {
  try {
    // Get the includeAll parameter from the query string
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get("includeAll") === "true";

    // Check if the loan exists and belongs to the current user
    const loan = await prismaAny.loan.findUnique({
      where: { id },
      include: {
        borrower: true,
        repayments: {
          orderBy: { paidDate: "asc" },
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Check if the current user is the owner
    if (loan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: "You do not have permission to view this loan" },
        { status: 403 }
      );
    }

    // Get the current date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day for accurate comparisons

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Calculate the date one week from now
    const oneWeekFromNow = new Date(today);
    oneWeekFromNow.setDate(today.getDate() + 7);
    
    // Calculate the date three days from now (for showing upcoming payments within 3 days)
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    // Generate dynamic payment schedules
    const schedules = [];
    const disbursementDate = new Date(loan.disbursementDate);
    const repaymentType = loan.repaymentType;
    const duration = loan.duration;
    const installmentAmount = loan.installmentAmount;
    const interestRate = loan.interestRate;

    // Create a map of repayments by period for quick lookup
    const repaymentsByPeriod = new Map();
    loan.repayments.forEach((repayment: any) => {
      if (repayment.period) {
        repaymentsByPeriod.set(repayment.period, repayment);
      }
    });

    // Generate schedules for each period
    for (let period = 1; period <= duration; period++) {
      // Calculate the due date for this period
      const dueDate = new Date(disbursementDate);
      if (repaymentType === "Monthly") {
        dueDate.setMonth(disbursementDate.getMonth() + period);
      } else if (repaymentType === "Weekly") {
        dueDate.setDate(disbursementDate.getDate() + period * 7);
      }

      // Log the first payment schedule due date for debugging
      if (period === 1) {
        console.log(`First payment due date: ${dueDate.toISOString()}`);
      }

      // Check if this period has been paid
      const repayment = repaymentsByPeriod.get(period);

      const isPaid = !!repayment;
      const isInterestOnly =
        repayment && repayment.paymentType === "INTEREST_ONLY";

      // Only include schedules that are due today or earlier, due tomorrow, or overdue
      // Normalize dates for comparison by setting hours to 0
      const dueDateNormalized = new Date(dueDate);
      dueDateNormalized.setHours(0, 0, 0, 0);

      const isDueToday = dueDateNormalized.getTime() === today.getTime();
      const isDueTomorrow = dueDateNormalized.getTime() === tomorrow.getTime();

      // Calculate the grace period date (3 days after due date)
      const gracePeriodDate = new Date(dueDateNormalized);
      gracePeriodDate.setDate(gracePeriodDate.getDate() + 3);

      // Only mark as overdue if it's past the grace period (3 days after due date)
      const isOverdue =
        dueDateNormalized < today && today >= gracePeriodDate && !isPaid;

      const isUpcoming =
        dueDateNormalized <= oneWeekFromNow && dueDateNormalized > today;
        
      // Check if the due date is within 3 days from now
      const isWithinThreeDays = dueDateNormalized <= threeDaysFromNow && dueDateNormalized >= today;

      // Check if this is the next payment date (first unpaid period)
      const nextPaymentDate = loan.nextPaymentDate
        ? new Date(loan.nextPaymentDate)
        : null;
      const isNextPayment =
        !isPaid &&
        nextPaymentDate &&
        nextPaymentDate.toDateString() === dueDate.toDateString();

      // ALWAYS include the first payment if it's not paid yet
      const isFirstUnpaidPayment = period === 1 && !isPaid;

      // For Record Payment page (includeAll=true): Show all unpaid schedules
      // For Loan Details page (includeAll=false): Show all past schedules (including overdue) and upcoming 1 schedule if within 3 days
      let shouldInclude;
      
      if (includeAll) {
        // For Record Payment page - show all unpaid schedules
        shouldInclude = !isPaid;
      } else {
        // For Loan Details page - show all past schedules (including overdue) and upcoming 1 schedule if within 3 days
        const isPast = dueDateNormalized <= today;
        shouldInclude = isPast || (isNextPayment && isWithinThreeDays);
      }

      if (shouldInclude) {
        schedules.push({
          id: period, // Use the period as the ID
          period,
          dueDate,
          amount: installmentAmount,
          interestAmount: interestRate,
          status: isPaid
            ? isInterestOnly
              ? "Interest Only"
              : "Paid"
            : isOverdue
            ? "Overdue"
            : "Pending",
          isPaid,
          isInterestOnly,
          isDueToday,
          isDueTomorrow,
          isOverdue,
          isUpcoming,
          isNextPayment,
          paidDate: repayment ? repayment.paidDate : null,
          paidAmount: repayment ? repayment.amount : null,
        });

        // Log if this is the next payment being included because it's within 3 days
        if (isNextPayment && isWithinThreeDays) {
          console.log(
            `Including upcoming payment date: ${dueDate.toISOString()} for period ${period} (within 3 days)`
          );
        }
      }
    }

    // Sort schedules by due date in descending order (newest first)
    schedules.sort(
      (a: any, b: any) =>
        new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
    );

    // If includeAll is true, return the array directly (for the Record Payment page)
    // Otherwise, return an object with schedules property (for the Loan Details page)
    if (includeAll) {
      return NextResponse.json(schedules);
    } else {
      return NextResponse.json({
        schedules,
        totalCount: schedules.length,
        page: 1,
        pageSize: schedules.length,
        totalPages: 1,
      });
    }
  } catch (error) {
    console.error("Error fetching payment schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment schedules" },
      { status: 500 }
    );
  }
}

// Handler for exporting a loan
async function exportLoan(
  request: NextRequest,
  id: number,
  currentUserId: number
) {
  try {
    // Get the loan for the current user
    const loan = await prismaAny.loan.findUnique({
      where: {
        id,
        createdById: currentUserId,
      },
      include: {
        borrower: true,
        repayments: true,
      },
    });

    // Check if the loan was found
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Generate Excel file
    const workbook = await generateLoansExcel([loan]);
    const buffer = await workbook.xlsx.writeBuffer();

    // Format current date for filename
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    // Set response headers for file download
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=loan_${id}_${dateStr}.xlsx`,
      },
    });
  } catch (error) {
    console.error("Error exporting loan:", error);
    throw new Error(
      `Failed to export loan: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Handler for exporting all loans
async function exportAllLoans(request: NextRequest, currentUserId: number) {
  try {
    // Get all loans for the current user
    const loans = await prismaAny.loan.findMany({
      where: {
        createdById: currentUserId,
      },
      include: {
        borrower: true,
        repayments: true,
      },
    });

    // Generate Excel file
    const workbook = await generateLoansExcel(loans);
    const buffer = await workbook.xlsx.writeBuffer();

    // Format current date for filename
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    // Set response headers for file download
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=all_loans_${dateStr}.xlsx`,
      },
    });
  } catch (error) {
    console.error("Error exporting all loans:", error);
    throw new Error(
      `Failed to export loans: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Handler for exporting selected loans
async function exportSelectedLoans(
  request: NextRequest,
  loanIds: number[],
  currentUserId: number
) {
  try {
    // Get selected loans for the current user
    const loans = await prismaAny.loan.findMany({
      where: {
        id: { in: loanIds },
        createdById: currentUserId,
      },
      include: {
        borrower: true,
        repayments: true,
      },
    });

    // Check if any loans were found
    if (loans.length === 0) {
      return NextResponse.json(
        { error: "No loans found with the provided IDs" },
        { status: 404 }
      );
    }

    // Generate Excel file
    const workbook = await generateLoansExcel(loans);
    const buffer = await workbook.xlsx.writeBuffer();

    // Format current date for filename
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    // Set response headers for file download
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=selected_loans_${dateStr}.xlsx`,
      },
    });
  } catch (error) {
    console.error("Error exporting selected loans:", error);
    throw new Error(
      `Failed to export loans: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Helper function to generate Excel file for loans
async function generateLoansExcel(loans: any[]) {
  // Import Excel.js dynamically
  const ExcelJS = require("exceljs");

  // Create a new workbook
  const workbook = new ExcelJS.Workbook();

  // Add a worksheet for loan details
  const worksheet = workbook.addWorksheet("Loan Details");

  // Define columns with optimized widths for better readability
  worksheet.columns = [
    { header: "Loan ID", key: "id", width: 10 },
    { header: "Borrower Name", key: "borrowerName", width: 25 },
    { header: "Contact", key: "contact", width: 15 },
    { header: "Loan Type", key: "loanType", width: 12 },
    { header: "Amount", key: "amount", width: 15 },
    { header: "Interest Rate", key: "interestRate", width: 12 },
    { header: "Document Charge", key: "documentCharge", width: 15 },
    { header: "Installment Amount", key: "installmentAmount", width: 18 },
    { header: "Duration", key: "duration", width: 10 },
    { header: "Disbursement Date", key: "disbursementDate", width: 20 },
    { header: "Remaining Amount", key: "remainingAmount", width: 18 },
    { header: "Status", key: "status", width: 12 },
    { header: "Overdue", key: "overdue", width: 15 },
    { header: "Next Payment Date", key: "nextPaymentDate", width: 20 },
    { header: "Purpose", key: "purpose", width: 35 },
  ];

  // Format header row with bold font
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  // Add data
  loans.forEach((loan) => {
    worksheet.addRow({
      id: loan.id,
      borrowerName: loan.borrower?.name || "Unknown",
      contact: loan.borrower?.contact || "Unknown",
      loanType: loan.loanType,
      amount: loan.amount,
      interestRate: loan.interestRate,
      documentCharge: loan.documentCharge || 0,
      installmentAmount: loan.installmentAmount,
      duration: loan.duration,
      disbursementDate: loan.disbursementDate
        ? new Date(loan.disbursementDate).toLocaleDateString()
        : "Unknown",
      remainingAmount: loan.remainingAmount,
      status: loan.status,
      overdue:
        loan.missedPayments > 0
          ? `${loan.missedPayments} ${
              loan.missedPayments === 1 ? "payment" : "payments"
            }`
          : "None",
      nextPaymentDate: loan.nextPaymentDate
        ? new Date(loan.nextPaymentDate).toLocaleDateString()
        : "N/A",
      purpose: loan.purpose || "N/A",
    });
  });

  // Add a worksheet for repayments
  const repaymentsWorksheet = workbook.addWorksheet("Repayments");

  // Define columns for repayments with optimized widths
  repaymentsWorksheet.columns = [
    { header: "Loan ID", key: "loanId", width: 10 },
    { header: "Borrower Name", key: "borrowerName", width: 25 },
    { header: "Repayment ID", key: "repaymentId", width: 15 },
    { header: "Amount", key: "amount", width: 15 },
    { header: "Paid Date", key: "paidDate", width: 20 },
    { header: "Payment Type", key: "paymentType", width: 15 },
    { header: "Period", key: "period", width: 10 },
  ];

  // Format header row with bold font and center alignment
  repaymentsWorksheet.getRow(1).font = { bold: true };
  repaymentsWorksheet.getRow(1).alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  // Add repayment data
  loans.forEach((loan) => {
    if (loan.repayments && loan.repayments.length > 0) {
      loan.repayments.forEach((repayment: any) => {
        repaymentsWorksheet.addRow({
          loanId: loan.id,
          borrowerName: loan.borrower?.name || "Unknown",
          repaymentId: repayment.id,
          amount: repayment.amount,
          paidDate: repayment.paidDate
            ? new Date(repayment.paidDate).toLocaleDateString()
            : "Unknown",
          paymentType: repayment.paymentType || "full",
          period: repayment.period || "N/A",
        });
      });
    }
  });

  return workbook;
}

/**
 * Creates a new loan and its associated disbursement transaction in a single atomic operation.
 */
/**
 * Creates a new loan and its associated disbursement transaction using alternative logic.
 */
async function createLoan(request: NextRequest, currentUserId: number) {
  try {
    const body = await request.json();
    const activePartnerName = request.headers.get("x-active-partner");

    if (!activePartnerName) {
      return NextResponse.json({ error: "Active partner not selected" }, { status: 400 });
    }

    const partner = await prisma.partner.findFirst({
      where: { name: activePartnerName, createdById: currentUserId },
    });

    if (!partner) {
      return NextResponse.json({ error: "Active partner not found" }, { status: 400 });
    }

    // ... (Validation and globalMember logic remains the same) ...
     let globalMember;
    if (body.globalMemberId) {
      globalMember = await prisma.globalMember.findUnique({
        where: { id: body.globalMemberId },
      });
      if (!globalMember) {
        return NextResponse.json(
          { error: "Global member not found" },
          { status: 404 }
        );
      }
    } else {
      globalMember = await prisma.globalMember.create({
        data: {
          name: body.borrowerName,
          contact: body.contact,
          email: body.email || null,
          address: body.address || null,
          createdById: currentUserId,
        },
      });
    }

    const disbursementDate = new Date(body.disbursementDate);
    const initialNextPaymentDate = new Date(disbursementDate);
    if (body.repaymentType === "Monthly") {
      initialNextPaymentDate.setMonth(disbursementDate.getMonth() + 1);
    } else if (body.repaymentType === "Weekly") {
      initialNextPaymentDate.setDate(disbursementDate.getDate() + 7);
    }

    // Calculate balances before creating the transaction
    const loanAmount = parseFloat(body.amount);
    const affectedPartnerId = partner.id; // LOAN_DISBURSEMENT affects the sending partner
    
    const currentPartnerBalance = await getCurrentPartnerBalance(affectedPartnerId, currentUserId);
    const currentTotalBalance = await getCurrentTotalBalance(currentUserId);
    
    const balanceCalculation = calculateTransactionBalance(
      {
        type: TRANSACTION_TYPES_CONFIG.LOAN_DISBURSEMENT,
        amount: loanAmount,
        from_partner_id: partner.id,
        to_partner_id: null
      },
      affectedPartnerId,
      currentPartnerBalance,
      currentTotalBalance
    );

    // --- ALTERNATIVE LOGIC ---
    // Create the Transaction first, and nest the Loan creation inside it.
    const createdTransaction = await prisma.transaction.create({
      data: {
        type: TRANSACTION_TYPES_CONFIG.LOAN_DISBURSEMENT,
        amount: loanAmount,
        date: disbursementDate,
        note: `Loan disbursed to ${body.borrowerName}`,
        createdById: currentUserId,
        action_performer: partner.name,
        entered_by: partner.name,
        from_partner_id: partner.id,
        // Add balance tracking
        partnerBalance: balanceCalculation.partnerBalance,
        totalBalance: balanceCalculation.totalBalance,
        // Nest the Loan creation here
        loan: {
          create: {
            borrowerId: globalMember.id,
            loanType: body.loanType,
            amount: loanAmount,
            interestRate: parseFloat(body.interestRate),
            documentCharge: body.documentCharge ? parseFloat(body.documentCharge) : 0,
            installmentAmount: body.installmentAmount ? parseFloat(body.installmentAmount) : 0,
            duration: parseInt(body.duration),
            disbursementDate,
            repaymentType: body.repaymentType,
            remainingAmount: loanAmount,
            status: "Active",
            purpose: body.purpose || null,
            createdById: currentUserId,
            nextPaymentDate: initialNextPaymentDate,
            disbursed_by_id: partner.id,
            entered_by_id: partner.id,
          },
        },
      },
      // Include the newly created Loan and its Borrower in the response
      include: {
        loan: {
          include: {
            borrower: true,
          },
        },
      },
    });

    // The loan object is now nested inside the transaction response
    const loan = createdTransaction.loan;

    // Generate payment schedule (can run after loan creation)
    try {
      await generatePaymentSchedule(loan.id, loan as any);
    } catch (scheduleError) {
      console.error("Error generating payment schedule:", scheduleError);
    }

    // Return the loan object, consistent with the original function's response
    return NextResponse.json(loan, { status: 201 });

  } catch (error) {
    console.error("Error creating loan:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create loan", details: errorMessage }, { status: 500 });
  }
}

/**
 * Adds a repayment to a loan and creates the associated transaction.
 * Uses Prisma's $transaction to ensure both the repayment is created and the loan is updated atomically.
 */
/**
 * Adds a repayment to a loan using the reliable "Transaction-first" pattern.
 */
async function addRepayment(request: NextRequest, id: number, currentUserId: number) {
  try {
    const requestBody = await request.json();
    const {
      amount,
      paidDate,
      paymentType = "REGULAR",
      scheduleId,
      collected_by, // partner ID
    } = requestBody;

    const activePartnerName = request.headers.get("x-active-partner") || "Me";

    // --- Input validation (remains the same) ... ---

    const collectorPartner = await prisma.partner.findUnique({ where: { id: parseInt(collected_by) } });
    if (!collectorPartner) {
      return NextResponse.json({ error: "Collector partner not found" }, { status: 400 });
    }
    const entryPartner = await prisma.partner.findFirst({ where: { name: activePartnerName, createdById: currentUserId }});
    if (!entryPartner) {
        return NextResponse.json({ error: "Data entry partner not found" }, { status: 400 });
    }

    const loanId = id;
    const paymentAmount = parseFloat(amount);
    const period = Number(scheduleId);

    // Fetch the loan first to get its current state and borrower info
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { borrower: true },
    });

    if (!loan || loan.createdById !== currentUserId) {
      throw new Error("Loan not found or permission denied");
    }

    // Calculate balances before creating the transaction
    const transactionDate = new Date(paidDate);
    const affectedPartnerId = collectorPartner.id; // LOAN_REPAYMENT affects the receiving partner
    
    const currentPartnerBalance = await getCurrentPartnerBalance(affectedPartnerId, currentUserId);
    const currentTotalBalance = await getCurrentTotalBalance(currentUserId);
    
    const balanceCalculation = calculateTransactionBalance(
      {
        type: TRANSACTION_TYPES_CONFIG.LOAN_REPAYMENT,
        amount: paymentAmount,
        from_partner_id: null,
        to_partner_id: collectorPartner.id
      },
      affectedPartnerId,
      currentPartnerBalance,
      currentTotalBalance
    );

    // --- REFACTORED REPAYMENT CREATION (PLAN B) ---
    // 1. Create the Transaction and nest the Repayment inside it.
    const createdTransaction = await prisma.transaction.create({
        data: {
            type: TRANSACTION_TYPES_CONFIG.LOAN_REPAYMENT,
            amount: paymentAmount,
            date: transactionDate,
            note: `Repayment from ${loan.borrower?.name} - Period ${period}`,
            createdById: currentUserId,
            action_performer: collectorPartner.name,
            entered_by: entryPartner.name,
            to_partner_id: collectorPartner.id,
            // Add balance tracking
            partnerBalance: balanceCalculation.partnerBalance,
            totalBalance: balanceCalculation.totalBalance,
            // Nest the Repayment creation
            repayment: {
                create: {
                    loanId,
                    amount: paymentAmount,
                    paidDate: transactionDate,
                    paymentType,
                    period,
                    collected_by_id: collectorPartner.id,
                    entered_by_id: entryPartner.id,
                    createdById: currentUserId,
                }
            }
        },
        include: {
            repayment: { // Include the new repayment in the response
                include: {
                    collectedBy: true
                }
            }
        }
    });

    // 2. Calculate the new loan state after the payment
    // Instead of subtracting from remaining amount, recalculate based on completed periods

    // Get all repayments for this loan (including the one we just added)
    const allRepayments = await prisma.repayment.findMany({
      where: { loanId },
      select: { period: true, paymentType: true }
    });

    // Count completed periods (excluding interest-only payments)
    const completedPeriods = new Set(
      allRepayments
        .filter(r => r.paymentType !== 'interestOnly')
        .map(r => r.period)
    ).size;

    let newRemainingAmount;
    if (loan.loanType === "Weekly") {
      // For weekly loans: remaining = original amount - (completed periods / (total periods - 1)) * original amount
      const progressRatio = completedPeriods / (loan.duration - 1);
      const paidAmount = progressRatio * loan.amount;
      newRemainingAmount = Math.max(0, loan.amount - paidAmount);
    } else {
      // For monthly loans: remaining = original amount - (completed periods / total periods) * original amount
      const progressRatio = completedPeriods / loan.duration;
      const paidAmount = progressRatio * loan.amount;
      newRemainingAmount = Math.max(0, loan.amount - paidAmount);
    }
    
    const updatedDuration = paymentType === "INTEREST_ONLY" ? loan.duration + 1 : loan.duration;
    const nextPaymentDate = await calculateNextPaymentDate(loanId);
    const { overdueAmount, missedPayments } = await updateOverdueAmountFromRepayments(loanId) || { overdueAmount: 0, missedPayments: 0 };

    // Check if all periods are completed to determine status
    const allPeriodsCompleted = await areAllPeriodsCompleted(loanId);
    const newStatus = allPeriodsCompleted ? "Completed" : "Active";

    // 3. Update the loan with the new state
    await prisma.loan.update({
      where: { id: loanId },
      data: {
        remainingAmount: newRemainingAmount,
        duration: updatedDuration,
        status: newStatus,
        nextPaymentDate: allPeriodsCompleted ? null : nextPaymentDate,
        overdueAmount,
        missedPayments,
      },
    });
    
    // Return the repayment object from the transaction response
    return NextResponse.json({loan: createdTransaction.repayment}, { status: 201 });

  } catch (error) {
    console.error("Error creating repayment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to create repayment: ${errorMessage}`}, { status: 500 });
  }
}

// Handler for updating a loan
async function updateLoan(
  request: NextRequest,
  id: number,
  currentUserId: number
) {
  try {
    const body = await request.json();

    // First, get the current loan to find the borrower
    const currentLoan = await prismaAny.loan.findUnique({
      where: { id },
      include: { borrower: true },
    });

    if (!currentLoan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Check if the current user is the owner
    if (currentLoan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: "You do not have permission to update this loan" },
        { status: 403 }
      );
    }

    // Update the global member if needed
    if (body.borrowerName || body.contact) {
      await prismaAny.globalMember.update({
        where: { id: currentLoan.borrowerId },
        data: {
          name: body.borrowerName || currentLoan.borrower.name,
          contact: body.contact || currentLoan.borrower.contact,
          email:
            body.email !== undefined ? body.email : currentLoan.borrower.email,
          address:
            body.address !== undefined
              ? body.address
              : currentLoan.borrower.address,
        },
      });
    }

    // Log the update request
    console.log("Updating loan with data:", body);

    // Update the loan
    const loan = await prismaAny.loan.update({
      where: { id },
      data: {
        loanType: body.loanType,
        amount: body.amount ? parseFloat(body.amount) : undefined,
        interestRate: body.interestRate
          ? parseFloat(body.interestRate)
          : undefined,
        documentCharge:
          body.documentCharge !== undefined
            ? parseFloat(body.documentCharge)
            : undefined,
        installmentAmount:
          body.installmentAmount !== undefined
            ? parseFloat(body.installmentAmount)
            : undefined,
        duration: body.duration ? parseInt(body.duration) : undefined,
        disbursementDate: body.disbursementDate
          ? new Date(body.disbursementDate)
          : undefined,
        repaymentType: body.repaymentType,
        remainingAmount: body.remainingAmount
          ? parseFloat(body.remainingAmount)
          : undefined,
        status: body.status,
        purpose: body.purpose,
        // Add support for updating currentMonth
        currentMonth:
          body.currentMonth !== undefined
            ? parseInt(body.currentMonth)
            : undefined,
      },
      include: {
        borrower: true,
      },
    });

    // Recalculate the next payment date based on the updated loan details
    try {
      const nextPaymentDate = await calculateNextPaymentDate(id);

      // Update the loan with the new next payment date
      await prismaAny.loan.update({
        where: { id },
        data: {
          nextPaymentDate,
        },
      });

      // Add the calculated next payment date to the response
      loan.nextPaymentDate = nextPaymentDate;
    } catch (error) {
      console.error("Error calculating next payment date:", error);
      // Continue even if next payment date calculation fails
    }

    return NextResponse.json(loan);
  } catch (error) {
    console.error("Error updating loan:", error);
    return NextResponse.json(
      { error: "Failed to update loan" },
      { status: 500 }
    );
  }
}

/**
 * Deletes a loan and all associated records using their direct relationships.
 */
async function deleteLoan(request: NextRequest, id: number, currentUserId: number) {
  try {
    // --- REFACTORED DELETION LOGIC ---
    // Use Prisma's $transaction to ensure all related data is deleted atomically.
    await prisma.$transaction(async (tx) => {
      // 1. Fetch the loan and its related repayment and transaction IDs
      const existingLoan = await tx.loan.findUnique({
        where: { id },
        include: {
          transaction: {
            select: {
              id: true,
              date: true,
              createdAt: true
            }
          },
          repayments: {
            select: {
              id: true,
              transactionId: true,
              transaction: {
                select: {
                  id: true,
                  date: true,
                  createdAt: true
                }
              }
            },
          },
        },
      });

      if (!existingLoan) {
        throw new Error("Loan not found");
      }

      if (existingLoan.createdById !== currentUserId) {
        throw new Error("You do not have permission to delete this loan");
      }

      // 2. Collect all transaction IDs to be deleted and find the earliest date
      const transactionIdsToDelete: number[] = [];
      let earliestTransactionDate = new Date();
      let earliestTransactionId = Number.MAX_SAFE_INTEGER;

      if (existingLoan.transaction) {
        transactionIdsToDelete.push(existingLoan.transaction.id);
        if (existingLoan.transaction.date < earliestTransactionDate) {
          earliestTransactionDate = existingLoan.transaction.date;
          earliestTransactionId = existingLoan.transaction.id;
        }
      }

      existingLoan.repayments.forEach(repayment => {
        if (repayment.transaction) {
          transactionIdsToDelete.push(repayment.transaction.id);
          if (repayment.transaction.date < earliestTransactionDate) {
            earliestTransactionDate = repayment.transaction.date;
            earliestTransactionId = repayment.transaction.id;
          }
        }
      });

      // 3. Delete all associated transactions
      if (transactionIdsToDelete.length > 0) {
        await tx.transaction.deleteMany({
          where: { id: { in: transactionIdsToDelete } },
        });
      }

      // 4. Delete related repayments (Prisma handles this cascade if configured, but explicit is safer)
      await tx.repayment.deleteMany({
        where: { loanId: id },
      });

      // 5. Delete payment schedules
      await tx.paymentSchedule.deleteMany({
        where: { loanId: id },
      });

      // 6. Delete the loan itself
      await tx.loan.delete({
        where: { id },
      });

      // 7. Recalculate balances for all subsequent transactions
      if (transactionIdsToDelete.length > 0) {
        await recalculateBalancesAfterDeletion(
          currentUserId,
          earliestTransactionDate,
          earliestTransactionId
        );
      }
    });

    return NextResponse.json({ message: "Loan deleted successfully" });
  } catch (error) {
    console.error("Error deleting loan:", error);
    const errorMessage = error instanceof Error ? error.message : "Permission denied";
    return NextResponse.json({ error: `Failed to delete loan: ${errorMessage}` }, { status: 500 });
  }
}

/**
 * Deletes a repayment and its associated transaction using the direct transactionId link.
 */
async function deleteRepayment(request: NextRequest, id: number, currentUserId: number) {
    try {
        const body = await request.json();
        const loanId = id;
        const repaymentId = body.repaymentId;

        if (!repaymentId) {
            return NextResponse.json({ error: "Repayment ID is required" }, { status: 400 });
        }

        // --- REFACTORED DELETION LOGIC ---
        await prisma.$transaction(async (tx) => {
            // 1. Fetch the repayment to get its details and transactionId
            const repayment = await tx.repayment.findUnique({
                where: { id: repaymentId },
                include: { 
                    loan: true,
                    transaction: {
                        select: {
                            id: true,
                            date: true,
                            createdAt: true
                        }
                    }
                },
            });

            if (!repayment || repayment.loan.createdById !== currentUserId) {
                throw new Error("Repayment not found or permission denied.");
            }

            const deletedTransactionDate = repayment.transaction?.date || new Date();
            const deletedTransactionId = repayment.transaction?.id || 0;
            
            // 2. Delete the associated transaction if it exists
            if (repayment.transactionId) {
                await tx.transaction.delete({
                    where: { id: repayment.transactionId },
                });
            }

            // 3. Delete the repayment itself
            await tx.repayment.delete({
                where: { id: repaymentId },
            });
            
            // 4. Recalculate loan state after deletion
            const currentLoan = repayment.loan;

            // Get remaining repayments after this deletion (excluding the one we just deleted)
            const remainingRepayments = await tx.repayment.findMany({
                where: { loanId },
                select: { period: true, paymentType: true }
            });

            // Count completed periods (excluding interest-only payments)
            const completedPeriods = new Set(
                remainingRepayments
                    .filter(r => r.paymentType !== 'interestOnly')
                    .map(r => r.period)
            ).size;

            let newRemainingAmount;
            if (currentLoan.loanType === "Weekly") {
                // For weekly loans: remaining = original amount - (completed periods / (total periods - 1)) * original amount
                const progressRatio = completedPeriods / (currentLoan.duration - 1);
                const paidAmount = progressRatio * currentLoan.amount;
                newRemainingAmount = Math.max(0, currentLoan.amount - paidAmount);
            } else {
                // For monthly loans: remaining = original amount - (completed periods / total periods) * original amount
                const progressRatio = completedPeriods / currentLoan.duration;
                const paidAmount = progressRatio * currentLoan.amount;
                newRemainingAmount = Math.max(0, currentLoan.amount - paidAmount);
            }

            const newDuration = repayment.paymentType === "INTEREST_ONLY" 
                ? Math.max(1, currentLoan.duration - 1) 
                : currentLoan.duration;

            const nextPaymentDate = await calculateNextPaymentDate(loanId);
            const { overdueAmount, missedPayments } = await updateOverdueAmountFromRepayments(loanId) || { overdueAmount: 0, missedPayments: 0 };
            
            // 5. Update the loan
            await tx.loan.update({
                where: { id: loanId },
                data: {
                    remainingAmount: newRemainingAmount,
                    duration: newDuration,
                    status: "Active",
                    nextPaymentDate,
                    overdueAmount,
                    missedPayments,
                },
            });

            // 6. Recalculate balances for all subsequent transactions
            if (repayment.transaction) {
                await recalculateBalancesAfterDeletion(
                    currentUserId,
                    deletedTransactionDate,
                    deletedTransactionId
                );
            }
        });

        return NextResponse.json({ message: "Repayment deleted successfully" });
    } catch (error) {
        console.error("Error deleting repayment:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: `Failed to delete repayment: ${errorMessage}` }, { status: 500 });
    }
}

// Handler for updating overdue amount for a loan
async function updateOverdue(
  request: NextRequest,
  id: number,
  currentUserId: number
) {
  try {
    // Check if the loan exists and belongs to the current user
    const loan = await prismaAny.loan.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Check if the current user is the owner
    if (loan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: "You do not have permission to update this loan" },
        { status: 403 }
      );
    }

    // Update the overdue amount
    const result = await updateOverdueAmountFromRepayments(id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating overdue amount:", error);
    return NextResponse.json(
      { error: "Failed to update overdue amount" },
      { status: 500 }
    );
  }
}

// Handler for updating overdue amounts for all loans
async function updateAllOverdue(request: NextRequest, currentUserId: number) {
  try {
    // Get all active loans for the current user
    const loans = await prismaAny.loan.findMany({
      where: {
        status: "Active",
        createdById: currentUserId,
      },
      select: { id: true },
    });

    // Update overdue amount for each loan
    const results = await Promise.all(
      loans.map(async (loan: any) => {
        try {
          const result = await updateOverdueAmountFromRepayments(loan.id);
          return { loanId: loan.id, ...result, success: true };
        } catch (error) {
          console.error(
            `Error updating overdue amount for loan ${loan.id}:`,
            error
          );
          return {
            loanId: loan.id,
            success: false,
            error: "Failed to update overdue amount",
          };
        }
      })
    );

    return NextResponse.json({
      totalLoans: loans.length,
      updatedLoans: results.filter((r: any) => r.success).length,
      results,
    });
  } catch (error) {
    console.error("Error updating all overdue amounts:", error);
    return NextResponse.json(
      { error: "Failed to update overdue amounts" },
      { status: 500 }
    );
  }
}
