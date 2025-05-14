import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';

// GET: Fetch all auctions of a chit fund
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
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
    const id = context.params.id;
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

    // Fetch auctions
    const auctions = await prisma.auction.findMany({
      where: {
        chitFundId,
      },
      include: {
        winner: {
          include: {
            globalMember: true,
          },
        },
      },
      orderBy: {
        month: 'asc',
      },
    });

    return NextResponse.json(auctions);
  } catch (error) {
    console.error('Error fetching chit fund auctions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chit fund auctions' },
      { status: 500 }
    );
  }
}

// POST: Add a new auction to a chit fund
export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
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
    const id = context.params.id;
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

    // Create the new auction
    const newAuction = await prisma.auction.create({
      data: {
        chitFundId,
        month: data.month,
        date: data.date || new Date(),
        winnerId: data.winnerId,
        amount: data.amount,
        lowestBid: data.lowestBid,
        highestBid: data.highestBid,
        numberOfBidders: data.numberOfBidders,
        notes: data.notes,
      },
      include: {
        winner: {
          include: {
            globalMember: true,
          },
        },
      },
    });

    // Update the member to mark that they won an auction
    await prisma.member.update({
      where: {
        id: data.winnerId,
      },
      data: {
        auctionWon: true,
        auctionMonth: data.month,
      },
    });

    // Update the chit fund's current month if needed
    if (data.month > chitFund.currentMonth) {
      await prisma.chitFund.update({
        where: {
          id: chitFundId,
        },
        data: {
          currentMonth: data.month,
        },
      });
    }

    return NextResponse.json(newAuction);
  } catch (error) {
    console.error('Error adding chit fund auction:', error);
    return NextResponse.json(
      { error: 'Failed to add chit fund auction' },
      { status: 500 }
    );
  }
}
