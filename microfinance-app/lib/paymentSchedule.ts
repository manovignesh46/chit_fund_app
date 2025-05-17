import prisma from './/prisma';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

/**
 * Calculate the correct period (week number) for a repayment date based on the loan's disbursement date
 * @param disbursementDate The loan's disbursement date
 * @param repaymentDate The date of the repayment
 * @returns The calculated period (week number)
 */
export function getRepaymentWeek(disbursementDate: Date | string, repaymentDate: Date | string): number {
  // Convert string dates to Date objects if needed
  const startDate = new Date(disbursementDate);
  const paymentDate = new Date(repaymentDate);

  // Calculate days difference between disbursement date and repayment date
  const daysDiff = Math.floor((paymentDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

  // Calculate week number (1-based)
  // Week 1 = 0-6 days after disbursement
  // Week 2 = 7-13 days after disbursement
  // And so on...
  const weekNumber = Math.floor(daysDiff / 7) + 1;

  return Math.max(1, weekNumber); // Ensure we never return a period less than 1
}

/**
 * Generate dynamic payment schedule for a loan without storing in the database
 * @param loanId The ID of the loan
 * @param options Optional parameters for filtering schedules
 * @returns Array of dynamically generated payment schedule entries
 */
export async function getDynamicPaymentSchedule(
  loanId: number,
  options: {
    page?: number;
    pageSize?: number;
    status?: string;
    includeAll?: boolean; // If true, returns all schedules regardless of due date
  } = {}
) {
  try {
    // Set default options
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const status = options.status;
    const includeAll = options.includeAll || false;

    // Get the loan details
    const loan = await prismaAny.loan.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      throw new Error(`Loan with ID ${loanId} not found`);
    }

    // Get all repayments for this loan
    const repayments = await prismaAny.repayment.findMany({
      where: { loanId },
      orderBy: { paidDate: 'asc' }
    });

    // Create a map of repayments by period for quick lookup
    const repaymentsByPeriod = new Map();

    // Calculate the expected due dates for each period
    const { disbursementDate, duration, repaymentType, installmentAmount } = loan;
    const startDate = new Date(disbursementDate);

    // Generate all possible periods and their due dates
    const allPeriods: { period: number; dueDate: Date }[] = [];
    for (let i = 1; i <= duration; i++) {
      const dueDate = new Date(startDate);

      if (repaymentType === 'Monthly') {
        dueDate.setMonth(startDate.getMonth() + i);
      } else if (repaymentType === 'Weekly') {
        dueDate.setDate(startDate.getDate() + (i * 7));
      }

      allPeriods.push({ period: i, dueDate });
    }

    // Match repayments to periods
    repayments.forEach((repayment: any) => {
      const repaymentDate = new Date(repayment.paidDate);
      let periodToUse;

      // If the repayment has a period field, always use it
      // This is the most reliable way to ensure payments are assigned to the correct period
      if (repayment.period) {
        periodToUse = repayment.period;
      }
      // For weekly loans without a period field, calculate the period based on the payment date
      else if (loan.repaymentType === 'Weekly') {
        periodToUse = getRepaymentWeek(disbursementDate, repaymentDate);
      }
      // For monthly loans or fallback, find the closest period by date
      else {
        let closestPeriod = null;
        let minDiff = Infinity;

        for (const { period, dueDate } of allPeriods) {
          const diff = Math.abs(repaymentDate.getTime() - dueDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestPeriod = period;
          }
        }

        // Only use the closest period if it's within 14 days of the due date
        if (closestPeriod !== null && minDiff <= 14 * 24 * 60 * 60 * 1000) {
          periodToUse = closestPeriod;
        } else {
          // If no close match found, skip this repayment
          return;
        }
      }

      // If multiple repayments match the same period, use the most recent one
      if (!repaymentsByPeriod.has(periodToUse) ||
          new Date(repaymentsByPeriod.get(periodToUse).paidDate) < repaymentDate) {
        repaymentsByPeriod.set(periodToUse, repayment);
      }
    });

    // Get current date and set up date ranges for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Set up date for showing schedules due within the next 7 days
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Generate dynamic payment schedules
    const dynamicSchedules: any[] = [];

    // Track the next upcoming payment date to ensure it's always shown
    let nextUpcomingPaymentDate = null;

    for (let i = 1; i <= duration; i++) {
      const dueDate = new Date(startDate);

      if (repaymentType === 'Monthly') {
        dueDate.setMonth(startDate.getMonth() + i);
      } else if (repaymentType === 'Weekly') {
        dueDate.setDate(startDate.getDate() + (i * 7));
      }

      // Check if there's a repayment for this period
      const repayment = repaymentsByPeriod.get(i);

      // Determine status based on repayment and due date
      let status = 'Pending';
      let actualPaymentDate = null;

      if (repayment) {
        status = repayment.paymentType === 'interestOnly' ? 'InterestOnly' : 'Paid';
        actualPaymentDate = repayment.paidDate;
      } else if (dueDate < today) {
        status = 'Missed';
      }

      // Track the next upcoming payment date (first unpaid future date)
      if (status === 'Pending' && dueDate >= today && (nextUpcomingPaymentDate === null || dueDate < nextUpcomingPaymentDate)) {
        nextUpcomingPaymentDate = dueDate;
      }

      // Normalize due date for comparison
      const dueDateNormalized = new Date(dueDate);
      dueDateNormalized.setHours(0, 0, 0, 0);

      // Check if due tomorrow specifically
      const isDueTomorrow = dueDateNormalized.getTime() === tomorrow.getTime();

      // Filter schedules based on visibility rules unless includeAll is true
      // New logic: Show all past due dates, current and upcoming due dates (within next 7 days), and any paid months
      const shouldShow = includeAll ||
                         status === 'Paid' || // Show all paid payments
                         status === 'InterestOnly' || // Show all interest-only payments
                         status === 'Missed' || // Show all missed payments
                         dueDateNormalized < today || // Show all past due dates
                         dueDateNormalized.getTime() === today.getTime() || // Due today
                         isDueTomorrow || // Due tomorrow
                         dueDateNormalized <= nextWeek; // Show all upcoming due dates within next 7 days

      // Apply status filter if provided
      const matchesStatusFilter = !status || !options.status || status === options.status;

      if (shouldShow && matchesStatusFilter) {
        dynamicSchedules.push({
          id: i, // Use period as ID since we're not storing in DB
          loanId,
          period: i,
          dueDate: dueDate.toISOString(),
          amount: installmentAmount,
          status,
          actualPaymentDate: actualPaymentDate ? new Date(actualPaymentDate).toISOString() : null,
          repayment: repayment ? {
            id: repayment.id,
            amount: repayment.amount,
            paidDate: new Date(repayment.paidDate).toISOString(),
            paymentType: repayment.paymentType
          } : null
        });
      }
    }

    // Sort schedules by period in descending order (newest first)
    dynamicSchedules.sort((a, b) => b.period - a.period);

    // Apply pagination if not including all
    const totalCount = dynamicSchedules.length;
    const paginatedSchedules = includeAll
      ? dynamicSchedules
      : dynamicSchedules.slice((page - 1) * pageSize, page * pageSize);

    return {
      schedules: paginatedSchedules,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    };
  } catch (error) {
    console.error('Error generating dynamic payment schedule:', error);
    throw error;
  }
}

/**
 * Calculate and update the overdue amount and missed payments for a loan based on repayments
 * @param loanId The ID of the loan
 * @returns Updated loan with new overdue amount and missed payments
 */
export async function updateOverdueAmountFromRepayments(loanId: number) {
  try {
    // Get the loan details
    const loan = await prismaAny.loan.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      throw new Error(`Loan with ID ${loanId} not found`);
    }

    // If loan is not active, no overdue
    if (loan.status !== 'Active') {
      const updatedLoan = await prismaAny.loan.update({
        where: { id: loanId },
        data: {
          overdueAmount: 0,
          missedPayments: 0
        }
      });
      console.log(`Loan ${loanId} is not active, setting overdue amount to 0`);
      return {
        overdueAmount: 0,
        missedPayments: 0
      };
    }

    // Get all repayments for this loan
    const repayments = await prismaAny.repayment.findMany({
      where: { loanId },
      orderBy: { paidDate: 'asc' }
    });

    // Get current date
    const currentDate = new Date();

    // Calculate how many payments should have been made by now
    const disbursementDate = new Date(loan.disbursementDate);
    let expectedPayments = 0;

    if (loan.repaymentType === 'Monthly') {
      // For monthly loans, calculate months difference
      const monthsDiff = (currentDate.getFullYear() - disbursementDate.getFullYear()) * 12 +
                        (currentDate.getMonth() - disbursementDate.getMonth());

      // Add 1 because first payment is due after 1 month
      expectedPayments = Math.max(0, monthsDiff);

      // Adjust if we haven't reached the same day of the month yet
      if (currentDate.getDate() < disbursementDate.getDate()) {
        expectedPayments--;
      }
    } else if (loan.repaymentType === 'Weekly') {
      // For weekly loans, calculate weeks difference
      const daysDiff = Math.floor((currentDate.getTime() - disbursementDate.getTime()) / (24 * 60 * 60 * 1000));
      expectedPayments = Math.floor(daysDiff / 7);
    }

    // Ensure we don't expect more payments than the loan duration
    expectedPayments = Math.min(expectedPayments, loan.duration);

    // Get all repayments sorted by period to handle multiple payments for the same period
    const repaymentsByPeriod = new Map();

    // Group repayments by period, keeping the most recent one for each period
    repayments.forEach((repayment: any) => {
      let periodToUse;

      // If the repayment has a period field, always use it
      // This is the most reliable way to ensure payments are assigned to the correct period
      if (repayment.period) {
        periodToUse = repayment.period;
      }
      // For weekly loans without a period field, calculate the period based on the payment date
      else if (loan.repaymentType === 'Weekly') {
        periodToUse = getRepaymentWeek(loan.disbursementDate, repayment.paidDate);
      }
      // For monthly loans or fallback, use 0 (will be handled differently)
      else {
        periodToUse = 0;
      }

      // If we don't have this period yet, or this is a newer payment for the same period
      if (!repaymentsByPeriod.has(periodToUse) ||
          new Date(repaymentsByPeriod.get(periodToUse).paidDate) < new Date(repayment.paidDate)) {
        repaymentsByPeriod.set(periodToUse, repayment);
      }
    });

    // Create an array of periods that should have been paid by now
    const periodsExpected = Array.from({ length: expectedPayments }, (_, i) => i + 1);

    // Calculate the principal portion of each payment
    const principalPerPayment = loan.repaymentType === 'Monthly'
      ? (loan.amount / loan.duration)
      : (loan.amount / (loan.duration - 1));

    // Calculate the interest portion of each payment
    const interestPerPayment = loan.installmentAmount - principalPerPayment;

    // Calculate overdue amount and missed payments
    let overdueAmount = 0;
    let missedPayments = 0;

    // Check each expected period
    for (const period of periodsExpected) {
      const repayment = repaymentsByPeriod.get(period);

      if (!repayment) {
        // No payment made for this period, add full installment amount to overdue
        overdueAmount += loan.installmentAmount;
        missedPayments++;
      } else if (repayment.paymentType === 'interestOnly') {
        // Interest-only payment made, add only principal portion to overdue
        overdueAmount += principalPerPayment;
        missedPayments++;
      }
      // If full payment was made, nothing to add to overdue
    }

    // Update the loan with the new overdue amount and missed payments
    const updatedLoan = await prismaAny.loan.update({
      where: { id: loanId },
      data: {
        overdueAmount,
        missedPayments
      }
    });

    console.log(`Updated overdue amount for loan ${loanId}: ${overdueAmount}, missed payments: ${missedPayments}`);

    // Return the updated values
    return {
      overdueAmount,
      missedPayments
    };
  } catch (error) {
    console.error('Error updating overdue amount from repayments:', error);
    throw error;
  }
}

