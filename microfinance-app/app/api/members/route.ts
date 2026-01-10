import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';

// GET /api/members - List global members (borrowers)
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search');

    const skip = (page - 1) * pageSize;
    const where: any = {
      // createdById: currentUserId, // Global members usually shared? Or filtered by creator?
      // Assuming for now they filter by creator or are visible to all admins.
      // Schema likely has createdById.
      createdById: currentUserId 
    };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { contact: { contains: search, mode: 'insensitive' } }
        ];
    }

    const [members, totalCount] = await Promise.all([
      prisma.globalMember.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.globalMember.count({ where }),
    ]);

    return NextResponse.json({
      members,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

// POST /api/members - Create new global member
export async function POST(request: NextRequest) {
    try {
        const currentUserId = await getCurrentUserId(request);
        if (!currentUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { name, contact, email, address, notes } = body;

        if (!name || !contact) {
            return NextResponse.json({ error: 'Name and Contact are required' }, { status: 400 });
        }

        const newMember = await prisma.globalMember.create({
            data: {
                name,
                contact,
                email,
                address,
                notes,
                createdById: currentUserId
            }
        });

        return NextResponse.json(newMember, { status: 201 });
    } catch (error) {
        console.error('Error creating member:', error);
        return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
    }
}
