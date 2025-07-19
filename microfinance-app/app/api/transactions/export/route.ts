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

    // Format data for Excel export
    const exportData = transactions.map((transaction: any) => {
      const formatDate = (date: string | Date) => {
        return new Date(date).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
        }).format(amount);
      };

      let memberName = '';
      let entityName = '';
      
      if (transaction.contribution) {
        memberName = transaction.contribution.member?.globalMember?.name || '';
        entityName = transaction.contribution.chitFund?.name || '';
      } else if (transaction.auction) {
        memberName = transaction.auction.winner?.globalMember?.name || '';
        entityName = transaction.auction.chitFund?.name || '';
      } else if (transaction.loan) {
        // For loans, extract member name from the note or loan borrower
        if (transaction.loan.borrower?.name) {
          memberName = transaction.loan.borrower.name;
        } else if (transaction.note) {
          // Try to extract member name from note
          memberName = transaction.note;
        }
        entityName = `${transaction.loan.loanType || 'Loan'} #${transaction.loan.id} - ₹${transaction.loan.amount?.toLocaleString() || transaction.loan.amount}`;
      }

      return {
        'Transaction ID': transaction.id,
        'Date': formatDate(transaction.date),
        'Type': transaction.type,
        'Amount': formatCurrency(transaction.amount),
        'From Partner': transaction.from_partner || 'N/A',
        'To Partner': transaction.to_partner || 'N/A',
        'Action Performer': transaction.action_performer,
        'Entered By': transaction.entered_by,
        'Member': memberName || 'N/A',
        'Entity': entityName || 'N/A',
        'Partner Balance': transaction.partnerBalance ? formatCurrency(transaction.partnerBalance) : 'N/A',
        'Total Balance': transaction.totalBalance ? formatCurrency(transaction.totalBalance) : 'N/A',
        'Note': transaction.note || 'N/A',
        'Created At': formatDate(transaction.createdAt),
      };
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

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