/**
 * Calculate the next payment date for a loan based on disbursement date and repayment history
 * @param loanId The ID of the loan
 * @returns The calculated next payment date
 */
export async function calculateNextPaymentDate(loanId: number) {
  try {
    // Get the loan details with repayments
    const loan = await prismaAny.loan.findUnique({
      where: { id: loanId },
      include: {
        repayments: {
          orderBy: { paidDate: 'asc' }
        }
      }
    });

    if (!loan) {
      throw new Error(`Loan with ID ${loanId} not found`);
    }

    // If loan is completed, no next payment date
    if (loan.status === 'Completed' || loan.remainingAmount <= 0) {
      return null;
    }

    const currentDate = new Date();
    const disbursementDate = new Date(loan.disbursementDate);
    const { duration, repaymentType } = loan;

    // Generate all possible due dates
    const dueDates: { period: number; dueDate: Date }[] = [];
    for (let i = 1; i <= duration; i++) {
      const dueDate = new Date(disbursementDate);

      if (repaymentType === 'Monthly') {
        dueDate.setMonth(disbursementDate.getMonth() + i);
      } else if (repaymentType === 'Weekly') {
        dueDate.setDate(disbursementDate.getDate() + (i * 7));
      }

      dueDates.push({ period: i, dueDate });
    }

    // Sort due dates chronologically
    dueDates.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    // Create a map of periods that have been paid with full payments
    const paidPeriods = new Set();
    loan.repayments
      .filter((r: any) => r.paymentType !== 'interestOnly')
      .forEach((repayment: any) => {
        let periodToUse;
        const repaymentDate = new Date(repayment.paidDate);

        // If the repayment has a period field, always use it
        // This is the most reliable way to ensure payments are assigned to the correct period
        if (repayment.period) {
          periodToUse = repayment.period;
        }
        // For weekly loans without a period field, calculate the period based on the payment date
        else if (repaymentType === 'Weekly') {
          periodToUse = getRepaymentWeek(disbursementDate, repaymentDate);
        }
        // For monthly loans or fallback, find the closest period by date
        else {
          let closestPeriod = null;
          let minDiff = Infinity;

          for (const { period, dueDate } of dueDates) {
            const diff = Math.abs(repaymentDate.getTime() - dueDate.getTime());
            if (diff < minDiff) {
              minDiff = diff;
              closestPeriod = period;
            }
          }

          periodToUse = closestPeriod;
        }

        if (periodToUse !== null) {
          paidPeriods.add(periodToUse);
        }
      });

    // For a new loan with no repayments, the first payment date should be the first due date
    if (loan.repayments.length === 0) {
      // Return the first due date
      return dueDates[0].dueDate;
    }

    // Find the first due date that:
    // 1. Has not been paid
    // 2. Is on or after today
    let nextPaymentDate = null;

    // First, check for any unpaid due dates that are in the past (overdue)
    for (const { period, dueDate } of dueDates) {
      if (!paidPeriods.has(period) && dueDate < currentDate) {
        return dueDate; // Return the earliest overdue date
      }
    }

    // If no overdue dates, find the next upcoming due date
    for (const { period, dueDate } of dueDates) {
      if (!paidPeriods.has(period) && dueDate >= currentDate) {
        return dueDate; // Return the next upcoming due date
        break;
      }
    }

    // If we get here and no next payment date was found,
    // but the loan is still active, use the first due date as fallback
    if (loan.status === 'Active' && dueDates.length > 0) {
      return dueDates[0].dueDate;
    }

    return null;
  } catch (error) {
    console.error('Error calculating next payment date:', error);
    throw error;
  }
}

