import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
import { generatePaymentSchedule, calculateNextPaymentDate, updateOverdueAmountFromRepayments } from '@/lib/paymentSchedule';

// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;

    // Get the current user ID
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case 'list':
        return await getLoansList(request, currentUserId);
      case 'detail':
        if (!id) {
          return NextResponse.json(
            { error: 'Loan ID is required' },
            { status: 400 }
          );
        }
        return await getLoanDetail(request, id, currentUserId);
      case 'repayments':
        if (!id) {
          return NextResponse.json(
            { error: 'Loan ID is required' },
            { status: 400 }
          );
        }
        return await getRepayments(request, id, currentUserId);
      case 'payment-schedules':
        if (!id) {
          return NextResponse.json(
            { error: 'Loan ID is required' },
            { status: 400 }
          );
        }
        return await getPaymentSchedules(request, id, currentUserId);
      case 'export':
        if (!id) {
          return NextResponse.json(
            { error: 'Loan ID is required' },
            { status: 400 }
          );
        }
        return await exportLoan(request, id, currentUserId);
      case 'export-all':
        return await exportAllLoans(request, currentUserId);
      case 'export-selected':
        const idsParam = searchParams.get('ids');
        if (!idsParam) {
          return NextResponse.json(
            { error: 'Loan IDs are required' },
            { status: 400 }
          );
        }
        const loanIds = idsParam.split(',').map(id => parseInt(id));
        return await exportSelectedLoans(request, loanIds, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in loans API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'create';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;

    // Get the current user ID
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case 'create':
        return await createLoan(request, currentUserId);
      case 'add-repayment':
        if (!id) {
          return NextResponse.json(
            { error: 'Loan ID is required' },
            { status: 400 }
          );
        }
        return await addRepayment(request, id, currentUserId);
      case 'update-overdue':
        if (id) {
          return await updateOverdue(request, id, currentUserId);
        } else {
          return await updateAllOverdue(request, currentUserId);
        }
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in loans API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'update';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;

    // Get the current user ID
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case 'update':
        if (!id) {
          return NextResponse.json(
            { error: 'Loan ID is required' },
            { status: 400 }
          );
        }
        return await updateLoan(request, id, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in loans API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'delete';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;

    // Get the current user ID
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case 'delete':
        if (!id) {
          return NextResponse.json(
            { error: 'Loan ID is required' },
            { status: 400 }
          );
        }
        return await deleteLoan(request, id, currentUserId);
      case 'delete-repayment':
        if (!id) {
          return NextResponse.json(
            { error: 'Loan ID is required' },
            { status: 400 }
          );
        }
        return await deleteRepayment(request, id, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in loans API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

// Handler for getting loans list
async function getLoansList(request: NextRequest, currentUserId: number) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const status = searchParams.get('status') || null;

    // Validate pagination parameters
    const validPage = page > 0 ? page : 1;
    const validPageSize = pageSize > 0 ? pageSize : 10;

    // Calculate skip value for pagination
    const skip = (validPage - 1) * validPageSize;

    // Build where clause for filtering
    const where: any = {
      // Only show loans created by the current user
      createdById: currentUserId
    };

    if (status) {
      where.status = status;
    }

    // Get total count for pagination with filter
    const totalCount = await prismaAny.loan.count({
      where
    });

    // Get paginated loans with filter
    const loans = await prismaAny.loan.findMany({
      where,
      include: {
        _count: {
          select: { repayments: true }
        },
        borrower: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: validPageSize,
    });

    return NextResponse.json({
      loans,
      totalCount,
      page: validPage,
      pageSize: validPageSize,
      totalPages: Math.ceil(totalCount / validPageSize)
    });
  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loans' },
      { status: 500 }
    );
  }
}

// Handler for getting a single loan
async function getLoanDetail(request: NextRequest, id: number, currentUserId: number) {
  try {
    // Check if the loan exists
    const loan = await prismaAny.loan.findUnique({
      where: { id },
      include: {
        borrower: true,
        _count: {
          select: { repayments: true }
        }
      }
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    // Check if the current user is the owner
    if (loan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to view this loan' },
        { status: 403 }
      );
    }

    return NextResponse.json(loan);
  } catch (error) {
    console.error('Error fetching loan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loan' },
      { status: 500 }
    );
  }
}

// Handler for getting repayments of a loan
async function getRepayments(request: NextRequest, id: number, currentUserId: number) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    // Validate pagination parameters
    const validPage = page > 0 ? page : 1;
    const validPageSize = pageSize > 0 ? pageSize : 10;

    // Calculate skip value for pagination
    const skip = (validPage - 1) * validPageSize;

    // Check if the loan exists and belongs to the current user
    const loan = await prismaAny.loan.findUnique({
      where: { id },
      select: { createdById: true }
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    // Check if the current user is the owner
    if (loan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to view this loan' },
        { status: 403 }
      );
    }

    // Get total count for pagination
    const totalCount = await prismaAny.repayment.count({
      where: { loanId: id }
    });

    // Get paginated repayments
    const repayments = await prismaAny.repayment.findMany({
      where: { loanId: id },
      orderBy: { paidDate: 'desc' },
      skip,
      take: validPageSize
    });

    return NextResponse.json({
      repayments,
      totalCount,
      page: validPage,
      pageSize: validPageSize,
      totalPages: Math.ceil(totalCount / validPageSize)
    });
  } catch (error) {
    console.error('Error fetching repayments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repayments' },
      { status: 500 }
    );
  }
}

