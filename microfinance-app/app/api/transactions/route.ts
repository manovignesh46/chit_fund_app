import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId, getActorUserId } from '../../../lib/auth';
import { TRANSACTION_TYPES_CONFIG } from '../../../config/config';
import { sendEmail, emailTemplates } from '../../../lib/emailConfig';
import * as XLSX from 'xlsx';
import { calculateTransactionBalance, getCurrentPartnerBalance, getCurrentTotalBalance } from '../../../lib/balanceCalculator';
import { buildTransactionWhereClause } from '../../../lib/transactionWhereBuilder';
import { generateTransactionExportName } from '../../../lib/transactionExportNameGenerator';
import { notifyOtherAdmins, getActorName } from '../../../lib/notifications';
import { validateManualTransaction, isManualTransactionType, firstError } from '../../../lib/transactionValidation';

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
    const validPageSize = pageSize > 0 && pageSize <= 1000 ? pageSize : 10;
    const skip = (validPage - 1) * validPageSize;

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

    // Focus on specific transactions (e.g. opened from a notification)
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      const ids = idsParam.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20);
      (where as any).id = { in: ids };
    }

    // Check if this is a request for partner transactions page (only manual transfers)
    const showOnlyManualTransfers = searchParams.get('manualOnly') === 'true';

    if (showOnlyManualTransfers) {
      // Only show manual partner-to-partner transfers
      where.type = 'transfer';
    }

    console.log("where clause:", where);  
    // Get total count for pagination
    const totalCount = await prisma.transaction.count({ where });

    // Get paginated transactions
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { date: 'desc' }
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

/** Window in which an identical manual entry is treated as an accidental double-submit. */
const DUPLICATE_WINDOW_MS = 15_000;

/**
 * Serialise manual balance-changing writes per data owner so two concurrent
 * entries cannot both read the same "current balance" and overwrite each other.
 */
