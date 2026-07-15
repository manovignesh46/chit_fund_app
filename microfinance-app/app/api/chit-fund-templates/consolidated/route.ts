import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getCurrentUserId } from '../../../../lib/auth';

// Use ISR with a 5-minute revalidation period (mirrors chit-funds/consolidated)
export const revalidate = 300;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Normalize an incoming month->amount map into a clean { "1": number, ... } object.
// Accepts either `fixedAmountsPattern` (object) or `fixedAmounts` (form map) shape.
function normalizePattern(source: any, duration: number): Record<string, number> {
  const pattern: Record<string, number> = {};
  for (let i = 1; i <= duration; i++) {
    pattern[String(i)] = parseFloat(source[i]);
  }
  return pattern;
}

// Shared validation for create/update payloads. Returns an error message or null.
function validateTemplateBody(body: any): string | null {
  const requiredFields = ['name', 'totalAmount', 'monthlyContribution', 'duration', 'membersCount'];
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `${field} is required`;
    }
  }

  if (body.chitFundType === 'Fixed') {
    const source = body.fixedAmountsPattern ?? body.fixedAmounts;
    if (!source) {
      return 'Fixed amounts are required for Fixed type templates';
    }
    const duration = parseInt(body.duration);
    for (let i = 1; i <= duration; i++) {
      if (!source[i] || isNaN(Number(source[i])) || Number(source[i]) <= 0) {
        return `Fixed amount for month ${i} is required and must be a valid positive number`;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET  ?action=list | ?action=detail&id=
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;

    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    switch (action) {
      case 'list':
        return await getTemplatesList(request, currentUserId);
      case 'detail':
        if (!id) return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
        return await getTemplateDetail(request, id, currentUserId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in chit-fund-templates GET:', error);
    return NextResponse.json({ error: 'An error occurred while processing your request' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'create';

    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    switch (action) {
      case 'create':
        return await createTemplate(request, currentUserId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in chit-fund-templates POST:', error);
    return NextResponse.json({ error: 'An error occurred while processing your request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'update';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;

    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    switch (action) {
      case 'update':
        if (!id) return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
        return await updateTemplate(request, id, currentUserId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in chit-fund-templates PUT:', error);
    return NextResponse.json({ error: 'An error occurred while processing your request' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'delete';
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;

    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    switch (action) {
      case 'delete':
        if (!id) return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
        return await deleteTemplate(request, id, currentUserId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in chit-fund-templates DELETE:', error);
    return NextResponse.json({ error: 'An error occurred while processing your request' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function getTemplatesList(request: NextRequest, currentUserId: number) {
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get('includeArchived') === 'true';

  const where: any = { createdById: currentUserId };
  if (!includeArchived) where.isArchived = false;

  const templates = await prisma.chitFundTemplate.findMany({
    where,
    include: {
      _count: { select: { chitFunds: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ templates });
}

async function getTemplateDetail(request: NextRequest, id: number, currentUserId: number) {
  const template = await prisma.chitFundTemplate.findUnique({
    where: { id },
    include: {
      _count: { select: { chitFunds: true } },
    },
  });

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }
  if (template.createdById !== currentUserId) {
    return NextResponse.json({ error: 'You do not have permission to view this template' }, { status: 403 });
  }

  return NextResponse.json(template);
}

async function createTemplate(request: NextRequest, currentUserId: number) {
  const body = await request.json();

  const validationError = validateTemplateBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const duration = parseInt(body.duration);
  const isFixed = body.chitFundType === 'Fixed';
  const patternSource = body.fixedAmountsPattern ?? body.fixedAmounts;

  const template = await prisma.chitFundTemplate.create({
    data: {
      name: body.name,
      description: body.description || null,
      totalAmount: parseFloat(body.totalAmount),
      monthlyContribution: parseFloat(body.monthlyContribution),
      firstMonthContribution: body.firstMonthContribution ? parseFloat(body.firstMonthContribution) : null,
      duration,
      membersCount: parseInt(body.membersCount),
      chitFundType: body.chitFundType || 'Auction',
      fixedAmountsPattern: isFixed ? normalizePattern(patternSource, duration) : undefined,
      createdById: currentUserId,
    },
  });

  return NextResponse.json(template, { status: 201 });
}

async function updateTemplate(request: NextRequest, id: number, currentUserId: number) {
  const body = await request.json();

  const existing = await prisma.chitFundTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }
  if (existing.createdById !== currentUserId) {
    return NextResponse.json({ error: 'You do not have permission to edit this template' }, { status: 403 });
  }

  // Metadata-only edit (archive/unarchive, rename) — skips structural validation.
  const isMetadataOnly = body.metadataOnly === true;

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.isArchived !== undefined) data.isArchived = !!body.isArchived;

  if (!isMetadataOnly) {
    const validationError = validateTemplateBody({ ...existing, ...body });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const duration = body.duration !== undefined ? parseInt(body.duration) : existing.duration;
    const chitFundType = body.chitFundType ?? existing.chitFundType;
    const isFixed = chitFundType === 'Fixed';
    const patternSource = body.fixedAmountsPattern ?? body.fixedAmounts;

    if (body.totalAmount !== undefined) data.totalAmount = parseFloat(body.totalAmount);
    if (body.monthlyContribution !== undefined) data.monthlyContribution = parseFloat(body.monthlyContribution);
    if (body.firstMonthContribution !== undefined) {
      data.firstMonthContribution = body.firstMonthContribution ? parseFloat(body.firstMonthContribution) : null;
    }
    if (body.duration !== undefined) data.duration = duration;
    if (body.membersCount !== undefined) data.membersCount = parseInt(body.membersCount);
    if (body.chitFundType !== undefined) data.chitFundType = chitFundType;
    // Re-derive the pattern when Fixed data is supplied; clear it when switching to Auction.
    if (isFixed && patternSource) {
      data.fixedAmountsPattern = normalizePattern(patternSource, duration);
    } else if (!isFixed) {
      data.fixedAmountsPattern = null as any;
    }
  }

  const template = await prisma.chitFundTemplate.update({ where: { id }, data });
  return NextResponse.json(template);
}

async function deleteTemplate(request: NextRequest, id: number, currentUserId: number) {
  const { searchParams } = new URL(request.url);
  const hard = searchParams.get('hard') === 'true';

  const template = await prisma.chitFundTemplate.findUnique({
    where: { id },
    include: { _count: { select: { chitFunds: true } } },
  });

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }
  if (template.createdById !== currentUserId) {
    return NextResponse.json({ error: 'You do not have permission to delete this template' }, { status: 403 });
  }

  if (hard) {
    // Block hard delete while funds still point at this template — preserve provenance.
    if (template._count.chitFunds > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${template._count.chitFunds} chit fund(s) reference this template. Archive it instead.` },
        { status: 409 }
      );
    }
    await prisma.chitFundTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  }

  // Default: soft-archive (always safe — never affects existing funds).
  const archived = await prisma.chitFundTemplate.update({
    where: { id },
    data: { isArchived: true },
  });
  return NextResponse.json({ success: true, archived: true, template: archived });
}
