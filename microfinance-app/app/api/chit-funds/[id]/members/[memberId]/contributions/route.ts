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

    // Check if the member exists and belongs to this chit fund
    const member = await prisma.member.findFirst({
      where: {
        id: memberIdInt,
        chitFundId: chitFundId,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found or does not belong to this chit fund' },
        { status: 404 }
      );
    }

    // Get all contributions for this member
    const contributions = await prisma.contribution.findMany({
      where: {
        memberId: memberIdInt,
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            contact: true,
            contribution: true,
          },
        },
      },
      orderBy: [
        { month: 'asc' },
        { paidDate: 'desc' },
      ],
    });

    return NextResponse.json(contributions);
  } catch (error) {
    console.error('Error fetching member contributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member contributions' },
      { status: 500 }
    );
  }
}
