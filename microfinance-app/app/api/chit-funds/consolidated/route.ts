import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';

// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;
    const memberId = searchParams.get('memberId') ? parseInt(searchParams.get('memberId')!) : null;

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
        return await getChitFundsList(request, currentUserId);
      case 'detail':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await getChitFundDetail(request, id, currentUserId);
      case 'members':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await getChitFundMembers(request, id, currentUserId);
      case 'member-detail':
        if (!id || !memberId) {
          return NextResponse.json(
            { error: 'Chit fund ID and member ID are required' },
            { status: 400 }
          );
        }
        return await getMemberDetail(request, id, memberId, currentUserId);
      case 'contributions':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await getContributions(request, id, memberId, currentUserId);
      case 'auctions':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await getAuctions(request, id, currentUserId);
      case 'export':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await exportChitFund(request, id, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in chit funds API:', error);
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
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;
    const memberId = searchParams.get('memberId') ? parseInt(searchParams.get('memberId')!) : null;

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
        return await createChitFund(request, currentUserId);
      case 'add-member':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await addMember(request, id, currentUserId);
      case 'add-contribution':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await addContribution(request, id, currentUserId);
      case 'add-auction':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await addAuction(request, id, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in chit funds API:', error);
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
    const memberId = searchParams.get('memberId') ? parseInt(searchParams.get('memberId')!) : null;

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
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await updateChitFund(request, id, currentUserId);
      case 'update-member':
        if (!id || !memberId) {
          return NextResponse.json(
            { error: 'Chit fund ID and member ID are required' },
            { status: 400 }
          );
        }
        return await updateMember(request, id, memberId, currentUserId);
      case 'update-contribution':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await updateContribution(request, id, currentUserId);
      case 'update-auction':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await updateAuction(request, id, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in chit funds API:', error);
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
    const memberId = searchParams.get('memberId') ? parseInt(searchParams.get('memberId')!) : null;

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
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await deleteChitFund(request, id, currentUserId);
      case 'delete-member':
        if (!id || !memberId) {
          return NextResponse.json(
            { error: 'Chit fund ID and member ID are required' },
            { status: 400 }
          );
        }
        return await deleteMember(request, id, memberId, currentUserId);
      case 'delete-contribution':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await deleteContribution(request, id, currentUserId);
      case 'delete-auction':
        if (!id) {
          return NextResponse.json(
            { error: 'Chit fund ID is required' },
            { status: 400 }
          );
        }
        return await deleteAuction(request, id, currentUserId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in chit funds API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

// Handler for getting chit funds list
async function getChitFundsList(request: NextRequest, currentUserId: number) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const status = searchParams.get('status') || null;

  // Validate pagination parameters
  const validPage = page > 0 ? page : 1;
  const validPageSize = pageSize > 0 ? pageSize : 10;

  // Calculate skip value for pagination
  const skip = (validPage - 1) * validPageSize;

  // Build where clause for filtering
  const where: any = {
    // Only show chit funds created by the current user
    createdById: currentUserId
  };

  if (status) {
    where.status = status;
  }

  // Get total count for pagination with filter
  const totalCount = await prisma.chitFund.count({
    where
  });

  // Get paginated chit funds with filter
  const chitFunds = await prisma.chitFund.findMany({
    where,
    include: {
      _count: {
        select: { members: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: validPageSize,
  });

  return NextResponse.json({
    chitFunds,
    totalCount,
    page: validPage,
    pageSize: validPageSize,
    totalPages: Math.ceil(totalCount / validPageSize)
  });
}

// Handler for getting a single chit fund
async function getChitFundDetail(request: NextRequest, id: number, currentUserId: number) {
  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          members: true,
          contributions: true,
          auctions: true
        }
      }
    }
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to view this chit fund' },
      { status: 403 }
    );
  }

  return NextResponse.json(chitFund);
}

// Handler for getting members of a chit fund
async function getChitFundMembers(request: NextRequest, id: number, currentUserId: number) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');

  // Validate pagination parameters
  const validPage = page > 0 ? page : 1;
  const validPageSize = pageSize > 0 ? pageSize : 10;

  // Calculate skip value for pagination
  const skip = (validPage - 1) * validPageSize;

  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to view this chit fund' },
      { status: 403 }
    );
  }

  // Get total count for pagination
  const totalCount = await prisma.member.count({
    where: { chitFundId: id },
  });

  // Get paginated members for this chit fund
  const members = await prisma.member.findMany({
    where: { chitFundId: id },
    include: {
      globalMember: true,
      _count: {
        select: { contributions: true },
      },
      auctions: {
        select: {
          id: true,
          month: true,
        },
        take: 1, // We only need to know if they won any auction
      },
    },
    orderBy: { joinDate: 'asc' },
    skip,
    take: validPageSize,
  });

  // Get all contributions for this chit fund with balance information
  const allContributions = await prisma.contribution.findMany({
    where: { chitFundId: id },
    select: {
      memberId: true,
      month: true,
      balance: true,
    },
  });

  // Transform the data to include auction information and calculate missed contributions
  const transformedMembers = await Promise.all(members.map(async member => {
    const wonAuction = member.auctions && member.auctions.length > 0 ? member.auctions[0] : null;

    // Get contributions for this member
    const memberContributions = allContributions.filter(c => c.memberId === member.id);

    // Calculate missed contributions (only for active chit funds)
    let missedContributions = 0;
    let pendingAmount = 0;

    if (chitFund.status === 'Active') {
      // Current month of the chit fund minus the number of contributions made
      const currentMonth = chitFund.currentMonth;
      const contributionMonths = memberContributions.map(c => c.month);

      // Count how many months from 1 to currentMonth are missing in contributionMonths
      for (let month = 1; month <= currentMonth; month++) {
        if (!contributionMonths.includes(month)) {
          missedContributions++;
        }
      }

      // Calculate pending amount based on missed contributions
      pendingAmount = missedContributions * member.contribution;

      // Add any balance from partial payments
      for (const contribution of memberContributions) {
        if (contribution.balance && contribution.balance > 0) {
          pendingAmount += contribution.balance;
        }
      }
    }

    return {
      id: member.id,
      globalMemberId: member.globalMemberId,
      globalMember: member.globalMember,
      name: member.globalMember.name,
      contact: member.globalMember.contact,
      joinDate: member.joinDate,
      contribution: member.contribution,
      contributionsCount: member._count.contributions,
      auctionWon: wonAuction !== null,
      auctionMonth: wonAuction?.month || null,
      missedContributions: missedContributions,
      pendingAmount: pendingAmount,
    };
  }));

  return NextResponse.json({
    members: transformedMembers,
    totalCount,
    page: validPage,
    pageSize: validPageSize,
    totalPages: Math.ceil(totalCount / validPageSize)
  });
}

