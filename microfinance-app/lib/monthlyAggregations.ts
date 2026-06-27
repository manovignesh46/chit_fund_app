/**
 * Shared monthly expected collection logic (loan repayments + chit contributions).
 * Used by dashboard aggregations and consolidated cash flow projection.
 */

export interface LoanForAggregation {
  id: number;
  installmentAmount: number;
  disbursementDate: Date | string;
  duration: number;
  repaymentType: string;
}

export interface ChitFundForAggregation {
  id: number;
  startDate: Date | string;
  duration: number;
  monthlyContribution: number;
  members: { id: number }[];
  firstMonthContribution?: number | null;
  chitFundType?: string;
}

/** Map a chit fund's month-of-fund (1-based) to its calendar payment date. */
export function getFundMonthCalendarDate(
  startDate: Date | string,
  fundMonth: number
): Date {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + (fundMonth - 1));
  return d;
}

/** Whether a date falls within a calendar month window (inclusive). */
export function isDateInCalendarMonth(
  date: Date,
  year: number,
  month: number
): boolean {
  return date.getFullYear() === year && date.getMonth() === month - 1;
}

export function computeExpectedLoanRepayment(
  allLoans: LoanForAggregation[],
  startDate: Date,
  endDate: Date
): number {
  let expectedLoanRepayment = 0;

  for (const loan of allLoans) {
    const installment = loan.installmentAmount || 0;
    const loanTermEnd = new Date(loan.disbursementDate);
    let paymentDate = new Date(loan.disbursementDate);

    if (loan.repaymentType === 'Weekly') {
      loanTermEnd.setDate(loanTermEnd.getDate() + (loan.duration || 0) * 7);
      paymentDate.setDate(paymentDate.getDate() + 7);
      while (paymentDate <= endDate && paymentDate <= loanTermEnd) {
        if (paymentDate >= startDate) {
          expectedLoanRepayment += installment;
        }
        paymentDate.setDate(paymentDate.getDate() + 7);
      }
    } else {
      loanTermEnd.setMonth(loanTermEnd.getMonth() + (loan.duration || 0));
      paymentDate.setMonth(paymentDate.getMonth() + 1);
      while (paymentDate <= endDate && paymentDate <= loanTermEnd) {
        if (paymentDate >= startDate) {
          expectedLoanRepayment += installment;
        }
        paymentDate.setMonth(paymentDate.getMonth() + 1);
      }
    }
  }

  return expectedLoanRepayment;
}

export function computeExpectedChitContribution(
  allChitFunds: ChitFundForAggregation[],
  startDate: Date,
  endDate: Date
): number {
  let expectedChitContribution = 0;

  for (const cf of allChitFunds) {
    const contribution = cf.monthlyContribution || 0;
    const membersCount = cf.members.length;
    const chitTermEnd = new Date(cf.startDate);
    chitTermEnd.setMonth(chitTermEnd.getMonth() + (cf.duration || 0));
    let paymentDate = new Date(cf.startDate);
    let month = 1;

    while (
      paymentDate <= endDate &&
      paymentDate < chitTermEnd &&
      month <= cf.duration
    ) {
      if (paymentDate >= startDate) {
        expectedChitContribution += contribution * membersCount;
      }
      paymentDate.setMonth(paymentDate.getMonth() + 1);
      month++;
    }
  }

  return expectedChitContribution;
}

