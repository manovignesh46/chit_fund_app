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
    const id = params.id;
    const chitFundId = parseInt(id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    // Fetch the chit fund
    const chitFund = await prisma.chitFund.findFirst({
      where: {
        id: chitFundId,
        createdById: currentUserId,
      },
      include: {
        members: {
          include: {
            globalMember: true,
          },
        },
        auctions: {
          include: {
            winner: {
              include: {
                globalMember: true,
              },
            },
          },
        },
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
      { error: 'Failed to fetch chit fund' },
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
    const id = params.id;
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

    // Parse the request body
    const data = await request.json();

    // Update the chit fund
    const updatedChitFund = await prisma.chitFund.update({
      where: {
        id: chitFundId,
      },
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        monthlyContribution: data.monthlyContribution,
        totalAmount: data.totalAmount,
        duration: data.duration,
        currentMonth: data.currentMonth,
        status: data.status,
        notes: data.notes,
      },
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
    const id = params.id;
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

    // Delete the chit fund
    await prisma.chitFund.delete({
      where: {
        id: chitFundId,
      },
    });

    return NextResponse.json({ message: 'Chit fund deleted successfully' });
  } catch (error) {
    console.error('Error deleting chit fund:', error);
    return NextResponse.json(
      { error: 'Failed to delete chit fund' },
      { status: 500 }
    );
  }
}
