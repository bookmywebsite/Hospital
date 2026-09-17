import { Queue, QueueEvents } from 'bullmq';
import { getRedisConnection } from './redis';
import { prisma } from '@/lib/prisma';

const QUEUE_NAME = 'outbound-calls';

export interface OutboundCallJobData {
  callQueueId: string;
  leadId:      string;
  agentId:     string;
  phoneNumber: string;
  language:    string;
  priority:    number;
  attempt:     number;
}

export const outboundCallQueue = new Queue<OutboundCallJobData>(QUEUE_NAME, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: 'exponential', delay: 60000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail:     { age: 7 * 24 * 3600 },
  },
});

export const queueEvents = new QueueEvents(QUEUE_NAME, {
  connection: getRedisConnection(),
});

export async function addCallToQueue(params: {
  leadId:        string;
  agentId:       string;
  scheduledFor?: Date;
  priority?:     number;
  language?:     string;
}): Promise<string> {
  const { leadId, agentId, scheduledFor, priority = 5, language = 'EN' } = params;

  // Only use fields that exist in current schema
  const lead = await prisma.lead.findUnique({
    where:  { id: leadId },
    select: { id: true, phone: true },
  });

  if (!lead)       throw new Error(`Lead not found: ${leadId}`);
  if (!lead.phone) throw new Error(`Lead has no phone number: ${leadId}`);

  const agent = await prisma.agent.findUnique({
    where:  { id: agentId },
    select: { id: true, organizationId: true },
  });
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  // Log to Activity table (works with existing schema)
  const activity = await prisma.activity.create({
    data: {
      leadId,
      type:        'call_queued',
      title:       'Added to auto-dialer queue',
      description: `Phone: ${lead.phone} | Language: ${language}`,
      actorType:   'system',
      actorId:     agentId,
      metadata: {
        agentId,
        phoneNumber:  lead.phone,
        language,
        priority,
        scheduledFor: scheduledFor?.toISOString() ?? new Date().toISOString(),
        status:       'QUEUED',
      },
    },
  });

  const delay = scheduledFor ? Math.max(0, scheduledFor.getTime() - Date.now()) : 0;

  const job = await outboundCallQueue.add(
    'make-call',
    {
      callQueueId: activity.id,
      leadId,
      agentId,
      phoneNumber: lead.phone,
      language,
      priority,
      attempt:     1,
    },
    { delay, priority, jobId: activity.id }
  );

  console.log(`Call queued: ${job.id} for lead ${leadId}`);
  return activity.id;
}

export async function addBulkCallsToQueue(params: {
  leadIds:          string[];
  agentId:          string;
  startTime?:       Date;
  intervalMinutes?: number;
  language?:        string;
}): Promise<string[]> {
  const { leadIds, agentId, startTime, intervalMinutes = 2, language = 'EN' } = params;
  const queueIds: string[] = [];

  for (let i = 0; i < leadIds.length; i++) {
    const scheduledFor = startTime
      ? new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000)
      : undefined;
    try {
      const queueId = await addCallToQueue({
        leadId: leadIds[i],
        agentId,
        scheduledFor,
        language,
      });
      queueIds.push(queueId);
    } catch (err: any) {
      console.warn(`Skipping lead ${leadIds[i]}: ${err.message}`);
    }
  }

  return queueIds;
}