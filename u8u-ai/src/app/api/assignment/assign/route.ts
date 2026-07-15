import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { assignLead, bulkAssignLeads, reassignLead } from '@/lib/assignment/engine';

// POST /api/assignment/assign — single or reassign
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { leadId, reassign, reassignReason } = await request.json();
    if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

    // Verify access
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const result = reassign
      ? await reassignLead(leadId, reassignReason ?? 'Manual reassignment')
      : await assignLead(leadId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Assignment API]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PUT /api/assignment/assign — bulk assign
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { leadIds } = await request.json();
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds array required' }, { status: 400 });
    }
    if (leadIds.length > 100) {
      return NextResponse.json({ error: 'Max 100 leads per request' }, { status: 400 });
    }

    const result = await bulkAssignLeads(leadIds);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Bulk Assignment API]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}