import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getCurrentUserId } from '../../../../../lib/auth';

// GET /api/chit-funds/[id]/members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const chitFundId = parseInt(params.id);

    const members = await prisma.member.findMany({
      where: { chitFundId },
      include: {
        globalMember: true,
      },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error('Error listing members:', error);
    return NextResponse.json({ error: 'Failed to list members' }, { status: 500 });
  }
}

// POST /api/chit-funds/[id]/members - Add a member to the chit fund
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const chitFundId = parseInt(params.id);
    const body = await request.json();
    const { globalMemberId, joinDate, contribution } = body;

    // Check ownership of chit fund
    const cf = await prisma.chitFund.findUnique({where: {id: chitFundId}});
    if(!cf || cf.createdById !== currentUserId) {
        return NextResponse.json({ error: 'Chit Fund not found' }, { status: 404 });
    }

    const newMember = await prisma.member.create({
      data: {
        chitFundId,
        globalMemberId: parseInt(globalMemberId),
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        contribution: contribution ? parseFloat(contribution) : 0, // Initial logic, might need refinement
      },
      include: { globalMember: true }
    });

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
     console.error('Error adding member:', error);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}
