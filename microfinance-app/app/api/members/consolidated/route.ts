import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';

// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export const dynamic = 'force-dynamic'; // Ensure the route is not statically optimized

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;

    // Get the current user ID
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case 'list':
        return await getMembersList(request, currentUserId);
      case 'detail':
        if (!id) {
          return NextResponse.json(
            { error: 'Member ID is required' },
            { status: 400 }
          );
        }
        return await getMemberDetail(request, id, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in members API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'create';

    // Get the current user ID
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case 'create':
        return await createMember(request, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in members API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'update';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;

    // Get the current user ID
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case 'update':
        if (!id) {
          return NextResponse.json(
            { error: 'Member ID is required' },
            { status: 400 }
          );
        }
        return await updateMember(request, id, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in members API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'delete';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;

    // Get the current user ID
    const currentUserId = getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Route to the appropriate handler based on the action
    switch (action) {
      case 'delete':
        if (!id) {
          return NextResponse.json(
            { error: 'Member ID is required' },
            { status: 400 }
          );
        }
        return await deleteMember(request, id, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in members API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

// Handler for getting members list
async function getMembersList(request: NextRequest, currentUserId: number) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    // Validate pagination parameters
    const validPage = page > 0 ? page : 1;
    const validPageSize = pageSize > 0 ? pageSize : 10;

    // Calculate skip value for pagination
    const skip = (validPage - 1) * validPageSize;

    // Filter by the current user
    const where = {
      createdById: currentUserId
    };

    // Get total count for pagination
    const totalCount = await prisma.globalMember.count({
      where
    });

    // Get paginated global members
    const members = await prisma.globalMember.findMany({
      where,
      include: {
        _count: {
          select: {
            chitFundMembers: true,
            loans: true
          }
        }
      },
      orderBy: { name: 'asc' },
      skip,
      take: validPageSize,
    });

    return NextResponse.json({
      members,
      totalCount,
      page: validPage,
      pageSize: validPageSize,
      totalPages: Math.ceil(totalCount / validPageSize)
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

// Handler for getting a single member
async function getMemberDetail(request: NextRequest, id: number, currentUserId: number) {
  try {
    // Check if the member exists and belongs to the current user
    const member = await prisma.globalMember.findUnique({
      where: { id },
      include: {
        chitFundMembers: {
          include: {
            chitFund: {
              select: {
                id: true,
                name: true,
                status: true,
                currentMonth: true,
                duration: true,
              },
            },
          },
        },
        loans: {
          select: {
            id: true,
            loanType: true,
            amount: true,
            status: true,
            disbursementDate: true,
            remainingAmount: true,
          },
        },
        _count: {
          select: {
            chitFundMembers: true,
            loans: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Check if the current user is the owner
    if (member.createdById !== currentUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to view this member' },
        { status: 403 }
      );
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error('Error fetching member:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member' },
      { status: 500 }
    );
  }
}

// Handler for creating a member
async function createMember(request: NextRequest, currentUserId: number) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'contact'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Create the global member
    const member = await prisma.globalMember.create({
      data: {
        name: body.name,
        contact: body.contact,
        email: body.email || null,
        address: body.address || null,
        notes: body.notes || null,
        createdById: currentUserId,
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Error creating member:', error);
    return NextResponse.json(
      { error: 'Failed to create member' },
      { status: 500 }
    );
  }
}

// Handler for updating a member
async function updateMember(request: NextRequest, id: number, currentUserId: number) {
  try {
    const body = await request.json();

    // Check if the member exists and belongs to the current user
    const existingMember = await prisma.globalMember.findUnique({
      where: { id },
      select: { createdById: true }
    });

    if (!existingMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Check if the current user is the owner
    if (existingMember.createdById !== currentUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to update this member' },
        { status: 403 }
      );
    }

    // Validate required fields
    const requiredFields = ['name', 'contact'];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === '') {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Update the global member
    const member = await prisma.globalMember.update({
      where: { id },
      data: {
        name: body.name,
        contact: body.contact,
        email: body.email || null,
        address: body.address || null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

// Handler for deleting a member
async function deleteMember(request: NextRequest, id: number, currentUserId: number) {
  try {
    // Check if the member exists and belongs to the current user
    const existingMember = await prisma.globalMember.findUnique({
      where: { id },
      select: { createdById: true }
    });

    if (!existingMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Check if the current user is the owner
    if (existingMember.createdById !== currentUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this member' },
        { status: 403 }
      );
    }

    // Check if the member is used in any chit funds
    const chitFundMembersCount = await prisma.member.count({
      where: { globalMemberId: id },
    });

    if (chitFundMembersCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete member that is associated with chit funds' },
        { status: 400 }
      );
    }

    // Check if the member is used in any loans
    const loansCount = await prisma.loan.count({
      where: { borrowerId: id },
    });

    if (loansCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete member that is associated with loans' },
        { status: 400 }
      );
    }

    // Delete the global member
    await prisma.globalMember.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { error: 'Failed to delete member' },
      { status: 500 }
    );
  }
}
