import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { addCallToQueue, addBulkCallsToQueue } from '@/lib/queue/call-queue';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const { leadIds, leadId, agentId, scheduledFor, language } = body;

    // Get default agent if not provided
    let resolvedAgentId = agentId;
    if (!resolvedAgentId) {
      const agent = await prisma.agent.findFirst({
        where: { organizationId: user.organizationId, isDefault: true, isActive: true },
      });
      if (!agent) return NextResponse.json({ error: 'No active agent found' }, { status: 404 });
      resolvedAgentId = agent.id;
    }

    // Bulk queue
    if (leadIds && Array.isArray(leadIds)) {
      const queueIds = await addBulkCallsToQueue({
        leadIds,
        agentId:   resolvedAgentId,
        startTime: scheduledFor ? new Date(scheduledFor) : new Date(),
        language:  language ?? 'EN',
      });
      return NextResponse.json({ success: true, queued: queueIds.length, queueIds });
    }

    // Single call
    if (leadId) {
      const queueId = await addCallToQueue({
        leadId,
        agentId:      resolvedAgentId,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        language:     language ?? 'EN',
      });
      return NextResponse.json({ success: true, queueId });
    }

    return NextResponse.json({ error: 'leadId or leadIds required' }, { status: 400 });
  } catch (error: any) {
    console.error('[Dialer Queue]', error);
    return NextResponse.json({ error: error.message ?? 'Failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Fetch queued calls from Activity table
    const queue = await prisma.activity.findMany({
      where: {
        type:   'call_queued',
        lead:   { organizationId: user.organizationId },
      },
      include: {
        lead: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });

    return NextResponse.json({ success: true, queue });
  } catch (error) {
    console.error('[Dialer Queue GET]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}