/**
 * Record a payment for a specific period without using payment schedules
 * @param loanId The ID of the loan
 * @param period The period number (month or week)
 * @param amount The payment amount
 * @param paidDate The payment date
 * @param paymentType The payment type ('full' or 'interestOnly')
 * @returns Created repayment record
 */
export async function recordPaymentForPeriod(
  loanId: number,
  period: number,
  amount: number,
  paidDate: Date | string,
  paymentType: 'full' | 'interestOnly' = 'full'
) {
  try {
    // Get the loan details
    const loan = await prismaAny.loan.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      throw new Error(`Loan with ID ${loanId} not found`);
    }

    // Calculate the due date for this period
    const disbursementDate = new Date(loan.disbursementDate);
    const dueDate = new Date(disbursementDate);

    if (loan.repaymentType === 'Monthly') {
      dueDate.setMonth(disbursementDate.getMonth() + period);
    } else if (loan.repaymentType === 'Weekly') {
      dueDate.setDate(disbursementDate.getDate() + (period * 7));
    }

    // Always use the exact period specified by the user
    // This ensures the payment is assigned to the period the user selected
    let finalPeriod = period;

    // Only calculate period if none was provided
    if (!period && loan.repaymentType === 'Weekly') {
      finalPeriod = getRepaymentWeek(loan.disbursementDate, paidDate);
      console.log(`Weekly loan: Calculated period ${finalPeriod} based on payment date (no period was specified)`);
    }

    // Create the repayment record with all required fields
    const repaymentData: any = {
      loanId,
      amount,
      paidDate: new Date(paidDate),
      paymentType,
      period: finalPeriod // Always include the period field
    };

    const repayment = await prismaAny.repayment.create({
      data: repaymentData
    });

    // If this is a full payment, update the loan's remaining amount
    if (paymentType === 'full') {
      const newRemainingAmount = Math.max(0, loan.remainingAmount - amount);

      await prismaAny.loan.update({
        where: { id: loanId },
        data: {
          remainingAmount: newRemainingAmount,
          status: newRemainingAmount <= 0 ? 'Completed' : 'Active'
        }
      });
    }

    // Calculate the next payment date
    const nextPaymentDate = await calculateNextPaymentDate(loanId);

    // Update the loan with the new next payment date and overdue information
    await prismaAny.loan.update({
      where: { id: loanId },
      data: {
        nextPaymentDate
      }
    });

    // Update overdue amount
    await updateOverdueAmountFromRepayments(loanId);

    return repayment;
  } catch (error) {
    console.error('Error recording payment for period:', error);
    throw error;
  }
}

