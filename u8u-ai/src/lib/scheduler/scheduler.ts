import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { makeOutboundCall } from '@/lib/agents/outbound-dialer';

export interface ScheduleOptions {
  type:          'CALL' | 'EMAIL' | 'WHATSAPP' | 'FOLLOW_UP';
  leadId:        string;
  agentId?:      string;
  scheduledFor?: Date;
  timezone?:     string;
  priority?:     number;
  payload?:      Record<string, any>;
}

// ── IST hours ─────────────────────────────────────────────────────────────────

const IST_CALL_START = 9;
const IST_CALL_END   = 21;

function getISTHour(): number {
  const now        = new Date();
  const istOffset  = 5.5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istMinutes = (utcMinutes + istOffset) % (24 * 60);
  return Math.floor(istMinutes / 60);
}

export function isWithinCallingHours(): boolean {
  const hour = getISTHour();
  return hour >= IST_CALL_START && hour < IST_CALL_END;
}

function nextCallingWindowIST(): Date {
  const now     = new Date();
  const istHour = getISTHour();
  const next    = new Date(now);
  if (istHour >= IST_CALL_END) next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(3, 30, 0, 0);
  return next;
}

// ── Check if a phone number has an active Twilio call ─────────────────────────

async function isPhoneNumberBusy(phone: string): Promise<boolean> {
  try {
    // Check if there's an ACTIVE conversation with this phone in the last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const activeCall    = await prisma.conversation.findFirst({
      where: {
        channel:   'VOICE',
        status:    'ACTIVE',
        phoneFrom: phone,
        startedAt: { gte: tenMinutesAgo },
      },
    });
    return !!activeCall;
  } catch {
    return false;
  }
}

// ── Schedule a single job ─────────────────────────────────────────────────────

export async function scheduleJob(options: ScheduleOptions): Promise<string> {
  const {
    type,
    leadId,
    agentId,
    scheduledFor,
    timezone = 'Asia/Kolkata',
    priority = 5,
    payload  = {},
  } = options;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  let contactTime = scheduledFor ?? new Date();

  if (type === 'CALL' && !isWithinCallingHours() && !scheduledFor) {
    contactTime = nextCallingWindowIST();
  }

  const job = await (prisma as any).scheduledJob.create({
    data: {
      jobType:      type,
      targetId:     leadId,
      scheduledFor: contactTime,
      timezone,
      status:       'PENDING',
      payload: {
        leadId,
        agentId: agentId ?? null,
        priority,
        phone:   lead.phone,
        ...payload,
      },
    },
  });

  await prisma.activity.create({
    data: {
      leadId,
      type:        `scheduled_${type.toLowerCase()}`,
      title:       `${type} scheduled`,
      description: `For ${contactTime.toISOString()}`,
      actorType:   'system',
      metadata:    { jobId: job.id, type, scheduledFor: contactTime.toISOString() },
    },
  });

  return job.id;
}

// ── Process ONE pending job per run ───────────────────────────────────────────

export async function processPendingJobs(): Promise<{
  processed: number;
  failed:    number;
  details:   string[];
}> {
  const now     = new Date();
  let processed = 0;
  let failed    = 0;
  const details: string[] = [];

  // Get all pending jobs due now — ordered by scheduledFor
  const pendingJobs = await (prisma as any).scheduledJob.findMany({
    where: {
      status:       'PENDING',
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: 'asc' },
    take:    10,
  });

  if (pendingJobs.length === 0) return { processed, failed, details };

  for (const job of pendingJobs) {
    const phone = job.payload?.phone as string | null;

    // ── Skip if same phone number is currently on an active call ─────────
    if (phone && await isPhoneNumberBusy(phone)) {
      details.push(`⏭️ Skipped ${phone} — call already active`);

      // Reschedule this job for 30 seconds later (hang-free retry)
      await (prisma as any).scheduledJob.update({
        where: { id: job.id },
        data:  { scheduledFor: new Date(now.getTime() + 30 * 1000) },
      });
      continue; // move to next lead
    }

    // ── Check if this job is already being processed ──────────────────────
    const alreadyProcessing = await (prisma as any).scheduledJob.findFirst({
      where: {
        status:  'PROCESSING',
        id:      { not: job.id },
        jobType: job.jobType,
      },
    });

    if (alreadyProcessing) {
      details.push(`⏳ Another ${job.jobType} job processing — queuing after 30 sec`);
      await (prisma as any).scheduledJob.update({
        where: { id: job.id },
        data:  { scheduledFor: new Date(now.getTime() + 30 * 1000) },
      });
      continue;
    }

    // ── Execute this job ──────────────────────────────────────────────────
    try {
      await (prisma as any).scheduledJob.update({
        where: { id: job.id },
        data:  { status: 'PROCESSING', attempts: { increment: 1 } },
      });

      const result = await executeJob(job);
      details.push(result);

      await (prisma as any).scheduledJob.update({
        where: { id: job.id },
        data:  { status: 'COMPLETED', processedAt: new Date() },
      });

      processed++;

      // ── After successful call, set next pending job to fire in 30 seconds ─────
      const nextJob = await (prisma as any).scheduledJob.findFirst({
        where:   { status: 'PENDING', id: { not: job.id } },
        orderBy: { scheduledFor: 'asc' },
      });

      if (nextJob) {
        const nextTime = new Date(now.getTime() + 30 * 1000);
        await (prisma as any).scheduledJob.update({
          where: { id: nextJob.id },
          data:  { scheduledFor: nextTime },
        });
        details.push(`⏰ Next call to ${nextJob.payload?.phone ?? 'lead'} in 30 seconds`);
      }

      // Only process ONE call per cron run — break after first success
      break;

    } catch (err: any) {
      console.error(`[Scheduler] Job ${job.id} failed:`, err.message);
      failed++;
      details.push(`❌ Failed: ${err.message}`);

      const attempts = (job.payload?.attempts ?? job.attempts ?? 0) + 1;
      await (prisma as any).scheduledJob.update({
        where: { id: job.id },
        data:  {
          status:       attempts >= 3 ? 'FAILED' : 'PENDING',
          lastError:    err.message,
          scheduledFor: attempts < 3
            ? new Date(now.getTime() + 30 * 1000)
            : undefined,
        },
      });

      // On failure, try the NEXT lead immediately (don't block)
      continue;
    }
  }

  return { processed, failed, details };
}

