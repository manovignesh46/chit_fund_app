import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partner = await prisma.partner.findFirst({
      where: {
        id: parseInt(params.id),
        createdById: session.user.id,
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
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { name, isActive } = data;

    const partner = await prisma.partner.updateMany({
      where: {
        id: parseInt(params.id),
        createdById: session.user.id,
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
        createdById: session.user.id,
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
