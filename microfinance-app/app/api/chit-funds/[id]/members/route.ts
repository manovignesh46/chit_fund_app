import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chitFundId = parseInt(id);

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
        globalMember: true,
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
        globalMemberId: member.globalMemberId,
        globalMember: member.globalMember,
        name: member.globalMember.name,
        contact: member.globalMember.contact,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chitFundId = parseInt(id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Check if we're using a global member or creating a new one
    if (body.globalMemberId) {
      // Using existing global member

      // Check if the global member exists
      const globalMember = await prisma.globalMember.findUnique({
        where: { id: body.globalMemberId },
      });

      if (!globalMember) {
        return NextResponse.json(
          { error: 'Global member not found' },
          { status: 404 }
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

      // Check if the member is already in this chit fund
      const existingMembership = await prisma.member.findFirst({
        where: {
          globalMemberId: body.globalMemberId,
          chitFundId: chitFundId,
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: 'This member is already part of this chit fund' },
          { status: 400 }
        );
      }

      // Create the member
      const member = await prisma.member.create({
        data: {
          globalMemberId: body.globalMemberId,
          chitFundId: chitFundId,
          joinDate: new Date(),
          contribution: body.contribution || chitFund.monthlyContribution,
        },
        include: {
          globalMember: true,
        },
      });

      return NextResponse.json(member, { status: 201 });
    } else {
      // Creating a new member from scratch

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

      // First create a global member
      const globalMember = await prisma.globalMember.create({
        data: {
          name: body.name,
          contact: body.contact,
          email: body.email || null,
          address: body.address || null,
          notes: body.notes || null,
        },
      });

      // Then create the chit fund member
      const member = await prisma.member.create({
        data: {
          globalMemberId: globalMember.id,
          chitFundId: chitFundId,
          joinDate: new Date(),
          contribution: body.contribution || chitFund.monthlyContribution,
        },
        include: {
          globalMember: true,
        },
      });

      return NextResponse.json(member, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating member:', error);
    return NextResponse.json(
      { error: 'Failed to create member' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chitFundId = parseInt(id);

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

    // Delete related contributions first
    await prisma.contribution.deleteMany({
      where: { memberId: memberId },
    });

    // Find auctions where this member is the winner
    const auctions = await prisma.auction.findMany({
      where: { winnerId: memberId },
    });

    // If there are auctions, handle them individually
    if (auctions.length > 0) {
      // We need to delete the auctions since we can't set winnerId to null
      // (Prisma schema requires winnerId to be non-null)
      await prisma.auction.deleteMany({
        where: { winnerId: memberId },
      });
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