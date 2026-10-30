import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId, getActorUserId } from '../../../../lib/auth';
import { notifyOtherAdmins, getActorName } from '../../../../lib/notifications';
import { updateOverdueAmountFromRepayments, calculateNextPaymentDate } from '../../../../lib/paymentSchedule';
import { computeChitMemberDuePeriods } from '../../../../lib/duesTracker';
import { buildDueAccounts } from '../../../../lib/duesAccounts';

// Define extended types for the membership object
interface ChitFundMembershipWithExtras {
  id: number;
  chitFundId: number;
  globalMemberId: number;
  contribution: number;
  createdAt: Date;
  updatedAt: Date;
  chitFund: {
    id: number;
    name: string;
    status: string;
    currentMonth: number;
    duration: number;
    startDate: Date;
    monthlyContribution: number;
    firstMonthContribution: number | null;
  };
  contributions?: { month: number; amount: number; paidDate: Date | null; balancePaymentStatus: string | null }[];
  missedContributions?: number;
  pendingAmount?: number;
  pendingMonths?: number[];
  partialMonths?: { month: number; balance: number }[];
}

// Define extended type for the loan object returned in member detail
interface LoanWithExtras {
  id: number;
  loanType: string;
  amount: number;
  status: string;
  disbursementDate: Date;
  remainingAmount: number;
  overdueAmount: number;
  missedPayments: number;
  installmentAmount: number;
  nextPaymentDate: Date | null;
}

// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export const dynamic = 'force-dynamic'; // Ensure the route is not statically optimized

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;

    // Get the current user ID - make sure to await the Promise
    const currentUserId = await getCurrentUserId(request);
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
      case 'dues':
        if (!id) {
          return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
        }
        return await getMemberDues(request, id, currentUserId);
      case 'history':
        if (!id) {
          return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
        }
        return await getMemberPaymentHistory(request, id, currentUserId);
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

    // Get the current user ID - make sure to await the Promise
    const currentUserId = await getCurrentUserId(request);
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

    // Get the current user ID - make sure to await the Promise
    const currentUserId = await getCurrentUserId(request);
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

    // Get the current user ID - make sure to await the Promise
    const currentUserId = await getCurrentUserId(request);
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

    // Optional search by name or phone (case-insensitive)
    const search = (searchParams.get('search') || '').trim().slice(0, 100);

    // Filter by the current user
    const where: any = {
      createdById: currentUserId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { contact: { contains: search } },
            ],
          }
        : {}),
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
      search,
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
                startDate: true,
                monthlyContribution: true,
                firstMonthContribution: true,
              },
            },
            contributions: {
              select: { month: true, amount: true, paidDate: true, balancePaymentStatus: true },
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
            overdueAmount: true,
            missedPayments: true,
            installmentAmount: true,
            nextPaymentDate: true,
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

    // Get all contributions for this member's chit funds
    const memberWithContributions = { ...member };

    // Pending contributions due up to today, using the same rules as the Dues Tracker
    const asOf = new Date();
    const dueRange = { start: new Date(0), end: new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 23, 59, 59, 999) };
    for (const membership of memberWithContributions.chitFundMembers as ChitFundMembershipWithExtras[]) {
      const periods = membership.chitFund.status === 'Active'
        ? computeChitMemberDuePeriods(membership.chitFund, membership.contributions || [], dueRange, asOf)
        : [];
      membership.missedContributions = periods.length;
      membership.pendingAmount = Math.round(periods.reduce((sum, p) => sum + p.outstanding, 0) * 100) / 100;
      membership.pendingMonths = periods.map((p) => p.period);
      membership.partialMonths = periods.filter((p) => p.paid > 0).map((p) => ({ month: p.period, balance: p.outstanding }));
      delete membership.contributions; // not needed by the client
    }

    // Refresh loan due details so the member page never shows stale overdue/next-due data
    for (const loan of memberWithContributions.loans as LoanWithExtras[]) {
      if (loan.status === 'Active') {
        const overdueResult = await updateOverdueAmountFromRepayments(loan.id);
        if (overdueResult) {
          loan.overdueAmount = overdueResult.overdueAmount;
          loan.missedPayments = overdueResult.missedPayments;
        }
        loan.nextPaymentDate = await calculateNextPaymentDate(loan.id);
      }
    }

    return NextResponse.json(memberWithContributions);
  } catch (error) {
    console.error('Error fetching member:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member' },
      { status: 500 }
    );
  }
}

/** Load a member only if it belongs to the current user. */
async function findOwnedMember(id: number, currentUserId: number) {
  const member = await prisma.globalMember.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!member) return { error: NextResponse.json({ error: 'Member not found' }, { status: 404 }) };
  if (member.createdById !== currentUserId) {
    return { error: NextResponse.json({ error: 'You do not have permission to view this member' }, { status: 403 }) };
  }
  return { member };
}