/**
 * Generate payment schedule for a loan
 * @param loanId The ID of the loan
 * @param loan The loan object (optional, will be fetched if not provided)
 * @returns Array of created payment schedule entries
 */
export async function generatePaymentSchedule(loanId: number, loan?: any) {
  try {
    // If loan is not provided, fetch it
    if (!loan) {
      loan = await prismaAny.loan.findUnique({
        where: { id: loanId }
      });

      if (!loan) {
        throw new Error(`Loan with ID ${loanId} not found`);
      }
    }

    // Get existing repayments for this loan instead of payment schedules
    const existingRepayments = await prismaAny.repayment.findMany({
      where: { loanId }
    });

    // Create a map of existing repayments by period for quick lookup
    const existingRepaymentsByPeriod: Record<number, any> = {};
    for (const repayment of existingRepayments) {
      if (repayment.period) {
        existingRepaymentsByPeriod[repayment.period] = repayment;
      }
    }

    const schedules: any[] = [];
    const { disbursementDate, duration, repaymentType, installmentAmount, interestRate } = loan;
    const startDate = new Date(disbursementDate);

    // Generate payment schedule based on repayment type
    for (let i = 1; i <= duration; i++) {
      const dueDate = new Date(startDate);

      if (repaymentType === 'Monthly') {
        dueDate.setMonth(startDate.getMonth() + i);
      } else if (repaymentType === 'Weekly') {
        dueDate.setDate(startDate.getDate() + (i * 7));
      }

      // Check if this payment is already overdue
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if there's an existing repayment for this period
      const existingRepayment = existingRepaymentsByPeriod[i];

      // Determine status based on existing repayment or due date
      let status;
      if (existingRepayment) {
        status = existingRepayment.paymentType === 'interestOnly' ? 'InterestOnly' : 'Paid';
      } else {
        status = dueDate < today ? 'Missed' : 'Pending';
      }

      // Create a schedule object (not stored in DB, just for the response)
      const schedule = {
        loanId,
        period: i,
        dueDate,
        amount: installmentAmount,
        status,
        // If there's an existing repayment, include its details
        repaymentId: existingRepayment?.id,
        paidDate: existingRepayment?.paidDate,
        paymentType: existingRepayment?.paymentType
      };

      schedules.push(schedule);
    }

    // No need to delete schedules since they're not stored in the database
    // We only need to make sure we're returning the correct schedules for the current loan duration

    // Sort schedules by period for consistent return order
    schedules.sort((a, b) => a.period - b.period);

    return schedules;
  } catch (error) {
    console.error('Error generating payment schedule:', error);
    throw error;
  }
}

