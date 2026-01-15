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
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const skip = (page - 1) * pageSize;
    const where: any = {
      createdById: currentUserId 
    };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { contact: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
        ];
    }

    // Build orderBy based on sortBy parameter
    let orderBy: any = {};
    if (sortBy === '_count.chitFundMembers' || sortBy === '_count.loans') {
      // For count fields, we'll need to handle differently
      orderBy = { name: sortOrder };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const [members, totalCount] = await Promise.all([
      prisma.globalMember.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              chitFundMembers: true,
              loans: true
            }
          }
        }
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
        if (!currentUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, contact, email, address, notes } = body;

        // Validation
        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        if (!contact || !contact.trim()) {
            return NextResponse.json({ error: 'Contact is required' }, { status: 400 });
        }

        // Validate phone number format (10-15 digits, can include +, spaces, -)
        const phoneRegex = /^[0-9+\s-]{10,15}$/;
        if (!phoneRegex.test(contact.trim())) {
            return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 });
        }

        // Validate email format if provided
        if (email && email.trim()) {
            const emailRegex = /\S+@\S+\.\S+/;
            if (!emailRegex.test(email.trim())) {
                return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
            }
        }

        const newMember = await prisma.globalMember.create({
            data: {
                name: name.trim(),
                contact: contact.trim(),
                email: email?.trim() || null,
                address: address?.trim() || null,
                notes: notes?.trim() || null,
                createdById: currentUserId
            },
            include: {
                _count: {
                    select: {
                        chitFundMembers: true,
                        loans: true
                    }
                }
            }
        });

        return NextResponse.json(newMember, { status: 201 });
    } catch (error) {
        console.error('Error creating member:', error);
        return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
    }
}
