import prisma from '@/lib/prisma';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

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
    const allPeriods = [];
    for (let i = 1; i <= duration; i++) {
      const dueDate = new Date(startDate);

      if (repaymentType === 'Monthly') {
        dueDate.setMonth(startDate.getMonth() + i);
      } else if (repaymentType === 'Weekly') {
        dueDate.setDate(startDate.getDate() + (i * 7));
      }

      allPeriods.push({ period: i, dueDate });
    }

    // Match repayments to periods based on date proximity
    repayments.forEach(repayment => {
      const repaymentDate = new Date(repayment.paidDate);

      // Find the closest period by date
      let closestPeriod = null;
      let minDiff = Infinity;

      for (const { period, dueDate } of allPeriods) {
        const diff = Math.abs(repaymentDate.getTime() - dueDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestPeriod = period;
        }
      }

      // If we found a period and it's within 14 days of the due date, associate the repayment
      if (closestPeriod !== null && minDiff <= 14 * 24 * 60 * 60 * 1000) {
        // If multiple repayments match the same period, use the most recent one
        if (!repaymentsByPeriod.has(closestPeriod) ||
            new Date(repaymentsByPeriod.get(closestPeriod).paidDate) < repaymentDate) {
          repaymentsByPeriod.set(closestPeriod, repayment);
        }
      }
    });

    // Get current date and set up date ranges for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    // Set up date for showing schedules due within the next 7 days
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);

    // Generate dynamic payment schedules
    const dynamicSchedules = [];

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

      // Filter schedules based on visibility rules unless includeAll is true
      // New logic: Show all past due dates, current and upcoming due dates (within next 7 days), and any paid months
      const shouldShow = includeAll ||
                         status === 'Paid' || // Show all paid payments
                         status === 'InterestOnly' || // Show all interest-only payments
                         status === 'Missed' || // Show all missed payments
                         dueDate < today || // Show all past due dates
                         dueDate <= nextWeek; // Show all upcoming due dates within next 7 days

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
      await prismaAny.loan.update({
        where: { id: loanId },
        data: {
          overdueAmount: 0,
          missedPayments: 0
        }
      });
      return;
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
    repayments.forEach(repayment => {
      const period = repayment.period || 0;

      // If we don't have this period yet, or this is a newer payment for the same period
      if (!repaymentsByPeriod.has(period) ||
          new Date(repaymentsByPeriod.get(period).paidDate) < new Date(repayment.paidDate)) {
        repaymentsByPeriod.set(period, repayment);
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
    const dueDates = [];
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
      .filter(r => r.paymentType !== 'interestOnly')
      .forEach(repayment => {
        // Find the closest period to this repayment date
        const repaymentDate = new Date(repayment.paidDate);
        let closestPeriod = null;
        let minDiff = Infinity;

        for (const { period, dueDate } of dueDates) {
          const diff = Math.abs(repaymentDate.getTime() - dueDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestPeriod = period;
          }
        }

        if (closestPeriod !== null) {
          paidPeriods.add(closestPeriod);
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

    // Create the repayment record with basic required fields
    const repaymentData: any = {
      loanId,
      amount,
      paidDate: new Date(paidDate),
      paymentType
    };

    // Add period field if it's supported by the schema
    try {
      repaymentData.period = period;
    } catch (error) {
      console.warn('Period field not supported in Repayment model, skipping it');
    }

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

    // Get existing payment schedules for this loan
    const existingSchedules = await prismaAny.paymentSchedule.findMany({
      where: { loanId }
    });

    // Create a map of existing schedules by period for quick lookup
    const existingSchedulesByPeriod = {};
    for (const schedule of existingSchedules) {
      existingSchedulesByPeriod[schedule.period] = schedule;
    }

    const schedules = [];
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

      // Check if there's an existing schedule for this period
      const existingSchedule = existingSchedulesByPeriod[i];

      if (existingSchedule) {
        // If the schedule exists and has been acted upon (Paid or InterestOnly), keep it
        if (existingSchedule.status === 'Paid' || existingSchedule.status === 'InterestOnly') {
          schedules.push(existingSchedule);
          continue;
        }

        // If it's Pending or Missed, update it with the correct status based on current date
        const newStatus = dueDate < today ? 'Missed' : 'Pending';

        // Only update if the status has changed
        if (existingSchedule.status !== newStatus) {
          const updatedSchedule = await prismaAny.paymentSchedule.update({
            where: { id: existingSchedule.id },
            data: { status: newStatus }
          });
          schedules.push(updatedSchedule);
        } else {
          schedules.push(existingSchedule);
        }
      } else {
        // Determine status based on due date for new schedules
        const status = dueDate < today ? 'Missed' : 'Pending';

        // Create new payment schedule entry
        const schedule = await prismaAny.paymentSchedule.create({
          data: {
            loanId,
            period: i,
            dueDate,
            amount: installmentAmount,
            status
          }
        });

        schedules.push(schedule);
      }
    }

    // Delete any schedules that are no longer needed (e.g., if loan duration was reduced)
    const validPeriods = Array.from({ length: duration }, (_, i) => i + 1);
    const schedulesToDelete = existingSchedules.filter(
      schedule => !validPeriods.includes(schedule.period) &&
                 schedule.status !== 'Paid' &&
                 schedule.status !== 'InterestOnly'
    );

    if (schedulesToDelete.length > 0) {
      await prismaAny.paymentSchedule.deleteMany({
        where: {
          id: { in: schedulesToDelete.map(s => s.id) }
        }
      });
    }

    // Sort schedules by period for consistent return order
    schedules.sort((a, b) => a.period - b.period);

    return schedules;
  } catch (error) {
    console.error('Error generating payment schedule:', error);
    throw error;
  }
}

/**
 * Update payment schedule status
 * @param scheduleId The ID of the payment schedule
 * @param status The new status
 * @param actualPaymentDate The actual payment date (optional)
 * @param notes Additional notes (optional)
 * @returns Updated payment schedule
 */
export async function updatePaymentScheduleStatus(
  scheduleId: number,
  status: string,
  actualPaymentDate?: Date | string,
  notes?: string
) {
  try {
    // Get the current schedule to check its previous status and loan details
    const currentSchedule = await prismaAny.paymentSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        loan: {
          include: {
            paymentSchedules: true
          }
        },
        repayment: true
      }
    });

    if (!currentSchedule) {
      throw new Error(`Payment schedule with ID ${scheduleId} not found`);
    }

    const updateData: any = { status };
    const paymentDate = actualPaymentDate ? new Date(actualPaymentDate) : new Date();

    if (actualPaymentDate) {
      updateData.actualPaymentDate = paymentDate;
    }

    if (notes) {
      updateData.notes = notes;
    }

    // Handle repayment record based on status change
    if ((status === 'Paid' || status === 'InterestOnly') && currentSchedule.status !== status) {
      // Create a new repayment record or update existing one
      if (currentSchedule.repayment) {
        // Update existing repayment
        await prismaAny.repayment.update({
          where: { id: currentSchedule.repayment.id },
          data: {
            amount: currentSchedule.amount,
            paidDate: paymentDate,
            paymentType: status === 'InterestOnly' ? 'interestOnly' : 'full'
          }
        });
      } else {
        // Create new repayment record
        const newRepayment = await prismaAny.repayment.create({
          data: {
            loanId: currentSchedule.loanId,
            amount: currentSchedule.amount,
            paidDate: paymentDate,
            paymentType: status === 'InterestOnly' ? 'interestOnly' : 'full',
            paymentScheduleId: scheduleId
          }
        });

        // If this is a full payment (not interest-only), update the loan's remaining amount
        if (status === 'Paid' && currentSchedule.loan) {
          const newRemainingAmount = Math.max(0, currentSchedule.loan.remainingAmount - currentSchedule.amount);

          await prismaAny.loan.update({
            where: { id: currentSchedule.loanId },
            data: {
              remainingAmount: newRemainingAmount,
              status: newRemainingAmount <= 0 ? 'Completed' : 'Active'
            }
          });
        }
      }
    } else if (status === 'Pending' && currentSchedule.repayment) {
      // If status is changed back to Pending and there's a linked repayment, delete it
      await prismaAny.repayment.delete({
        where: { id: currentSchedule.repayment.id }
      });

      // If this was a full payment, restore the loan's remaining amount
      if (currentSchedule.status === 'Paid' && currentSchedule.loan) {
        const restoredRemainingAmount = currentSchedule.loan.remainingAmount + currentSchedule.amount;

        await prismaAny.loan.update({
          where: { id: currentSchedule.loanId },
          data: {
            remainingAmount: restoredRemainingAmount,
            status: 'Active' // Always set back to Active when restoring amount
          }
        });
      }
    }

    // Update the payment schedule
    const updatedSchedule = await prismaAny.paymentSchedule.update({
      where: { id: scheduleId },
      data: updateData,
      include: {
        repayment: true
      }
    });

    // Calculate and update the overdue amount and missed payments directly
    await updateOverdueAmount(currentSchedule.loanId);

    return updatedSchedule;
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
    // Get the loan with its payment schedules
    const loan = await prismaAny.loan.findUnique({
      where: { id: loanId },
      include: {
        paymentSchedules: {
          orderBy: { period: 'asc' }
        }
      }
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
    repayments.forEach(repayment => {
      const period = repayment.period || 0;

      // If we don't have this period yet, or this is a newer payment for the same period
      if (!repaymentsByPeriod.has(period) ||
          new Date(repaymentsByPeriod.get(period).paidDate) < new Date(repayment.paidDate)) {
        repaymentsByPeriod.set(period, repayment);
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
 * Link a repayment to a payment schedule
 * @param scheduleId The ID of the payment schedule
 * @param repaymentId The ID of the repayment
 * @returns Updated payment schedule
 */
export async function linkRepaymentToSchedule(scheduleId: number, repaymentId: number) {
  try {
    // Update the repayment to link to the schedule
    await prismaAny.repayment.update({
      where: { id: repaymentId },
      data: { paymentScheduleId: scheduleId }
    });

    // Get the repayment details
    const repayment = await prismaAny.repayment.findUnique({
      where: { id: repaymentId }
    });

    // Update the schedule with the payment information
    const updatedSchedule = await prismaAny.paymentSchedule.update({
      where: { id: scheduleId },
      data: {
        status: repayment.paymentType === 'interestOnly' ? 'InterestOnly' : 'Paid',
        actualPaymentDate: repayment.paidDate
      }
    });

    return updatedSchedule;
  } catch (error) {
    console.error('Error linking repayment to schedule:', error);
    throw error;
  }
}
