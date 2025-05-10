import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const chitFundId = parseInt(params.id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
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

    // Get all members for this chit fund
    const members = await prisma.member.findMany({
      where: { chitFundId: chitFundId },
      include: {
        _count: {
          select: { contributions: true },
        },
        auctions: {
          select: {
            id: true,
            month: true,
          },
          take: 1, // We only need to know if they won any auction
        },
      },
      orderBy: { joinDate: 'asc' },
    });

    // Transform the data to include auction information
    const transformedMembers = members.map(member => {
      const wonAuction = member.auctions && member.auctions.length > 0 ? member.auctions[0] : null;
      return {
        id: member.id,
        name: member.name,
        contact: member.contact,
        joinDate: member.joinDate,
        contribution: member.contribution,
        contributionsCount: member._count.contributions,
        auctionWon: wonAuction !== null,
        auctionMonth: wonAuction?.month || null,
      };
    });

    return NextResponse.json(transformedMembers);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const chitFundId = parseInt(params.id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'contact'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
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

    // Create the member
    const member = await prisma.member.create({
      data: {
        name: body.name,
        contact: body.contact,
        chitFundId: chitFundId,
        joinDate: new Date(),
        contribution: body.contribution || chitFund.monthlyContribution,
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Error creating member:', error);
    return NextResponse.json(
      { error: 'Failed to create member' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const chitFundId = parseInt(params.id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    const { memberId } = await request.json();

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    // Check if the member exists and belongs to this chit fund
    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        chitFundId: chitFundId,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found or does not belong to this chit fund' },
        { status: 404 }
      );
    }

    // Check if the member has contributions
    const contributionsCount = await prisma.contribution.count({
      where: { memberId: memberId },
    });

    if (contributionsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete member with contributions. Delete contributions first.' },
        { status: 400 }
      );
    }

    // Check if the member has won an auction
    const auctionCount = await prisma.auction.count({
      where: { winnerId: memberId },
    });

    if (auctionCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete member who has won an auction.' },
        { status: 400 }
      );
    }

    // Delete the member
    await prisma.member.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { error: 'Failed to delete member' },
      { status: 500 }
    );
  }
}