async function lockPartnerBalances(tx: any, userId: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('partner-balance'), ${userId})`;
}

/**
 * Create a manual PARTNER_TO_PARTNER transfer or RECORD_AMOUNT credit/debit.
 *
 * PARTNER_TO_PARTNER produces two rows so each partner's running balance is stored:
 * 1. Debit row for from_partner (money going out)
 * 2. Credit row for to_partner (money coming in)
 */
async function handleManualTransaction(
  currentUserId: number,
  actorUserId: number,
  activePartner: { id: number; name: string },
  body: any
) {
  const validation = validateManualTransaction(body);
  if ('errors' in validation) {
    return NextResponse.json(
      { error: firstError(validation.errors), fieldErrors: validation.errors },
      { status: 400 }
    );
  }
  const { type, amount, date, note, fromPartnerId, toPartnerId } = validation.value;

  // Partners must belong to the current data owner — never trust client-supplied IDs.
  const partnerIds = [fromPartnerId, toPartnerId].filter((id): id is number => id !== null);
  const partners = await prisma.partner.findMany({
    where: { id: { in: partnerIds }, createdById: currentUserId },
  });
  const fromPartner = fromPartnerId ? partners.find(p => p.id === fromPartnerId) : null;
  const toPartner = toPartnerId ? partners.find(p => p.id === toPartnerId) : null;
  if ((fromPartnerId && !fromPartner) || (toPartnerId && !toPartner)) {
    return NextResponse.json({ error: 'Invalid partner selected.' }, { status: 400 });
  }
  const inactive = partners.find(p => !p.isActive);
  if (inactive) {
    return NextResponse.json({ error: `Partner "${inactive.name}" is inactive.` }, { status: 400 });
  }

  const isTransfer = type === TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER;
  // For transfers this is the debit row's note; the credit row mirrors it.
  const primaryNote = isTransfer ? `Transfer to ${toPartner!.name} - ${note}` : note;

  const result = await prisma.$transaction(async (tx) => {
    await lockPartnerBalances(tx, currentUserId);

    // Reject accidental double-submits (double tap, network retry) of the exact same entry.
    const duplicate = await tx.transaction.findFirst({
      where: {
        createdById: currentUserId,
        type,
        amount,
        date,
        from_partner_id: fromPartnerId,
        to_partner_id: isTransfer ? null : toPartnerId,
        note: primaryNote,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (duplicate) return { duplicate: true as const };

    const currentTotalBalance = await getCurrentTotalBalance(currentUserId, undefined, tx);

    if (!isTransfer) {
      const affectedPartnerId = (toPartnerId || fromPartnerId) as number;
      const currentPartnerBalance = await getCurrentPartnerBalance(affectedPartnerId, currentUserId, undefined, tx);
      const balance = calculateTransactionBalance(
        { type, amount, from_partner_id: fromPartnerId, to_partner_id: toPartnerId },
        affectedPartnerId,
        currentPartnerBalance,
        currentTotalBalance
      );
      const transaction = await tx.transaction.create({
        data: {
          type,
          amount,
          date,
          note,
          createdById: currentUserId,
          from_partner_id: fromPartnerId,
          to_partner_id: toPartnerId,
          partnerBalance: balance.partnerBalance,
          totalBalance: balance.totalBalance,
          from_partner: fromPartner?.name || null,
          to_partner: toPartner?.name || null,
          action_performer: activePartner.name,
          entered_by: activePartner.name,
        },
        include: { fromPartner: true, toPartner: true },
      });
      return { duplicate: false as const, transaction };
    }

    // PARTNER_TO_PARTNER
    const fromBalance = await getCurrentPartnerBalance(fromPartnerId, currentUserId, undefined, tx);
    const toBalance = await getCurrentPartnerBalance(toPartnerId, currentUserId, undefined, tx);

    const debitBalance = calculateTransactionBalance(
      { type, amount, from_partner_id: fromPartnerId, to_partner_id: null },
      fromPartnerId,
      fromBalance,
      currentTotalBalance
    );
    const debitTransaction = await tx.transaction.create({
      data: {
        type,
        amount,
        date,
        note: primaryNote,
        createdById: currentUserId,
        from_partner_id: fromPartnerId,
        to_partner_id: null,
        partnerBalance: debitBalance.partnerBalance,
        totalBalance: debitBalance.totalBalance,
        from_partner: fromPartner!.name,
        to_partner: null,
        action_performer: activePartner.name,
        entered_by: activePartner.name,
      },
    });

    const creditBalance = calculateTransactionBalance(
      { type, amount, from_partner_id: null, to_partner_id: toPartnerId },
      toPartnerId,
      toBalance,
      debitBalance.totalBalance
    );
    const creditTransaction = await tx.transaction.create({
      data: {
        type,
        amount,
        date,
        note: `Transfer from ${fromPartner!.name} - ${note}`,
        createdById: currentUserId,
        from_partner_id: null,
        to_partner_id: toPartnerId,
        partnerBalance: creditBalance.partnerBalance,
        totalBalance: creditBalance.totalBalance,
        from_partner: null,
        to_partner: toPartner!.name,
        action_performer: activePartner.name,
        entered_by: activePartner.name,
      },
    });

    return { duplicate: false as const, debitTransaction, creditTransaction };
  });

  if (result.duplicate) {
    return NextResponse.json(
      { error: 'An identical entry was just recorded. Check the transaction list before submitting again.' },
      { status: 409 }
    );
  }

  // Notify after commit so a notification problem can never roll back money movement.
  const actorName = await getActorName(actorUserId);
  const amountText = `₹${amount.toLocaleString('en-IN')}`;
  const transactionIds = 'transaction' in result
    ? [result.transaction.id]
    : [result.debitTransaction.id, result.creditTransaction.id];
  await notifyOtherAdmins({
    actorId: actorUserId,
    type: 'transaction',
    title: isTransfer ? 'Partner Transfer' : 'Amount Recorded',
    message: isTransfer
      ? `${actorName} recorded a transfer of ${amountText} from ${fromPartner!.name} to ${toPartner!.name}: ${note}`
      : `${actorName} recorded a ${toPartnerId ? 'credit' : 'debit'} of ${amountText} for ${(toPartner || fromPartner)!.name}: ${note}`,
    link: `/transactions?txn=${transactionIds.join(',')}`,
    entityType: 'transaction',
    entityId: transactionIds[0],
    details: {
      kind: type,
      direction: isTransfer ? 'transfer' : toPartnerId ? 'credit' : 'debit',
      amount,
      reason: note,
      date: date.toISOString(),
      fromPartner: fromPartner?.name ?? null,
      toPartner: toPartner?.name ?? null,
      enteredBy: activePartner.name,
      transactionIds,
    },
  });

  if ('transaction' in result) {
    return NextResponse.json(result.transaction, { status: 201 });
  }
  return NextResponse.json({
    message: 'Partner to partner transfer completed',
    debitTransaction: result.debitTransaction,
    creditTransaction: result.creditTransaction,
  }, { status: 201 });
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
    const actorUserId = (await getActorUserId(request)) ?? currentUserId;

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
    
    // Manual partner entries carry money between partners and must be fully auditable.
    if (isManualTransactionType(type)) {
      return await handleManualTransaction(currentUserId, actorUserId, activePartner, body);
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

    console.log(`Transaction creation - Type: ${type}`);
    console.log(`From Partner ID: ${fromPartnerId} (${fromPartner?.name || 'N/A'})`);
    console.log(`To Partner ID: ${toPartnerId} (${toPartner?.name || 'N/A'})`);
    console.log(`Active Partner: ${activePartner.name} (ID: ${activePartner.id})`);

    // Calculate balance for this transaction
    const transactionDate = date ? new Date(date) : new Date();
    
    // Determine which partner this transaction affects for balance calculation
    let affectedPartnerId: number | null = null;
    
    switch (type) {
      case 'collection':
      case 'balance_adjustment':
      case 'CHIT_CONTRIBUTION':
      case 'LOAN_REPAYMENT':
        // These transactions bring money in - affect the receiving partner
        affectedPartnerId = toPartnerId;
        break;
        
      case 'expense':
      case 'LOAN_DISBURSEMENT':
      case 'AUCTION_PAYOUT':
        // These transactions send money out - affect the sending partner
        affectedPartnerId = fromPartnerId;
        break;
        
      case 'transfer':
      case TRANSACTION_TYPES_CONFIG.PARTNER_TO_PARTNER:
        // For transfers, we store the balance of the sending partner (from_partner)
        // since they are the one whose balance decreases
        affectedPartnerId = fromPartnerId;
        break;
        
      default:
        // For other types, use the primary partner involved
        affectedPartnerId = toPartnerId || fromPartnerId;
        break;
    }

    // Get current balances
    const currentPartnerBalance = affectedPartnerId 
      ? await getCurrentPartnerBalance(affectedPartnerId, currentUserId)
      : 0;
    const currentTotalBalance = await getCurrentTotalBalance(currentUserId);

    console.log(`Balance calculation for transaction type: ${type}`);
    console.log(`Affected Partner ID: ${affectedPartnerId}`);
    console.log(`From Partner ID: ${fromPartnerId}, To Partner ID: ${toPartnerId}`);
    console.log(`Current Partner Balance: ${currentPartnerBalance}`);
    console.log(`Current Total Balance: ${currentTotalBalance}`);

    // Calculate new balances
    const balanceCalculation = calculateTransactionBalance(
      {
        type,
        amount: parseFloat(amount),
        from_partner_id: fromPartnerId,
        to_partner_id: toPartnerId
      },
      affectedPartnerId,
      currentPartnerBalance,
      currentTotalBalance
    );

    // Save the transaction using the new ID-based foreign keys
    const transaction = await prisma.transaction.create({
      data: {
        type,
        amount: parseFloat(amount),
        date: transactionDate,
        note,
        createdById: currentUserId,
        
        // New ID-based foreign keys
        from_partner_id: fromPartnerId,
        to_partner_id: toPartnerId,
        
        // Balance tracking
        partnerBalance: balanceCalculation.partnerBalance,
        totalBalance: balanceCalculation.totalBalance,
        
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

    const actorName = await getActorName(actorUserId);
    await notifyOtherAdmins({
      actorId: actorUserId,
      type: 'transaction',
      title: 'New Transaction',
      message: `${actorName} added a ${type} transaction of ₹${amount}`,
      link: '/transactions',
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

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { date: 'desc' }],
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

    // Create Excel file using same format as UI
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

    // Calculate summary data for email and Excel
    let totalLoanRepayment = 0;
    let totalLoanDisbursement = 0;
    let totalChitContributions = 0;
    let totalAuctionPayouts = 0;
    let totalRecordedAmountCredit = 0;
    let totalRecordedAmountDebit = 0;
    let totalPartnerTransfers = 0;
    let totalDocumentCharges = 0;

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
      documentCharges: number;
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

      const creditTypes = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION', 'DOCUMENT_CHARGE'];
      const debitTypes = ['LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];
      
      if (creditTypes.includes(transaction.type)) return true;
      if (debitTypes.includes(transaction.type)) return false;
      
      return (transaction.amount || 0) >= 0;
    }

    // Process each transaction for summary calculations
    for (const transaction of transactions) {
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
        case 'DOCUMENT_CHARGE':
          totalDocumentCharges += amount;
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
            partnerTransfersOut: 0,
            documentCharges: 0
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
          case 'DOCUMENT_CHARGE':
            partnerStats[partnerName].documentCharges += amount;
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

    // Calculate totals for summary
    const netRecordedAmount = totalRecordedAmountCredit - totalRecordedAmountDebit;
    const summaryTotalAmount = (totalLoanRepayment + totalDocumentCharges + totalChitContributions + totalRecordedAmountCredit) - (totalLoanDisbursement + totalAuctionPayouts + totalRecordedAmountDebit);

      // Remove ₹ symbol for Amount, Partner Balance, Total Balance
      const stripRupee = (val: any) => {
        if (typeof val === 'string') return val.replace(/^\s*₹\s*/, '').replace(/,/g, '');
        return val;
      };

    const exportData = transactions.map((transaction: any) => {
      return {
        'Date': formatDate(transaction.createdAt),
        'Payment Date': formatDate(transaction.date),
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
        'Note': transaction.note || '-',
      };
    });

    // Create summary data for Excel
    const summaryExportData = Object.entries(partnerStats).map(([name, stats]) => {
      const partnerTotalAmount = (stats.loanRepayments + stats.documentCharges + stats.chitContributions + stats.recordedAmounts) - (stats.loanDisbursements + stats.auctionPayouts);
      const netPartnerTransfers = stats.partnerTransfersIn - stats.partnerTransfersOut;
      const finalTotalAmount = partnerTotalAmount + netPartnerTransfers;
      return {
        'Partner': name,
        'Loan Repayments': formatCurrency(stats.loanRepayments || 0),
        'Chit Contributions': formatCurrency(stats.chitContributions || 0),
        'Recorded Amounts': formatCurrency(stats.recordedAmounts || 0),
        'Loan Disbursements': formatCurrency(stats.loanDisbursements || 0),
        'Document Charges': formatCurrency(stats.documentCharges || 0),
        'Auction Payouts': formatCurrency(stats.auctionPayouts || 0),
        'Partner Transfers': formatCurrency(netPartnerTransfers),
        'Total Amount': formatCurrency(finalTotalAmount)
      };
    });

    // Add totals row to summary
    const totalNetPartnerTransfers = Object.values(partnerStats).reduce((sum, stats) => sum + (stats.partnerTransfersIn - stats.partnerTransfersOut), 0);
    const finalSummaryTotalAmount = summaryTotalAmount + totalNetPartnerTransfers;
    summaryExportData.push({
      'Partner': 'TOTAL',
      'Loan Repayments': formatCurrency(totalLoanRepayment),
      'Chit Contributions': formatCurrency(totalChitContributions),
      'Recorded Amounts': formatCurrency(netRecordedAmount),
      'Loan Disbursements': formatCurrency(totalLoanDisbursement),
      'Document Charges': formatCurrency(totalDocumentCharges),
      'Auction Payouts': formatCurrency(totalAuctionPayouts),
      'Partner Transfers': formatCurrency(totalNetPartnerTransfers),
      'Total Amount': formatCurrency(finalSummaryTotalAmount)
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    
    // Add transactions worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths to match UI table
    ws['!cols'] = [
      { width: 12 }, // Date
      { width: 12 }, // Payment Date
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
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:J1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellRef]) continue;
      ws[cellRef].s = { font: { bold: true } };
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    // Add summary worksheet
    const summaryWs = XLSX.utils.json_to_sheet(summaryExportData);

    // Set column widths for summary
    summaryWs['!cols'] = [
      { width: 15 }, // Partner
      { width: 18 }, // Loan Repayments
      { width: 18 }, // Chit Contributions
      { width: 18 }, // Recorded Amounts
      { width: 18 }, // Loan Disbursements
      { width: 18 }, // Document Charges
      { width: 18 }, // Auction Payouts
      { width: 18 }, // Partner Transfers
      { width: 18 }  // Total Amount
    ];

    // Apply bold formatting to header row
    const summaryRange = XLSX.utils.decode_range(summaryWs['!ref'] || 'A1:I1');
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

    XLSX.utils.book_append_sheet(wb, summaryWs, 'Transaction Summary');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Get partner and member names for generating descriptive names
    const partnerNames: Record<string, string> = {};
    const memberNames: Record<string, string> = {};
    
    // Fetch partner names if needed
    if (partner || Object.keys(partnerStats).length > 0) {
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

    // Generate dynamic filename, subject, and description based on applied filters
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
    
    const { filename, subject, description } = exportNameData;

    // Prepare email data
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalTransactions = transactions.length;

    // Generate summary table for email
    const summaryTableRows = Object.entries(partnerStats).map(([name, stats]) => {
      const partnerTotalAmount = (stats.loanRepayments + stats.documentCharges + stats.chitContributions + stats.recordedAmounts) - (stats.loanDisbursements + stats.auctionPayouts);
      const netPartnerTransfers = stats.partnerTransfersIn - stats.partnerTransfersOut;
      const finalTotalAmount = partnerTotalAmount + netPartnerTransfers;
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${name}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(stats.loanRepayments || 0)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(stats.chitContributions || 0)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(stats.recordedAmounts || 0)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(stats.loanDisbursements || 0)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(stats.documentCharges || 0)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(stats.auctionPayouts || 0)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(netPartnerTransfers)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(finalTotalAmount)}</td>
        </tr>
      `;
    }).join('');

    const emailContent = `
      <h2>Transaction Export Report</h2>
      <p>Please find attached the transaction export file with detailed transaction data and summary.</p>
      
      <h3>Export Details:</h3>
      <ul>
        <li><strong>Export Type:</strong> ${description}</li>
        <li><strong>Total Transactions:</strong> ${totalTransactions}</li>
        <li><strong>Transaction Amount Total:</strong> ${formatCurrency(totalAmount)}</li>
        ${startDate ? `<li><strong>Start Date:</strong> ${formatDate(startDate)}</li>` : ''}
        ${endDate ? `<li><strong>End Date:</strong> ${formatDate(endDate)}</li>` : ''}
        ${partner && partner !== 'ALL' && partnerNames[partner] ? `<li><strong>Partner:</strong> ${partnerNames[partner]}</li>` : ''}
        ${advMember && memberNames[advMember] ? `<li><strong>Member:</strong> ${memberNames[advMember]}</li>` : ''}
        ${type ? `<li><strong>Transaction Type:</strong> ${type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</li>` : ''}
      </ul>

      <h3>Transaction Summary by Type:</h3>
      <ul>
        <li><strong>Loan Repayments:</strong> ${formatCurrency(totalLoanRepayment)}</li>
        <li><strong>Loan Disbursements:</strong> ${formatCurrency(totalLoanDisbursement)}</li>
        <li><strong>Document Charges:</strong> ${formatCurrency(totalDocumentCharges)}</li>
        <li><strong>Chit Contributions:</strong> ${formatCurrency(totalChitContributions)}</li>
        <li><strong>Auction Payouts:</strong> ${formatCurrency(totalAuctionPayouts)}</li>
        <li><strong>Net Recorded Amount:</strong> ${formatCurrency(netRecordedAmount)}</li>
        <li><strong>Partner Transfers:</strong> ${formatCurrency(totalNetPartnerTransfers)}</li>
        <li><strong>Net Total Amount:</strong> ${formatCurrency(summaryTotalAmount)}</li>
      </ul>
      
      <h3>Partner-wise Summary:</h3>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px;">
          <thead>
            <tr style="background-color: #f9f9f9;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Partner</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Loan Repayments</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Chit Contributions</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Recorded Amounts</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Loan Disbursements</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Document Charges</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Auction Payouts</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Partner Transfers</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${summaryTableRows}
            <tr style="background-color: #f0f0f0; font-weight: bold;">
              <td style="padding: 8px; border: 1px solid #ddd;">TOTAL</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(totalLoanRepayment)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(totalChitContributions)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(netRecordedAmount)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(totalLoanDisbursement)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(totalDocumentCharges)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(totalAuctionPayouts)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(totalNetPartnerTransfers)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(finalSummaryTotalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      ${customMessage ? `<h3>Additional Notes:</h3><p>${customMessage}</p>` : ''}
      
      <p><strong>Generated on:</strong> ${formatDate(new Date())}</p>
      <p><em>The attached Excel file contains two worksheets:</em></p>
      <ul>
        <li><strong>Transactions:</strong> Detailed transaction list</li>
        <li><strong>Transaction Summary:</strong> Partner-wise summary data</li>
      </ul>
    `;

    // Send email with attachment
    const emailResult = await sendEmail({
      to: recipients,
      subject: subject,
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