import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

// Use type assertion to handle TypeScript type checking
const prismaAny = prisma as any;

export async function POST(request: NextRequest) {
    try {
        // Get loan IDs from request body
        const { loanIds } = await request.json();

        if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
            return NextResponse.json({ message: 'No loan IDs provided' }, { status: 400 });
        }

        // Convert string IDs to numbers if needed
        const numericLoanIds = loanIds.map(id => typeof id === 'string' ? parseInt(id, 10) : id);

        // Fetch all selected loans with their borrowers
        const loans = await prismaAny.loan.findMany({
            where: {
                id: { in: numericLoanIds }
            },
            include: {
                borrower: true
            }
        });

        if (!loans || loans.length === 0) {
            return NextResponse.json({ message: 'No loans found' }, { status: 404 });
        }

        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // Add a summary sheet with all loans
        const summaryData = loans.map(loan => ({
            'Loan ID': loan.id,
            'Borrower Name': loan.borrower.name,
            'Loan Type': loan.loanType,
            'Amount': loan.amount,
            'Interest Rate': loan.interestRate,
            'Document Charge': loan.documentCharge || 0,
            'Duration': loan.duration,
            'Disbursement Date': formatDate(loan.disbursementDate),
            'Repayment Type': loan.repaymentType,
            'Remaining Amount': loan.remainingAmount,
            'Current Month/Week': loan.currentMonth || 0,
            'Next Payment Date': loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A',
            'Status': loan.status,
            'Created At': formatDate(loan.createdAt)
        }));

        const summarySheet = XLSX.utils.json_to_sheet(summaryData);

        // Define column widths for summary sheet
        summarySheet['!cols'] = [
            { width: 10 },  // Loan ID
            { width: 25 },  // Borrower Name
            { width: 15 },  // Loan Type
            { width: 15 },  // Amount
            { width: 15 },  // Interest Rate
            { width: 15 },  // Document Charge
            { width: 10 },  // Duration
            { width: 20 },  // Disbursement Date
            { width: 15 },  // Repayment Type
            { width: 18 },  // Remaining Amount
            { width: 15 },  // Current Month/Week
            { width: 20 },  // Next Payment Date
            { width: 12 },  // Status
            { width: 20 },  // Created At
        ];

        // Apply bold formatting to header row
        if (summaryData.length > 0) {
            const summaryRange = XLSX.utils.decode_range(summarySheet['!ref'] || 'A1:N1');
            for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
                if (!summarySheet[cellRef]) continue;
                summarySheet[cellRef].s = { font: { bold: true } };
            }
        }

        XLSX.utils.book_append_sheet(wb, summarySheet, 'Loans Summary');

        // For each loan, create a detailed sheet with repayments
        for (const loan of loans) {
            // Fetch repayments for this loan
            const repayments = await prismaAny.repayment.findMany({
                where: { loanId: loan.id },
                orderBy: { paidDate: 'asc' }
            });

            // Format loan details
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
                'Duration': loan.duration,
                'Disbursement Date': formatDate(loan.disbursementDate),
                'Repayment Type': loan.repaymentType,
                'Remaining Amount': loan.remainingAmount,
                'Current Month/Week': loan.currentMonth || 0,
                'Next Payment Date': loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A',
                'Status': loan.status,
                'Purpose': loan.purpose || 'N/A',
                'Created At': formatDate(loan.createdAt)
            };

            // Format repayments
            const formattedRepayments = repayments.map((repayment, index) => ({
                'No.': index + 1,
                'Payment ID': repayment.id,
                'Paid Date': formatDate(repayment.paidDate),
                'Amount': repayment.amount,
                'Payment Type': repayment.paymentType || 'full',
                'Created At': formatDate(repayment.createdAt)
            }));

            // Calculate totals
            const totalPaid = repayments.reduce((sum, repayment) => {
                if (repayment.paymentType !== 'interestOnly') {
                    return sum + repayment.amount;
                }
                return sum;
            }, 0);

            const interestOnlyPayments = repayments
                .filter(repayment => repayment.paymentType === 'interestOnly')
                .reduce((sum, repayment) => sum + repayment.amount, 0);

            const allPaymentsTotal = repayments.reduce((sum, repayment) => sum + repayment.amount, 0);

            // Calculate profit
            let profit = 0;
            if (loan.repaymentType === 'Monthly') {
                const completedMonths = loan.currentMonth || 0;
                profit = (loan.interestRate * completedMonths) + (loan.documentCharge || 0) + interestOnlyPayments;
            } else if (loan.repaymentType === 'Weekly') {
                profit = totalPaid - loan.amount + (loan.documentCharge || 0);
            }

            // Add summary row to repayments if there are any
            if (formattedRepayments.length > 0) {
                formattedRepayments.push({
                    'No.': '',
                    'Payment ID': '',
                    'Paid Date': '',
                    'Amount': allPaymentsTotal,
                    'Payment Type': '',
                    'Created At': 'TOTAL PAYMENTS'
                });
            }

            // Create a sheet for this loan
            const loanSheet = XLSX.utils.json_to_sheet([
                loanDetails,
                { 'Loan ID': '' }, // Empty row for spacing
                { 'Loan ID': 'REPAYMENTS' }, // Header for repayments section
                ...formattedRepayments,
                { 'Loan ID': '' }, // Empty row for spacing
                { 'Loan ID': 'SUMMARY' }, // Header for summary section
                {
                    'Loan ID': 'Total Paid (Principal)',
                    'Loan Type': totalPaid
                },
                {
                    'Loan ID': 'Interest-Only Payments',
                    'Loan Type': interestOnlyPayments
                },
                {
                    'Loan ID': 'Total All Payments',
                    'Loan Type': allPaymentsTotal
                },
                {
                    'Loan ID': 'Remaining Balance',
                    'Loan Type': loan.remainingAmount
                },
                {
                    'Loan ID': 'Profit',
                    'Loan Type': profit
                }
            ]);

            // Define column widths for loan sheet
            loanSheet['!cols'] = [
                { width: 25 }, // Property name
                { width: 30 }, // Value
            ];

            // Apply formatting to section headers and data
            // Find the range of cells in the sheet
            const loanSheetRange = XLSX.utils.decode_range(loanSheet['!ref'] || 'A1:B1');

            // Apply bold formatting to property names in loan details section
            for (let row = loanSheetRange.s.r; row <= loanSheetRange.e.r; row++) {
                // Apply bold to the first column (property names)
                const propCellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
                if (loanSheet[propCellRef]) {
                    // Bold for property names
                    loanSheet[propCellRef].s = { font: { bold: true } };

                    // Special formatting for section headers
                    const cellValue = loanSheet[propCellRef].v;
                    if (cellValue === 'REPAYMENTS' || cellValue === 'SUMMARY') {
                        loanSheet[propCellRef].s = {
                            font: { bold: true, size: 14 },
                            fill: { fgColor: { rgb: "EEEEEE" } }
                        };
                    }
                }
            }

            // Add the sheet to the workbook
            XLSX.utils.book_append_sheet(wb, loanSheet, `Loan ${loan.id} - ${loan.borrower.name.substring(0, 15)}`);
        }

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Format current date for filename
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Set response headers for file download
        const headers = new Headers();
        const fileName = `Loan_Details_${dateStr}.xlsx`;
        headers.append('Content-Disposition', `attachment; filename="${fileName}"`);
        headers.append('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        return new NextResponse(excelBuffer, {
            status: 200,
            headers: headers
        });
    } catch (error) {
        console.error('Error exporting loans:', error);
        return NextResponse.json({ message: 'Error exporting loans' }, { status: 500 });
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
