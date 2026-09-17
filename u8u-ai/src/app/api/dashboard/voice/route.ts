// @ts-nocheck
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// ─── Date helpers ────────────────────────────────────────────────────────────
function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
function bucketLabel(hour24: number) {
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12} ${hour24 < 12 ? 'AM' : 'PM'}`;
}
function toRelative(d?: Date | null) {
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// ─── Cache ────────────────────────────────────────────────────────────────────
type CachedDashboardPayload = {
  expiresAt: number;
  payload: unknown;
};

const globalForCache = globalThis as unknown as {
  voiceDashboardCache?: Map<string, CachedDashboardPayload>;
};

if (!globalForCache.voiceDashboardCache) {
  globalForCache.voiceDashboardCache = new Map();
}

const CACHE_TTL_MS = 30000; // 30 seconds

// ─── Data fetcher ────────────────────────────────────────────────────────────
async function getVoiceData(orgId: string) {
  const today0 = startOfDay();
  const today1 = endOfDay();

  const todayMetrics = await prisma.dailyMetrics.findUnique({
    where: { organizationId_date: { organizationId: orgId, date: today0 } },
  }).catch(() => null);

  const [
    callStats,
    callBucketsRows,
    agents,
    aiAgentMetrics,
    liveQueue,
    inboundScenarioRows,
    outboundScenarioRows,
  ] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        inbound: number;
        outbound: number;
        missed: number;
        booked: number;
        callbacks: number;
        completed: number;
      }>
    >`
      SELECT
        SUM(CASE WHEN cl."direction" = 'INBOUND' THEN 1 ELSE 0 END)::int AS inbound,
        SUM(CASE WHEN cl."direction" = 'OUTBOUND' THEN 1 ELSE 0 END)::int AS outbound,
        SUM(CASE WHEN cl."status" IN ('NO_ANSWER','BUSY','FAILED','CANCELLED') THEN 1 ELSE 0 END)::int AS missed,
        SUM(CASE WHEN cl."outcome" = 'APPOINTMENT_BOOKED' THEN 1 ELSE 0 END)::int AS booked,
        SUM(CASE WHEN cl."isMissedCallback" = true THEN 1 ELSE 0 END)::int AS callbacks,
        SUM(CASE WHEN cl."status" = 'COMPLETED' THEN 1 ELSE 0 END)::int AS completed
      FROM "CallLog" cl
      LEFT JOIN "Patient" p ON p."id" = cl."patientId"
      LEFT JOIN "Lead" l ON l."id" = cl."leadId"
      WHERE cl."startedAt" >= ${today0} AND cl."startedAt" <= ${today1}
        AND (p."organizationId" = ${orgId} OR l."organizationId" = ${orgId});
    `.catch(() => []),
    prisma.$queryRaw<
      Array<{
        hour: number;
        inbound: number;
        outbound: number;
        missed: number;
        booked: number;
      }>
    >`
      SELECT
        EXTRACT(HOUR FROM cl."startedAt")::int AS hour,
        SUM(CASE WHEN cl."direction" = 'INBOUND' THEN 1 ELSE 0 END)::int AS inbound,
        SUM(CASE WHEN cl."direction" = 'OUTBOUND' THEN 1 ELSE 0 END)::int AS outbound,
        SUM(CASE WHEN cl."status" IN ('NO_ANSWER','BUSY','FAILED','CANCELLED') THEN 1 ELSE 0 END)::int AS missed,
        SUM(CASE WHEN cl."outcome" = 'APPOINTMENT_BOOKED' THEN 1 ELSE 0 END)::int AS booked
      FROM "CallLog" cl
      LEFT JOIN "Patient" p ON p."id" = cl."patientId"
      LEFT JOIN "Lead" l ON l."id" = cl."leadId"
      WHERE cl."startedAt" >= ${today0} AND cl."startedAt" <= ${today1}
        AND (p."organizationId" = ${orgId} OR l."organizationId" = ${orgId})
      GROUP BY 1 ORDER BY 1;
    `.catch(() => []),
    prisma.agent.findMany({
      where: { organizationId: orgId, isActive: true },
      select: {
        id: true,
        name: true,
        agentType: true,
        callsToday: true,
        bookedToday: true,
        conversionRate: true,
        updatedAt: true,
      },
      take: 8,
    }).catch(() => []),
    prisma.aIAgentMetrics.findMany({
      where: { organizationId: orgId, date: today0 },
      select: { agentId: true, callsOrChats: true, booked: true },
      take: 8,
    }).catch(() => []),
    prisma.callQueue.findMany({
      where: { organizationId: orgId, scheduledFor: { gte: today0, lte: today1 } },
      orderBy: [{ status: 'asc' }, { scheduledFor: 'asc' }],
      take: 10,
      select: {
        id: true,
        status: true,
        scheduledFor: true,
        priority: true,
        patient: {
          select: {
            fullName: true,
            firstName: true,
            lastName: true,
            phone: true,
            department: { select: { name: true } },
          },
        },
        lead: { select: { firstName: true, lastName: true, email: true, phone: true } },
        agent: { select: { name: true } },
      },
    }).catch(() => []),
    prisma.activity.findMany({
      where: {
        createdAt: { gte: today0, lte: today1 },
        type: { startsWith: 'voice_' },
        OR: [{ lead: { organizationId: orgId } }, { patient: { organizationId: orgId } }],
      },
      select: { type: true, metadata: true },
      take: 2000,
    }).catch(() => []),
    prisma.callQueue.findMany({
      where: {
        organizationId: orgId,
        attempts: { gt: 0 },
        lastAttemptAt: { gte: today0, lte: today1 },
      },
      select: { notes: true },
      take: 2000,
    }).catch(() => []),
  ]);

  const cs0 = callStats?.[0] ?? {
    inbound: 0,
    outbound: 0,
    missed: 0,
    booked: 0,
    callbacks: 0,
    completed: 0,
  };
  const inboundCalls = cs0.inbound ?? 0;
  const outboundCalls = cs0.outbound ?? 0;
  const missedCalls = cs0.missed ?? 0;
  const bookedViaVoice = cs0.booked ?? 0;
  const callbacksDone = cs0.callbacks ?? 0;

  // Build call data by hour
  const hours = [9, 10, 11, 12, 13, 14, 15, 16];
  const bucketMap: Record<
    number,
    { inbound: number; outbound: number; missed: number; booked: number }
  > = {};
  for (const h of hours)
    bucketMap[h] = { inbound: 0, outbound: 0, missed: 0, booked: 0 };
  for (const r of callBucketsRows) {
    if (!bucketMap[r.hour]) continue;
    bucketMap[r.hour] = {
      inbound: r.inbound,
      outbound: r.outbound,
      missed: r.missed,
      booked: r.booked,
    };
  }
  const callData = hours.map((h) => ({ time: bucketLabel(h), ...bucketMap[h] }));

  // AI Agents
  const aiAgentsRaw = aiAgentMetrics.length > 0
    ? aiAgentMetrics
    : agents.map((a) => ({
        agent: {
          id: a.id,
          name: a.name,
          agentType: a.agentType,
          isActive: true,
          updatedAt: a.updatedAt,
        },
        callsOrChats: a.callsToday ?? 0,
        booked: a.bookedToday ?? 0,
        conversionRate: a.conversionRate ?? 0,
      })) as any[];

  const aiAgents = aiAgentsRaw
    .slice(0, 8)
    .map((m: any, idx: number) => ({
      id: idx + 1,
      name: m.agent?.name ?? 'AI Agent',
      type:
        m.agent?.agentType === 'RECEPTION' ? 'inbound' :
        m.agent?.agentType === 'FOLLOW_UP' ? 'outbound' : 'chat',
      status: m.agent?.isActive ?? true ? 'active' : 'paused',
      callsToday: m.callsOrChats ?? 0,
      booked: m.booked ?? 0,
      conv: Math.round(m.conversionRate ?? 0),
      last: toRelative(m.agent?.updatedAt),
    }));

  // Live queue
  const liveQueueMapped = liveQueue.map((q, idx) => {
    const patientName =
      q.patient?.fullName ||
      `${q.patient?.firstName ?? ''} ${q.patient?.lastName ?? ''}`.trim() ||
      `${q.lead?.firstName ?? ''} ${q.lead?.lastName ?? ''}`.trim() ||
      (q.lead?.email ? q.lead.email.split('@')[0] : 'Unknown');
    const st =
      q.status === 'IN_PROGRESS' ? 'in-progress' :
      q.status === 'RINGING' ? 'ringing' : 'queued';
    return {
      id: q.id,
      name: patientName,
      phone: q.patient?.phone ?? q.lead?.phone ?? '—',
      status: st,
      dept: q.patient?.department?.name ?? 'General',
      agent: q.agent?.name ?? 'AI Agent',
      pos: st === 'queued' ? idx + 1 : undefined,
    };
  });

  // Voice scenarios
  const inboundCountMap = new Map<string, number>();
  for (const row of inboundScenarioRows) {
    const meta: any = row.metadata ?? {};
    if ((meta.callType ?? '').toString().toLowerCase() !== 'inbound') continue;
    const scenario = (meta.scenario ?? row.type.replace(/^voice_/, '')).toString().toUpperCase();
    inboundCountMap.set(scenario, (inboundCountMap.get(scenario) ?? 0) + 1);
  }

  const outboundCountMap = new Map<string, number>();
  for (const row of outboundScenarioRows) {
    const purpose = (row.notes ?? 'missed_call_followup').toString().trim().toLowerCase();
    outboundCountMap.set(purpose, (outboundCountMap.get(purpose) ?? 0) + 1);
  }

  const inboundScenarioStats = [
    { key: 'CONSULTATION', label: 'Consultation Enquiry', color: '#6366f1' },
    { key: 'EMERGENCY', label: 'Emergency Case', color: '#ff4d6d' },
    { key: 'LAB_TEST', label: 'Lab Test / Scan', color: '#00e5a0' },
    { key: 'COST_ENQUIRY', label: 'Treatment Cost Enquiry', color: '#ffb347' },
    { key: 'DOCTOR_AVAILABILITY', label: 'Doctor Availability', color: '#a78bfa' },
    { key: 'INSURANCE', label: 'Insurance / Cashless', color: '#22d3ee' },
    { key: 'MATERNITY', label: 'Maternity Package', color: '#f472b6' },
    { key: 'SECOND_OPINION', label: 'Second Opinion', color: '#94a3b8' },
    { key: 'PHARMACY', label: 'Pharmacy / Medicine', color: '#f43f5e' },
    { key: 'LOCATION', label: 'Location / Directions', color: '#c084fc' },
    { key: 'RESCHEDULE', label: 'Reschedule / Cancel', color: '#fb7185' },
    { key: 'GENERAL', label: 'General Enquiry', color: '#64748b' },
  ].map((item) => ({ ...item, count: inboundCountMap.get(item.key) ?? 0 }));

  const outboundScenarioStats = [
    {
      key: 'appointment_reminder',
      label: 'Appointment Reminder',
      color: '#00e5a0',
    },
    {
      key: 'missed_call_followup',
      label: 'Missed Call Follow-up',
      color: '#6366f1',
    },
    { key: 'health_checkup_promo', label: 'Health Checkup Promo', color: '#3b82f6' },
    {
      key: 'patient_reactivation',
      label: 'Patient Reactivation',
      color: '#ffb347',
    },
    {
      key: 'test_result_followup',
      label: 'Test Result Follow-up',
      color: '#22d3ee',
    },
    { key: 'treatment_conversion', label: 'Treatment Conversion', color: '#8b5cf6' },
    { key: 'feedback_review', label: 'Feedback & Review', color: '#34d399' },
    { key: 'maternity_followup', label: 'Maternity Follow-up', color: '#f472b6' },
    { key: 'medication_reminder', label: 'Medication Reminder', color: '#94a3b8' },
    {
      key: 'post_discharge',
      label: 'Post-Discharge Follow-up',
      color: '#64748b',
    },
  ].map((item) => ({ ...item, count: outboundCountMap.get(item.key) ?? 0 }));

  return {
    callData,
    aiAgents,
    liveQueue: liveQueueMapped,
    voice: {
      inbound: todayMetrics?.callsInbound ?? inboundCalls,
      outbound: todayMetrics?.callsOutbound ?? outboundCalls,
      missed: todayMetrics?.callsMissed ?? missedCalls,
      booked: bookedViaVoice,
      avgDurationSec: todayMetrics?.avgCallDurationSec ?? 0,
      callbacks: {
        missed: todayMetrics?.callsMissed ?? missedCalls,
        done: callbacksDone,
        booked: todayMetrics?.callbacksBooked ?? 0,
      },
    },
    voiceScenarioStats: {
      inbound: inboundScenarioStats,
      outbound: outboundScenarioStats,
    },
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const apiStartTime = Date.now();

  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const orgId = user.organizationId;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    const cacheKey = `${orgId}:voice:${startOfDay().toISOString().slice(0, 10)}`;

    // Check cache
    if (!forceRefresh) {
      const cached = globalForCache.voiceDashboardCache?.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.payload, {
          headers: {
            'X-Dashboard-Cache': 'HIT',
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
            'X-Response-Time': `${Date.now() - apiStartTime}ms`,
          },
        });
      }
    }

    // Fetch data
    const payload = await getVoiceData(orgId);

    // Cache result
    globalForCache.voiceDashboardCache?.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload, {
      headers: {
        'X-Dashboard-Cache': 'MISS',
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'X-Response-Time': `${Date.now() - apiStartTime}ms`,
      },
    });
  } catch (error) {
    const totalDuration = Date.now() - apiStartTime;
    console.error('[Voice Dashboard API] Error:', { error, duration_ms: totalDuration });
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500, headers: { 'X-Response-Time': `${totalDuration}ms` } }
    );
  }
}
