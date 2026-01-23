import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getCurrentUserId } from '../../../../../lib/auth';

// Use type assertion to handle TypeScript type checking for any custom fields if needed
const prismaAny = prisma as any;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const loanId = parseInt(id);

    // Get the includeAll parameter from the query string
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get("includeAll") === "true";

    // Check if the loan exists and belongs to the current user
    const loan = await prismaAny.loan.findUnique({
      where: { id: loanId },
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
      if (repayment.period !== undefined && repayment.period !== null) {
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

      // Check if this period has been paid
      const repayment = repaymentsByPeriod.get(period);

      const isPaid = !!repayment;
      const isInterestOnly =
        repayment && repayment.paymentType === "interestOnly";

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

      // Determine if schedule should be included based on page context
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
