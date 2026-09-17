// PATH: src/app/api/dialer/process/route.ts
// Vercel cron: dequeue CallQueue, place Twilio outbound calls (IST9–21).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { makeOutboundCall } from '@/lib/communications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL!;
const MAX_CONCURRENT = parseInt(process.env.MAX_PARALLEL_CALLS || '5', 10);

function isCallingHours(): boolean {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hour = ist.getHours();
  return hour >= 9 && hour < 21;
}

function normalizeTwilioLang(lang: string): string {
  if (lang.includes('-')) return lang;
  const m: Record<string, string> = {
    EN: 'en-IN',
    HI: 'hi-IN',
    KN: 'kn-IN',
    TA: 'ta-IN',
    TE: 'te-IN',
    ML: 'ml-IN',
    MR: 'mr-IN',
    BN: 'bn-IN',
    GU: 'gu-IN',
    PA: 'pa-IN',
    OR: 'or-IN',
  };
  return m[lang.toUpperCase()] ?? 'en-IN';
}

export async function GET() {
  const [queued, active, completed, failed] = await Promise.all([
    prisma.callQueue.count({ where: { status: 'QUEUED' } }),
    prisma.callQueue.count({ where: { status: { in: ['RINGING', 'IN_PROGRESS'] } } }),
    prisma.callQueue.count({ where: { status: 'COMPLETED' } }),
    prisma.callQueue.count({ where: { status: 'FAILED' } }),
  ]);
  return NextResponse.json({ queued, active, completed, failed, isCallingHours: isCallingHours() });
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev && cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isCallingHours()) {
    return NextResponse.json({ message: 'Outside calling hours (9am-9pm IST)', processed: 0 });
  }

  const activeCalls = await prisma.callQueue.count({
    where: { status: { in: ['RINGING', 'IN_PROGRESS'] } },
  });
  const slots = Math.max(0, MAX_CONCURRENT - activeCalls);
  if (slots === 0) return NextResponse.json({ message: 'All slots busy', processed: 0 });

  const dueItems = await prisma.callQueue.findMany({
    where: {
      status: 'QUEUED',
      scheduledFor: { lte: new Date() },
      attempts: { lt: 3 },
    },
    include: {
      lead: {
        select: { id: true, phone: true, firstName: true, doNotCall: true, preferredLanguage: true },
      },
      patient: {
        select: { id: true, phone: true, firstName: true, doNotContact: true, preferredLanguage: true },
      },
    },
    orderBy: [{ priority: 'asc' }, { scheduledFor: 'asc' }],
    take: slots,
  });

  let processed = 0;
  let failed = 0;

  for (const item of dueItems) {
    const phoneRaw = item.patient?.phone || item.lead?.phone;
    const dnd = item.patient?.doNotContact || item.lead?.doNotCall;

    if (!phoneRaw || dnd) {
      await prisma.callQueue
        .update({ where: { id: item.id }, data: { status: 'CANCELLED', completedAt: new Date() } })
        .catch(() => null);
      continue;
    }

    try {
      await prisma.callQueue.update({
        where: { id: item.id },
        data: { status: 'RINGING', attempts: { increment: 1 }, lastAttemptAt: new Date() },
      });

      let phone = phoneRaw.replace(/\D/g, '');
      if (phone.length === 10) phone = '+91' + phone;
      else if (!phone.startsWith('+')) phone = '+' + phone;

      const prefLang = item.patient?.preferredLanguage || item.lead?.preferredLanguage || 'en-IN';
      const lang = normalizeTwilioLang(item.language || prefLang);
      const purpose = item.notes || 'missed_call_followup';

      const voiceParams = new URLSearchParams({
        agentId: item.agentId,
        callType: 'outbound',
        purpose,
        language: lang,
      });
      if (item.leadId) voiceParams.set('leadId', item.leadId);
      if (item.patientId) voiceParams.set('patientId', item.patientId);

      const statusParams = new URLSearchParams({ callQueueId: item.id });
      if (item.leadId) statusParams.set('leadId', item.leadId);
      if (item.patientId) statusParams.set('patientId', item.patientId);

      const callResult = await makeOutboundCall({
        to: phone,
        url: `${BASE_URL}/api/twilio/voice?${voiceParams.toString()}`,
        statusCallback: `${BASE_URL}/api/twilio/status?${statusParams.toString()}`,
        statusCallbackMethod: 'POST',
        timeout: 30,
      });

      if (!callResult.success) {
        throw new Error(callResult.error || 'Failed to initiate outbound dialer call');
      }

      const updates: Promise<unknown>[] = [
        prisma.callQueue.update({ where: { id: item.id }, data: { callSid: callResult.callSid, status: 'IN_PROGRESS' } }),
      ];

      if (item.leadId) {
        updates.push(
          prisma.lead.update({
            where: { id: item.leadId },
            data: {
              lastContactedAt: new Date(),
              lastCallAt: new Date(),
              totalCalls: { increment: 1 },
              status: 'CONTACTED',
            },
          }),
        );
        updates.push(
          prisma.activity.create({
            data: {
              leadId: item.leadId,
              type: 'outbound_call_initiated',
              title: `Outbound call — ${purpose.replace(/_/g, ' ')}`,
              description: `Calling ${phone}`,
              actorType: 'agent',
              actorId: item.agentId,
              metadata: { callSid: callResult.callSid, phone, lang, purpose },
            },
          }),
        );
      }

      if (item.patientId) {
        updates.push(
          prisma.patient.update({
            where: { id: item.patientId },
            data: {
              lastContactedAt: new Date(),
              lastCallAt: new Date(),
              totalCalls: { increment: 1 },
              patientStatus: 'CONTACTED',
            },
          }),
        );
        updates.push(
          prisma.activity.create({
            data: {
              patientId: item.patientId,
              type: 'outbound_call_initiated',
              title: `Outbound call — ${purpose.replace(/_/g, ' ')}`,
              description: `Calling ${phone}`,
              actorType: 'agent',
              actorId: item.agentId,
              metadata: { callSid: callResult.callSid, phone, lang, purpose },
            },
          }),
        );
      }

      Promise.all(updates).catch((e) => console.error('[Dialer] DB update:', e));

      processed++;
      console.log(`[Dialer] Called ${phone} | ${callResult.callSid}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Dialer] Failed ${phoneRaw}:`, msg);
      failed++;

      const att = (item.attempts || 0) + 1;
      await prisma.callQueue
        .update({
          where: { id: item.id },
          data: {
            status: att >= 3 ? 'FAILED' : 'QUEUED',
            scheduledFor: att < 3 ? new Date(Date.now() + 30 * 60 * 1000) : undefined,
          },
        })
        .catch(() => null);
    }
  }

  return NextResponse.json({ success: true, processed, failed, slots: slots - processed });
}
