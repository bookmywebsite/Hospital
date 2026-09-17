import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import {
  scheduleJob,
  processPendingJobs,
  scheduleFollowUp,
  scheduleBulkFollowUps,
} from '@/lib/scheduler/scheduler';

// POST /api/scheduler — create a scheduled job
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const { action, leadId, agentId, type, scheduledFor, delayHours, leadIds } = body;

    // Get default agent if not provided
    let resolvedAgentId = agentId;
    if (!resolvedAgentId) {
      const agent = await prisma.agent.findFirst({
        where: { organizationId: user.organizationId, isDefault: true, isActive: true },
      });
      resolvedAgentId = agent?.id;
    }

    switch (action) {
      case 'schedule': {
        if (!leadId || !type) {
          return NextResponse.json({ error: 'leadId and type required' }, { status: 400 });
        }
        if (!resolvedAgentId) {
          return NextResponse.json({ error: 'No default agent available' }, { status: 400 });
        }
        const jobId = await scheduleJob({
          type,
          leadId,
          agentId:      resolvedAgentId,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        });
        return NextResponse.json({ success: true, jobId });
      }

      case 'follow_up': {
        if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });
        if (!resolvedAgentId) {
          return NextResponse.json({ error: 'No default agent available' }, { status: 400 });
        }
        const jobId = await scheduleFollowUp(
          leadId,
          resolvedAgentId,
          delayHours ?? 24
        );
        return NextResponse.json({ success: true, jobId });
      }

      case 'bulk_follow_up': {
        if (!resolvedAgentId) {
          return NextResponse.json({ error: 'No default agent available' }, { status: 400 });
        }
        const count = await scheduleBulkFollowUps(user.organizationId, resolvedAgentId, Array.isArray(leadIds) ? leadIds : undefined);
        return NextResponse.json({ success: true, scheduled: count });
      }

      case 'clear_pending': {
        const deleted = await (prisma as any).scheduledJob.deleteMany({
          where: { status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } },
        });
        return NextResponse.json({ success: true, deleted: deleted.count });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Scheduler API]', error);
    return NextResponse.json({ error: error.message ?? 'Failed' }, { status: 500 });
  }
}

// GET /api/scheduler — list pending/recent jobs
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jobs = await (prisma as any).scheduledJob.findMany({
      where:   { status: { in: ['PENDING', 'PROCESSING'] } },
      orderBy: { scheduledFor: 'asc' },
      take:    50,
    });

    const leadIds = jobs.map((job: any) => job.targetId).filter(Boolean);
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });
    const leadMap = new Map(leads.map((lead) => [lead.id, lead]));

    const jobsWithLead = jobs.map((job: any) => {
      const lead = leadMap.get(job.targetId);
      const leadName = lead ? `${lead.firstName ?? lead.email}${lead.lastName ? ` ${lead.lastName}` : ''}` : undefined;
      const leadPhone = lead?.phone ?? job.payload?.phone ?? null;
      return {
        ...job,
        leadName,
        leadPhone,
      };
    });

    return NextResponse.json({ success: true, jobs: jobsWithLead });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}