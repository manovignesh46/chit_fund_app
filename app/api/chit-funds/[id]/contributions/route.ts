import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';

// GET: Fetch all contributions of a chit fund
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the current user ID from the request
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const id = params.id;
    const chitFundId = parseInt(id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    // Verify the chit fund exists and belongs to the current user
    const chitFund = await prisma.chitFund.findFirst({
      where: {
        id: chitFundId,
        createdById: currentUserId,
      },
    });

    if (!chitFund) {
      return NextResponse.json(
        { error: 'Chit fund not found' },
        { status: 404 }
      );
    }

    // Fetch contributions
    const contributions = await prisma.contribution.findMany({
      where: {
        chitFundId,
      },
      include: {
        member: {
          include: {
            globalMember: true,
          },
        },
      },
      orderBy: [
        { month: 'asc' },
        { memberId: 'asc' },
      ],
    });

    return NextResponse.json(contributions);
  } catch (error) {
    console.error('Error fetching chit fund contributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chit fund contributions' },
      { status: 500 }
    );
  }
}

// POST: Add a new contribution to a chit fund
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the current user ID from the request
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const id = params.id;
    const chitFundId = parseInt(id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    // Verify the chit fund exists and belongs to the current user
    const chitFund = await prisma.chitFund.findFirst({
      where: {
        id: chitFundId,
        createdById: currentUserId,
      },
    });

    if (!chitFund) {
      return NextResponse.json(
        { error: 'Chit fund not found' },
        { status: 404 }
      );
    }

    // Parse the request body
    const data = await request.json();

    // Check if a contribution already exists for this member and month
    const existingContribution = await prisma.contribution.findFirst({
      where: {
        chitFundId,
        memberId: data.memberId,
        month: data.month,
      },
    });

    if (existingContribution) {
      return NextResponse.json(
        { error: 'A contribution already exists for this member and month' },
        { status: 400 }
      );
    }

    // Create the new contribution
    const newContribution = await prisma.contribution.create({
      data: {
        chitFundId,
        memberId: data.memberId,
        month: data.month,
        amount: data.amount,
        paidDate: data.paidDate || new Date(),
        balance: data.balance || 0,
        balancePaymentDate: data.balancePaymentDate,
        balancePaymentStatus: data.balancePaymentStatus || 'Pending',
        notes: data.notes,
      },
      include: {
        member: {
          include: {
            globalMember: true,
          },
        },
      },
    });

    return NextResponse.json(newContribution);
  } catch (error) {
    console.error('Error adding chit fund contribution:', error);
    return NextResponse.json(
      { error: 'Failed to add chit fund contribution' },
      { status: 500 }
    );
  }
}