// Handler for getting payment schedules of a loan
async function getPaymentSchedules(request: NextRequest, id: number, currentUserId: number) {
  try {
    // Get the includeAll parameter from the query string
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('includeAll') === 'true';

    // Check if the loan exists and belongs to the current user
    const loan = await prismaAny.loan.findUnique({
      where: { id },
      include: {
        borrower: true,
        repayments: {
          orderBy: { paidDate: 'asc' }
        }
      }
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    // Check if the current user is the owner
    if (loan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to view this loan' },
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

    console.log('Date ranges for payment schedules:', {
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString(),
      oneWeekFromNow: oneWeekFromNow.toISOString()
    });

    // Generate dynamic payment schedules
    const schedules = [];
    const disbursementDate = new Date(loan.disbursementDate);
    const repaymentType = loan.repaymentType;
    const duration = loan.duration;
    const installmentAmount = loan.installmentAmount;
    const interestRate = loan.interestRate;

    console.log('Generating payment schedules with dates:', {
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString(),
      oneWeekFromNow: oneWeekFromNow.toISOString(),
      disbursementDate: disbursementDate.toISOString(),
      loanId: id,
      duration: duration,
      repaymentType: repaymentType,
      includeAll: includeAll
    });

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
      if (repaymentType === 'Monthly') {
        dueDate.setMonth(disbursementDate.getMonth() + period);
      } else if (repaymentType === 'Weekly') {
        dueDate.setDate(disbursementDate.getDate() + (period * 7));
      }

      // Log the first payment schedule due date for debugging
      if (period === 1) {
        console.log(`First payment due date: ${dueDate.toISOString()}`);
      }

      // Check if this period has been paid
      const repayment = repaymentsByPeriod.get(period);
      const isPaid = !!repayment;
      const isInterestOnly = repayment && repayment.paymentType === 'interestOnly';

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
      const isOverdue = dueDateNormalized < today && today >= gracePeriodDate && !isPaid;

      const isUpcoming = dueDateNormalized <= oneWeekFromNow && dueDateNormalized > today;

      // Debug log for period 1 (first payment)
      if (period === 1) {
        console.log(`Payment schedule for period ${period}:`, {
          dueDate: dueDateNormalized.toISOString(),
          isDueToday,
          isDueTomorrow,
          isOverdue,
          isUpcoming,
          isPaid,
          dueDateTimestamp: dueDateNormalized.getTime(),
          tomorrowTimestamp: tomorrow.getTime(),
          isSameAsTomorrow: dueDateNormalized.getTime() === tomorrow.getTime(),
          dateDiff: dueDateNormalized.getTime() - tomorrow.getTime()
        });
      }

      // Check if this is the next payment date (first unpaid period)
      const nextPaymentDate = loan.nextPaymentDate ? new Date(loan.nextPaymentDate) : null;
      const isNextPayment = !isPaid && nextPaymentDate &&
        nextPaymentDate.toDateString() === dueDate.toDateString();

      // For debugging
      if (period === 1) {
        // console.log('Next payment date check:', {
        //   nextPaymentDate: nextPaymentDate ? nextPaymentDate.toISOString() : null,
        //   dueDate: dueDate.toISOString(),
        //   isNextPayment,
        //   nextPaymentDateString: nextPaymentDate ? nextPaymentDate.toDateString() : null,
        //   dueDateString: dueDate.toDateString(),
        //   stringsEqual: nextPaymentDate ? nextPaymentDate.toDateString() === dueDate.toDateString() : false
        // });
      }

      // ALWAYS include the first payment if it's not paid yet
      const isFirstUnpaidPayment = period === 1 && !isPaid;

      // If includeAll is true, include all periods regardless of status
      // Otherwise, apply the filtering logic
      const shouldInclude = includeAll ||
        isDueToday || isDueTomorrow || isOverdue || isUpcoming || isPaid || isNextPayment || isFirstUnpaidPayment;

      if (shouldInclude) {
        schedules.push({
          id: period, // Use the period as the ID
          period,
          dueDate,
          amount: installmentAmount,
          interestAmount: interestRate,
          status: isPaid ? (isInterestOnly ? 'Interest Only' : 'Paid') : (isOverdue ? 'Overdue' : 'Pending'),
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

        // Log if this is the next payment
        if (isNextPayment) {
          console.log(`Including next payment date: ${dueDate.toISOString()} for period ${period}`);
        }
      }
    }

    // Sort schedules by due date in descending order (newest first)
    schedules.sort((a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

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
        totalPages: 1
      });
    }
  } catch (error) {
    console.error('Error fetching payment schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment schedules' },
      { status: 500 }
    );
  }
}

// Handler for exporting a loan
async function exportLoan(request: NextRequest, id: number, currentUserId: number) {
  try {
    // Get the loan for the current user
    const loan = await prismaAny.loan.findUnique({
      where: {
        id,
        createdById: currentUserId
      },
      include: {
        borrower: true,
        repayments: true
      }
    });

    // Check if the loan was found
    if (!loan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    // Generate Excel file
    const workbook = await generateLoansExcel([loan]);
    const buffer = await workbook.xlsx.writeBuffer();

    // Format current date for filename
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Set response headers for file download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=loan_${id}_${dateStr}.xlsx`
      }
    });
  } catch (error) {
    console.error('Error exporting loan:', error);
    throw new Error(`Failed to export loan: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Handler for exporting all loans
async function exportAllLoans(request: NextRequest, currentUserId: number) {
  try {
    // Get all loans for the current user
    const loans = await prismaAny.loan.findMany({
      where: {
        createdById: currentUserId
      },
      include: {
        borrower: true,
        repayments: true
      }
    });

    // Generate Excel file
    const workbook = await generateLoansExcel(loans);
    const buffer = await workbook.xlsx.writeBuffer();

    // Format current date for filename
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Set response headers for file download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=all_loans_${dateStr}.xlsx`
      }
    });
  } catch (error) {
    console.error('Error exporting all loans:', error);
    throw new Error(`Failed to export loans: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Handler for exporting selected loans
async function exportSelectedLoans(request: NextRequest, loanIds: number[], currentUserId: number) {
  try {
    // Get selected loans for the current user
    const loans = await prismaAny.loan.findMany({
      where: {
        id: { in: loanIds },
        createdById: currentUserId
      },
      include: {
        borrower: true,
        repayments: true
      }
    });

    // Check if any loans were found
    if (loans.length === 0) {
      return NextResponse.json(
        { error: 'No loans found with the provided IDs' },
        { status: 404 }
      );
    }

    // Generate Excel file
    const workbook = await generateLoansExcel(loans);
    const buffer = await workbook.xlsx.writeBuffer();

    // Format current date for filename
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Set response headers for file download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=selected_loans_${dateStr}.xlsx`
      }
    });
  } catch (error) {
    console.error('Error exporting selected loans:', error);
    throw new Error(`Failed to export loans: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to generate Excel file for loans
async function generateLoansExcel(loans: any[]) {
  // Import Excel.js dynamically
  const ExcelJS = require('exceljs');

  // Create a new workbook
  const workbook = new ExcelJS.Workbook();

  // Add a worksheet for loan details
  const worksheet = workbook.addWorksheet('Loan Details');

  // Define columns with optimized widths for better readability
  worksheet.columns = [
    { header: 'Loan ID', key: 'id', width: 10 },
    { header: 'Borrower Name', key: 'borrowerName', width: 25 },
    { header: 'Contact', key: 'contact', width: 15 },
    { header: 'Loan Type', key: 'loanType', width: 12 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Interest Rate', key: 'interestRate', width: 12 },
    { header: 'Document Charge', key: 'documentCharge', width: 15 },
    { header: 'Installment Amount', key: 'installmentAmount', width: 18 },
    { header: 'Duration', key: 'duration', width: 10 },
    { header: 'Disbursement Date', key: 'disbursementDate', width: 20 },
    { header: 'Remaining Amount', key: 'remainingAmount', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Overdue', key: 'overdue', width: 15 },
    { header: 'Next Payment Date', key: 'nextPaymentDate', width: 20 },
    { header: 'Purpose', key: 'purpose', width: 35 },
  ];

  // Format header row with bold font
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data
  loans.forEach(loan => {
    worksheet.addRow({
      id: loan.id,
      borrowerName: loan.borrower?.name || 'Unknown',
      contact: loan.borrower?.contact || 'Unknown',
      loanType: loan.loanType,
      amount: loan.amount,
      interestRate: loan.interestRate,
      documentCharge: loan.documentCharge || 0,
      installmentAmount: loan.installmentAmount,
      duration: loan.duration,
      disbursementDate: loan.disbursementDate ? new Date(loan.disbursementDate).toLocaleDateString() : 'Unknown',
      remainingAmount: loan.remainingAmount,
      status: loan.status,
      overdue: loan.missedPayments > 0 ? `${loan.missedPayments} ${loan.missedPayments === 1 ? 'payment' : 'payments'}` : 'None',
      nextPaymentDate: loan.nextPaymentDate ? new Date(loan.nextPaymentDate).toLocaleDateString() : 'N/A',
      purpose: loan.purpose || 'N/A',
    });
  });

  // Add a worksheet for repayments
  const repaymentsWorksheet = workbook.addWorksheet('Repayments');

  // Define columns for repayments with optimized widths
  repaymentsWorksheet.columns = [
    { header: 'Loan ID', key: 'loanId', width: 10 },
    { header: 'Borrower Name', key: 'borrowerName', width: 25 },
    { header: 'Repayment ID', key: 'repaymentId', width: 15 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Paid Date', key: 'paidDate', width: 20 },
    { header: 'Payment Type', key: 'paymentType', width: 15 },
    { header: 'Period', key: 'period', width: 10 },
  ];

  // Format header row with bold font and center alignment
  repaymentsWorksheet.getRow(1).font = { bold: true };
  repaymentsWorksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // Add repayment data
  loans.forEach(loan => {
    if (loan.repayments && loan.repayments.length > 0) {
      loan.repayments.forEach((repayment: any) => {
        repaymentsWorksheet.addRow({
          loanId: loan.id,
          borrowerName: loan.borrower?.name || 'Unknown',
          repaymentId: repayment.id,
          amount: repayment.amount,
          paidDate: repayment.paidDate ? new Date(repayment.paidDate).toLocaleDateString() : 'Unknown',
          paymentType: repayment.paymentType || 'full',
          period: repayment.period || 'N/A',
        });
      });
    }
  });

  return workbook;
}

// Handler for creating a loan
async function createLoan(request: NextRequest, currentUserId: number) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['borrowerName', 'contact', 'loanType', 'amount', 'interestRate', 'duration', 'disbursementDate', 'repaymentType'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // First, find or create a global member
    let globalMember;

    if (body.globalMemberId) {
      // Use existing global member
      globalMember = await prismaAny.globalMember.findUnique({
        where: { id: body.globalMemberId }
      });

      if (!globalMember) {
        return NextResponse.json(
          { error: 'Global member not found' },
          { status: 404 }
        );
      }
    } else {
      // Create a new global member
      globalMember = await prismaAny.globalMember.create({
        data: {
          name: body.borrowerName,
          contact: body.contact,
          email: body.email || null,
          address: body.address || null,
          notes: body.notes || null,
          createdById: currentUserId,
        }
      });
    }

    // Parse the disbursement date
    const disbursementDate = new Date(body.disbursementDate);

    // Calculate initial next payment date based on disbursement date and repayment type
    const initialNextPaymentDate = new Date(disbursementDate);

    if (body.repaymentType === 'Monthly') {
      initialNextPaymentDate.setMonth(disbursementDate.getMonth() + 1);
    } else if (body.repaymentType === 'Weekly') {
      initialNextPaymentDate.setDate(disbursementDate.getDate() + 7);
    }

    // Create a loan data object with all fields
    const loanData = {
      borrowerId: globalMember.id,
      loanType: body.loanType,
      amount: parseFloat(body.amount),
      interestRate: parseFloat(body.interestRate),
      documentCharge: body.documentCharge ? parseFloat(body.documentCharge) : 0,
      installmentAmount: body.installmentAmount ? parseFloat(body.installmentAmount) : 0,
      duration: parseInt(body.duration),
      disbursementDate: disbursementDate,
      repaymentType: body.repaymentType,
      remainingAmount: parseFloat(body.amount), // Initially, remaining amount is the full loan amount
      status: body.status || 'Active',
      purpose: body.purpose || null,
      // Set the creator
      createdById: currentUserId,
      // Add the next payment date
      nextPaymentDate: initialNextPaymentDate
    };

    // Create the loan
    const loan = await prismaAny.loan.create({
      data: loanData,
      include: {
        borrower: true
      }
    });

    // Generate payment schedule for the loan
    try {
      await generatePaymentSchedule(loan.id, loan);
    } catch (scheduleError) {
      console.error('Error generating payment schedule:', scheduleError);
      // Continue even if schedule generation fails - we don't want to roll back the loan creation
    }

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    console.error('Error creating loan:', error);

    // Provide more detailed error information
    let errorMessage = 'Failed to create loan';
    let errorDetails = '';

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || '';
    }

    // Check for specific Prisma errors
    if (errorMessage.includes('Prisma')) {
      if (errorMessage.includes('Foreign key constraint failed')) {
        errorMessage = 'Invalid relationship reference';
      } else if (errorMessage.includes('Unique constraint failed')) {
        errorMessage = 'Duplicate record found';
      } else if (errorMessage.includes('Unknown arg')) {
        errorMessage = 'Schema mismatch - please contact support';
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}

// Handler for adding a repayment to a loan
async function addRepayment(request: NextRequest, id: number, currentUserId: number) {
  try {
    const requestBody = await request.json();
    const { amount, paidDate, paymentType = 'full', scheduleId } = requestBody;

    const loanId = id;
    const paymentAmount = parseFloat(amount);
    const isInterestOnly = paymentType === 'interestOnly';

    // Get the current loan to check remaining amount
    const loan = await prismaAny.loan.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    // Check if the current user is the owner
    if (loan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this loan' },
        { status: 403 }
      );
    }

    // Validate payment amount
    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than zero' },
        { status: 400 }
      );
    }

    // Only validate against remaining amount for full payments
    if (!isInterestOnly && paymentAmount > loan.remainingAmount) {
      return NextResponse.json(
        { error: 'Payment amount cannot exceed the remaining balance' },
        { status: 400 }
      );
    }

    // Validate scheduleId is provided
    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Payment schedule selection is required' },
        { status: 400 }
      );
    }

    // Calculate new remaining amount - only reduce for full payments
    const newRemainingAmount = isInterestOnly
      ? loan.remainingAmount // No change for interest-only payments
      : loan.remainingAmount - paymentAmount;

    // Calculate overdue amount after this payment
    const overdueResult = await updateOverdueAmountFromRepayments(loanId);
    const { overdueAmount, missedPayments } = overdueResult || { overdueAmount: 0, missedPayments: 0 };

    // Get the period from the selected schedule
    // For dynamic schedules, the ID is the period
    const finalPeriod = Number(scheduleId);

    // Validate that the period is a valid number
    if (isNaN(finalPeriod) || finalPeriod <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment schedule ID' },
        { status: 400 }
      );
    }

    // Prepare the repayment data
    const repaymentData = {
      loanId: loanId,
      amount: paymentAmount,
      paidDate: new Date(paidDate),
      paymentType: isInterestOnly ? 'interestOnly' : 'full',
      // Store the period from the schedule ID
      period: finalPeriod
    };

    try {
      // Step 1: Create the repayment record
      const repayment = await prismaAny.repayment.create({
        data: repaymentData,
      });

      // Step 2: Calculate the next payment date
      const nextPaymentDate = await calculateNextPaymentDate(loanId);

      // Step 3: Update the loan
      const updatedLoan = await prismaAny.loan.update({
        where: { id: loanId },
        data: {
          // Only update remaining amount for full payments
          remainingAmount: newRemainingAmount,
          // If fully paid, update the status
          status: newRemainingAmount <= 0 ? 'Completed' : 'Active',
          // Update next payment date with the calculated value
          nextPaymentDate: newRemainingAmount <= 0 ? null : nextPaymentDate,
          // Update overdue information
          overdueAmount: overdueAmount,
          missedPayments: missedPayments
        } as any, // Use type assertion to handle custom fields
      });

      return NextResponse.json({
        ...repayment,
        paymentType: isInterestOnly ? 'interestOnly' : 'full'
      }, { status: 201 });
    } catch (error: any) {
      console.error('Error in repayment creation process:', error);
      return NextResponse.json(
        { error: `Failed to create repayment: ${error.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error creating repayment:', error);
    return NextResponse.json(
      { error: `Failed to create repayment: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Handler for updating a loan
async function updateLoan(request: NextRequest, id: number, currentUserId: number) {
  try {
    const body = await request.json();

    // First, get the current loan to find the borrower
    const currentLoan = await prismaAny.loan.findUnique({
      where: { id },
      include: { borrower: true }
    });

    if (!currentLoan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    // Check if the current user is the owner
    if (currentLoan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to update this loan' },
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
          email: body.email !== undefined ? body.email : currentLoan.borrower.email,
          address: body.address !== undefined ? body.address : currentLoan.borrower.address,
        }
      });
    }

    // Log the update request
    console.log('Updating loan with data:', body);

    // Update the loan
    const loan = await prismaAny.loan.update({
      where: { id },
      data: {
        loanType: body.loanType,
        amount: body.amount ? parseFloat(body.amount) : undefined,
        interestRate: body.interestRate ? parseFloat(body.interestRate) : undefined,
        documentCharge: body.documentCharge !== undefined ? parseFloat(body.documentCharge) : undefined,
        installmentAmount: body.installmentAmount !== undefined ? parseFloat(body.installmentAmount) : undefined,
        duration: body.duration ? parseInt(body.duration) : undefined,
        disbursementDate: body.disbursementDate ? new Date(body.disbursementDate) : undefined,
        repaymentType: body.repaymentType,
        remainingAmount: body.remainingAmount ? parseFloat(body.remainingAmount) : undefined,
        status: body.status,
        purpose: body.purpose,
        // Add support for updating currentMonth
        currentMonth: body.currentMonth !== undefined ? parseInt(body.currentMonth) : undefined,
      },
      include: {
        borrower: true
      }
    });

    // Recalculate the next payment date based on the updated loan details
    try {
      const nextPaymentDate = await calculateNextPaymentDate(id);

      // Update the loan with the new next payment date
      await prismaAny.loan.update({
        where: { id },
        data: {
          nextPaymentDate
        }
      });

      // Add the calculated next payment date to the response
      loan.nextPaymentDate = nextPaymentDate;
    } catch (error) {
      console.error('Error calculating next payment date:', error);
      // Continue even if next payment date calculation fails
    }

    return NextResponse.json(loan);
  } catch (error) {
    console.error('Error updating loan:', error);
    return NextResponse.json(
      { error: 'Failed to update loan' },
      { status: 500 }
    );
  }
}

// Handler for deleting a loan
async function deleteLoan(request: NextRequest, id: number, currentUserId: number) {
  try {
    // Check if the loan exists and belongs to the current user
    const existingLoan = await prismaAny.loan.findUnique({
      where: { id },
      select: { createdById: true }
    });

    if (!existingLoan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    // Check if the current user is the owner
    if (existingLoan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this loan' },
        { status: 403 }
      );
    }

    // Delete related records first
    await prismaAny.repayment.deleteMany({
      where: { loanId: id },
    });

    // Delete payment schedules
    await prismaAny.paymentSchedule.deleteMany({
      where: { loanId: id },
    });

    // Delete the loan
    await prismaAny.loan.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Loan deleted successfully' });
  } catch (error) {
    console.error('Error deleting loan:', error);
    return NextResponse.json(
      { error: 'Failed to delete loan' },
      { status: 500 }
    );
  }
}

// Handler for deleting a repayment
async function deleteRepayment(request: NextRequest, id: number, currentUserId: number) {
  try {
    const body = await request.json();
    const loanId = id;

    // Check if the loan exists and belongs to the current user
    const loan = await prismaAny.loan.findUnique({
      where: { id: loanId },
      select: { createdById: true }
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    // Check if the current user is the owner
    if (loan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this loan' },
        { status: 403 }
      );
    }

    // Check if we're deleting a single repayment or multiple
    if (body.repaymentId) {
      // Get the repayment to check if it's a full payment
      const repayment = await prismaAny.repayment.findUnique({
        where: { id: body.repaymentId }
      });

      if (!repayment) {
        return NextResponse.json(
          { error: 'Repayment not found' },
          { status: 404 }
        );
      }

      // Get the loan to update remaining amount
      const currentLoan = await prismaAny.loan.findUnique({
        where: { id: loanId }
      });

      if (!currentLoan) {
        return NextResponse.json(
          { error: 'Loan not found' },
          { status: 404 }
        );
      }

      // Only adjust remaining amount if it was a full payment
      const newRemainingAmount = repayment.paymentType === 'full'
        ? currentLoan.remainingAmount + repayment.amount
        : currentLoan.remainingAmount;

      // First delete the repayment
      await prismaAny.repayment.delete({
        where: { id: body.repaymentId }
      });

      // Calculate new overdue amount after deletion
      const overdueResult = await updateOverdueAmountFromRepayments(loanId);
      const { overdueAmount, missedPayments } = overdueResult || { overdueAmount: 0, missedPayments: 0 };

      // Recalculate the next payment date
      let nextPaymentDate;
      try {
        nextPaymentDate = await calculateNextPaymentDate(loanId);
      } catch (error) {
        console.error('Error recalculating next payment date:', error);
        nextPaymentDate = currentLoan.nextPaymentDate;
      }

      // Update the loan with new values
      await prismaAny.loan.update({
        where: { id: loanId },
        data: {
          remainingAmount: newRemainingAmount,
          status: 'Active',
          nextPaymentDate: nextPaymentDate,
          overdueAmount: overdueAmount,
          missedPayments: missedPayments
        } as any,
      });

      return NextResponse.json({ message: 'Repayment deleted successfully' });
    }
    else if (body.repaymentIds && Array.isArray(body.repaymentIds)) {
      // Get all repayments to calculate amount adjustment
      const repayments = await prismaAny.repayment.findMany({
        where: {
          id: { in: body.repaymentIds },
          loanId: loanId
        }
      });

      if (repayments.length === 0) {
        return NextResponse.json(
          { error: 'No valid repayments found' },
          { status: 404 }
        );
      }

      // Get the loan to update remaining amount
      const currentLoan = await prismaAny.loan.findUnique({
        where: { id: loanId }
      });

      if (!currentLoan) {
        return NextResponse.json(
          { error: 'Loan not found' },
          { status: 404 }
        );
      }

      // Calculate amount to add back to remaining amount (only for full payments)
      const amountToAddBack = repayments
        .filter((r: any) => r.paymentType === 'full')
        .reduce((sum: number, r: any) => sum + r.amount, 0);

      // First delete the repayments
      await prismaAny.repayment.deleteMany({
        where: {
          id: { in: body.repaymentIds },
          loanId: loanId
        }
      });

      // Calculate new overdue amount after deletion
      const overdueResult = await updateOverdueAmountFromRepayments(loanId);
      const { overdueAmount, missedPayments } = overdueResult || { overdueAmount: 0, missedPayments: 0 };

      // Recalculate the next payment date
      let nextPaymentDate;
      try {
        nextPaymentDate = await calculateNextPaymentDate(loanId);
      } catch (error) {
        console.error('Error recalculating next payment date:', error);
        nextPaymentDate = currentLoan.nextPaymentDate;
      }

      // Update the loan with new values
      await prismaAny.loan.update({
        where: { id: loanId },
        data: {
          remainingAmount: currentLoan.remainingAmount + amountToAddBack,
          status: 'Active',
          nextPaymentDate: nextPaymentDate,
          overdueAmount: overdueAmount,
          missedPayments: missedPayments
        } as any,
      });

      return NextResponse.json({
        message: `${repayments.length} repayments deleted successfully`
      });
    }
    else {
      return NextResponse.json(
        { error: 'No repayment ID or IDs provided' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error deleting repayment(s):', error);
    return NextResponse.json(
      { error: 'Failed to delete repayment(s)' },
      { status: 500 }
    );
  }
}

// Handler for updating overdue amount for a loan
async function updateOverdue(request: NextRequest, id: number, currentUserId: number) {
  try {
    // Check if the loan exists and belongs to the current user
    const loan = await prismaAny.loan.findUnique({
      where: { id },
      select: { createdById: true }
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    // Check if the current user is the owner
    if (loan.createdById !== currentUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to update this loan' },
        { status: 403 }
      );
    }

    // Update the overdue amount
    const result = await updateOverdueAmountFromRepayments(id);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating overdue amount:', error);
    return NextResponse.json(
      { error: 'Failed to update overdue amount' },
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
        status: 'Active',
        createdById: currentUserId
      },
      select: { id: true }
    });

    // Update overdue amount for each loan
    const results = await Promise.all(
      loans.map(async (loan: any) => {
        try {
          const result = await updateOverdueAmountFromRepayments(loan.id);
          return { loanId: loan.id, ...result, success: true };
        } catch (error) {
          console.error(`Error updating overdue amount for loan ${loan.id}:`, error);
          return { loanId: loan.id, success: false, error: 'Failed to update overdue amount' };
        }
      })
    );

    return NextResponse.json({
      totalLoans: loans.length,
      updatedLoans: results.filter((r: any) => r.success).length,
      results
    });
  } catch (error) {
    console.error('Error updating all overdue amounts:', error);
    return NextResponse.json(
      { error: 'Failed to update overdue amounts' },
      { status: 500 }
    );
  }
}