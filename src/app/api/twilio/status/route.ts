// PATH: src/app/api/twilio/status/route.ts
// Twilio status callback: terminal states, CallLog, CallQueue retry, conversation close.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function mapCallStatus(twilio: string): 'COMPLETED' | 'BUSY' | 'NO_ANSWER' | 'FAILED' | 'CANCELLED' {
  switch (twilio) {
    case 'completed':
      return 'COMPLETED';
    case 'busy':
      return 'BUSY';
    case 'no-answer':
      return 'NO_ANSWER';
    case 'canceled':
      return 'CANCELLED';
    case 'failed':
      return 'FAILED';
    default:
      return 'FAILED';
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const callSid = (form.get('CallSid') as string) || '';
    const callStatus = (form.get('CallStatus') as string) || '';
    const duration = parseInt((form.get('CallDuration') as string) || '0', 10);

    const { searchParams } = new URL(request.url);
    const callQueueId = searchParams.get('callQueueId') || '';
    const leadId = searchParams.get('leadId') || '';
    const patientId = searchParams.get('patientId') || '';

    console.log(`[Status] ${callSid} → ${callStatus} (${duration}s)`);

    if (!['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(callStatus)) {
      return new NextResponse('OK');
    }

    const isSuccess = callStatus === 'completed' && duration > 5;
    const dbStatus = mapCallStatus(callStatus);

    await prisma.callLog
      .updateMany({
        where: { callSid },
        data: {
          status: dbStatus,
          outcome: isSuccess
            ? 'INTERESTED'
            : callStatus === 'busy'
              ? 'CALLBACK_REQUESTED'
              : 'NO_OUTCOME',
          duration: duration || null,
          endedAt: new Date(),
        },
      })
      .catch(() => null);

    if (callQueueId) {
      const queueItem = await prisma.callQueue.findUnique({ where: { id: callQueueId } });

      if (queueItem) {
        const shouldRetry =
          ['busy', 'no-answer'].includes(callStatus) && queueItem.attempts < queueItem.maxAttempts;

        await prisma.callQueue
          .update({
            where: { id: callQueueId },
            data: {
              status: shouldRetry ? 'QUEUED' : callStatus === 'completed' ? 'COMPLETED' : 'FAILED',
              completedAt: shouldRetry ? undefined : new Date(),
              scheduledFor: shouldRetry ? new Date(Date.now() + 2 * 60 * 60 * 1000) : undefined,
            },
          })
          .catch(() => null);
      }
    }

    if (leadId) {
      await prisma.lead
        .update({
          where: { id: leadId },
          data: {
            lastCallAt: new Date(),
            lastCallOutcome: isSuccess ? 'INTERESTED' : 'NO_OUTCOME',
          },
        })
        .catch(() => null);

      await prisma.activity
        .create({
          data: {
            leadId,
            type: `call_${callStatus}`,
            title: `Call ${callStatus}`,
            description: `Duration: ${duration}s`,
            actorType: 'system',
            metadata: { callSid, callStatus, duration },
          },
        })
        .catch(() => null);
    }

    if (patientId) {
      await prisma.patient
        .update({
          where: { id: patientId },
          data: {
            lastCallAt: new Date(),
            lastCallOutcome: isSuccess ? 'INTERESTED' : 'NO_OUTCOME',
          },
        })
        .catch(() => null);

      await prisma.activity
        .create({
          data: {
            patientId,
            type: `call_${callStatus}`,
            title: `Call ${callStatus}`,
            description: `Duration: ${duration}s`,
            actorType: 'system',
            metadata: { callSid, callStatus, duration },
          },
        })
        .catch(() => null);
    }

    await prisma.conversation
      .updateMany({
        where: { twilioCallSid: callSid },
        data: { status: 'CLOSED', endedAt: new Date(), callDuration: duration || 0 },
      })
      .catch(() => null);

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('[Status]', err);
    return new NextResponse('OK', { status: 200 });
  }
}
