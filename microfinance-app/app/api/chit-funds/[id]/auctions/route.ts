import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { apiCache } from '@/lib/cache';


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const chitFundId = parseInt(id);

    if (isNaN(chitFundId)) {
      return NextResponse.json({ error: 'Invalid chit fund ID' }, { status: 400 });
    }

    const chitFund = await prisma.chitFund.findUnique({
      where: { id: chitFundId },
    });

    if (!chitFund) {
      return NextResponse.json({ error: 'Chit fund not found' }, { status: 404 });
    }

    const auctions = await prisma.auction.findMany({
      where: { chitFundId },
      include: {
        winner: {
          select: {
            id: true,
            globalMember: {
              select: {
                name: true,
                contact: true,
              }
            }
          },
        },
      },
      orderBy: { month: 'asc' },
    });

    return NextResponse.json(auctions);
  } catch (error) {
    console.error('Error fetching auctions:', error);
    return NextResponse.json({ error: 'Failed to fetch auctions' }, { status: 500 });
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

    // Validate required fields
    const requiredFields = ['winnerId', 'month', 'amount', 'date'];
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

    // Check if the winner exists and belongs to this chit fund
    const winner = await prisma.member.findFirst({
      where: {
        id: body.winnerId,
        chitFundId: chitFundId,
      },
    });

    if (!winner) {
      return NextResponse.json(
        { error: 'Winner not found or does not belong to this chit fund' },
        { status: 404 }
      );
    }

    // Check if the month is valid
    if (body.month < 1 || body.month > chitFund.duration) {
      return NextResponse.json(
        { error: `Month must be between 1 and ${chitFund.duration}` },
        { status: 400 }
      );
    }

    // Check if an auction for this month already exists
    const existingAuction = await prisma.auction.findFirst({
      where: {
        chitFundId: chitFundId,
        month: body.month,
      },
    });

    if (existingAuction) {
      return NextResponse.json(
        { error: 'An auction for this month already exists' },
        { status: 400 }
      );
    }

    // Check if the winner has already won an auction in this chit fund
    const winnerAuction = await prisma.auction.findFirst({
      where: {
        chitFundId: chitFundId,
        winnerId: body.winnerId,
      },
    });

    if (winnerAuction) {
      return NextResponse.json(
        { error: 'This member has already won an auction in this chit fund' },
        { status: 400 }
      );
    }

    // Create the auction
    const auction = await prisma.auction.create({
      data: {
        chitFundId: chitFundId,
        winnerId: body.winnerId,
        month: body.month,
        amount: body.amount,
        date: new Date(body.date),
        lowestBid: body.lowestBid,
        highestBid: body.highestBid,
        numberOfBidders: body.numberOfBidders,
        notes: body.notes,
      },
      include: {
        winner: {
          select: {
            id: true,
            globalMember: {
              select: {
                name: true,
                contact: true,
              }
            }
          },
        },
      },
    });

    // Update the chit fund's next auction date
    const nextMonth = body.month + 1;
    if (nextMonth <= chitFund.duration) {
      // Calculate next auction date (typically one month from the current auction)
      const nextAuctionDate = new Date(body.date);
      nextAuctionDate.setMonth(nextAuctionDate.getMonth() + 1);

      await prisma.chitFund.update({
        where: { id: chitFundId },
        data: {
          currentMonth: body.month,
          nextAuctionDate: nextAuctionDate,
        },
      });
    } else {
      // If this was the last auction, mark the chit fund as completed
      await prisma.chitFund.update({
        where: { id: chitFundId },
        data: {
          currentMonth: body.month,
          status: 'Completed',
          nextAuctionDate: null,
        },
      });
    }

    return NextResponse.json(auction, { status: 201 });
  } catch (error) {
    console.error('Error creating auction:', error);
    return NextResponse.json(
      { error: 'Failed to create auction' },
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

    const { auctionId } = await request.json();

    if (!auctionId) {
      return NextResponse.json(
        { error: 'Auction ID is required' },
        { status: 400 }
      );
    }

    // Check if the auction exists and belongs to this chit fund
    const auction = await prisma.auction.findFirst({
      where: {
        id: auctionId,
        chitFundId: chitFundId,
      },
    });

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found or does not belong to this chit fund' },
        { status: 404 }
      );
    }

    // Delete the auction
    await prisma.auction.delete({
      where: { id: auctionId },
    });

    // Update the chit fund's current month and status if needed
    const latestAuction = await prisma.auction.findFirst({
      where: { chitFundId: chitFundId },
      orderBy: { month: 'desc' },
    });

    if (latestAuction) {
      await prisma.chitFund.update({
        where: { id: chitFundId },
        data: {
          currentMonth: latestAuction.month,
          status: 'Active',
        },
      });
    } else {
      // If no auctions left, reset to month 1
      await prisma.chitFund.update({
        where: { id: chitFundId },
        data: {
          currentMonth: 1,
          status: 'Active',
        },
      });
    }

    return NextResponse.json({ message: 'Auction deleted successfully' });
  } catch (error) {
    console.error('Error deleting auction:', error);
    return NextResponse.json(
      { error: 'Failed to delete auction' },
      { status: 500 }
    );
  }
}
