import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const loanId = Number(id);

        // Get loan details with borrower
        const loan = await prismaAny.loan.findUnique({
            where: { id: loanId },
            include: {
                borrower: true
            }
        });

        // Fetch ALL repayments for this loan separately (not paginated)
        const repayments = await prismaAny.repayment.findMany({
            where: { loanId: loanId },
            orderBy: { paidDate: 'asc' }
        });

        if (!loan) {
            return NextResponse.json({ message: 'Loan not found' }, { status: 404 });
        }

        // Format loan data for export
        const loanDetails = {
            'Loan ID': loan.id,
            'Loan Type': loan.loanType,
            'Borrower Name': loan.borrower.name,
            'Borrower Contact': loan.borrower.contact,
            'Borrower Email': loan.borrower.email || 'N/A',
            'Borrower Address': loan.borrower.address || 'N/A',
            'Loan Amount': loan.amount,
            'Interest Rate': loan.interestRate,
            'Document Charge': loan.documentCharge || 0,
            'Installment Amount': loan.installmentAmount || calculateInstallmentAmount(loan),
            'Duration (months)': loan.duration,
            'Disbursement Date': formatDate(loan.disbursementDate),
            'Repayment Type': loan.repaymentType,
            'Remaining Amount': loan.remainingAmount,
            'Overdue Amount': loan.overdueAmount || 0,
            'Missed Payments': loan.missedPayments || 0,
            'Current Month': loan.currentMonth || 0,
            'Next Payment Date': loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A',
            'Status': loan.status,
            'Purpose': loan.purpose || 'N/A',
            'Created At': formatDate(loan.createdAt),
            'Updated At': formatDate(loan.updatedAt)
        };

        // Define a type for repayment to avoid TypeScript errors
        interface Repayment {
            id: number;
            amount: number;
            paidDate: string | Date;
            loanId: number;
            paymentType?: string;
            createdAt: string | Date;
            updatedAt: string | Date;
        }

        // Format repayments data for export
        const formattedRepayments = repayments.map((repayment: Repayment, index: number) => {
            // Determine payment description based on type
            let paymentDescription = 'Regular Payment';
            if (repayment.paymentType === 'interestOnly') {
                paymentDescription = 'Interest Only Payment';
            }

            // Calculate running balance (this is an approximation since we don't store balance history)
            const previousPayments = repayments.slice(0, index)
                .filter((r: Repayment) => r.paymentType !== 'interestOnly')
                .reduce((sum: number, r: Repayment) => sum + r.amount, 0);
            const runningBalance = loan.amount - previousPayments;

            return {
                'No.': index + 1,
                'Payment ID': repayment.id,
                'Paid Date': formatDate(repayment.paidDate),
                'Amount': repayment.amount,
                'Payment Type': repayment.paymentType || 'full',
                'Description': paymentDescription,
                'Balance After Payment': repayment.paymentType === 'interestOnly' ? runningBalance : runningBalance - repayment.amount,
                'Created At': formatDate(repayment.createdAt)
            };
        });

        // Calculate loan summary
        const totalPaid = repayments.reduce((sum: number, repayment: Repayment) => {
            // Only count non-interest-only payments toward principal reduction
            if (repayment.paymentType !== 'interestOnly') {
                return sum + repayment.amount;
            }
            return sum;
        }, 0);

        const interestOnlyPayments = repayments
            .filter((repayment: Repayment) => repayment.paymentType === 'interestOnly')
            .reduce((sum: number, repayment: Repayment) => sum + repayment.amount, 0);

        // Calculate profit based on loan type
        let profit = 0;
        if (loan.repaymentType === 'Monthly') {
            // For monthly loans: document charge + interest
            // For interest, we either count interest-only payments OR monthly interest, not both
            const hasInterestOnlyPayments = repayments.some(r => r.paymentType === 'interestOnly');
            const completedMonths = loan.currentMonth || 0;

            // Document charge is always counted
            profit = (loan.documentCharge || 0);

            // For interest, avoid double counting
            if (hasInterestOnlyPayments) {
                // If there are interest-only payments, use those
                profit += interestOnlyPayments;
            } else if (repayments.length > 0) {
                // Otherwise, if there are any payments, use the monthly interest calculation
                profit += loan.interestRate * completedMonths;
            }
        } else if (loan.repaymentType === 'Weekly') {
            // For weekly loans: profit is the difference between total payments and principal
            profit = totalPaid - loan.amount + (loan.documentCharge || 0);
        }

        // Calculate percentage of loan completed
        const percentComplete = loan.amount > 0
            ? Math.round(((loan.amount - loan.remainingAmount) / loan.amount) * 100)
            : 0;

        // Calculate total number of payments made
        const totalPayments = repayments.length;

        // Calculate average payment amount
        const avgPaymentAmount = totalPayments > 0
            ? Math.round((totalPaid + interestOnlyPayments) / totalPayments)
            : 0;

        // Calculate total of ALL payments (including interest-only payments)
        const allPaymentsTotal = repayments.reduce((sum: number, repayment: Repayment) => sum + repayment.amount, 0);

        const summary = {
            'Total Loan Amount': loan.amount,
            'Total Paid (Principal)': totalPaid,
            'Interest-Only Payments': interestOnlyPayments,
            'Total All Payments': allPaymentsTotal,
            'Remaining Balance': loan.remainingAmount,
            'Overdue Amount': loan.overdueAmount || 0,
            'Missed Payments': loan.missedPayments || 0,
            'Percentage Complete': `${percentComplete}%`,
            'Total Number of Payments': totalPayments,
            'Average Payment Amount': avgPaymentAmount,
            'Profit': profit,
            'Profit Percentage': loan.amount > 0 ? `${Math.round((profit / loan.amount) * 100)}%` : '0%'
        };

        // Create workbook with multiple sheets
        const wb = XLSX.utils.book_new();

        // Add loan details sheet
        const loanDetailsWS = XLSX.utils.json_to_sheet([loanDetails]);
        XLSX.utils.book_append_sheet(wb, loanDetailsWS, 'Loan Details');

        // Add repayments sheet with a summary row at the bottom
        let repaymentsData = [...formattedRepayments];

        // Add a summary row if there are any repayments
        if (formattedRepayments.length > 0) {
            // Calculate total of ALL payments (including interest-only payments)
            const allPaymentsTotal = repayments.reduce((sum: number, repayment: Repayment) => sum + repayment.amount, 0);

            repaymentsData.push({
                'No.': '',
                'Payment ID': '',
                'Paid Date': '',
                'Amount': allPaymentsTotal, // Use total of ALL payments
                'Payment Type': '',
                'Description': 'TOTAL PAYMENTS',
                'Balance After Payment': loan.remainingAmount,
                'Created At': ''
            });
        }

        const repaymentsWS = XLSX.utils.json_to_sheet(repaymentsData);
        XLSX.utils.book_append_sheet(wb, repaymentsWS, 'Repayments');

        // Add summary sheet
        const summaryWS = XLSX.utils.json_to_sheet([summary]);
        XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Format the filename using borrower name, loan amount, and disbursement date
        const borrowerName = loan.borrower.name.replace(/[^a-zA-Z0-9]/g, '_'); // Replace special chars with underscore
        const loanAmount = Math.round(loan.amount).toString(); // Round to nearest integer

        // Format date as YYYY-MM-DD
        const disbursementDate = new Date(loan.disbursementDate)
            .toISOString()
            .split('T')[0];

        const fileName = `${borrowerName}_${loanAmount}_${disbursementDate}.xlsx`;

        // Encode the filename for Content-Disposition header
        // This ensures special characters are properly handled
        const encodedFilename = encodeURIComponent(fileName).replace(/['()]/g, escape);

        // Set response headers for file download
        const headers = new Headers();
        // Use both filename and filename* parameters for better browser compatibility
        headers.append('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFilename}`);
        headers.append('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        return new NextResponse(excelBuffer, {
            status: 200,
            headers: headers
        });
    } catch (error) {
        console.error('Error exporting loan details:', error);
        return NextResponse.json({ message: 'Error exporting loan details' }, { status: 500 });
    }
}

// Helper function to format date
function formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Helper function to calculate installment amount if it's not set
function calculateInstallmentAmount(loan: any): number {
    let installmentAmount = 0;

    if (loan.repaymentType === 'Monthly') {
        // For monthly loans: Principal/Duration + Interest
        const principalPerMonth = loan.amount / loan.duration;
        installmentAmount = principalPerMonth + loan.interestRate;
    } else {
        // For weekly loans: Principal/(Duration-1)
        const effectiveDuration = Math.max(1, loan.duration - 1);
        installmentAmount = loan.amount / effectiveDuration;
    }

    return installmentAmount;
}
