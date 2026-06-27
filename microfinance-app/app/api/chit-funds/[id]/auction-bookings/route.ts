import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getCurrentUserId } from '../../../../../lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

async function getAuthorizedChitFund(chitFundId: number, userId: number) {
  return prisma.chitFund.findFirst({
    where: { id: chitFundId, createdById: userId },
    include: {
      members: { include: { globalMember: true } },
      auctions: {
        include: {
          winner: { include: { globalMember: true } },
        },
        orderBy: [{ month: 'asc' }, { id: 'asc' }],
      },
      auctionBookings: {
        include: {
          member: { include: { globalMember: true } },
        },
        orderBy: [{ month: 'asc' }, { id: 'asc' }],
      },
    },
  });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const chitFundId = parseInt(id, 10);
    if (isNaN(chitFundId)) {
      return NextResponse.json({ error: 'Invalid chit fund ID' }, { status: 400 });
    }

    const chitFund = await getAuthorizedChitFund(chitFundId, currentUserId);
    if (!chitFund) {
      return NextResponse.json({ error: 'Chit fund not found' }, { status: 404 });
    }

    const bookings = chitFund.auctionBookings.map((b) => ({
      id: b.id,
      month: b.month,
      memberId: b.memberId,
      memberName: b.member.globalMember.name,
      isPlanned: true,
    }));

    const completedAuctions = chitFund.auctions.map((a) => ({
      id: a.id,
      month: a.month,
      memberId: a.winnerId,
      memberName: a.winner.globalMember.name,
      amount: a.amount,
      date: a.date,
      isPlanned: false,
    }));

    const members = chitFund.members.map((m) => ({
      id: m.id,
      name: m.globalMember.name,
      contribution: m.contribution,
    }));

    return NextResponse.json({
      chitFund: {
        id: chitFund.id,
        name: chitFund.name,
        duration: chitFund.duration,
        currentMonth: chitFund.currentMonth,
        status: chitFund.status,
        startDate: chitFund.startDate,
      },
      bookings,
      completedAuctions,
      members,
    });
  } catch (error) {
    console.error('Error fetching auction bookings:', error);
    return NextResponse.json({ error: 'Failed to fetch auction bookings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const chitFundId = parseInt(id, 10);
    if (isNaN(chitFundId)) {
      return NextResponse.json({ error: 'Invalid chit fund ID' }, { status: 400 });
    }

    const body = await request.json();
    const month = parseInt(body.month, 10);
    const memberId = parseInt(body.memberId, 10);

    if (isNaN(month) || isNaN(memberId)) {
      return NextResponse.json({ error: 'Month and memberId are required' }, { status: 400 });
    }

    const chitFund = await prisma.chitFund.findFirst({
      where: { id: chitFundId, createdById: currentUserId },
      include: { members: true, auctionBookings: true, auctions: true },
    });

    if (!chitFund) {
      return NextResponse.json({ error: 'Chit fund not found' }, { status: 404 });
    }

    if (month < 1 || month > chitFund.duration) {
      return NextResponse.json(
        { error: `Month must be between 1 and ${chitFund.duration}` },
        { status: 400 }
      );
    }

    const member = chitFund.members.find((m) => m.id === memberId);
    if (!member) {
      return NextResponse.json({ error: 'Member does not belong to this chit fund' }, { status: 400 });
    }

    const existingBooking = chitFund.auctionBookings.find((b) => b.memberId === memberId);
    if (existingBooking) {
      return NextResponse.json(
        {
          error: `Member is already booked for month ${existingBooking.month}. Remove that booking first or move them.`,
        },
        { status: 409 }
      );
    }

    const existingAuction = chitFund.auctions.find((a) => a.winnerId === memberId);
    if (existingAuction) {
      return NextResponse.json(
        {
          error: `Member already won an auction in month ${existingAuction.month} and cannot be booked again.`,
        },
        { status: 409 }
      );
    }

    const booking = await prisma.auctionBooking.create({
      data: { chitFundId, month, memberId },
      include: {
        member: { include: { globalMember: true } },
      },
    });

    return NextResponse.json({
      id: booking.id,
      month: booking.month,
      memberId: booking.memberId,
      memberName: booking.member.globalMember.name,
    });
  } catch (error) {
    console.error('Error creating auction booking:', error);
    return NextResponse.json({ error: 'Failed to create auction booking' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const chitFundId = parseInt(id, 10);
    if (isNaN(chitFundId)) {
      return NextResponse.json({ error: 'Invalid chit fund ID' }, { status: 400 });
    }

    const body = await request.json();
    const bookingId = body.bookingId ? parseInt(body.bookingId, 10) : null;

    if (!bookingId || isNaN(bookingId)) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const booking = await prisma.auctionBooking.findFirst({
      where: { id: bookingId, chitFundId },
      include: { chitFund: { select: { createdById: true } } },
    });

    if (!booking || booking.chitFund.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    await prisma.auctionBooking.delete({ where: { id: bookingId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting auction booking:', error);
    return NextResponse.json({ error: 'Failed to delete auction booking' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const chitFundId = parseInt(id, 10);
    if (isNaN(chitFundId)) {
      return NextResponse.json({ error: 'Invalid chit fund ID' }, { status: 400 });
    }

    const body = await request.json();
    const bookingId = parseInt(body.bookingId, 10);
    const month = parseInt(body.month, 10);

    if (isNaN(bookingId) || isNaN(month)) {
      return NextResponse.json({ error: 'bookingId and month are required' }, { status: 400 });
    }

    const chitFund = await prisma.chitFund.findFirst({
      where: { id: chitFundId, createdById: currentUserId },
    });

    if (!chitFund) {
      return NextResponse.json({ error: 'Chit fund not found' }, { status: 404 });
    }

    if (month < 1 || month > chitFund.duration) {
      return NextResponse.json(
        { error: `Month must be between 1 and ${chitFund.duration}` },
        { status: 400 }
      );
    }

    const booking = await prisma.auctionBooking.findFirst({
      where: { id: bookingId, chitFundId },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const updated = await prisma.auctionBooking.update({
      where: { id: bookingId },
      data: { month },
      include: {
        member: { include: { globalMember: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      month: updated.month,
      memberId: updated.memberId,
      memberName: updated.member.globalMember.name,
    });
  } catch (error) {
    console.error('Error updating auction booking:', error);
    return NextResponse.json({ error: 'Failed to update auction booking' }, { status: 500 });
  }
}
