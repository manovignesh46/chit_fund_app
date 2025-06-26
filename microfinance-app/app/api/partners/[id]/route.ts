import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partner = await prisma.partner.findFirst({
      where: {
        id: parseInt(params.id),
        createdById: userId,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    return NextResponse.json({ partner });
  } catch (error: any) {
    console.error('Error fetching partner:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { name, isActive } = data;

    const partner = await prisma.partner.updateMany({
      where: {
        id: parseInt(params.id),
        createdById: userId,
      },
      data: {
        ...(name && { name }),
        ...(typeof isActive === 'boolean' && { isActive }),
      },
    });

    if (!partner.count) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const updatedPartner = await prisma.partner.findFirst({
      where: {
        id: parseInt(params.id),
        createdById: userId,
      },
    });

    return NextResponse.json({ partner: updatedPartner });
  } catch (error: any) {
    console.error('Error updating partner:', error);
    return NextResponse.json(
      { error: 'Failed to update partner' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = parseInt(params.id);

    // Check if partner exists and belongs to the user
    const partner = await prisma.partner.findFirst({
      where: {
        id: partnerId,
        createdById: userId,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Check if partner has any associated transactions
    const transactionCount = await prisma.transaction.count({
      where: {
        OR: [
          { from_partner: partner.name },
          { to_partner: partner.name },
        ],
        createdById: userId,
      },
    });

    if (transactionCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete partner with existing transactions. Please remove all transactions first.' },
        { status: 400 }
      );
    }

    // Delete the partner
    await prisma.partner.delete({
      where: { id: partnerId },
    });

    return NextResponse.json({ message: 'Partner deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting partner:', error);
    return NextResponse.json(
      { error: 'Failed to delete partner' },
      { status: 500 }
    );
  }
}
