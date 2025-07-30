import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';
import * as XLSX from 'xlsx';
import { buildTransactionWhereClause } from '../../../../lib/transactionWhereBuilder';
import { generateTransactionExportName } from '../../../../lib/transactionExportNameGenerator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '1000'); // Default to larger export size
    const type = searchParams.get('type');
    const partner = searchParams.get('partner');
    const member = searchParams.get('member');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    // Advanced filter params
    const advType = searchParams.get('advType');
    const advMember = searchParams.get('advMember');
    const advEntity = searchParams.get('advEntity');
    const advSubType = searchParams.get('advSubType');

    // Get the current user ID
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

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
    const showOnlyManualTransfers = searchParams.get('manualOnly') === 'true';
    if (showOnlyManualTransfers) {
      // Only show manual partner-to-partner transfers
      where.type = 'transfer';
    }

    // Get transactions for export
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
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
        fromPartner: true,
        toPartner: true,
      },
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

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
        }).format(amount);
      };

      // Helper to extract member name from note string (same as UI logic)
      function extractMemberName(note?: string): string {
        if (!note) return '-';
        // Pattern 1: Repayment from Arunkumar - Period 1
        let match = note.match(/Repayment from ([^-]+?)(?: -|$)/i);
        if (match) return match[1].trim();
        // Pattern 2: Loan disbursed to Arunkumar
        match = note.match(/Loan disbursed to ([^-]+?)(?: -|$)/i);
        if (match) return match[1].trim();
        // Pattern 3: Auction payout to ([^-]+?)(?: -|$)
        match = note.match(/Auction payout to ([^-]+?)(?: -|$)/i);
        if (match) return match[1].trim();
        // Pattern 4: Chit contribution from ([^-]+?)(?: -|$)
        match = note.match(/Chit contribution from ([^-]+?)(?: -|$)/i);
        if (match) return match[1].trim();
        // Pattern 5: fallback for 'from' or 'to' member
        match = note.match(/from ([^-]+?)(?: -|$)/i);
        if (match) return match[1].trim();
        match = note.match(/to ([^-]+?)(?: -|$)/i);
        if (match) return match[1].trim();
        return '-';
      }

      // Helper to get the partner name for the transaction (same as UI logic)
      function getPartnerName(t: any): string {
        // For PARTNER_TO_PARTNER transactions, show the partner who is involved
        if (t.type === 'PARTNER_TO_PARTNER') {
          if (t.from_partner && !t.to_partner) {
            // Debit transaction - show from_partner
            return t.from_partner;
          } else if (t.to_partner && !t.from_partner) {
            // Credit transaction - show to_partner
            return t.to_partner;
          } else if (t.from_partner && t.to_partner) {
            // Old format with both partners - show both partners
            return `${t.from_partner} → ${t.to_partner}`;
          }
        }
        
        // For other transaction types, show the action_performer
        return t.action_performer || '-';
      }

      // Helper to determine Credit/Debit (same as UI logic)
      function getCrDr(t: any): 'Credit' | 'Debit' | '-' {
        // Special handling for PARTNER_TO_PARTNER transactions
        if (t.type === 'PARTNER_TO_PARTNER') {
          // For new format with separate transactions
          if (t.from_partner && !t.to_partner) {
            // Debit transaction (money going out from from_partner)
            return 'Debit';
          } else if (t.to_partner && !t.from_partner) {
            // Credit transaction (money coming in to to_partner)
            return 'Credit';
          } else if (t.from_partner && t.to_partner) {
            // Old format - show as transfer
            return '-';
          }
        }

        // Special handling for RECORD AMOUNT transactions
        if (t.type === 'RECORD_AMOUNT') {
          if (t.to_partner) {
            // Money coming in to to_partner (credit)
            return 'Credit';
          } else if (t.from_partner) {
            // Money going out from from_partner (debit)
            return 'Debit';
          }
        }

        // Categorize based on standardized transaction types
        if (t.type && typeof t.type === 'string') {
          const debitTypes = ['LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];
          const creditTypes = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION'];
          if (debitTypes.includes(t.type)) return 'Debit';
          if (creditTypes.includes(t.type)) return 'Credit';
        }
        
        // fallback: use amount sign if type is unknown
        if (typeof t.amount === 'number') {
          if (t.amount > 0) return 'Credit';
          if (t.amount < 0) return 'Debit';
        }
        return 'Credit';
      }

      // Remove ₹ symbol for Amount, Partner Balance, Total Balance
      const stripRupee = (val: any) => {
        if (typeof val === 'string') return val.replace(/^\s*₹\s*/, '').replace(/,/g, '');
        return val;
      };
      return {
        'Date': formatDate(transaction.date),
        'Type': transaction.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        'Member': extractMemberName(transaction.note),
        'Partner': getPartnerName(transaction),
        'Cr/Dt': getCrDr(transaction),
        'Amount': stripRupee(transaction.amount),
        'Partner Balance': transaction.partnerBalance !== null && transaction.partnerBalance !== undefined 
          ? stripRupee(transaction.partnerBalance) 
          : '-',
        'Total Balance': transaction.totalBalance !== null && transaction.totalBalance !== undefined 
          ? stripRupee(transaction.totalBalance) 
          : '-',
        'Note': transaction.note || ''
      };
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add transactions worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths to match UI table
    ws['!cols'] = [
      { width: 12 }, // Date
      { width: 18 }, // Type
      { width: 20 }, // Member
      { width: 20 }, // Partner
      { width: 8 },  // Cr/Dt
      { width: 15 }, // Amount
      { width: 18 }, // Partner Balance
      { width: 18 }, // Total Balance
      { width: 30 }  // Note
    ];

    // Apply bold formatting to header row
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:I1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellRef]) continue;
      ws[cellRef].s = { font: { bold: true } };
    }

    // Add the transactions worksheet
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    // Fetch and add Transaction Summary data
    try {
      // Build summary API URL with same filters
      let summaryUrl = `/api/transactions/summary?`;
      const params = new URLSearchParams();
      
      if (partner && partner !== 'ALL') params.append('partner', partner);
      if (type) params.append('type', type);
      if (member) params.append('member', member);
      if (advType) params.append('advType', advType);
      if (advMember) params.append('advMember', advMember);
      if (advEntity) params.append('advEntity', advEntity);
      if (advSubType) params.append('advSubType', advSubType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      summaryUrl += params.toString();

      // Fetch summary data (simulate internal API call)
      const summaryWhere = { ...where }; // Use same where clause
      
      // Calculate summary data directly
      const summaryTransactions = await prisma.transaction.findMany({
        where: summaryWhere,
        orderBy: { date: 'desc' },
      });

      // Calculate summary statistics
      let totalLoanRepayment = 0;
      let totalLoanDisbursement = 0;
      let totalChitContributions = 0;
      let totalAuctionPayouts = 0;
      let totalRecordedAmountCredit = 0;
      let totalRecordedAmountDebit = 0;
      let totalPartnerTransfers = 0;

      // Partner breakdown tracking
      const partnerStats: { [key: string]: {
        balance: number;
        totalCredits: number;
        totalDebits: number;
        transactionCount: number;
        loanRepayments: number;
        loanDisbursements: number;
        chitContributions: number;
        auctionPayouts: number;
        recordedAmounts: number;
        partnerTransfersIn: number;
        partnerTransfersOut: number;
      } } = {};

      // Helper function to determine credit/debit status for a partner (same as in summary route)
      function getCreditDebitStatus(transaction: any, partnerName: string): boolean {
        if (transaction.type === 'PARTNER_TO_PARTNER') {
          if (transaction.from_partner && !transaction.to_partner) {
            return transaction.from_partner !== partnerName;
          } else if (transaction.to_partner && !transaction.from_partner) {
            return transaction.to_partner === partnerName;
          } else if (transaction.from_partner && transaction.to_partner) {
            return transaction.to_partner === partnerName;
          }
        }

        if (transaction.type === 'RECORD_AMOUNT') {
          if (transaction.to_partner === partnerName) return true;
          if (transaction.from_partner === partnerName) return false;
        }

        const creditTypes = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION'];
        const debitTypes = ['LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];
        
        if (creditTypes.includes(transaction.type)) return true;
        if (debitTypes.includes(transaction.type)) return false;
        
        return (transaction.amount || 0) >= 0;
      }

      // Process each transaction for summary
      for (const transaction of summaryTransactions) {
        const amount = Math.abs(transaction.amount || 0);
        const signedAmount = transaction.amount || 0;

        // Categorize by transaction type
        switch (transaction.type) {
          case 'LOAN_REPAYMENT':
            totalLoanRepayment += amount;
            break;
          case 'LOAN_DISBURSEMENT':
            totalLoanDisbursement += amount;
            break;
          case 'CHIT_CONTRIBUTION':
            totalChitContributions += amount;
            break;
          case 'AUCTION_PAYOUT':
            totalAuctionPayouts += amount;
            break;
          case 'RECORD_AMOUNT':
            if (transaction.to_partner) {
              totalRecordedAmountCredit += amount;
            } else if (transaction.from_partner) {
              totalRecordedAmountDebit += amount;
            } else {
              if (signedAmount >= 0) {
                totalRecordedAmountCredit += amount;
              } else {
                totalRecordedAmountDebit += amount;
              }
            }
            break;
          case 'PARTNER_TO_PARTNER':
            totalPartnerTransfers += amount;
            break;
        }

        // Track partner statistics
        const getPartnerForTransaction = (t: any) => {
          if (t.type === 'PARTNER_TO_PARTNER') {
            if (t.from_partner && !t.to_partner) return t.from_partner;
            if (t.to_partner && !t.from_partner) return t.to_partner;
            if (partner && partner !== 'ALL') {
              return partner;
            }
            return t.from_partner || t.to_partner;
          }
          return t.action_performer;
        };

        const partnerName = getPartnerForTransaction(transaction);
        if (partnerName) {
          if (!partnerStats[partnerName]) {
            partnerStats[partnerName] = {
              balance: 0,
              totalCredits: 0,
              totalDebits: 0,
              transactionCount: 0,
              loanRepayments: 0,
              loanDisbursements: 0,
              chitContributions: 0,
              auctionPayouts: 0,
              recordedAmounts: 0,
              partnerTransfersIn: 0,
              partnerTransfersOut: 0
            };
          }

          partnerStats[partnerName].transactionCount++;

          // Add to specific transaction type totals for this partner
          switch (transaction.type) {
            case 'LOAN_REPAYMENT':
              partnerStats[partnerName].loanRepayments += amount;
              break;
            case 'LOAN_DISBURSEMENT':
              partnerStats[partnerName].loanDisbursements += amount;
              break;
            case 'CHIT_CONTRIBUTION':
              partnerStats[partnerName].chitContributions += amount;
              break;
            case 'AUCTION_PAYOUT':
              partnerStats[partnerName].auctionPayouts += amount;
              break;
            case 'RECORD_AMOUNT':
              if (transaction.to_partner === partnerName) {
                partnerStats[partnerName].recordedAmounts += amount;
              } else if (transaction.from_partner === partnerName) {
                partnerStats[partnerName].recordedAmounts -= amount;
              } else if (partnerName === transaction.action_performer) {
                partnerStats[partnerName].recordedAmounts += signedAmount;
              }
              break;
            case 'PARTNER_TO_PARTNER':
              // Track incoming vs outgoing transfers for net calculation
              if (transaction.to_partner === partnerName) {
                partnerStats[partnerName].partnerTransfersIn += amount;
              } else if (transaction.from_partner === partnerName) {
                partnerStats[partnerName].partnerTransfersOut += amount;
              }
              break;
          }

          // Determine if this is a credit or debit for the partner
          const isCredit = getCreditDebitStatus(transaction, partnerName);
          if (isCredit) {
            partnerStats[partnerName].totalCredits += amount;
            partnerStats[partnerName].balance += signedAmount;
          } else {
            partnerStats[partnerName].totalDebits += amount;
            partnerStats[partnerName].balance += signedAmount;
          }
        }
      }

      // Create summary data for export
      const netRecordedAmount = totalRecordedAmountCredit - totalRecordedAmountDebit;
      const totalAmount = (totalLoanRepayment + totalChitContributions + totalRecordedAmountCredit) - (totalLoanDisbursement + totalAuctionPayouts + totalRecordedAmountDebit);

      // Helper function for formatting currency in summary
      const formatSummaryCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
        }).format(amount);
      };

      const summaryExportData = Object.entries(partnerStats).map(([name, stats]) => {
        const partnerTotalAmount = (stats.loanRepayments + stats.chitContributions + stats.recordedAmounts) - (stats.loanDisbursements + stats.auctionPayouts);
        const netPartnerTransfers = stats.partnerTransfersIn - stats.partnerTransfersOut;
        const finalTotalAmount = partnerTotalAmount + netPartnerTransfers;
        return {
          'Partner': name,
          'Loan Repayments': formatSummaryCurrency(stats.loanRepayments || 0),
          'Chit Contributions': formatSummaryCurrency(stats.chitContributions || 0),
          'Recorded Amounts': formatSummaryCurrency(stats.recordedAmounts || 0),
          'Loan Disbursements': formatSummaryCurrency(stats.loanDisbursements || 0),
          'Auction Payouts': formatSummaryCurrency(stats.auctionPayouts || 0),
          'Partner Transfers': formatSummaryCurrency(netPartnerTransfers),
          'Total Amount': formatSummaryCurrency(finalTotalAmount)
        };
      });

      // Add totals row
      const totalNetPartnerTransfers = Object.values(partnerStats).reduce((sum, stats) => sum + (stats.partnerTransfersIn - stats.partnerTransfersOut), 0);
      const finalTotalAmount = totalAmount + totalNetPartnerTransfers;
      summaryExportData.push({
        'Partner': 'TOTAL',
        'Loan Repayments': formatSummaryCurrency(totalLoanRepayment),
        'Chit Contributions': formatSummaryCurrency(totalChitContributions),
        'Recorded Amounts': formatSummaryCurrency(netRecordedAmount),
        'Loan Disbursements': formatSummaryCurrency(totalLoanDisbursement),
        'Auction Payouts': formatSummaryCurrency(totalAuctionPayouts),
        'Partner Transfers': formatSummaryCurrency(totalNetPartnerTransfers),
        'Total Amount': formatSummaryCurrency(finalTotalAmount)
      });

      // Create summary worksheet
      const summaryWs = XLSX.utils.json_to_sheet(summaryExportData);

      // Set column widths for summary
      summaryWs['!cols'] = [
        { width: 15 }, // Partner
        { width: 18 }, // Loan Repayments
        { width: 18 }, // Chit Contributions
        { width: 18 }, // Recorded Amounts
        { width: 18 }, // Loan Disbursements
        { width: 18 }, // Auction Payouts
        { width: 18 }, // Partner Transfers
        { width: 18 }  // Total Amount
      ];

      // Apply bold formatting to header row
      const summaryRange = XLSX.utils.decode_range(summaryWs['!ref'] || 'A1:H1');
      for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!summaryWs[cellRef]) continue;
        summaryWs[cellRef].s = { font: { bold: true } };
      }

      // Bold the totals row (last row)
      const lastRowIndex = summaryExportData.length; // 1-based index due to header
      for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: lastRowIndex, c: col });
        if (!summaryWs[cellRef]) continue;
        summaryWs[cellRef].s = { font: { bold: true } };
      }

      // Add the summary worksheet
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Transaction Summary');

    } catch (summaryError) {
      console.error('Error generating summary data:', summaryError);
      // Continue without summary data if there's an error
    }

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Get partner and member names for generating descriptive names
    const partnerNames: Record<string, string> = {};
    const memberNames: Record<string, string> = {};
    
    // Fetch partner names if needed
    if (partner) {
      const partners = await prisma.partner.findMany({
        where: { createdById: currentUserId },
        select: { id: true, name: true }
      });
      partners.forEach(p => {
        partnerNames[p.id.toString()] = p.name;
      });
    }
    
    // Fetch member names if needed
    if (advMember || member) {
      const members = await prisma.globalMember.findMany({
        select: { id: true, name: true }
      });
      members.forEach(m => {
        memberNames[m.id.toString()] = m.name;
      });
    }

    // Generate dynamic filename based on applied filters
    const exportNameData = generateTransactionExportName({
      partner,
      type,
      member,
      startDate,
      endDate,
      advType,
      advMember,
      advEntity,
      advSubType
    }, partnerNames, memberNames);
    
    const { filename } = exportNameData;

    // Return the Excel file
    return new NextResponse(excelBuffer, {
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