// Handler for a member's pending dues (overdue + upcoming within horizonDays)
async function getMemberDues(request: NextRequest, id: number, currentUserId: number) {
  try {
    const { searchParams } = new URL(request.url);
    const horizonDays = Number(searchParams.get('horizonDays') ?? 30);
    if (!Number.isInteger(horizonDays) || horizonDays < 0 || horizonDays > 366) {
      return NextResponse.json({ error: 'Invalid horizonDays' }, { status: 400 });
    }

    const owned = await findOwnedMember(id, currentUserId);
    if (owned.error) return owned.error;

    const [{ accounts, summary }, lastContribution, lastRepayment] = await Promise.all([
      buildDueAccounts(prisma, currentUserId, { horizonDays, globalMemberId: id }),
      prisma.contribution.findFirst({
        where: { member: { globalMemberId: id }, chitFund: { createdById: currentUserId } },
        orderBy: { paidDate: 'desc' },
        select: { paidDate: true, amount: true },
      }),
      prisma.repayment.findFirst({
        where: { loan: { borrowerId: id, createdById: currentUserId } },
        orderBy: { paidDate: 'desc' },
        select: { paidDate: true, amount: true },
      }),
    ]);

    const last = [lastContribution, lastRepayment]
      .filter(Boolean)
      .sort((a, b) => new Date(b!.paidDate).getTime() - new Date(a!.paidDate).getTime())[0] || null;

    return NextResponse.json({
      horizonDays,
      summary,
      accounts,
      lastPayment: last ? { date: last.paidDate, amount: last.amount } : null,
    });
  } catch (error) {
    console.error('Error fetching member dues:', error);
    return NextResponse.json({ error: 'Failed to fetch member dues' }, { status: 500 });
  }
}

// Handler for a member's combined contribution + repayment history, newest first
async function getMemberPaymentHistory(request: NextRequest, id: number, currentUserId: number) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20') || 20));
    const kind = searchParams.get('kind'); // 'contribution' | 'repayment' | null
    const accountKey = searchParams.get('account'); // e.g. 'loan-12' | 'chit-3'

    const owned = await findOwnedMember(id, currentUserId);
    if (owned.error) return owned.error;

    const [contributions, repayments] = await Promise.all([
      kind === 'repayment' || accountKey?.startsWith('loan-')
        ? Promise.resolve([])
        : prisma.contribution.findMany({
            where: {
              member: { globalMemberId: id },
              chitFund: { createdById: currentUserId },
              ...(accountKey?.startsWith('chit-') ? { chitFundId: Number(accountKey.slice(5)) } : {}),
            },
            select: {
              id: true, amount: true, month: true, paidDate: true, balance: true, notes: true,
              chitFund: { select: { id: true, name: true } },
              collectedBy: { select: { name: true } },
            },
          }),
      kind === 'contribution' || accountKey?.startsWith('chit-')
        ? Promise.resolve([])
        : prisma.repayment.findMany({
            where: {
              loan: { borrowerId: id, createdById: currentUserId },
              ...(accountKey?.startsWith('loan-') ? { loanId: Number(accountKey.slice(5)) } : {}),
            },
            select: {
              id: true, amount: true, period: true, paidDate: true, paymentType: true,
              loan: { select: { id: true, loanType: true, repaymentType: true } },
              collectedBy: { select: { name: true } },
            },
          }),
    ]);

    const items = [
      ...contributions.map((c: any) => ({
        key: `c-${c.id}`,
        kind: 'contribution',
        date: c.paidDate,
        amount: c.amount,
        accountKey: `chit-${c.chitFund.id}`,
        accountName: c.chitFund.name,
        periodLabel: `Month ${c.month}`,
        balance: c.balance || 0,
        detail: c.notes || null,
        collectedBy: c.collectedBy?.name || null,
        href: `/chit-funds/${c.chitFund.id}/contributions?month=${c.month}`,
      })),
      ...repayments.map((r: any) => ({
        key: `r-${r.id}`,
        kind: 'repayment',
        date: r.paidDate,
        amount: r.amount,
        accountKey: `loan-${r.loan.id}`,
        accountName: `Loan #${r.loan.id} · ${r.loan.loanType}`,
        periodLabel: `${r.loan.repaymentType === 'Weekly' ? 'Week' : 'Installment'} ${r.period}`,
        balance: 0,
        detail: r.paymentType === 'interestOnly' ? 'Interest only' : null,
        collectedBy: r.collectedBy?.name || null,
        href: `/loans/${r.loan.id}`,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalCount = items.length;
    return NextResponse.json({
      items: items.slice((page - 1) * pageSize, page * pageSize),
      totalCount,
      totalAmount: Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    });
  } catch (error) {
    console.error('Error fetching member payment history:', error);
    return NextResponse.json({ error: 'Failed to fetch payment history' }, { status: 500 });
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

    const actorUserId = (await getActorUserId(request)) ?? currentUserId;
    const actorName = await getActorName(actorUserId);
    await notifyOtherAdmins({
      actorId: actorUserId,
      type: 'member_created',
      title: 'New Member',
      message: `${actorName} added member "${member.name}"`,
      link: `/members/${member.id}`,
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