/**
 * Update payment schedule status by recording a payment for a specific period
 * @param loanId The ID of the loan
 * @param period The period number (month or week)
 * @param status The new status ('Paid' or 'InterestOnly')
 * @param amount The payment amount
 * @param actualPaymentDate The actual payment date (optional)
 * @param notes Additional notes (optional)
 * @returns Created or updated repayment record
 */
export async function updatePaymentScheduleStatus(
  loanId: number,
  period: number,
  status: string,
  amount: number,
  actualPaymentDate?: Date | string,
  notes?: string
) {
  try {
    // Get the loan details
    const loan = await prismaAny.loan.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      throw new Error(`Loan with ID ${loanId} not found`);
    }

    const paymentDate = actualPaymentDate ? new Date(actualPaymentDate) : new Date();

    // Check if there's an existing repayment for this period
    const existingRepayment = await prismaAny.repayment.findFirst({
      where: {
        loanId,
        period
      }
    });

    let repayment;

    // Handle repayment record based on status
    if (status === 'Paid' || status === 'InterestOnly') {
      const paymentType = status === 'InterestOnly' ? 'interestOnly' : 'full';

      if (existingRepayment) {
        // Update existing repayment
        repayment = await prismaAny.repayment.update({
          where: { id: existingRepayment.id },
          data: {
            amount,
            paidDate: paymentDate,
            paymentType,
            notes
          }
        });
      } else {
        // Create new repayment record
        repayment = await prismaAny.repayment.create({
          data: {
            loanId,
            period,
            amount,
            paidDate: paymentDate,
            paymentType,
            notes
          }
        });

        // If this is a full payment (not interest-only), update the loan's remaining amount
        if (status === 'Paid') {
          const newRemainingAmount = Math.max(0, loan.remainingAmount - amount);

          await prismaAny.loan.update({
            where: { id: loanId },
            data: {
              remainingAmount: newRemainingAmount,
              status: newRemainingAmount <= 0 ? 'Completed' : 'Active'
            }
          });
        }
      }
    } else if (status === 'Pending' && existingRepayment) {
      // If status is changed back to Pending and there's a repayment, delete it
      await prismaAny.repayment.delete({
        where: { id: existingRepayment.id }
      });

      // If this was a full payment, restore the loan's remaining amount
      if (existingRepayment.paymentType === 'full') {
        const restoredRemainingAmount = loan.remainingAmount + existingRepayment.amount;

        await prismaAny.loan.update({
          where: { id: loanId },
          data: {
            remainingAmount: restoredRemainingAmount,
            status: 'Active' // Always set back to Active when restoring amount
          }
        });
      }

      // Return a placeholder for the deleted repayment
      repayment = {
        id: existingRepayment.id,
        deleted: true,
        status: 'Pending'
      };
    }

    // Calculate and update the overdue amount and missed payments directly
    await updateOverdueAmount(loanId);

    // Return the repayment with status information
    return {
      ...repayment,
      status: status
    };
  } catch (error) {
    console.error('Error updating payment schedule status:', error);
    throw error;
  }
}

