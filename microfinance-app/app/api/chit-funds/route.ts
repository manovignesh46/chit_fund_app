import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';

// GET /api/chit-funds - List all chit funds
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const status = searchParams.get('status');

    const skip = (page - 1) * pageSize;
    const where: any = {
      createdById: currentUserId, // Verify this matches your User relation
      ...(status && { status }),
    };

    const [chitFunds, totalCount] = await Promise.all([
      prisma.chitFund.findMany({
        where,
        include: {
          _count: { select: { members: true } },
          feeStructure: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.chitFund.count({ where }),
    ]);

    return NextResponse.json({
      chitFunds,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    });
  } catch (error) {
    console.error('Error fetching chit funds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chit funds' },
      { status: 500 }
    );
  }
}

// POST /api/chit-funds - Create new chit fund
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      totalAmount,
      monthlyContribution,
      duration,
      membersCount,
      startDate,
      chitFundType, // 'Auction' or 'Fixed'
      feeStructureId,
      firstMonthContribution, // Optional
    } = body;

    // Validate required fields
    if (!name || !totalAmount || !monthlyContribution || !duration || !membersCount || !startDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const chitFund = await prisma.chitFund.create({
      data: {
        name,
        totalAmount: parseFloat(totalAmount),
        monthlyContribution: parseFloat(monthlyContribution),
        duration: parseInt(duration),
        membersCount: parseInt(membersCount),
        startDate: new Date(startDate),
        chitFundType: chitFundType || 'Auction',
        feeStructureId: feeStructureId ? parseInt(feeStructureId) : null,
        firstMonthContribution: firstMonthContribution ? parseFloat(firstMonthContribution) : null,
        createdById: currentUserId,
        currentMonth: 1,
        status: 'Active',
      },
    });

    return NextResponse.json(chitFund, { status: 201 });
  } catch (error) {
    console.error('Error creating chit fund:', error);
    return NextResponse.json(
      { error: 'Failed to create chit fund' },
      { status: 500 }
    );
  }
}
