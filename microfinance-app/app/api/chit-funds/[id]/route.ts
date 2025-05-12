import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiCache } from '@/lib/cache';


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
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

        // Get the chit fund with member count
        const chitFund = await prisma.chitFund.findUnique({
            where: { id: chitFundId },
            include: {
                _count: {
                    select: { members: true },
                },
            },
        });

        if (!chitFund) {
            return NextResponse.json({ error: 'Chit fund not found' }, { status: 404 });
        }

        // Add the members count to the response
        const response = {
            ...chitFund,
            membersCount: chitFund._count.members,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error retrieving chit fund:', error);
        return NextResponse.json({ error: 'Error retrieving chit fund' }, { status: 500 });
    }
}

export async function PUT(
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

    const data = await request.json();

        const updatedChitFund = await prisma.chitFund.update({
            where: { id: chitFundId },
            data,
        });

        return NextResponse.json(updatedChitFund);
    } catch (error) {
        console.error('Error updating chit fund:', error);
        return NextResponse.json({ error: 'Error updating chit fund' }, { status: 500 });
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

        // Check if the chit fund has members
        const membersCount = await prisma.member.count({
            where: { chitFundId: chitFundId },
        });

        if (membersCount > 0) {
            return NextResponse.json(
                { error: 'Cannot delete chit fund with members. Remove members first.' },
                { status: 400 }
            );
        }

        // Check if the chit fund has auctions
        const auctionsCount = await prisma.auction.count({
            where: { chitFundId: chitFundId },
        });

        if (auctionsCount > 0) {
            return NextResponse.json(
                { error: 'Cannot delete chit fund with auctions. Remove auctions first.' },
                { status: 400 }
            );
        }

        await prisma.chitFund.delete({
            where: { id: chitFundId },
        });

        return NextResponse.json({ message: 'Chit fund deleted successfully' });
    } catch (error) {
        console.error('Error deleting chit fund:', error);
        return NextResponse.json({ error: 'Error deleting chit fund' }, { status: 500 });
    }
}