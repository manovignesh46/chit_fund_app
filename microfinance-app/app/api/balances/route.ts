import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';
import { getBalanceSummary } from '../../../lib/balanceCalculator';

// GET /api/balances - Get balance summary for current user
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const balanceSummary = await getBalanceSummary(currentUserId);

    return NextResponse.json(balanceSummary);
  } catch (error) {
    console.error('Error fetching balance summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance summary' },
      { status: 500 }
    );
  }
}
