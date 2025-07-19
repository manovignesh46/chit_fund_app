import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

// GET /api/chit-funds/by-member?globalMemberId=123
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const globalMemberId = searchParams.get('globalMemberId');
    if (!globalMemberId) {
      return NextResponse.json({ error: 'globalMemberId is required' }, { status: 400 });
    }
    // Find all Member records for this global member
    const members = await prisma.member.findMany({
      where: { globalMemberId: parseInt(globalMemberId) },
      select: { chitFundId: true },
    });
    const chitFundIds = [...new Set(members.map(m => m.chitFundId))];
    if (chitFundIds.length === 0) {
      return NextResponse.json({ chitFunds: [] });
    }
    // Get chit fund details
    const chitFunds = await prisma.chitFund.findMany({
      where: { id: { in: chitFundIds } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ chitFunds });
  } catch (error) {
    console.error('Error fetching chit funds by member:', error);
    return NextResponse.json({ error: 'Failed to fetch chit funds' }, { status: 500 });
  }
}
