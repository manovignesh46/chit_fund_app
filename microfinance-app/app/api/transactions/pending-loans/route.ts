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

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
      return NextResponse.json({ error: "A valid date range is required" }, { status: 400 });
    }
    endDate.setUTCHours(23, 59, 59, 999);

    // Get active loans that have pending repayments
    const activeLoans = await prisma.loan.findMany({
      where: {
        createdById: currentUserId,
        status: "Active",
        disbursementDate: {
          lte: endDate,
        },
      },
      include: {
        borrower: {
          select: {
            name: true,
          },
        },
        repayments: true,
      },
    });

    // Calculate pending repayments for each loan in the date range
    const pendingLoans = activeLoans
      .map((loan) => {
        const periodStart = new Date(startDate);
        const periodEnd = new Date(endDate);
        const installment = loan.installmentAmount || (
          loan.loanType === "Reducing Balance" || loan.repaymentType === "Reducing Balance"
            ? Math.round((loan.remainingAmount * ((loan.interestPercentage || 0) / 100)) / 12)
            : 0
        );
        const paidAmounts = new Map<number, number>();
        for (const repayment of loan.repayments) {
          if (repayment.paidDate) {
            paidAmounts.set(repayment.period, (paidAmounts.get(repayment.period) || 0) + repayment.amount);
          }
        }

        let pendingAmount = 0;
        let pendingPeriods = 0;
        for (let period = 1; period <= loan.duration; period++) {
          const paymentDate = new Date(loan.disbursementDate);
          if (loan.repaymentType === "Weekly") {
            paymentDate.setDate(paymentDate.getDate() + period * 7);
          } else {
            paymentDate.setMonth(paymentDate.getMonth() + period);
          }
          if (paymentDate < periodStart || paymentDate > periodEnd) continue;

          const outstanding = Math.max(0, installment - (paidAmounts.get(period) || 0));
          if (outstanding > 0) {
            pendingAmount += outstanding;
            pendingPeriods++;
          }
        }

        if (pendingPeriods === 0) return null;

        return {
          id: loan.id,
          borrowerName: loan.borrower.name,
          loanType: loan.loanType,
          totalAmount: loan.amount,
          installmentAmount: installment,
          pendingAmount,
          pendingPeriods,
          repaymentType: loan.repaymentType,
        };
      })
      .filter((loan) => loan !== null);

    return NextResponse.json({ pendingLoans });
  } catch (error: any) {
    console.error("Error fetching pending loans:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch pending loans" },
      { status: 500 }
    );
  }
}
