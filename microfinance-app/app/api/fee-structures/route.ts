import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';

// GET /api/fee-structures - List all fee structures
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const feeStructures = await prisma.feeStructure.findMany({
      where: { createdById: currentUserId },
      include: {
        months: {
          orderBy: { month: 'asc' },
        },
        _count: {
          select: { chitFunds: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ feeStructures });
  } catch (error) {
    console.error('Error fetching fee structures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fee structures' },
      { status: 500 }
    );
  }
}

// POST /api/fee-structures - Create new fee structure
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, duration, months } = body;

    // Validate required fields
    if (!name || !duration || !months || !Array.isArray(months)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const feeStructure = await prisma.feeStructure.create({
      data: {
        name,
        description,
        duration: parseInt(duration),
        createdById: currentUserId,
        months: {
          create: months.map((m: any) => ({
            month: parseInt(m.month),
            amount: parseFloat(m.amount),
          })),
        },
      },
      include: {
        months: {
          orderBy: { month: 'asc' },
        },
      },
    });

    return NextResponse.json(feeStructure, { status: 201 });
  } catch (error) {
    console.error('Error creating fee structure:', error);
    return NextResponse.json(
      { error: 'Failed to create fee structure' },
      { status: 500 }
    );
  }
}