// Handler for getting a single member of a chit fund
async function getMemberDetail(request: NextRequest, id: number, memberId: number, currentUserId: number) {
  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to view this chit fund' },
      { status: 403 }
    );
  }

  // Get the member
  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      chitFundId: id,
    },
    include: {
      globalMember: true,
      contributions: {
        orderBy: { month: 'asc' },
      },
      auctions: {
        orderBy: { month: 'asc' },
      },
    },
  });

  if (!member) {
    return NextResponse.json(
      { error: 'Member not found or does not belong to this chit fund' },
      { status: 404 }
    );
  }

  return NextResponse.json(member);
}

// Handler for getting contributions of a chit fund
async function getContributions(request: NextRequest, id: number, memberId: number | null, currentUserId: number) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');

  // Validate pagination parameters
  const validPage = page > 0 ? page : 1;
  const validPageSize = pageSize > 0 ? pageSize : 10;

  // Calculate skip value for pagination
  const skip = (validPage - 1) * validPageSize;

  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to view this chit fund' },
      { status: 403 }
    );
  }

  // Build where clause for filtering
  const where: any = { chitFundId: id };

  // If memberId is provided, filter by member
  if (memberId) {
    where.memberId = memberId;
  }

  // Get total count for pagination
  const totalCount = await prisma.contribution.count({
    where,
  });

  // Get paginated contributions
  const contributions = await prisma.contribution.findMany({
    where,
    include: {
      member: {
        include: {
          globalMember: true,
        },
      },
    },
    orderBy: [
      { month: 'desc' },
      { paidDate: 'desc' },
    ],
    skip,
    take: validPageSize,
  });

  return NextResponse.json({
    contributions,
    totalCount,
    page: validPage,
    pageSize: validPageSize,
    totalPages: Math.ceil(totalCount / validPageSize)
  });
}

