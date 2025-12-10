import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { getCurrentUserId } from "../../../../lib/auth";

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = new Date(searchParams.get("startDate") || "");
    const endDate = new Date(searchParams.get("endDate") || "");

    // First, get loans that were completed during the period by checking their repayments
    const completedLoansInPeriod = await prisma.loan.findMany({
      where: {
        createdById: currentUserId,
        status: "Completed",
        repayments: {
          some: {
            paidDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
    });

    // Get currently active loans
    const activeLoans = await prisma.loan.findMany({
      where: {
        createdById: currentUserId,
        status: "Active",
        disbursementDate: {
          lte: endDate,
        },
      },
    });

    // Combine both active and completed loans
    const allRelevantLoans = [...activeLoans, ...completedLoansInPeriod];

    // Calculate which loan periods fall within the selected date range for each loan
    let expectedLoanRepaymentTotal = 0;
    const periodsInRange = new Set<string>(); // Format: "loanId-period"

    allRelevantLoans.forEach((loan) => {
      const periodStart = new Date(startDate);
      const periodEnd = new Date(endDate);
      const installment = loan.installmentAmount || 0;

      // Calculate the loan's final due date based on its duration
      const loanTermEnd = new Date(loan.disbursementDate);

      // Start iterating from the first payment date
      let paymentDate = new Date(loan.disbursementDate);
      let currentPeriod = 1;

      if (loan.repaymentType === "Weekly") {
        loanTermEnd.setDate(loanTermEnd.getDate() + (loan.duration || 0) * 7);
        paymentDate.setDate(paymentDate.getDate() + 7); // First payment is 1 week after disbursement

        while (paymentDate <= periodEnd && paymentDate <= loanTermEnd) {
          if (paymentDate >= periodStart) {
            expectedLoanRepaymentTotal += installment;
            periodsInRange.add(`${loan.id}-${currentPeriod}`);
          }
          // Move to the next week
          paymentDate.setDate(paymentDate.getDate() + 7);
          currentPeriod++;
        }
      } else {
        // Assume Monthly
        loanTermEnd.setMonth(loanTermEnd.getMonth() + (loan.duration || 0));
        paymentDate.setMonth(paymentDate.getMonth() + 1); // First payment is 1 month after disbursement

        while (paymentDate <= periodEnd && paymentDate <= loanTermEnd) {
          if (paymentDate >= periodStart) {
            expectedLoanRepaymentTotal += installment;
            periodsInRange.add(`${loan.id}-${currentPeriod}`);
          }
          // Move to the next month
          paymentDate.setMonth(paymentDate.getMonth() + 1);
          currentPeriod++;
        }
      }
    });

    // Get actual loan repayments by joining with Repayment table
    // Filter by period instead of payment date
    const repayments = await prisma.repayment.findMany({
      where: {
        createdById: currentUserId,
        loanId: {
          in: allRelevantLoans.map(loan => loan.id),
        },
      },
      select: {
        loanId: true,
        period: true,
        amount: true,
      },
    });

    // Sum only repayments whose periods fall in the date range
    const actualLoanRepaymentAmount = repayments
      .filter(repayment => periodsInRange.has(`${repayment.loanId}-${repayment.period}`))
      .reduce((sum, repayment) => sum + repayment.amount, 0);

    // Get chit funds that were active or completed during the period
    const activeChitFunds = await prisma.chitFund.findMany({
      where: {
        createdById: currentUserId,
        OR: [
          {
            status: "Active",
            startDate: {
              lte: endDate,
            },
          },
          {
            status: "Completed",
            startDate: {
              lte: endDate,
            },
          },
        ],
      },
      include: {
        members: true,
      },
    });

    // Calculate which chit months fall within the selected date range for each chit fund
    let expectedChitContributionTotal = 0;
    const chitMonthsInRange = new Set<string>(); // Format: "chitFundId-month"

    activeChitFunds.forEach((chitFund) => {
      const periodStart = new Date(startDate);
      const periodEnd = new Date(endDate);
      const contribution = chitFund.monthlyContribution || 0;
      const membersCount = chitFund.members.length;

      // Calculate the chit's final payment date
      const chitTermEnd = new Date(chitFund.startDate);
      chitTermEnd.setMonth(chitTermEnd.getMonth() + (chitFund.duration || 0));

      // Start from the first contribution date
      let paymentDate = new Date(chitFund.startDate);
      let currentMonth = 1;

      while (paymentDate <= periodEnd && paymentDate < chitTermEnd && currentMonth <= chitFund.duration) {
        if (paymentDate >= periodStart) {
          expectedChitContributionTotal += contribution * membersCount;
          chitMonthsInRange.add(`${chitFund.id}-${currentMonth}`);
        }
        // Move to the next month's contribution date
        paymentDate.setMonth(paymentDate.getMonth() + 1);
        currentMonth++;
      }
    });

    // Get actual chit fund contributions by joining with Contribution table
    // Filter by month instead of payment date
    const contributions = await prisma.contribution.findMany({
      where: {
        createdById: currentUserId,
        chitFundId: {
          in: activeChitFunds.map(cf => cf.id),
        },
      },
      select: {
        chitFundId: true,
        month: true,
        amount: true,
      },
    });

    // Sum only contributions whose months fall in the date range
    const actualChitContributionAmount = contributions
      .filter(contribution => chitMonthsInRange.has(`${contribution.chitFundId}-${contribution.month}`))
      .reduce((sum, contribution) => sum + contribution.amount, 0);

    // Prepare response
    const response = {
      expectedLoanRepayment: expectedLoanRepaymentTotal,
      actualLoanRepayment: actualLoanRepaymentAmount,
      expectedChitContribution: expectedChitContributionTotal,
      actualChitContribution: actualChitContributionAmount,
      totalExpectedAmount: expectedLoanRepaymentTotal + expectedChitContributionTotal,
      totalActualAmount: actualLoanRepaymentAmount + actualChitContributionAmount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in aggregations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
