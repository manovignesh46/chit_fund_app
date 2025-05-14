import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';

// GET: Fetch a specific chit fund by ID
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
    const id = await params.id;
    const chitFundId = parseInt(id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    // Fetch the chit fund with the given ID
    const chitFund = await prisma.chitFund.findFirst({
      where: {
        id: chitFundId,
        createdById: currentUserId, // Ensure the user owns this chit fund
      },
    });

    if (!chitFund) {
      return NextResponse.json(
        { error: 'Chit fund not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(chitFund);
  } catch (error) {
    console.error('Error fetching chit fund:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chit fund details' },
      { status: 500 }
    );
  }
}

// PUT: Update a chit fund
export async function PUT(
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
    const id = await params.id;
    const chitFundId = parseInt(id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    // Parse the request body
    const data = await request.json();

    // Verify the chit fund exists and belongs to the current user
    const existingChitFund = await prisma.chitFund.findFirst({
      where: {
        id: chitFundId,
        createdById: currentUserId,
      },
    });

    if (!existingChitFund) {
      return NextResponse.json(
        { error: 'Chit fund not found' },
        { status: 404 }
      );
    }

    // Update the chit fund
    const updatedChitFund = await prisma.chitFund.update({
      where: {
        id: chitFundId,
      },
      data,
    });

    return NextResponse.json(updatedChitFund);
  } catch (error) {
    console.error('Error updating chit fund:', error);
    return NextResponse.json(
      { error: 'Failed to update chit fund' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a chit fund
export async function DELETE(
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
    const id = await params.id;
    const chitFundId = parseInt(id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    // Verify the chit fund exists and belongs to the current user
    const existingChitFund = await prisma.chitFund.findFirst({
      where: {
        id: chitFundId,
        createdById: currentUserId,
      },
    });

    if (!existingChitFund) {
      return NextResponse.json(
        { error: 'Chit fund not found' },
        { status: 404 }
      );
    }

    // Delete related records first (to avoid foreign key constraints)
    // Delete contributions
    await prisma.contribution.deleteMany({
      where: {
        chitFundId,
      },
    });

    // Delete auctions
    await prisma.auction.deleteMany({
      where: {
        chitFundId,
      },
    });

    // Delete members
    await prisma.member.deleteMany({
      where: {
        chitFundId,
      },
    });

    // Finally, delete the chit fund
    await prisma.chitFund.delete({
      where: {
        id: chitFundId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chit fund:', error);
    return NextResponse.json(
      { error: 'Failed to delete chit fund' },
      { status: 500 }
    );
  }
}