/**
 * Calculate and update the overdue amount and missed payments for a loan
 * @param loanId The ID of the loan
 * @returns Updated loan with new overdue amount and missed payments
 */
async function updateOverdueAmount(loanId: number) {
  try {
    // Get the loan without payment schedules (since they're dynamic)
    const loan = await prismaAny.loan.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      throw new Error(`Loan with ID ${loanId} not found`);
    }

    // If loan is not active, no overdue
    if (loan.status !== 'Active') {
      await prismaAny.loan.update({
        where: { id: loanId },
        data: {
          overdueAmount: 0,
          missedPayments: 0
        }
      });
      return;
    }

    // Get the current date
    const currentDate = new Date();

    // Get all repayments for this loan
    const repayments = await prismaAny.repayment.findMany({
      where: { loanId },
      orderBy: { paidDate: 'asc' }
    });

    // Calculate how many payments should have been made by now
    const disbursementDate = new Date(loan.disbursementDate);
    let expectedPayments = 0;

    if (loan.repaymentType === 'Monthly') {
      // For monthly loans, calculate months difference
      const monthsDiff = (currentDate.getFullYear() - disbursementDate.getFullYear()) * 12 +
                        (currentDate.getMonth() - disbursementDate.getMonth());

      // Add 1 because first payment is due after 1 month
      expectedPayments = Math.max(0, monthsDiff);

      // Adjust if we haven't reached the same day of the month yet
      if (currentDate.getDate() < disbursementDate.getDate()) {
        expectedPayments--;
      }
    } else if (loan.repaymentType === 'Weekly') {
      // For weekly loans, calculate weeks difference
      const daysDiff = Math.floor((currentDate.getTime() - disbursementDate.getTime()) / (24 * 60 * 60 * 1000));
      expectedPayments = Math.floor(daysDiff / 7);
    }

    // Ensure we don't expect more payments than the loan duration
    expectedPayments = Math.min(expectedPayments, loan.duration);

    // Get all repayments sorted by period to handle multiple payments for the same period
    const repaymentsByPeriod = new Map();

    // Group repayments by period, keeping the most recent one for each period
    repayments.forEach((repayment: any) => {
      let periodToUse;

      // If the repayment has a period field, always use it
      // This is the most reliable way to ensure payments are assigned to the correct period
      if (repayment.period) {
        periodToUse = repayment.period;
      }
      // For weekly loans without a period field, calculate the period based on the payment date
      else if (loan.repaymentType === 'Weekly') {
        periodToUse = getRepaymentWeek(loan.disbursementDate, repayment.paidDate);
      }
      // For monthly loans or fallback, use 0 (will be handled differently)
      else {
        periodToUse = 0;
      }

      // If we don't have this period yet, or this is a newer payment for the same period
      if (!repaymentsByPeriod.has(periodToUse) ||
          new Date(repaymentsByPeriod.get(periodToUse).paidDate) < new Date(repayment.paidDate)) {
        repaymentsByPeriod.set(periodToUse, repayment);
      }
    });

    // Create an array of periods that should have been paid by now
    const periodsExpected = Array.from({ length: expectedPayments }, (_, i) => i + 1);

    // Calculate the principal portion of each payment
    const principalPerPayment = loan.repaymentType === 'Monthly'
      ? (loan.amount / loan.duration)
      : (loan.amount / (loan.duration - 1));

    // Calculate the interest portion of each payment
    const interestPerPayment = loan.installmentAmount - principalPerPayment;

    // Calculate overdue amount and missed payments
    let overdueAmount = 0;
    let missedPayments = 0;

    // Check each expected period
    for (const period of periodsExpected) {
      const repayment = repaymentsByPeriod.get(period);

      if (!repayment) {
        // No payment made for this period, add full installment amount to overdue
        overdueAmount += loan.installmentAmount;
        missedPayments++;
      } else if (repayment.paymentType === 'interestOnly') {
        // Interest-only payment made, add only principal portion to overdue
        overdueAmount += principalPerPayment;
        missedPayments++;
      }
      // If full payment was made, nothing to add to overdue
    }

    // Update the loan with the new overdue amount and missed payments
    await prismaAny.loan.update({
      where: { id: loanId },
      data: {
        overdueAmount,
        missedPayments
      }
    });

    return;
  } catch (error) {
    console.error('Error updating overdue amount:', error);
    throw error;
  }
}

/**
 * Link a repayment to a specific period
 * @param loanId The ID of the loan
 * @param repaymentId The ID of the repayment
 * @param period The period number to link the repayment to
 * @returns Updated repayment
 */
export async function linkRepaymentToPeriod(loanId: number, repaymentId: number, period: number) {
  try {
    // Get the repayment details
    const repayment = await prismaAny.repayment.findUnique({
      where: { id: repaymentId }
    });

    if (!repayment) {
      throw new Error(`Repayment with ID ${repaymentId} not found`);
    }

    // Update the repayment with the period
    const updatedRepayment = await prismaAny.repayment.update({
      where: { id: repaymentId },
      data: { period }
    });

    // Update the loan's overdue amount and missed payments
    await updateOverdueAmount(loanId);

    return updatedRepayment;
  } catch (error) {
    console.error('Error linking repayment to period:', error);
    throw error;
  }
}
