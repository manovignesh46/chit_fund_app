import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';
import * as XLSX from 'xlsx';
import { buildTransactionWhereClause } from '../../../../lib/transactionWhereBuilder';
import { generateTransactionExportName } from '../../../../lib/transactionExportNameGenerator';
import { sendEmail, emailTemplates } from '../../../../lib/emailConfig';

// Helper function to process export data and generate Excel workbook
async function generateExportWorkbook(currentUserId: number, filters: any) {
  const { 
    partner, type, member, startDate, endDate, 
    advType, advMember, advEntity, advSubType,
    manualOnly 
  } = filters;

  // Build where clause using common utility
  const where = await buildTransactionWhereClause(currentUserId, {
    partner,
    type,
    member,
    startDate,
    endDate,
    advType,
    advMember,
    advEntity,
    advSubType
  });

  // Check if this is a request for partner transactions page (only manual transfers)
  if (manualOnly === 'true' || manualOnly === true) {
    where.type = 'transfer';
  }

  // Get transactions for export
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [
      { createdAt: 'desc' },
      { date: 'desc' }
    ],
    include: {
      loan: {
        include: {
          borrower: true
        }
      },
      contribution: {
        include: {
          member: {
            include: {
              globalMember: true
            }
          },
          chitFund: true
        }
      },
      auction: {
        include: {
          winner: {
            include: {
              globalMember: true
            }
          },
          chitFund: true
        }
      },
      partner: true,
    } as any, // Cast to any to avoid Prisma type mismatch during sync
  });

  // Format data for Excel export to match UI table format
  const exportData = transactions.map((transaction: any) => {
    const formatDate = (date: string | Date) => {
      return new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    // Helper to extract member name from note string (same as UI logic)
    function extractMemberName(note?: string): string {
      if (!note) return '-';
      let match = note.match(/Repayment from ([^-]+?)(?: -|$)/i);
      if (match) return match[1].trim();
      match = note.match(/Loan disbursed to ([^-]+?)(?: -|$)/i);
      if (match) return match[1].trim();
      match = note.match(/Auction payout to ([^-]+?)(?: -|$)/i);
      if (match) return match[1].trim();
      match = note.match(/Chit contribution from ([^-]+?)(?: -|$)/i);
      if (match) return match[1].trim();
      match = note.match(/from ([^-]+?)(?: -|$)/i);
      if (match) return match[1].trim();
      match = note.match(/to ([^-]+?)(?: -|$)/i);
      if (match) return match[1].trim();
      return '-';
    }

    // Helper to get the partner name for the transaction (updated for new schema)
    function getPartnerName(t: any): string {
      return t.partner?.name || '-';
    }

    // Helper to determine Credit/Debit (updated for new schema)
    function getCrDr(t: any): 'Credit' | 'Debit' | '-' {
      if (t.transactionClass === 'CREDIT') return 'Credit';
      if (t.transactionClass === 'DEBIT') return 'Debit';
      if (t.transactionClass === 'TRANSFER') return '-';
      
      if (t.type && typeof t.type === 'string') {
        const debitTypes = ['LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];
        const creditTypes = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION', 'DOCUMENT_CHARGE'];
        if (debitTypes.includes(t.type)) return 'Debit';
        if (creditTypes.includes(t.type)) return 'Credit';
      }
      return 'Credit';
    }

    const stripRupee = (val: any) => {
      if (typeof val === 'string') return val.replace(/^\s*₹\s*/, '').replace(/,/g, '');
      return val;
    };

    return {
      'Date': formatDate(transaction.createdAt),
      'Payment Date': formatDate(transaction.date),
      'Type': transaction.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      'Member': extractMemberName(transaction.note),
      'Partner': getPartnerName(transaction),
      'Cr/Dt': getCrDr(transaction),
      'Amount': stripRupee(transaction.amount),
      'Note': transaction.note || ''
    };
  });

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);

  ws['!cols'] = [
    { width: 12 }, { width: 12 }, { width: 18 }, { width: 20 }, 
    { width: 20 }, { width: 8 }, { width: 15 }, { width: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

  // Add summary worksheet logic
  try {
    const summaryTransactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { partner: true } as any
    });

    let totalLoanRepayment = 0, totalLoanDisbursement = 0, totalChitContributions = 0, 
        totalAuctionPayouts = 0, totalRecordedAmountCredit = 0, totalRecordedAmountDebit = 0, 
        totalPartnerTransfers = 0, totalDocumentCharges = 0;

    const partnerStats: { [key: string]: any } = {};

    function getCreditDebitStatus(transaction: any): boolean {
      if (transaction.transactionClass === 'CREDIT') return true;
      if (transaction.transactionClass === 'DEBIT') return false;
      return (transaction.amount || 0) >= 0;
    }

    for (const transaction of summaryTransactions as any[]) {
      const amount = Math.abs(transaction.amount || 0);
      const signedAmount = transaction.amount || 0;
      const isCredit = getCreditDebitStatus(transaction);

      switch (transaction.type) {
        case 'LOAN_REPAYMENT': totalLoanRepayment += amount; break;
        case 'LOAN_DISBURSEMENT': totalLoanDisbursement += amount; break;
        case 'DOCUMENT_CHARGE': totalDocumentCharges += amount; break;
        case 'CHIT_CONTRIBUTION': totalChitContributions += amount; break;
        case 'AUCTION_PAYOUT': totalAuctionPayouts += amount; break;
        case 'RECORD_AMOUNT':
          if (isCredit) totalRecordedAmountCredit += amount; else totalRecordedAmountDebit += amount;
          break;
        case 'PARTNER_TO_PARTNER': totalPartnerTransfers += amount; break;
      }

      const partnerName = transaction.partner?.name || 'Unknown';
      if (!partnerStats[partnerName]) {
        partnerStats[partnerName] = {
          balance: 0, totalCredits: 0, totalDebits: 0, transactionCount: 0,
          loanRepayments: 0, loanDisbursements: 0, chitContributions: 0,
          auctionPayouts: 0, recordedAmounts: 0, partnerTransfersIn: 0,
          partnerTransfersOut: 0, documentCharges: 0
        };
      }

      const stats = partnerStats[partnerName];
      stats.transactionCount++;
      switch (transaction.type) {
        case 'LOAN_REPAYMENT': stats.loanRepayments += amount; break;
        case 'LOAN_DISBURSEMENT': stats.loanDisbursements += amount; break;
        case 'DOCUMENT_CHARGE': stats.documentCharges += amount; break;
        case 'CHIT_CONTRIBUTION': stats.chitContributions += amount; break;
        case 'AUCTION_PAYOUT': stats.auctionPayouts += amount; break;
        case 'RECORD_AMOUNT':
          if (isCredit) stats.recordedAmounts += amount; else stats.recordedAmounts -= amount;
          break;
        case 'PARTNER_TO_PARTNER':
          if (transaction.transactionClass === 'TRANSFER') {
             stats.partnerTransfersIn += (signedAmount >= 0 ? amount : 0);
             stats.partnerTransfersOut += (signedAmount < 0 ? amount : 0);
          }
          break;
      }

      if (isCredit) {
        stats.totalCredits += amount;
        stats.balance += Math.abs(signedAmount);
      } else if (transaction.transactionClass === 'DEBIT') {
        stats.totalDebits += amount;
        stats.balance -= Math.abs(signedAmount);
      } else if (transaction.transactionClass === 'TRANSFER') {
        stats.balance += signedAmount;
      }
    }

    const formatSummaryCurrency = (val: number) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', minimumFractionDigits: 0,
      }).format(val);
    };

    const summaryExportData = Object.entries(partnerStats).map(([name, stats]: [string, any]) => {
      const partnerTotalAmount = (stats.loanRepayments + stats.documentCharges + stats.chitContributions + stats.recordedAmounts) - (stats.loanDisbursements + stats.auctionPayouts);
      const netPartnerTransfers = stats.partnerTransfersIn - stats.partnerTransfersOut;
      const finalTotalAmount = partnerTotalAmount + netPartnerTransfers;
      return {
        'Partner': name,
        'Loan Repayments': formatSummaryCurrency(stats.loanRepayments || 0),
        'Chit Contributions': formatSummaryCurrency(stats.chitContributions || 0),
        'Recorded Amounts': formatSummaryCurrency(stats.recordedAmounts || 0),
        'Loan Disbursements': formatSummaryCurrency(stats.loanDisbursements || 0),
        'Document Charges': formatSummaryCurrency(stats.documentCharges || 0),
        'Auction Payouts': formatSummaryCurrency(stats.auctionPayouts || 0),
        'Partner Transfers': formatSummaryCurrency(netPartnerTransfers),
        'Total Amount': formatSummaryCurrency(finalTotalAmount)
      };
    });

    const netRecordedAmount = totalRecordedAmountCredit - totalRecordedAmountDebit;
    const coreTotal = (totalLoanRepayment + totalChitContributions + totalRecordedAmountCredit) - (totalLoanDisbursement + totalAuctionPayouts + totalRecordedAmountDebit);
    const totalNetPartnerTransfers = Object.values(partnerStats).reduce((sum, s: any) => sum + (s.partnerTransfersIn - s.partnerTransfersOut), 0);
    
    summaryExportData.push({
      'Partner': 'TOTAL',
      'Loan Repayments': formatSummaryCurrency(totalLoanRepayment),
      'Chit Contributions': formatSummaryCurrency(totalChitContributions),
      'Recorded Amounts': formatSummaryCurrency(netRecordedAmount),
      'Loan Disbursements': formatSummaryCurrency(totalLoanDisbursement),
      'Document Charges': formatSummaryCurrency(totalDocumentCharges),
      'Auction Payouts': formatSummaryCurrency(totalAuctionPayouts),
      'Partner Transfers': formatSummaryCurrency(totalNetPartnerTransfers),
      'Total Amount': formatSummaryCurrency(coreTotal + totalNetPartnerTransfers)
    });

    const summaryWs = XLSX.utils.json_to_sheet(summaryExportData);
    summaryWs['!cols'] = Array(9).fill({ width: 18 });
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Transaction Summary');
  } catch (err) {
    console.error('Error in summary worksheet:', err);
  }

  // Generate filename
  const partnerNames: Record<string, string> = {};
  const memberNames: Record<string, string> = {};
  if (partner) {
    const partners = await prisma.partner.findMany({ where: { createdById: currentUserId }, select: { id: true, name: true } });
    partners.forEach(p => partnerNames[p.id.toString()] = p.name);
  }
  if (advMember || member) {
    const members = await prisma.globalMember.findMany({ select: { id: true, name: true } });
    members.forEach(m => memberNames[m.id.toString()] = m.name);
  }

  const { filename } = generateTransactionExportName({
    partner, type, member, startDate, endDate, advType, advMember, advEntity, advSubType
  }, partnerNames, memberNames);

  return { wb, filename };
}

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const filters = {
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '1000'),
      type: searchParams.get('type'),
      partner: searchParams.get('partner'),
      member: searchParams.get('member'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      advType: searchParams.get('advType'),
      advMember: searchParams.get('advMember'),
      advEntity: searchParams.get('advEntity'),
      advSubType: searchParams.get('advSubType'),
      manualOnly: searchParams.get('manualOnly')
    };

    const { wb, filename } = await generateExportWorkbook(currentUserId, filters);
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting transactions:', error);
    return NextResponse.json({ error: 'Failed to export transactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { recipients, customMessage, ...filters } = body;

    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { name: true, email: true }
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { wb, filename } = await generateExportWorkbook(currentUserId, filters);
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Extract summary data for email body
    const transactionSheet = wb.Sheets['Transactions'];
    const summarySheet = wb.Sheets['Transaction Summary'];
    
    const transactions = XLSX.utils.sheet_to_json(transactionSheet);
    const partnerSummary: any[] = XLSX.utils.sheet_to_json(summarySheet);
    
    // Add raw values to partnerSummary for coloring/logic
    partnerSummary.forEach(row => {
      const totalStr = row['Total Amount'] || '₹0';
      row.TotalValue = parseFloat(totalStr.replace(/[^\d.-]/g, ''));
    });

    // Calculate summary by type
    const summaryByType = {
       loanRepayments: 0,
       loanDisbursements: 0,
       documentCharges: 0,
       chitContributions: 0,
       auctionPayouts: 0,
       netRecordedAmount: 0,
       partnerTransfers: 0,
       netTotalAmount: 0
    };

    transactions.forEach((tx: any) => {
       const amount = parseFloat(String(tx['Amount']).replace(/,/g, ''));
       const type = tx['Type']?.toUpperCase();
       const isCredit = tx['Cr/Dt'] === 'Credit';

       if (type === 'LOAN REPAYMENT') summaryByType.loanRepayments += amount;
       else if (type === 'LOAN DISBURSEMENT') summaryByType.loanDisbursements += amount;
       else if (type === 'DOCUMENT CHARGE') summaryByType.documentCharges += amount;
       else if (type === 'CHIT CONTRIBUTION') summaryByType.chitContributions += amount;
       else if (type === 'AUCTION PAYOUT') summaryByType.auctionPayouts += amount;
       else if (type === 'RECORD AMOUNT') {
          if (isCredit) summaryByType.netRecordedAmount += amount;
          else summaryByType.netRecordedAmount -= amount;
       }
       else if (type === 'PARTNER TO PARTNER') {
          // Transfer is net 0 usually across partners, but we show the amount
          // We'll follow the user's template where it might be 0
       }
    });

    const formatForSubject = (dateStr: string | null) => {
      if (!dateStr) return 'N/A';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (e) {
        return dateStr;
      }
    };

    const formattedStartDate = formatForSubject(filters.startDate);
    const formattedEndDate = formatForSubject(filters.endDate);

    summaryByType.netTotalAmount = (summaryByType.loanRepayments + summaryByType.chitContributions + summaryByType.documentCharges + summaryByType.netRecordedAmount) - (summaryByType.loanDisbursements + summaryByType.auctionPayouts);

    const emailDataForTemplate = {
      details: {
        exportType: filters.startDate && filters.endDate 
          ? `(${formattedStartDate} to ${formattedEndDate})` 
          : (filters.endDate ? `Until ${formattedEndDate}` : 'Full History'),
        totalTransactions: transactions.length,
        totalAmount: transactions.reduce((sum: number, tx: any) => sum + parseFloat(String(tx['Amount']).replace(/,/g, '')), 0),
        startDate: formattedStartDate,
        endDate: formattedEndDate
      },
      summaryByType,
      partnerSummary,
      filename
    };

    const template = emailTemplates.transactionExport(user.name, emailDataForTemplate);
    let htmlContent = template.html;
    if (customMessage) {
      const customSection = `<div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;"><h4 style="margin-top:0;">Message:</h4><p style="margin:0;">${customMessage}</p></div>`;
      htmlContent = htmlContent.replace('</div>', customSection + '</div>');
    }

    let emailRecipients = recipients;
    if (!emailRecipients || emailRecipients.length === 0) {
      const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
      emailRecipients = defaultRecipients ? defaultRecipients.split(',').map(e => e.trim()) : [user.email];
    }

    await sendEmail({
      to: emailRecipients,
      subject: template.subject,
      html: htmlContent,
      text: template.text + (customMessage ? `\n\nMessage:\n${customMessage}` : ''),
      attachments: [{
        filename,
        content: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }]
    });

    return NextResponse.json({ success: true, message: 'Transaction export emailed successfully', filename });
  } catch (error) {
    console.error('Error emailing transactions:', error);
    return NextResponse.json({ error: 'Failed to email transaction export' }, { status: 500 });
  }
}
