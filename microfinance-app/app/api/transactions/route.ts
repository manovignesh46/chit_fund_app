import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';
import { TRANSACTION_TYPES_CONFIG } from '../../../config/config';
import { sendEmail, emailTemplates } from '../../../lib/emailConfig';
import * as XLSX from 'xlsx';

// GET /api/transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Handle email export action
    if (action === 'email-export') {
      return await handleEmailExport(request);
    }

    // Regular transaction fetching logic
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
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

    // Validate pagination parameters
    const validPage = page > 0 ? page : 1;
    const validPageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 10;
    const skip = (validPage - 1) * validPageSize;

    // Build where clause for filtering
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
          const member = await prisma.globalMember.findUnique({
            where: { id: memberId },
          });
          const memberName = member?.name;
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

    console.log("where clause:", where);  
    // Get total count for pagination
    const totalCount = await prisma.transaction.count({ where });

    // Get paginated transactions
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ],
      skip,
      take: validPageSize,
      include: {
        loan: true,
        contribution: { include: { member: true } },
        auction: { include: { winner: true } },
      },
    });

    return NextResponse.json({
      transactions,
      totalCount,
      page: validPage,
      pageSize: validPageSize,
      totalPages: Math.ceil(totalCount / validPageSize)
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// POST /api/transactions
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Handle email export action for POST requests
    if (action === 'email-export') {
      return await handleEmailExport(request);
    }

    // Regular transaction creation logic
    const body = await request.json();
    const {
      type,
      amount,
      date,
      note,
      from_partner_id, // Expecting ID from the frontend
      to_partner_id,   // Expecting ID from the frontend
    } = body;

    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // The 'active partner' is the person performing the data entry.
    const activePartnerName = request.headers.get('x-active-partner');
    if (!activePartnerName) {
      return NextResponse.json({ error: 'Active partner context is missing.' }, { status: 400 });
    }
    const activePartner = await prisma.partner.findFirst({
        where: { name: activePartnerName, createdById: currentUserId }
    });
    if (!activePartner) {
        return NextResponse.json({ error: 'Active partner not found.' }, { status: 404 });
    }
    
    let fromPartnerId: number | null = null;
    let toPartnerId: number | null = null;
    let actionPerformerId: number | null = null;

    // Determine the 'from' and 'to' based on the transaction type
    switch (type) {
      case 'collection':
        // Money collected by the active partner from an external source.
        fromPartnerId = null;
        toPartnerId = activePartner.id;
        actionPerformerId = activePartner.id;
        break;
      
      case 'expense':
        // Money spent by the active partner on an external expense.
        fromPartnerId = activePartner.id;
        toPartnerId = null;
        actionPerformerId = activePartner.id;
        break;

      case TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER:
        // Money transferred between two partners. Frontend must provide both IDs.
        if (!from_partner_id || !to_partner_id) {
          return NextResponse.json({ error: 'For transfers, both a "from" and "to" partner must be specified.' }, { status: 400 });
        }
        fromPartnerId = parseInt(from_partner_id);
        toPartnerId = parseInt(to_partner_id);
        actionPerformerId = activePartner.id; // The person recording the transfer
        break;

      case TRANSACTION_TYPES_CONFIG.RECORD_AMOUNT:
        // Recording an amount for a specific partner. Frontend must provide the ID.

        fromPartnerId = parseInt(from_partner_id);
        toPartnerId = parseInt(to_partner_id);
        actionPerformerId = activePartner.id;
        break;

      case 'balance_adjustment':
        // Manually adjusting a partner's balance (e.g., adding starting cash).
        // Frontend must provide the ID of the partner whose balance is being adjusted.
        if (!to_partner_id) {
          return NextResponse.json({ error: 'For a balance adjustment, the target partner must be specified.' }, { status: 400 });
        }
        fromPartnerId = null;
        toPartnerId = parseInt(to_partner_id);
        actionPerformerId = activePartner.id;
        break;

        
      default:
        // Use the IDs provided directly from the form for any other types
        fromPartnerId = from_partner_id ? parseInt(from_partner_id) : null;
        toPartnerId = to_partner_id ? parseInt(to_partner_id) : null;
        actionPerformerId = activePartner.id;
        break;
    }

    // For better display text, fetch the names of the partners involved.
    const fromPartner = fromPartnerId ? await prisma.partner.findUnique({ where: { id: fromPartnerId }}) : null;
    const toPartner = toPartnerId ? await prisma.partner.findUnique({ where: { id: toPartnerId }}) : null;
    const actionPerformer = actionPerformerId ? await prisma.partner.findUnique({ where: { id: actionPerformerId }}) : activePartner;

    // Save the transaction using the new ID-based foreign keys
    const transaction = await prisma.transaction.create({
      data: {
        type,
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date(),
        note,
        createdById: currentUserId,
        
        // New ID-based foreign keys
        from_partner_id: fromPartnerId,
        to_partner_id: toPartnerId,
        
        // Denormalized string fields for easy display (optional but recommended)
        from_partner: fromPartner?.name || null,
        to_partner: toPartner?.name || null,
        action_performer: actionPerformer?.name || activePartner.name,
        entered_by: activePartner.name,
      },
      include: {
        fromPartner: true, // Include full partner objects in the response
        toPartner: true,
      }
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create transaction', details: errorMessage }, { status: 500 });
  }
}

// Handle email export for transactions
async function handleEmailExport(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    let {
      recipients,
      exportType,
      period,
      duration,
      limit,
      customMessage,
      startDate,
      endDate,
      // Transaction-specific filters
      partner,
      type,
      member,
      advType,
      advMember,
      advEntity,
      advSubType
    } = body;

    if (!recipients || recipients.length === 0) {
      // Use default recipients from environment variable, or fallback to user email
      const defaultRecipients = process.env.DEFAULT_EMAIL_RECIPIENTS;
      if (defaultRecipients) {
        recipients = defaultRecipients.split(',').map(email => email.trim()).filter(email => email);
      } else {
        // Get current user's email as fallback
        const user = await prisma.user.findUnique({
          where: { id: currentUserId },
          select: { email: true }
        });
        recipients = user ? [user.email] : [];
      }
      
      if (!recipients || recipients.length === 0) {
        return NextResponse.json({ error: 'No recipients available. Please configure DEFAULT_EMAIL_RECIPIENTS or provide recipients.' }, { status: 400 });
      }
    }

    // Build same where clause as in GET method
    const where: any = { createdById: currentUserId };

    // Apply filters (same logic as GET method)
    if (advType) {
      if (advType === 'loan') {
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
        if (advMember) {
          const memberId = parseInt(advMember);
          const memberRecord = await prisma.globalMember.findUnique({
            where: { id: memberId },
          });
          const memberName = memberRecord?.name;
          if (memberName) {
            where.note = { contains: memberName, mode: 'insensitive' };
          } else {
            where.note = { contains: '__NO_MATCH__' };
          }
        }
      } else if (advType === 'chit') {
        where.OR = [
          { type: { in: ['CHIT_CONTRIBUTION', 'AUCTION_PAYOUT'] } },
          { contribution: { is: { } } },
          { auction: { is: { } } }
        ];
        if (advMember) {
          const memberId = parseInt(advMember);
          if (advSubType === 'auction') {
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

    if (type) {
      where.type = type;
    }

    if (partner) {
      where.OR = [
        { from_partner: partner },
        { to_partner: partner },
        { action_performer: partner },
        { entered_by: partner }
      ];
    }

    if (member) {
      where.note = { contains: member, mode: 'insensitive' };
    }

    if (startDate) {
      where.date = { ...where.date, gte: new Date(startDate) };
    }

    if (endDate) {
      where.date = { ...where.date, lte: new Date(endDate) };
    }

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        loan: {
          include: {
            borrower: true
          }
        },
        contribution: { 
          include: { 
            member: { include: { globalMember: true } },
            chitFund: true
          } 
        },
        auction: { 
          include: { 
            winner: { include: { globalMember: true } },
            chitFund: true
          } 
        },
        fromPartner: true,
        toPartner: true,
      },
    });

    // Create Excel file
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

    const exportData = transactions.map((transaction: any) => {
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
        'Note': transaction.note || 'N/A',
        'Created At': formatDate(transaction.createdAt),
      };
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Create filename
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `transactions-${period || 'export'}-${currentDate}.xlsx`;

    // Prepare email data
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalTransactions = transactions.length;

    const emailContent = `
      <h2>Transactions Export Report</h2>
      <p>Please find attached the transactions export file.</p>
      
      <h3>Summary:</h3>
      <ul>
        <li><strong>Total Transactions:</strong> ${totalTransactions}</li>
        <li><strong>Total Amount:</strong> ${formatCurrency(totalAmount)}</li>
        <li><strong>Period:</strong> ${period || 'All time'}</li>
        ${startDate ? `<li><strong>Start Date:</strong> ${formatDate(startDate)}</li>` : ''}
        ${endDate ? `<li><strong>End Date:</strong> ${formatDate(endDate)}</li>` : ''}
      </ul>
      
      ${customMessage ? `<h3>Additional Notes:</h3><p>${customMessage}</p>` : ''}
      
      <p>Generated on: ${formatDate(new Date())}</p>
    `;

    // Send email with attachment
    const emailResult = await sendEmail({
      to: recipients,
      subject: `Transactions Export - ${period || 'Report'}`,
      html: emailContent,
      attachments: [{
        filename,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }]
    });

    return NextResponse.json({
      message: 'Transactions export email sent successfully',
      emailResult,
      totalTransactions,
      totalAmount
    });

  } catch (error) {
    console.error('Error sending transactions email:', error);
    return NextResponse.json(
      { error: 'Failed to send transactions email' },
      { status: 500 }
    );
  }
}