// Handler for exporting a chit fund
async function exportChitFund(request: NextRequest, id: number, currentUserId: number) {
  try {
    // Forward the request to the existing export API
    const response = await fetch(`${request.nextUrl.origin}/api/chit-funds/${id}/export`, {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to export chit fund: ${response.status} ${response.statusText}`);
    }

    const data = await response.arrayBuffer();

    // Set response headers for file download
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment; filename=chit_fund.xlsx'
      }
    });
  } catch (error) {
    console.error('Error in exportChitFund:', error);

    // If the error is that the export route doesn't exist, suggest using the direct route
    return NextResponse.json(
      {
        error: 'Failed to export chit fund',
        message: 'Please use the direct export route: /api/chit-funds/[id]/export'
      },
      { status: 500 }
    );
  }
}

// Handler for creating a chit fund
async function createChitFund(request: NextRequest, currentUserId: number) {
  const body = await request.json();

  // Validate required fields
  const requiredFields = ['name', 'totalAmount', 'monthlyContribution', 'duration', 'membersCount', 'startDate'];
  for (const field of requiredFields) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `${field} is required` },
        { status: 400 }
      );
    }
  }

  // Create the chit fund
  const chitFund = await prisma.chitFund.create({
    data: {
      name: body.name,
      totalAmount: parseFloat(body.totalAmount),
      monthlyContribution: parseFloat(body.monthlyContribution),
      duration: parseInt(body.duration),
      membersCount: parseInt(body.membersCount),
      status: body.status || 'Active',
      startDate: new Date(body.startDate),
      nextAuctionDate: body.nextAuctionDate ? new Date(body.nextAuctionDate) : null,
      description: body.description || null,
      // Set the creator
      createdById: currentUserId,
    }
  });

  return NextResponse.json(chitFund, { status: 201 });
}

// Handler for adding a member to a chit fund
async function addMember(request: NextRequest, id: number, currentUserId: number) {
  const body = await request.json();

  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this chit fund' },
      { status: 403 }
    );
  }

  // Check if we're using a global member or creating a new one
  if (body.globalMemberId) {
    // Using existing global member

    // Check if the global member exists
    const globalMember = await prisma.globalMember.findUnique({
      where: { id: body.globalMemberId },
    });

    if (!globalMember) {
      return NextResponse.json(
        { error: 'Global member not found' },
        { status: 404 }
      );
    }

    // Check if the member is already in this chit fund
    const existingMembership = await prisma.member.findFirst({
      where: {
        globalMemberId: body.globalMemberId,
        chitFundId: id,
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: 'This member is already part of this chit fund' },
        { status: 400 }
      );
    }

    // Create the member
    const member = await prisma.member.create({
      data: {
        globalMemberId: body.globalMemberId,
        chitFundId: id,
        joinDate: new Date(),
        contribution: body.contribution || chitFund.monthlyContribution,
      },
      include: {
        globalMember: true,
      },
    });

    return NextResponse.json(member, { status: 201 });
  } else {
    // Creating a new member from scratch

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

    // First create a global member
    const globalMember = await prisma.globalMember.create({
      data: {
        name: body.name,
        contact: body.contact,
        email: body.email || null,
        address: body.address || null,
        notes: body.notes || null,
        createdById: currentUserId
      },
    });

    // Then create the chit fund member
    const member = await prisma.member.create({
      data: {
        globalMemberId: globalMember.id,
        chitFundId: id,
        joinDate: new Date(),
        contribution: body.contribution || chitFund.monthlyContribution,
      },
      include: {
        globalMember: true,
      },
    });

    return NextResponse.json(member, { status: 201 });
  }
}

// Handler for adding a contribution to a chit fund
async function addContribution(request: NextRequest, id: number, currentUserId: number) {
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
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this chit fund' },
      { status: 403 }
    );
  }

  // Check if the member exists
  const member = await prisma.member.findFirst({
    where: {
      id: parseInt(body.memberId),
      chitFundId: id,
    },
  });

  if (!member) {
    return NextResponse.json(
      { error: 'Member not found or does not belong to this chit fund' },
      { status: 404 }
    );
  }

  // Check if a contribution for this month already exists
  const existingContribution = await prisma.contribution.findFirst({
    where: {
      memberId: parseInt(body.memberId),
      chitFundId: id,
      month: parseInt(body.month),
    },
  });

  if (existingContribution) {
    return NextResponse.json(
      { error: 'A contribution for this month already exists' },
      { status: 400 }
    );
  }

  // Calculate balance if the payment is partial
  const expectedAmount = chitFund.monthlyContribution;
  const paidAmount = parseFloat(body.amount);
  const isPartialPayment = paidAmount < expectedAmount;

  // Create the contribution with balance information if it's a partial payment
  const contribution = await prisma.contribution.create({
    data: {
      memberId: parseInt(body.memberId),
      chitFundId: id,
      month: parseInt(body.month),
      amount: paidAmount,
      paidDate: new Date(body.paidDate),
      notes: body.notes || null,
      // Set balance and status for partial payments
      balance: isPartialPayment ? expectedAmount - paidAmount : 0,
      balancePaymentStatus: isPartialPayment ? 'Pending' : null,
      // Set a default balance payment date 30 days from now if it's a partial payment
      balancePaymentDate: isPartialPayment ? new Date(new Date().setDate(new Date().getDate() + 30)) : null,
    },
  });

  return NextResponse.json(contribution, { status: 201 });
}

// Handler for adding an auction to a chit fund
async function addAuction(request: NextRequest, id: number, currentUserId: number) {
  const body = await request.json();

  // Validate required fields
  const requiredFields = ['winnerId', 'month', 'amount', 'date'];
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
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this chit fund' },
      { status: 403 }
    );
  }

  // Check if the winner exists
  const winner = await prisma.member.findFirst({
    where: {
      id: parseInt(body.winnerId),
      chitFundId: id,
    },
  });

  if (!winner) {
    return NextResponse.json(
      { error: 'Winner not found or does not belong to this chit fund' },
      { status: 404 }
    );
  }

  // Check if an auction for this month already exists
  const existingAuction = await prisma.auction.findFirst({
    where: {
      chitFundId: id,
      month: parseInt(body.month),
    },
  });

  if (existingAuction) {
    return NextResponse.json(
      { error: 'An auction for this month already exists' },
      { status: 400 }
    );
  }

  // Create the auction
  const auction = await prisma.auction.create({
    data: {
      chitFundId: id,
      winnerId: parseInt(body.winnerId),
      month: parseInt(body.month),
      amount: parseFloat(body.amount),
      date: new Date(body.date),
      notes: body.notes || null,
    },
    include: {
      winner: {
        include: {
          globalMember: true,
        },
      },
    },
  });

  // Update the chit fund's current month and next auction date
  await prisma.chitFund.update({
    where: { id },
    data: {
      currentMonth: parseInt(body.month),
      nextAuctionDate: body.nextAuctionDate ? new Date(body.nextAuctionDate) : null,
    },
  });

  return NextResponse.json(auction, { status: 201 });
}

// Handler for updating a chit fund
async function updateChitFund(request: NextRequest, id: number, currentUserId: number) {
  const body = await request.json();

  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this chit fund' },
      { status: 403 }
    );
  }

  // Update the chit fund
  const updatedChitFund = await prisma.chitFund.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.totalAmount && { totalAmount: parseFloat(body.totalAmount) }),
      ...(body.monthlyContribution && { monthlyContribution: parseFloat(body.monthlyContribution) }),
      ...(body.duration && { duration: parseInt(body.duration) }),
      ...(body.membersCount && { membersCount: parseInt(body.membersCount) }),
      ...(body.status && { status: body.status }),
      ...(body.startDate && { startDate: new Date(body.startDate) }),
      ...(body.nextAuctionDate && { nextAuctionDate: new Date(body.nextAuctionDate) }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.currentMonth && { currentMonth: parseInt(body.currentMonth) }),
    },
  });

  return NextResponse.json(updatedChitFund);
}

// Handler for updating a member
async function updateMember(request: NextRequest, id: number, memberId: number, currentUserId: number) {
  const body = await request.json();

  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this chit fund' },
      { status: 403 }
    );
  }

  // Check if the member exists
  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      chitFundId: id,
    },
  });

  if (!member) {
    return NextResponse.json(
      { error: 'Member not found or does not belong to this chit fund' },
      { status: 404 }
    );
  }

  // Update the member
  const updatedMember = await prisma.member.update({
    where: { id: memberId },
    data: {
      ...(body.contribution && { contribution: parseFloat(body.contribution) }),
      ...(body.joinDate && { joinDate: new Date(body.joinDate) }),
    },
    include: {
      globalMember: true,
    },
  });

  return NextResponse.json(updatedMember);
}

// Handler for updating a contribution
async function updateContribution(request: NextRequest, id: number, currentUserId: number) {
  const body = await request.json();

  // Check if the contribution ID is provided
  if (!body.contributionId) {
    return NextResponse.json(
      { error: 'Contribution ID is required' },
      { status: 400 }
    );
  }

  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this chit fund' },
      { status: 403 }
    );
  }

  // Check if the contribution exists and belongs to this chit fund
  const contribution = await prisma.contribution.findFirst({
    where: {
      id: parseInt(body.contributionId),
      chitFundId: id,
    },
  });

  if (!contribution) {
    return NextResponse.json(
      { error: 'Contribution not found or does not belong to this chit fund' },
      { status: 404 }
    );
  }

  // Update the contribution
  const updatedContribution = await prisma.contribution.update({
    where: { id: parseInt(body.contributionId) },
    data: {
      ...(body.amount && { amount: parseFloat(body.amount) }),
      ...(body.paidDate && { paidDate: new Date(body.paidDate) }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.balancePaymentStatus !== undefined && { balancePaymentStatus: body.balancePaymentStatus }),
      ...(body.balancePaymentDate !== undefined && { balancePaymentDate: body.balancePaymentDate ? new Date(body.balancePaymentDate) : null }),
      ...(body.actualBalancePaymentDate !== undefined && { actualBalancePaymentDate: body.actualBalancePaymentDate ? new Date(body.actualBalancePaymentDate) : null }),
      // If marking as paid, set balance to 0
      ...(body.balancePaymentStatus === 'Paid' && { balance: 0 }),
    },
  });

  return NextResponse.json(updatedContribution);
}

// Handler for updating an auction
async function updateAuction(request: NextRequest, id: number, currentUserId: number) {
  const body = await request.json();

  // Check if the auction ID is provided
  if (!body.auctionId) {
    return NextResponse.json(
      { error: 'Auction ID is required' },
      { status: 400 }
    );
  }

  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this chit fund' },
      { status: 403 }
    );
  }

  // Check if the auction exists and belongs to this chit fund
  const auction = await prisma.auction.findFirst({
    where: {
      id: parseInt(body.auctionId),
      chitFundId: id,
    },
  });

  if (!auction) {
    return NextResponse.json(
      { error: 'Auction not found or does not belong to this chit fund' },
      { status: 404 }
    );
  }

  // Update the auction
  const updatedAuction = await prisma.auction.update({
    where: { id: parseInt(body.auctionId) },
    data: {
      ...(body.winnerId && { winnerId: parseInt(body.winnerId) }),
      ...(body.amount && { amount: parseFloat(body.amount) }),
      ...(body.date && { date: new Date(body.date) }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
    include: {
      winner: {
        include: {
          globalMember: true,
        },
      },
    },
  });

  // If next auction date is provided, update the chit fund
  if (body.nextAuctionDate) {
    await prisma.chitFund.update({
      where: { id },
      data: {
        nextAuctionDate: new Date(body.nextAuctionDate),
      },
    });
  }

  return NextResponse.json(updatedAuction);
}

// Handler for deleting a chit fund
async function deleteChitFund(request: NextRequest, id: number, currentUserId: number) {
  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to delete this chit fund' },
      { status: 403 }
    );
  }

  // Delete the chit fund
  await prisma.chitFund.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}

// Handler for deleting a member
async function deleteMember(request: NextRequest, id: number, memberId: number, currentUserId: number) {
  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this chit fund' },
      { status: 403 }
    );
  }

  // Check if the member exists
  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      chitFundId: id,
    },
  });

  if (!member) {
    return NextResponse.json(
      { error: 'Member not found or does not belong to this chit fund' },
      { status: 404 }
    );
  }

  // Check if the member has contributions or auctions
  const [contributionsCount, auctionsCount] = await Promise.all([
    prisma.contribution.count({
      where: {
        memberId,
      },
    }),
    prisma.auction.count({
      where: {
        winnerId: memberId,
      },
    }),
  ]);

  if (contributionsCount > 0 || auctionsCount > 0) {
    return NextResponse.json(
      { error: 'Cannot delete member with contributions or auctions' },
      { status: 400 }
    );
  }

  // Delete the member
  await prisma.member.delete({
    where: { id: memberId },
  });

  return NextResponse.json({ success: true });
}

// Handler for deleting a contribution
async function deleteContribution(request: NextRequest, id: number, currentUserId: number) {
  const body = await request.json();

  // Check if the contribution ID is provided
  if (!body.contributionId) {
    return NextResponse.json(
      { error: 'Contribution ID is required' },
      { status: 400 }
    );
  }

  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this chit fund' },
      { status: 403 }
    );
  }

  // Check if the contribution exists and belongs to this chit fund
  const contribution = await prisma.contribution.findFirst({
    where: {
      id: parseInt(body.contributionId),
      chitFundId: id,
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
    where: { id: parseInt(body.contributionId) },
  });

  return NextResponse.json({ success: true });
}

// Handler for deleting an auction
async function deleteAuction(request: NextRequest, id: number, currentUserId: number) {
  const body = await request.json();

  // Check if the auction ID is provided
  if (!body.auctionId) {
    return NextResponse.json(
      { error: 'Auction ID is required' },
      { status: 400 }
    );
  }

  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this chit fund' },
      { status: 403 }
    );
  }

  // Check if the auction exists and belongs to this chit fund
  const auction = await prisma.auction.findFirst({
    where: {
      id: parseInt(body.auctionId),
      chitFundId: id,
    },
  });

  if (!auction) {
    return NextResponse.json(
      { error: 'Auction not found or does not belong to this chit fund' },
      { status: 404 }
    );
  }

  // Delete the auction
  await prisma.auction.delete({
    where: { id: parseInt(body.auctionId) },
  });

  return NextResponse.json({ success: true });
}

// Handler for getting auctions of a chit fund
async function getAuctions(request: NextRequest, id: number, currentUserId: number) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');

  // Validate pagination parameters
  const validPage = page > 0 ? page : 1;
  const validPageSize = pageSize > 0 ? pageSize : 10;

  // Calculate skip value for pagination
  const skip = (validPage - 1) * validPageSize;

  // Check if the chit fund exists
  const chitFund = await prisma.chitFund.findUnique({
    where: { id },
  });

  if (!chitFund) {
    return NextResponse.json(
      { error: 'Chit fund not found' },
      { status: 404 }
    );
  }

  // Check if the current user is the owner
  if (chitFund.createdById !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to view this chit fund' },
      { status: 403 }
    );
  }

  // Get total count for pagination
  const totalCount = await prisma.auction.count({
    where: { chitFundId: id },
  });

  // Get paginated auctions
  const auctions = await prisma.auction.findMany({
    where: { chitFundId: id },
    include: {
      winner: {
        include: {
          globalMember: true,
        },
      },
    },
    orderBy: { month: 'desc' },
    skip,
    take: validPageSize,
  });

  return NextResponse.json({
    auctions,
    totalCount,
    page: validPage,
    pageSize: validPageSize,
    totalPages: Math.ceil(totalCount / validPageSize)
  });
}
