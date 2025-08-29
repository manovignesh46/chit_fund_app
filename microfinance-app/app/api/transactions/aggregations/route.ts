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

    // Get active loans for the period
    const activeLoans = await prisma.loan.findMany({
      where: {
        createdById: currentUserId,
        status: "Active",
        disbursementDate: {
          lte: endDate,
        },
      },
    });

    // Get actual loan repayments
    const actualLoanRepayments = await prisma.transaction.aggregate({
      where: {
        createdById: currentUserId,
        type: "LOAN_REPAYMENT",
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Get active chit funds for the period
    const activeChitFunds = await prisma.chitFund.findMany({
      where: {
        createdById: currentUserId,
        status: "Active",
        startDate: {
          lte: endDate,
        },
      },
      include: {
        members: true,
      },
    });

    // Get actual chit fund contributions
    const actualChitContributions = await prisma.transaction.aggregate({
      where: {
        createdById: currentUserId,
        type: "CHIT_CONTRIBUTION",
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Helper function to count months in date range
    const getMonthsInRange = (start: Date, end: Date) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      return (
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
        endDate.getMonth() -
        startDate.getMonth() +
        (endDate.getDate() >= startDate.getDate() ? 1 : 0)
      );
    };
    
    // Calculate expected loan repayments
    const expectedLoanRepayment = activeLoans.reduce((sum, loan) => {
      let expectedAmountInPeriod = 0;
      const periodStart = new Date(startDate);
      const periodEnd = new Date(endDate);
      const installment = loan.installmentAmount || 0;

      // Calculate the loan's final due date based on its duration
      const loanTermEnd = new Date(loan.disbursementDate);

      // Start iterating from the first payment date
      let paymentDate = new Date(loan.disbursementDate);

      if (loan.repaymentType === "Weekly") {
        loanTermEnd.setDate(loanTermEnd.getDate() + (loan.duration || 0) * 7);
        paymentDate.setDate(paymentDate.getDate() + 7); // First payment is 1 week after disbursement

        while (paymentDate <= periodEnd && paymentDate <= loanTermEnd) {
          if (paymentDate >= periodStart) {
            expectedAmountInPeriod += installment;
          }
          // Move to the next week
          paymentDate.setDate(paymentDate.getDate() + 7);
        }
      } else {
        // Assume Monthly
        loanTermEnd.setMonth(loanTermEnd.getMonth() + (loan.duration || 0));
        paymentDate.setMonth(paymentDate.getMonth() + 1); // First payment is 1 month after disbursement

        while (paymentDate <= periodEnd && paymentDate <= loanTermEnd) {
          if (paymentDate >= periodStart) {
            expectedAmountInPeriod += installment;
          }
          // Move to the next month
          paymentDate.setMonth(paymentDate.getMonth() + 1);
        }
      }

      return sum + expectedAmountInPeriod;
    }, 0);

    // Calculate expected chit fund contributions
    const expectedChitContribution = activeChitFunds.reduce((sum, chitFund) => {
      let expectedAmountInPeriod = 0;
      const periodStart = new Date(startDate);
      const periodEnd = new Date(endDate);
      const contribution = chitFund.monthlyContribution || 0;
      const membersCount = chitFund.members.length;

      // Calculate the chit's final payment date
      const chitTermEnd = new Date(chitFund.startDate);
      chitTermEnd.setMonth(chitTermEnd.getMonth() + (chitFund.duration || 0));

      // Start from the first contribution date
      let paymentDate = new Date(chitFund.startDate);

      while (paymentDate <= periodEnd && paymentDate < chitTermEnd) {
        if (paymentDate >= periodStart) {
          // Note: Add logic here to handle the 'firstMonthContribution' if its date matches
          expectedAmountInPeriod += contribution * membersCount;
        }
        // Move to the next month's contribution date
        paymentDate.setMonth(paymentDate.getMonth() + 1);
      }

      return sum + expectedAmountInPeriod;
    }, 0);
    // Prepare response
    const response = {
      expectedLoanRepayment,
      actualLoanRepayment: actualLoanRepayments._sum.amount || 0,
      expectedChitContribution,
      actualChitContribution: actualChitContributions._sum.amount || 0,
      totalExpectedAmount: expectedLoanRepayment + expectedChitContribution,
      totalActualAmount:
        (actualLoanRepayments._sum.amount || 0) +
        (actualChitContributions._sum.amount || 0),
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
