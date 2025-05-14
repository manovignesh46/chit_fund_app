import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';

// GET: Fetch all members of a chit fund
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

    // Get pagination parameters from the query string
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;

    // Fetch members with pagination
    const members = await prisma.member.findMany({
      where: {
        chitFundId,
      },
      include: {
        globalMember: true,
      },
      skip,
      take: pageSize,
    });

    // Get total count for pagination
    const totalCount = await prisma.member.count({
      where: {
        chitFundId,
      },
    });

    return NextResponse.json({
      members,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching chit fund members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chit fund members' },
      { status: 500 }
    );
  }
}

// POST: Add a new member to a chit fund
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

    // Create the new member
    const newMember = await prisma.member.create({
      data: {
        globalMemberId: data.globalMemberId,
        chitFundId,
        joinDate: data.joinDate || new Date(),
        contribution: data.contribution || chitFund.monthlyContribution,
      },
      include: {
        globalMember: true,
      },
    });

    return NextResponse.json(newMember);
  } catch (error) {
    console.error('Error adding chit fund member:', error);
    return NextResponse.json(
      { error: 'Failed to add chit fund member' },
      { status: 500 }
    );
  }
}
