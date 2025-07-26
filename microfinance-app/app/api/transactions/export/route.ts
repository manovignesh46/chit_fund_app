import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';
import * as XLSX from 'xlsx';

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

    // Build where clause for filtering (same logic as the main transactions route)
    const where: any = {
      createdById: currentUserId
    };

    // Advanced filter logic: apply each filter independently
    if (advType) {
      if (advType === 'loan') {
        // Only show loan-related transactions
        where.OR = [
          { type: { in: ['loan_given', 'LOAN_DISBURSEMENT', 'loan_repaid', 'LOAN_REPAYMENT'] } },
          { loan: { is: { } } }
        ];
        if (advEntity) {
          where.loan = { id: parseInt(advEntity) };
        }
        if (advSubType === 'disbursement') {
          where.type = { in: ['loan_given', 'LOAN_DISBURSEMENT'] };
        } else if (advSubType === 'repayment') {
          where.type = { in: ['loan_repaid', 'LOAN_REPAYMENT'] };
        }
        // Filter by member name in note if advMember is set
        if (advMember) {
          // Look up member name by ID (via Member -> GlobalMember)
          const memberId = parseInt(advMember);
          const memberRecord = await prisma.globalMember.findUnique({
            where: { id: memberId },
          });
          const memberName = memberRecord?.name;
          if (memberName) {
            where.note = {
              contains: memberName,
              mode: 'insensitive',
            };
          } else {
            // If member not found, filter by impossible string
            where.note = { contains: '__NO_MATCH__' };
          }
        }
      } else if (advType === 'chit') {
        // Only show chit-related transactions
        where.OR = [
          { type: { in: ['CHIT_CONTRIBUTION', 'AUCTION_PAYOUT'] } },
          { contribution: { is: { } } },
          { auction: { is: { } } }
        ];
        // Always filter by member if advMember is set
        if (advMember) {
          const memberId = parseInt(advMember);
          if (advSubType === 'auction') {
            // Only auction transactions for this member and chit fund
            if (advEntity) {
              where.auction = { 
                chitFundId: parseInt(advEntity), 
                winner: { globalMemberId: memberId } 
              };
              where.type = { in: ['AUCTION_PAYOUT'] };
            } else {
              where.auction = { 
                winner: { globalMemberId: memberId } 
              };
              where.type = { in: ['AUCTION_PAYOUT'] };
            }
          } else if (advSubType === 'contribution') {
            // Only contribution transactions for this member and chit fund
            if (advEntity) {
              where.contribution = { 
                chitFundId: parseInt(advEntity), 
                member: { globalMemberId: memberId } 
              };
              where.type = { in: ['CHIT_CONTRIBUTION'] };
            } else {
              where.contribution = { 
                member: { globalMemberId: memberId } 
              };
              where.type = { in: ['CHIT_CONTRIBUTION'] };
            }
          } else {
            // No specific subtype - show both contributions and auctions for this member
            if (advEntity) {
              where.OR = [
                {
                  contribution: { 
                    chitFundId: parseInt(advEntity), 
                    member: { globalMemberId: memberId } 
                  },
                  type: { in: ['CHIT_CONTRIBUTION'] }
                },
                {
                  auction: { 
                    chitFundId: parseInt(advEntity), 
                    winner: { globalMemberId: memberId } 
                  },
                  type: { in: ['AUCTION_PAYOUT'] }
                }
              ];
            } else {
              where.OR = [
                {
                  contribution: { 
                    member: { globalMemberId: memberId } 
                  },
                  type: { in: ['CHIT_CONTRIBUTION'] }
                },
                {
                  auction: { 
                    winner: { globalMemberId: memberId } 
                  },
                  type: { in: ['AUCTION_PAYOUT'] }
                }
              ];
            }
          }
        } else if (advSubType === 'contribution') {
          if (advEntity) {
            where.contribution = { chitFundId: parseInt(advEntity) };
            where.type = { in: ['CHIT_CONTRIBUTION'] };
          }
        } else if (advSubType === 'auction') {
          if (advEntity) {
            where.auction = { chitFundId: parseInt(advEntity) };
            where.type = { in: ['AUCTION_PAYOUT'] };
          }
        }
      }
    }

    // Check if this is a request for partner transactions page (only manual transfers)
    const showOnlyManualTransfers = searchParams.get('manualOnly') === 'true';

    if (showOnlyManualTransfers) {
      // Only show manual partner-to-partner transfers
      where.type = 'transfer';
    } else if (type) {
      // Allow filtering by specific type for other pages
      where.type = type;
    } else if (where.type && Array.isArray(where.type)) {
      // If type is an array (from advanced filter), use Prisma's in operator
      where.type = { in: where.type };
    }

    if (partner) {
      where.OR = [
        { from_partner: partner },
        { to_partner: partner },
        { action_performer: partner },
        { entered_by: partner }
      ];
    }

    // Partial/case-insensitive filter for member name (search in note field as fallback)
    if (member) {
      // Only filter in the note column for member search
      where.note = {
        contains: member,
        mode: 'insensitive',
      };
    }

    if (startDate) {
      where.date = {
        ...where.date,
        gte: new Date(startDate)
      };
    }

    if (endDate) {
      where.date = {
        ...where.date,
        lte: new Date(endDate)
      };
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

      return {
        'Date': formatDate(transaction.date),
        'Type': transaction.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        'Member': extractMemberName(transaction.note),
        'Partner': getPartnerName(transaction),
        'Cr/Dt': getCrDr(transaction),
        'Amount': formatCurrency(transaction.amount),
        'Partner Balance': transaction.partnerBalance !== null && transaction.partnerBalance !== undefined 
          ? formatCurrency(transaction.partnerBalance) 
          : '-',
        'Total Balance': transaction.totalBalance !== null && transaction.totalBalance !== undefined 
          ? formatCurrency(transaction.totalBalance) 
          : '-',
      };
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
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
      { width: 18 }  // Total Balance
    ];

    // Apply bold formatting to header row
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:H1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellRef]) continue;
      ws[cellRef].s = { font: { bold: true } };
    }

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Get current date for filename
    const currentDate = new Date().toISOString().split('T')[0];
    let filename = 'transactions-export';
    
    if (startDate && endDate) {
      filename += `-${startDate}-to-${endDate}`;
    } else if (startDate) {
      filename += `-from-${startDate}`;
    } else if (endDate) {
      filename += `-until-${endDate}`;
    } else {
      filename += `-${currentDate}`;
    }
    
    filename += '.xlsx';

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
