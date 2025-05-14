import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

export async function GET(
    _request: NextRequest,
    context: { params: { id: string } }
) {
    try {
        const id = context.params.id;
        const loanId = Number(id);

        // Get loan details with borrower and all repayments
        const loan = await prismaAny.loan.findUnique({
            where: { id: loanId },
            include: {
                borrower: true,
                repayments: {
                    orderBy: { paidDate: 'asc' }
                }
            }
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
            'Installment Amount': loan.installmentAmount || 0,
            'Duration (months)': loan.duration,
            'Disbursement Date': formatDate(loan.disbursementDate),
            'Repayment Type': loan.repaymentType,
            'Remaining Amount': loan.remainingAmount,
            'Current Month': loan.currentMonth || 0,
            'Next Payment Date': loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A',
            'Status': loan.status,
            'Purpose': loan.purpose || 'N/A',
            'Created At': formatDate(loan.createdAt),
            'Updated At': formatDate(loan.updatedAt)
        };

        // Format repayments data for export
        const repayments = loan.repayments.map((repayment: any, index: number) => ({
            'No.': index + 1,
            'Payment ID': repayment.id,
            'Paid Date': formatDate(repayment.paidDate),
            'Amount': repayment.amount,
            'Payment Type': repayment.paymentType || 'full',
            'Created At': formatDate(repayment.createdAt)
        }));

        // Calculate loan summary
        const totalPaid = loan.repayments.reduce((sum: number, repayment: any) => {
            // Only count non-interest-only payments toward principal reduction
            if (repayment.paymentType !== 'interestOnly') {
                return sum + repayment.amount;
            }
            return sum;
        }, 0);

        const interestOnlyPayments = loan.repayments
            .filter((repayment: any) => repayment.paymentType === 'interestOnly')
            .reduce((sum: number, repayment: any) => sum + repayment.amount, 0);

        // Calculate profit based on loan type
        let profit = 0;
        if (loan.repaymentType === 'Monthly') {
            // For monthly loans: interest amount * completed months + document charge
            const completedMonths = loan.currentMonth || 0;
            profit = (loan.interestRate * completedMonths) + (loan.documentCharge || 0) + interestOnlyPayments;
        } else if (loan.repaymentType === 'Weekly') {
            // For weekly loans: profit is the difference between total payments and principal
            profit = totalPaid - loan.amount + (loan.documentCharge || 0);
        }

        const summary = {
            'Total Loan Amount': loan.amount,
            'Total Paid': totalPaid,
            'Interest-Only Payments': interestOnlyPayments,
            'Remaining Balance': loan.remainingAmount,
            'Profit': profit
        };

        // Create workbook with multiple sheets
        const wb = XLSX.utils.book_new();

        // Add loan details sheet
        const loanDetailsWS = XLSX.utils.json_to_sheet([loanDetails]);
        XLSX.utils.book_append_sheet(wb, loanDetailsWS, 'Loan Details');

        // Add repayments sheet
        const repaymentsWS = XLSX.utils.json_to_sheet(repayments);
        XLSX.utils.book_append_sheet(wb, repaymentsWS, 'Repayments');

        // Add summary sheet
        const summaryWS = XLSX.utils.json_to_sheet([summary]);
        XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Set response headers for file download
        const headers = new Headers();
        headers.append('Content-Disposition', `attachment; filename="loan_${loan.id}_details.xlsx"`);
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
