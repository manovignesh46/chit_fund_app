import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getCurrentUserId } from '../../../lib/auth';

export async function GET(req: NextRequest) {
  try {
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

    // Pass the partner's ID (number) to the balance calculation function
    const partnersWithBalances = await Promise.all(
      partners.map(async (partner) => {
        const balance = await calculatePartnerBalance(partner.id, userId);
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

/**
 * Calculates a partner's cash balance by aggregating all their transactions.
 * This is more efficient and accurate than the previous method.
 * @param partnerId The ID of the partner.
 * @param userId The ID of the current user for authorization.
 * @returns The calculated cash balance.
 */
async function calculatePartnerBalance(partnerId: number, userId: number): Promise<number> {
  try {
    // 1. Calculate the total amount of money received by the partner.
    // This includes loan repayments, chit contributions, and incoming transfers.
    const moneyIn = await prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        createdById: userId,
        to_partner_id: partnerId,
      },
    });

    // 2. Calculate the total amount of money sent out by the partner.
    // This includes loan disbursements, auction payouts, and outgoing transfers.
    const moneyOut = await prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        createdById: userId,
        from_partner_id: partnerId,
      },
    });

    const totalIn = moneyIn._sum.amount || 0;
    const totalOut = moneyOut._sum.amount || 0;

    // 3. The final balance is the difference.
    const balance = totalIn - totalOut;

    return balance;
  } catch (error) {
    console.error(`Error calculating balance for partner ${partnerId}:`, error);
    // Return 0 in case of an error to prevent breaking the UI.
    return 0;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { name, code } = data; // Added 'code' for creating partners

    if (!name) {
      return NextResponse.json({ error: 'Partner name is required' }, { status: 400 });
    }
    
    // Check if a partner with the same code already exists for this user
    if (code) {
        const existingPartner = await prisma.partner.findUnique({
            where: {
                Partner_createdById_code_key: {
                    createdById: userId,
                    code: code,
                }
            }
        });
        if (existingPartner) {
            return NextResponse.json({ error: 'A partner with this code already exists.' }, { status: 400 });
        }
    }

    const partner = await prisma.partner.create({
      data: {
        name,
        code: code || null, // Save code if provided
        isActive: true,
        createdById: userId,
      },
    });

    return NextResponse.json({ partner }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating partner:', error);
    // Handle unique constraint violation for name gracefully
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
        return NextResponse.json({ error: 'A partner with this name already exists.' }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create partner' },
      { status: 500 }
    );
  }
}