import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '../../../../lib/auth';
import { getBalanceSummary } from '../../../../lib/balanceCalculator';

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