// ── Execute a single job ──────────────────────────────────────────────────────

async function executeJob(job: any): Promise<string> {
  const { jobType, targetId: leadId, payload } = job;

  switch (jobType) {

    case 'CALL': {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!lead)       throw new Error(`Lead not found: ${leadId}`);
      if (!lead.phone) throw new Error(`Lead has no phone: ${leadId}`);

      if (!isWithinCallingHours()) {
        const next = nextCallingWindowIST();
        await (prisma as any).scheduledJob.update({
          where: { id: job.id },
          data:  { status: 'PENDING', scheduledFor: next },
        });
        throw new Error(`Outside calling hours — rescheduled for next window`);
      }

      const agentId = payload?.agentId;
      if (!agentId) throw new Error('No agentId in job payload');

      const result = await makeOutboundCall({
        leadId,
        agentId,
        phoneNumber:  lead.phone,
        language:     payload?.language ?? 'EN',
        callQueueId:  job.id,
      });

      // Update lead status
      await prisma.lead.update({
        where: { id: leadId },
        data:  {
          status:          lead.status === 'NEW' ? 'CONTACTED' : lead.status,
          lastContactedAt: new Date(),
        },
      }).catch(() => {});

      console.log(`[Scheduler] ✅ Call → ${lead.phone} | SID: ${result.callSid}`);
      return `✅ Called ${lead.firstName ?? lead.phone} | SID: ${result.callSid.slice(0, 12)}...`;
    }

    case 'EMAIL': {
      const lead    = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!lead) throw new Error(`Lead not found: ${leadId}`);

      const agentId = payload?.agentId;
      if (agentId) {
        const agent = await prisma.agent.findUnique({ where: { id: agentId } });
        if (agent) {
          const { generateEmailContent } = await import('@/lib/email');
          const generated = await generateEmailContent({
            agentName:     agent.name,
            agentRole:     agent.role,
            companyName:   (agent as any).companyName ?? '',
            leadFirstName: lead.firstName  ?? '',
            leadCompany:   lead.company    ?? '',
            painPoints:    lead.painPoints ?? [],
            stepNumber:    1,
            totalSteps:    1,
            tone:          (agent as any).tone ?? 'conversational',
          });
          await sendEmail({
            to:      lead.email,
            toName:  lead.firstName ?? lead.email,
            subject: generated.subject,
            html:    generated.html,
            text:    generated.text,
          });
          return `✅ Email → ${lead.email}`;
        }
      }
      return `⚠️ Email skipped — no agent`;
    }

    case 'FOLLOW_UP': {
      await prisma.activity.create({
        data: {
          leadId,
          type:        'follow_up_due',
          title:       'Follow-up due',
          description: payload?.note ?? 'Scheduled follow-up',
          actorType:   'system',
          metadata:    payload ?? {},
        },
      });
      return `✅ Follow-up logged for ${leadId}`;
    }

    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}

// ── Bulk schedule with 2-min stagger ─────────────────────────────────────────

export async function scheduleBulkFollowUps(
  organizationId: string,
  agentId:        string,
  leadIds?:       string[]
): Promise<number> {
  const query: any = {
    organizationId,
    phone:  { not: null },
  };

  if (Array.isArray(leadIds) && leadIds.length > 0) {
    query.id = { in: leadIds };
  } else {
    query.assignedToId = { not: null };
    query.status       = { in: ['NEW', 'CONTACTED', 'ENGAGED'] };
  }

  const leads = await prisma.lead.findMany({
    where: query,
    take: 50,
  });

  let scheduled = 0;
  const now     = new Date();
  const startDelayMs = 2 * 60 * 1000; // schedule after 2 minutes
  const intervalMs   = 1 * 60 * 1000; // 1 minute apart

  for (let i = 0; i < leads.length; i++) {
    const scheduledFor = new Date(now.getTime() + startDelayMs + i * intervalMs);
    await scheduleJob({
      type:    'CALL',
      leadId:  leads[i].id,
      agentId,
      scheduledFor,
      payload: { source: 'bulk_follow_up', phone: leads[i].phone },
    });
    scheduled++;
  }

  return scheduled;
}

export async function scheduleFollowUp(
  leadId:     string,
  agentId:    string,
  delayHours: number = 24
): Promise<string> {
  return scheduleJob({
    type:        'CALL',
    leadId,
    agentId,
    scheduledFor: new Date(Date.now() + delayHours * 60 * 60 * 1000),
  });
}

export { resetDailyLeadCounts } from '@/lib/assignment/engine';