import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getCurrentUserId, getActorUserId, getLinkedPartnerId } from '../../../../../lib/auth';
import { changeLoanRecovery, collectionPreview } from '../../../../../lib/loanRecoveryService';
import { RecoveryError } from '../../../../../lib/loanRecovery';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const ownerId = await getCurrentUserId(request);
  if (!ownerId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 });
  const loan = await prisma.loan.findFirst({ where: { id, createdById: ownerId }, include: {
    repayments: { orderBy: { paidDate: 'asc' } },
    recoveryEvents: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { name: true } } } },
  } });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  return NextResponse.json({ preview: collectionPreview(loan), events: loan.recoveryEvents,
    receipts: loan.repayments.filter((r) => r.paymentType.startsWith('RECOVERY')) });
}

export async function POST(request: NextRequest, { params }: Params) {
  const ownerId = await getCurrentUserId(request);
  const actorId = await getActorUserId(request);
  if (!ownerId || !actorId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 });
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') throw new RecoveryError('Invalid request');
    const result = await changeLoanRecovery(prisma, {
      ownerId, actorId, linkedPartnerId: await getLinkedPartnerId(request),
      entryPartnerName: request.headers.get('x-active-partner') || 'Me',
    }, id, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RecoveryError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    console.error('Loan recovery failed:', error);
    return NextResponse.json({ error: 'Unable to update loan recovery. Please try again.' }, { status: 500 });
  }
}
