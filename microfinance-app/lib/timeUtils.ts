import prisma from './prisma';

export function calculateChitFundCurrentMonth(startDate: string | Date, duration: number): number {
  if (!startDate) return 1;

  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const now = new Date();

  // If the start date is in the future, return 1
  if (start > now) {
    return 1;
  }

  // Calculate the difference in months
  const diffYears = now.getFullYear() - start.getFullYear();
  const diffMonths = now.getMonth() - start.getMonth();
  let monthDiff = diffYears * 12 + diffMonths + 1; // +1 because we count the first month

  // Adjust if we haven't reached the same day of the month yet
  if (now.getDate() < start.getDate()) {
    monthDiff--;
  }

  // Ensure the month is within the duration range
  return Math.min(Math.max(1, monthDiff), duration);
}

export function calculateLoanCurrentMonth(disbursementDate: string | Date, duration: number, loanType: string): number {
  if (!disbursementDate) return 0;
  
  const startDate = typeof disbursementDate === 'string' ? new Date(disbursementDate) : disbursementDate;
  const currentDate = new Date();

  if (startDate > currentDate) {
    return 0; // Not started yet
  }

  let newCurrentPeriod;

  if (loanType === 'Weekly') {
    const startDateClean = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const currentDateClean = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

    const daysDiff = Math.floor(
      (currentDateClean.getTime() - startDateClean.getTime()) / (24 * 60 * 60 * 1000)
    );

    const isExactMultipleOfSeven = daysDiff % 7 === 0;
    const currentWeek = Math.floor(daysDiff / 7) + (isExactMultipleOfSeven ? 0 : 1);
    
    newCurrentPeriod = currentWeek;
  } else {
    let monthsDiff =
      (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
      (currentDate.getMonth() - startDate.getMonth()) + 1;

    if (currentDate.getDate() < startDate.getDate()) {
      monthsDiff--;
    }

    newCurrentPeriod = Math.max(1, monthsDiff);
  }

  return Math.min(newCurrentPeriod, duration);
}

export async function autoUpdateCurrentMonths(userId: number) {
  try {
    // 1. Check and update Active Chit Funds
    const activeChitFunds = await prisma.chitFund.findMany({
      where: { 
        createdById: userId,
        status: 'Active' 
      },
      select: { id: true, startDate: true, currentMonth: true, duration: true }
    });

    for (const cf of activeChitFunds) {
      const calculatedMonth = calculateChitFundCurrentMonth(cf.startDate, cf.duration);
      if (calculatedMonth !== cf.currentMonth) {
        await prisma.chitFund.update({
          where: { id: cf.id },
          data: { currentMonth: calculatedMonth }
        });
      }
    }

    // 2. Check and update Active Loans
    const activeLoans = await prisma.loan.findMany({
      where: {
        createdById: userId,
        status: 'Active'
      },
      select: { id: true, disbursementDate: true, currentMonth: true, duration: true, loanType: true }
    });

    for (const loan of activeLoans) {
      const calculatedMonth = calculateLoanCurrentMonth(loan.disbursementDate, loan.duration, loan.loanType);
      if (calculatedMonth !== loan.currentMonth) {
        await prisma.loan.update({
          where: { id: loan.id },
          data: { currentMonth: calculatedMonth }
        });
      }
    }
  } catch (error) {
    console.error('Error auto updating current months:', error);
  }
}
