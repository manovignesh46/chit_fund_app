import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { getCurrentUserId } from "../../../../lib/auth";
import { computeLoanDuePeriods, getLoanInstallment, summarizePeriods } from "../../../../lib/duesTracker";

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
            contact: true,
          },
        },
        repayments: true,
      },
    });

    // Calculate pending repayments for each loan in the date range
    const range = { start: startDate, end: endDate };
    const asOf = new Date();
    const pendingLoans = activeLoans
      .map((loan) => {
        const periods = computeLoanDuePeriods(loan, range, asOf);
        if (periods.length === 0) return null;
        const summary = summarizePeriods(periods);

        return {
          id: loan.id,
          borrowerId: loan.borrowerId,
          borrowerName: loan.borrower.name,
          contact: loan.borrower.contact,
          loanType: loan.loanType,
          totalAmount: loan.amount,
          installmentAmount: getLoanInstallment(loan),
          pendingAmount: summary.totalOutstanding,
          pendingPeriods: periods.length,
          overdueAmount: summary.overdueAmount,
          maxDaysOverdue: summary.maxDaysOverdue,
          periods,
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
