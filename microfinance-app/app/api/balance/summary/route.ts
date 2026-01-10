import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';

// GET /api/balance/summary
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // New Architecture: Fetch from PartnerBalance table
    // 1. Get all partners for the user (to ensure we list all, even with 0 balance)
    const partners = await prisma.partner.findMany({
        where: { createdById: currentUserId, isActive: true },
        select: { id: true, name: true }
    });

    // 2. Get balances from PartnerBalance table
    const partnerBalances = await prisma.partnerBalance.findMany({
        where: { createdById: currentUserId }
    });

    // 3. Map balances to partners
    const partnerBalanceData = partners.map(p => {
        const pb = partnerBalances.find(b => b.partnerId === p.id);
        return {
            partnerId: p.id,
            partnerName: p.name,
            balance: pb ? pb.balance : 0
        };
    });

    // 4. Calculate Total
    const totalBalance = partnerBalanceData.reduce((sum, item) => sum + item.balance, 0);

    return NextResponse.json({
        totalBalance,
        partnerBalances: partnerBalanceData
    });
  } catch (error) {
    console.error('Error fetching balance summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance summary' },
      { status: 500 }
    );
  }
}
