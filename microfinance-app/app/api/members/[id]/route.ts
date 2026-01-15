import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';

// GET /api/members/:id - Get single member with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const memberId = parseInt(id);
    if (isNaN(memberId)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    const member = await prisma.globalMember.findUnique({
      where: { id: memberId },
      include: {
        _count: {
          select: {
            chitFundMembers: true,
            loans: true
          }
        },
        chitFundMembers: {
          include: {
            chitFund: {
              select: {
                id: true,
                name: true,
                status: true,
                totalAmount: true,
                monthlyContribution: true
              }
            }
          }
        },
        loans: {
          select: {
            id: true,
            amount: true,
            interestRate: true,
            remainingAmount: true,
            status: true,
            disbursementDate: true,
            loanType: true
          },
          orderBy: {
            disbursementDate: 'desc'
          }
        }
      }
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Check ownership
    if (member.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

// PUT /api/members/:id - Update member
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const memberId = parseInt(id);
    if (isNaN(memberId)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    // Check if member exists and belongs to user
    const existingMember = await prisma.globalMember.findUnique({
      where: { id: memberId },
      select: { createdById: true }
    });

    if (!existingMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (existingMember.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, contact, email, address, notes } = body;

    // Validation
    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }

    if (contact !== undefined && (!contact || !contact.trim())) {
      return NextResponse.json({ error: 'Contact cannot be empty' }, { status: 400 });
    }

    // Validate phone number format if contact is being updated
    if (contact !== undefined) {
      const phoneRegex = /^[0-9+\s-]{10,15}$/;
      if (!phoneRegex.test(contact.trim())) {
        return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 });
      }
    }

    // Validate email format if provided
    if (email !== undefined && email && email.trim()) {
      const emailRegex = /\S+@\S+\.\S+/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (contact !== undefined) updateData.contact = contact.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    const updatedMember = await prisma.globalMember.update({
      where: { id: memberId },
      data: updateData,
      include: {
        _count: {
          select: {
            chitFundMembers: true,
            loans: true
          }
        }
      }
    });

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

// DELETE /api/members/:id - Delete member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const memberId = parseInt(id);
    if (isNaN(memberId)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    // Check if member exists and belongs to user
    const memberWithRelations = await prisma.globalMember.findUnique({
      where: { id: memberId },
      include: {
        chitFundMembers: {
          include: {
            chitFund: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        },
        loans: {
          select: {
            id: true,
            status: true,
            loanType: true
          }
        }
      }
    });

    if (!memberWithRelations) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (memberWithRelations.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check for dependencies - Note: relations are loans and chitFundMembers from schema
    const chitFunds = (memberWithRelations as any).chitFundMembers || [];
    const loans = (memberWithRelations as any).loans || [];
    
    if (chitFunds.length > 0) {
      const chitFundNames = chitFunds
        .map((m: any) => m.chitFund.name)
        .join(', ');
      return NextResponse.json({
        error: `Cannot delete member. Member is part of active chit funds: ${chitFundNames}. Please remove the member from these chit funds first.`
      }, { status: 400 });
    }

    if (loans.length > 0) {
      const activeLoanCount = loans.filter((l: any) => l.status === 'Active').length;
      if (activeLoanCount > 0) {
        return NextResponse.json({
          error: `Cannot delete member. Member has ${activeLoanCount} active loan(s). Please close these loans first.`
        }, { status: 400 });
      }
      return NextResponse.json({
        error: `Cannot delete member. Member has ${loans.length} associated loan(s).`
      }, { status: 400 });
    }

    // Delete the member
    await prisma.globalMember.delete({
      where: { id: memberId }
    });

    return NextResponse.json({
      success: true,
      message: 'Member deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { error: 'Failed to delete member' },
      { status: 500 }
    );
  }
}
