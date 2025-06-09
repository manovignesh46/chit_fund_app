import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';

// GET /api/transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const type = searchParams.get('type');
    const partner = searchParams.get('partner');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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
      orderBy: { date: 'desc' },
      skip,
      take: validPageSize,
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
    // Required fields from user input
    const {
      type,
      amount,
      member,
      from_partner,
      to_partner,
      action_performer,
      date,
      note
    } = body;

    // Get the current user ID and active partner (assume from session or request header)
    const currentUserId = await getCurrentUserId(request);
    // For demo, get active_partner from header (replace with your session logic)
    const active_partner = request.headers.get('x-active-partner') || 'Me';
    const other_partner = active_partner === 'Me' ? 'My Friend' : 'Me';

    // Default assignment rules
    let _from = from_partner;
    let _to = to_partner;
    let _action = action_performer;

    if (!from_partner && !to_partner && !action_performer) {
      switch (type) {
        case 'collection':
          _from = null;
          _to = active_partner;
          _action = active_partner;
          break;
        case 'transfer':
          _from = active_partner;
          _to = other_partner;
          _action = active_partner;
          break;
        case 'loan_given':
          _from = active_partner;
          _to = null;
          _action = active_partner;
          break;
        case 'loan_repaid':
          _from = null;
          _to = active_partner;
          _action = active_partner;
          break;
        default:
          return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
      }
    }

    // Save transaction
    const transaction = await prisma.transaction.create({
      data: {
        type,
        amount: parseFloat(amount),
        member,
        from_partner: _from,
        to_partner: _to,
        action_performer: _action,
        entered_by: active_partner,
        date: date ? new Date(date) : new Date(),
        note,
        createdById: currentUserId
      }
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
