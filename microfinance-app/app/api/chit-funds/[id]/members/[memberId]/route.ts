import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const chitFundId = parseInt(id);
    const memberIdInt = parseInt(memberId);

    if (isNaN(chitFundId) || isNaN(memberIdInt)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID or member ID' },
        { status: 400 }
      );
    }

    // Check if the chit fund exists
    const chitFund = await prisma.chitFund.findUnique({
      where: { id: chitFundId },
    });

    if (!chitFund) {
      return NextResponse.json(
        { error: 'Chit fund not found' },
        { status: 404 }
      );
    }

    // Get the member with global member details
    const member = await prisma.member.findFirst({
      where: {
        id: memberIdInt,
        chitFundId: chitFundId,
      },
      include: {
        globalMember: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found or does not belong to this chit fund' },
        { status: 404 }
      );
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error('Error fetching member:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member details' },
      { status: 500 }
    );
  }
}
