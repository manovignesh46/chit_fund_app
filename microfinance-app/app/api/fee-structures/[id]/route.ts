import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';

// GET /api/fee-structures/[id] - Get fee structure details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    const feeStructure = await prisma.feeStructure.findUnique({
      where: { id },
      include: {
        months: {
          orderBy: { month: 'asc' },
        },
        chitFunds: true,
      },
    });

    if (!feeStructure) {
      return NextResponse.json({ error: 'Fee structure not found' }, { status: 404 });
    }

    if (feeStructure.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(feeStructure);
  } catch (error) {
    console.error('Error fetching fee structure:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fee structure' },
      { status: 500 }
    );
  }
}

// PUT /api/fee-structures/[id] - Update fee structure
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    const body = await request.json();

    // Check if fee structure exists and belongs to user
    const existing = await prisma.feeStructure.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Fee structure not found' }, { status: 404 });
    }

    if (existing.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.feeStructure.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
      },
      include: {
        months: {
          orderBy: { month: 'asc' },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating fee structure:', error);
    return NextResponse.json(
      { error: 'Failed to update fee structure' },
      { status: 500 }
    );
  }
}

// DELETE /api/fee-structures/[id] - Delete fee structure
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);

    // Check if fee structure exists and belongs to user
    const existing = await prisma.feeStructure.findUnique({
      where: { id },
      select: { createdById: true, _count: { select: { chitFunds: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Fee structure not found' }, { status: 404 });
    }

    if (existing.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if fee structure is being used
    if (existing._count.chitFunds > 0) {
      return NextResponse.json(
        { error: 'Cannot delete fee structure that is being used by chit funds' },
        { status: 400 }
      );
    }

    await prisma.feeStructure.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Fee structure deleted successfully' });
  } catch (error) {
    console.error('Error deleting fee structure:', error);
    return NextResponse.json(
      { error: 'Failed to delete fee structure' },
      { status: 500 }
    );
  }
}