/** Full aggregations including actuals — for dashboard reuse. */
export function computeAggregations(
  allLoans: LoanForAggregation[],
  allChitFunds: ChitFundForAggregation[],
  repaymentMap: Map<string, number>,
  contributionMap: Map<string, number>,
  startDate: Date,
  endDate: Date
) {
  let expectedLoanRepayment = 0;
  const periodsInRange = new Set<string>();

  for (const loan of allLoans) {
    const installment = loan.installmentAmount || 0;
    const loanTermEnd = new Date(loan.disbursementDate);
    let paymentDate = new Date(loan.disbursementDate);
    let period = 1;

    if (loan.repaymentType === 'Weekly') {
      loanTermEnd.setDate(loanTermEnd.getDate() + (loan.duration || 0) * 7);
      paymentDate.setDate(paymentDate.getDate() + 7);
      while (paymentDate <= endDate && paymentDate <= loanTermEnd) {
        if (paymentDate >= startDate) {
          expectedLoanRepayment += installment;
          periodsInRange.add(`${loan.id}-${period}`);
        }
        paymentDate.setDate(paymentDate.getDate() + 7);
        period++;
      }
    } else {
      loanTermEnd.setMonth(loanTermEnd.getMonth() + (loan.duration || 0));
      paymentDate.setMonth(paymentDate.getMonth() + 1);
      while (paymentDate <= endDate && paymentDate <= loanTermEnd) {
        if (paymentDate >= startDate) {
          expectedLoanRepayment += installment;
          periodsInRange.add(`${loan.id}-${period}`);
        }
        paymentDate.setMonth(paymentDate.getMonth() + 1);
        period++;
      }
    }
  }

  const actualLoanRepayment = [...periodsInRange].reduce(
    (sum, key) => sum + (repaymentMap.get(key) || 0),
    0
  );

  let expectedChitContribution = 0;
  const chitMonthsInRange = new Set<string>();

  for (const cf of allChitFunds) {
    const contribution = cf.monthlyContribution || 0;
    const membersCount = cf.members.length;
    const chitTermEnd = new Date(cf.startDate);
    chitTermEnd.setMonth(chitTermEnd.getMonth() + (cf.duration || 0));
    let paymentDate = new Date(cf.startDate);
    let month = 1;

    while (
      paymentDate <= endDate &&
      paymentDate < chitTermEnd &&
      month <= cf.duration
    ) {
      if (paymentDate >= startDate) {
        expectedChitContribution += contribution * membersCount;
        chitMonthsInRange.add(`${cf.id}-${month}`);
      }
      paymentDate.setMonth(paymentDate.getMonth() + 1);
      month++;
    }
  }

  const actualChitContribution = [...chitMonthsInRange].reduce(
    (sum, key) => sum + (contributionMap.get(key) || 0),
    0
  );

  return {
    expectedLoanRepayment,
    actualLoanRepayment,
    expectedChitContribution,
    actualChitContribution,
    totalExpectedAmount: expectedLoanRepayment + expectedChitContribution,
    totalActualAmount: actualLoanRepayment + actualChitContribution,
  };
}

export interface CalendarMonth {
  year: number;
  month: number;
  label: string;
  start: Date;
  end: Date;
}

/** Generate calendar months from start (inclusive) to end (inclusive), by month. */
export function generateCalendarMonths(from: Date, to: Date): CalendarMonth[] {
  const months: CalendarMonth[] = [];
  let y = from.getFullYear();
  let m = from.getMonth();
  const endY = to.getFullYear();
  const endM = to.getMonth();

  while (y < endY || (y === endY && m <= endM)) {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const now = new Date();
    const isCurrent =
      y === now.getFullYear() && m === now.getMonth();
    months.push({
      year: y,
      month: m + 1,
      label: isCurrent
        ? 'This month'
        : start.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
          }),
      start,
      end,
    });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return months;
}

/** Latest calendar month any active chit fund still has collections. */
export function getProjectionEndDate(
  chitFunds: { startDate: Date | string; duration: number }[]
): Date {
  let latest = new Date();
  for (const fund of chitFunds) {
    const lastPayment = getFundMonthCalendarDate(fund.startDate, fund.duration);
    if (lastPayment > latest) {
      latest = lastPayment;
    }
  }
  return latest;
}

export function isCalendarMonthOnOrAfter(
  year: number,
  month: number,
  fromYear: number,
  fromMonth: number
): boolean {
  return year > fromYear || (year === fromYear && month >= fromMonth);
}

/** Whether a chit fund has a contribution due in a given calendar month. */
export function fundHasContributionInCalendarMonth(
  fund: ChitFundForAggregation,
  year: number,
  month: number
): boolean {
  for (let m = 1; m <= fund.duration; m++) {
    const paymentDate = getFundMonthCalendarDate(fund.startDate, m);
    if (isDateInCalendarMonth(paymentDate, year, month)) {
      return true;
    }
  }
  return false;
}
