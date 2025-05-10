import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const chitFundId = parseInt(params.id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    // Check if the chit fund exists
    const chitFund = await prisma.chitFund.findUnique({
      where: { id: chitFundId },
    });

    if (!chitFund) {
      return NextResponse.json(
        { error: 'Chit fund not found' },
        { status: 404 }
      );
    }

    // Get all contributions for this chit fund with member details
    const contributions = await prisma.contribution.findMany({
      where: {
        member: {
          chitFundId: chitFundId,
        },
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            contact: true,
            contribution: true,
          },
        },
      },
      orderBy: [
        { month: 'asc' },
        { paidDate: 'desc' },
      ],
    });

    return NextResponse.json(contributions);
  } catch (error) {
    console.error('Error fetching contributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const chitFundId = parseInt(params.id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['memberId', 'month', 'amount', 'paidDate'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Check if the chit fund exists
    const chitFund = await prisma.chitFund.findUnique({
      where: { id: chitFundId },
    });

    if (!chitFund) {
      return NextResponse.json(
        { error: 'Chit fund not found' },
        { status: 404 }
      );
    }

    // Check if the member exists and belongs to this chit fund
    const member = await prisma.member.findFirst({
      where: {
        id: body.memberId,
        chitFundId: chitFundId,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found or does not belong to this chit fund' },
        { status: 404 }
      );
    }

    // Check if the month is valid
    if (body.month < 1 || body.month > chitFund.duration) {
      return NextResponse.json(
        { error: `Month must be between 1 and ${chitFund.duration}` },
        { status: 400 }
      );
    }

    // Check if a contribution for this member and month already exists
    const existingContribution = await prisma.contribution.findFirst({
      where: {
        memberId: body.memberId,
        month: body.month,
      },
    });

    if (existingContribution) {
      return NextResponse.json(
        { error: 'A contribution for this member and month already exists' },
        { status: 400 }
      );
    }

    // Create the contribution
    const contribution = await prisma.contribution.create({
      data: {
        memberId: body.memberId,
        month: body.month,
        amount: body.amount,
        paidDate: new Date(body.paidDate),
        chitFundId: chitFundId, // Add the chitFundId
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            contact: true,
            contribution: true,
          },
        },
      },
    });

    // Update the chit fund's current month if needed
    if (body.month > chitFund.currentMonth) {
      await prisma.chitFund.update({
        where: { id: chitFundId },
        data: { currentMonth: body.month },
      });
    }

    return NextResponse.json(contribution, { status: 201 });
  } catch (error) {
    console.error('Error creating contribution:', error);
    return NextResponse.json(
      { error: 'Failed to create contribution' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const chitFundId = parseInt(params.id);

    if (isNaN(chitFundId)) {
      return NextResponse.json(
        { error: 'Invalid chit fund ID' },
        { status: 400 }
      );
    }

    const { contributionId } = await request.json();

    if (!contributionId) {
      return NextResponse.json(
        { error: 'Contribution ID is required' },
        { status: 400 }
      );
    }

    // Check if the contribution exists and belongs to a member of this chit fund
    const contribution = await prisma.contribution.findFirst({
      where: {
        id: contributionId,
        member: {
          chitFundId: chitFundId,
        },
      },
    });

    if (!contribution) {
      return NextResponse.json(
        { error: 'Contribution not found or does not belong to this chit fund' },
        { status: 404 }
      );
    }

    // Delete the contribution
    await prisma.contribution.delete({
      where: { id: contributionId },
    });

    return NextResponse.json({ message: 'Contribution deleted successfully' });
  } catch (error) {
    console.error('Error deleting contribution:', error);
    return NextResponse.json(
      { error: 'Failed to delete contribution' },
      { status: 500 }
    );
  }
}
