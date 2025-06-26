import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Get the current user ID from the request
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeBalances = searchParams.get('includeBalances') === 'true';

    const partners = await prisma.partner.findMany({
      where: {
        createdById: userId,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    if (!includeBalances) {
      return NextResponse.json({ partners });
    }

    // Calculate balances for each partner
    const partnersWithBalances = await Promise.all(
      partners.map(async (partner) => {
        const balance = await calculatePartnerBalance(partner.name, userId);
        return {
          ...partner,
          balance,
        };
      })
    );

    return NextResponse.json({ partners: partnersWithBalances });
  } catch (error: any) {
    console.error('Error fetching partners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partners' },
      { status: 500 }
    );
  }
}

// Helper function to calculate partner balance including all financial activities
async function calculatePartnerBalance(partnerName: string, userId: number): Promise<number> {
  try {
    let balance = 0;

    // 1. Manual partner-to-partner transactions (from Transaction table)
    const manualTransactions = await prisma.transaction.findMany({
      where: {
        createdById: userId,
        OR: [
          { from_partner: partnerName },
          { to_partner: partnerName },
        ],
      },
      orderBy: {
        date: 'asc',
      },
    });

    for (const transaction of manualTransactions) {
      const { type, amount, from_partner, to_partner } = transaction;

      switch (type) {
        case 'collection':
          if (to_partner === partnerName) {
            balance += amount;
          }
          break;
        case 'transfer':
          if (from_partner === partnerName) {
            balance -= amount;
          }
          if (to_partner === partnerName) {
            balance += amount;
          }
          break;
        case 'loan_given':
          if (from_partner === partnerName) {
            balance -= amount;
          }
          break;
        case 'loan_repaid':
          if (to_partner === partnerName) {
            balance += amount;
          }
          break;
        case 'chit_contribution':
          if (to_partner === partnerName) {
            balance += amount;
          }
          break;
      }
    }

    // 2. Loan disbursements (money going out when creating loans)
    // These are now tracked via transactions with type 'loan_given'
    // So we don't need to calculate them separately here

    // 3. Loan repayments (money coming in when collecting repayments)
    // These are now tracked via transactions with type 'loan_repaid'
    // So we don't need to calculate them separately here

    // 4. Chit fund contributions and auctions
    // Chit fund contributions are now tracked via transactions with type 'chit_contribution'
    // Auction payments will be implemented in a future update

    return balance;
  } catch (error) {
    console.error('Error calculating partner balance:', error);
    return 0;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get the current user ID from the request
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { name } = data;

    if (!name) {
      return NextResponse.json(
        { error: 'Partner name is required' },
        { status: 400 }
      );
    }

    const partner = await prisma.partner.create({
      data: {
        name,
        isActive: true,
        createdById: userId,
      },
    });

    return NextResponse.json({ partner }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating partner:', error);
    return NextResponse.json(
      { error: 'Failed to create partner' },
      { status: 500 }
    );
  }
}
