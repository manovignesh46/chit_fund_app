import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';

// GET /api/chit-funds/[id] - Get details
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
    const chitFund = await prisma.chitFund.findUnique({
      where: { id },
      include: {
        feeStructure: {
          include: { months: { orderBy: { month: 'asc' } } }
        },
        members: {
            include: { globalMember: true }
        },
        auctions: true,
        _count: { select: { members: true, contributions: true } },
      },
    });

    if (!chitFund) {
      return NextResponse.json({ error: 'Chit Fund not found' }, { status: 404 });
    }
    
    // Check ownership
    if(chitFund.createdById !== currentUserId) {
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

// PUT /api/chit-funds/[id] - Update
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

    const existing = await prisma.chitFund.findUnique({ where: { id } });
    if (!existing || existing.createdById !== currentUserId) {
        return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
    }

    const updated = await prisma.chitFund.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.status && { status: body.status }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.feeStructureId && { feeStructureId: parseInt(body.feeStructureId) }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating chit fund:', error);
    return NextResponse.json(
      { error: 'Failed to update chit fund' },
      { status: 500 }
    );
  }
}

// DELETE /api/chit-funds/[id]
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
    
    const existing = await prisma.chitFund.findUnique({ where: { id } });
    if (!existing || existing.createdById !== currentUserId) {
        return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
    }

    // Optional: check for dependent data constraints if strict
    
    await prisma.chitFund.delete({ where: { id } });

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting chit fund:', error);
    return NextResponse.json(
      { error: 'Failed to delete chit fund' },
      { status: 500 }
    );
  }
}
