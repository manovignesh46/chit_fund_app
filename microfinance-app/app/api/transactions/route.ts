import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';
import { TRANSACTION_TYPES_CONFIG } from '../../../config/config';

// GET /api/transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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

    // Advanced filter logic
    if (advType && advMember && advEntity) {
      if (advType === 'loan') {
        // Find transactions linked to this loan
        where.loan = { id: parseInt(advEntity) };
      } else if (advType === 'chit') {
        // Find transactions linked to this chit fund (via contribution or auction)
        // Contribution
        where.OR = [
          { contribution: { chitFundId: parseInt(advEntity), member: { globalMemberId: parseInt(advMember) } } },
          { auction: { chitFundId: parseInt(advEntity) } }
        ];
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

    // Get total count for pagination
    const totalCount = await prisma.transaction.count({ where });

    // Get paginated transactions
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: validPageSize,
      include: {
        loan: true,
        contribution: { include: { member: true } },
        auction: true,
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