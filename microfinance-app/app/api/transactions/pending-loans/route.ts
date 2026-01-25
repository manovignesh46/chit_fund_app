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
        const installment = loan.installmentAmount || 0;

        // Calculate expected periods in the date range
        const expectedPeriods: number[] = [];
        const paidPeriods = new Set(
          loan.repayments
            .filter((r) => r.paidDate !== null)
            .map((r) => r.period)
        );

        let paymentDate = new Date(loan.disbursementDate);
        let currentPeriod = 1;
        const loanTermEnd = new Date(loan.disbursementDate);

        if (loan.repaymentType === "Weekly") {
          loanTermEnd.setDate(loanTermEnd.getDate() + (loan.duration || 0) * 7);
          paymentDate.setDate(paymentDate.getDate() + 7);

          while (paymentDate <= periodEnd && paymentDate <= loanTermEnd) {
            if (paymentDate >= periodStart && !paidPeriods.has(currentPeriod)) {
              expectedPeriods.push(currentPeriod);
            }
            paymentDate.setDate(paymentDate.getDate() + 7);
            currentPeriod++;
          }
        } else {
          // Monthly
          loanTermEnd.setMonth(loanTermEnd.getMonth() + (loan.duration || 0));
          paymentDate.setMonth(paymentDate.getMonth() + 1);

          while (paymentDate <= periodEnd && paymentDate <= loanTermEnd) {
            if (paymentDate >= periodStart && !paidPeriods.has(currentPeriod)) {
              expectedPeriods.push(currentPeriod);
            }
            paymentDate.setMonth(paymentDate.getMonth() + 1);
            currentPeriod++;
          }
        }

        // Only return loans that have pending periods
        if (expectedPeriods.length === 0) return null;

        const pendingAmount = expectedPeriods.length * installment;

        return {
          id: loan.id,
          borrowerName: loan.borrower.name,
          loanType: loan.loanType,
          totalAmount: loan.amount,
          installmentAmount: installment,
          pendingAmount,
          pendingPeriods: expectedPeriods.length,
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
