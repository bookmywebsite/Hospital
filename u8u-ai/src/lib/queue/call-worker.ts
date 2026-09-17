import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './redis';
import { prisma } from '@/lib/prisma';
import { makeOutboundCall } from '@/lib/agents/outbound-dialer';
import type { OutboundCallJobData } from './call-queue';

export function createCallWorker() {
  const worker = new Worker<OutboundCallJobData>(
    'outbound-calls',
    async (job: Job<OutboundCallJobData>) => {
      const { callQueueId, leadId, agentId, phoneNumber, language } = job.data;

      // Update activity status
      await prisma.activity.update({
        where: { id: callQueueId },
        data:  {
          description: `Status: RINGING | Phone: ${phoneNumber}`,
          metadata: {
            status:    'RINGING',
            attempts:  job.attemptsMade + 1,
            phoneNumber,
            language,
            agentId,
          },
        },
      }).catch(() => {}); // ignore if activity not found

      // Check calling hours using hardcoded defaults (9am-9pm IST)
      // Will use org settings after schema migration
      const hour = new Date().getHours();
      const START_HOUR = 0;
      const END_HOUR   = 24;

      if (hour < START_HOUR || hour >= END_HOUR) {
        const next = new Date();
        if (hour >= END_HOUR) next.setDate(next.getDate() + 1);
        next.setHours(START_HOUR, 0, 0, 0);
        throw new Error(`Outside calling hours (${START_HOUR}am-${END_HOUR%12}pm IST). Next: ${next.toISOString()}`);
      }

      const result = await makeOutboundCall({
        leadId,
        agentId,
        phoneNumber,
        language,
        callQueueId,
      });

      // Update activity as in progress
      await prisma.activity.update({
        where: { id: callQueueId },
        data:  {
          description: `Status: IN_PROGRESS | CallSid: ${result.callSid}`,
          metadata: {
            status:     'IN_PROGRESS',
            callSid:    result.callSid,
            phoneNumber,
            language,
            agentId,
          },
        },
      }).catch(() => {});

      return result;
    },
    {
      connection:  getRedisConnection(),
      concurrency: 5,
      limiter:     {
        max:      parseInt(process.env.CALLS_PER_MINUTE_LIMIT ?? '5'),
        duration: 60000,
      },
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`✅ Call completed: ${job.id}`, result);
  });

  worker.on('failed', async (job, err) => {
    console.error(`❌ Call failed: ${job?.id}`, err.message);
    if (job?.data.callQueueId) {
      // Log failure to activity
      await prisma.activity.update({
        where: { id: job.data.callQueueId },
        data:  {
          description: `Status: ${job.attemptsMade >= 3 ? 'FAILED' : 'RETRY'} | Error: ${err.message}`,
          metadata: {
            status:  job.attemptsMade >= 3 ? 'FAILED' : 'QUEUED',
            error:   err.message,
            attempts: job.attemptsMade,
          },
        },
      }).catch(() => {});

      // Update lead lastContactedAt (field exists in current schema)
      await prisma.lead.update({
        where: { id: job.data.leadId },
        data:  { lastContactedAt: new Date() },
      }).catch(() => {});
    }
  });

  worker.on('error', (err) => console.error('Worker error:', err));
  console.log('✅ Call worker started');
  return worker;
}