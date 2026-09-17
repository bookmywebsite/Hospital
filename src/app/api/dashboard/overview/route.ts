// @ts-nocheck
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// ─── Cache ────────────────────────────────────────────────────────────────────
type CachedDashboardPayload = {
  expiresAt: number;
  payload: unknown;
};

const globalForCache = globalThis as unknown as {
  overviewDashboardCache?: Map<string, CachedDashboardPayload>;
};

if (!globalForCache.overviewDashboardCache) {
  globalForCache.overviewDashboardCache = new Map();
}

const CACHE_TTL_MS = 30000; // 30 seconds

// ─── Date helpers ────────────────────────────────────────────────────────────
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function fmtTimeOnly(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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
function bucketLabel(hour24: number) {
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

// ─── Data fetcher ────────────────────────────────────────────────────────────
async function getOverviewData(orgId: string) {
  const today0 = startOfDay();
  const today1 = endOfDay();
  const month0 = startOfMonth(today0);

  const todayMetrics = await prisma.dailyMetrics.findUnique({
    where: { organizationId_date: { organizationId: orgId, date: today0 } },
  }).catch(() => null);

  const [
    todaysPatients,
    todaysAppointments,
    newPatientsThisMonth,
    totalAppointmentsAllTime,
    upcomingAppointmentsAllTime,
    pastAppointmentsAllTime,
    totalPatients,
    returningPatients,
    appointmentsPendingAllTime,
    appointmentsConfirmedAllTime,
    appointmentsNoShowAllTime,
    todaysReminders,
    todaysConversationsActiveCount,
    callStats,
    departments,
    recentPatients,
    appointmentsConfirmedCount,
    revenueResult,
    callBucketsRows,
    agents,
    aiAgentMetrics,
  ] = await Promise.all([
    prisma.patient.count({ where: { organizationId: orgId, createdAt: { gte: today0, lte: today1 } } }).catch(() => 0),
    prisma.appointment.count({ where: { organizationId: orgId, scheduledAt: { gte: today0, lte: today1 } } }).catch(() => 0),
    prisma.patient.count({ where: { organizationId: orgId, createdAt: { gte: month0, lte: today1 } } }).catch(() => 0),
    prisma.appointment.count({ where: { organizationId: orgId } }).catch(() => 0),
    prisma.appointment.count({ where: { organizationId: orgId, scheduledAt: { gte: today0 } } }).catch(() => 0),
    prisma.appointment.count({ where: { organizationId: orgId, scheduledAt: { lt: today0 } } }).catch(() => 0),
    prisma.patient.count({ where: { organizationId: orgId } }).catch(() => 0),
    prisma.patient.count({ where: { organizationId: orgId, totalVisits: { gt: 1 } } }).catch(() => 0),
    prisma.appointment.count({ where: { organizationId: orgId, status: { in: ['SCHEDULED', 'RESCHEDULED'] as any } } }).catch(() => 0),
    prisma.appointment.count({ where: { organizationId: orgId, status: 'CONFIRMED' } }).catch(() => 0),
    prisma.appointment.count({ where: { organizationId: orgId, status: 'NO_SHOW' } }).catch(() => 0),
    prisma.reminderLog.findMany({
      where: { appointment: { organizationId: orgId }, createdAt: { gte: today0, lte: today1 } },
      select: { channel: true, status: true },
      take: 100,
    }).catch(() => []),
    prisma.conversation.count({
      where: { organizationId: orgId, startedAt: { gte: today0, lte: today1 }, status: 'ACTIVE', channel: { in: ['CHAT', 'WHATSAPP'] } },
    }).catch(() => 0),
    prisma.$queryRaw<Array<{ inbound: number; outbound: number; missed: number; booked: number; callbacks: number; completed: number }>>`
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
    prisma.department.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { totalLeads: 'desc' },
      take: 6,
      select: { name: true, totalLeads: true, totalBookings: true, totalRevenue: true },
    }).catch(() => []),
    prisma.patient.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true, fullName: true, firstName: true, lastName: true, phone: true,
        email: true, source: true, intent: true, tier: true, patientStatus: true,
        createdAt: true, department: { select: { name: true } },
      },
    }).catch(() => []),
    prisma.appointment.count({
      where: { organizationId: orgId, scheduledAt: { gte: today0, lte: today1 }, status: 'CONFIRMED' },
    }).catch(() => 0),
    prisma.appointment.aggregate({
      where: { organizationId: orgId, scheduledAt: { gte: today0, lte: today1 }, billingAmount: { not: null } },
      _sum: { billingAmount: true },
    }).then((r) => r._sum.billingAmount ?? 0).catch(() => 0),
    prisma.$queryRaw<Array<{ hour: number; inbound: number; outbound: number; missed: number; booked: number }>>`
      SELECT
        EXTRACT(HOUR FROM "startedAt")::int AS hour,
        SUM(CASE WHEN "direction" = 'INBOUND' THEN 1 ELSE 0 END)::int AS inbound,
        SUM(CASE WHEN "direction" = 'OUTBOUND' THEN 1 ELSE 0 END)::int AS outbound,
        SUM(CASE WHEN "status" IN ('NO_ANSWER','BUSY','FAILED','CANCELLED') THEN 1 ELSE 0 END)::int AS missed,
        SUM(CASE WHEN "outcome" = 'APPOINTMENT_BOOKED' THEN 1 ELSE 0 END)::int AS booked
      FROM "CallLog"
      WHERE "startedAt" >= ${today0} AND "startedAt" <= ${today1}
      GROUP BY EXTRACT(HOUR FROM "startedAt")
    `.catch(() => []),
    prisma.agent.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, agentType: true, callsToday: true, bookedToday: true, conversionRate: true, updatedAt: true },
      take: 8,
    }).catch(() => []),
    prisma.aIAgentMetrics.findMany({
      where: { organizationId: orgId, date: today0 },
      select: { agentId: true, callsOrChats: true, booked: true },
      take: 8,
    }).catch(() => []),
  ]);

  const cs0 = callStats?.[0] ?? { inbound: 0, outbound: 0, missed: 0, booked: 0, callbacks: 0, completed: 0 };
  const inboundCalls = cs0.inbound ?? 0;
  const outboundCalls = cs0.outbound ?? 0;
  const missedCalls = cs0.missed ?? 0;
  const callbacksDone = cs0.callbacks ?? 0;
  const activeChats = todayMetrics?.activeChats ?? todaysConversationsActiveCount;
  const revenueToday = revenueResult;
  const todayLeads = todayMetrics?.totalLeads ?? todaysPatients;
  const appointmentsConfirmed = todayMetrics?.appointmentsConfirmed ?? appointmentsConfirmedCount;
  const conversionRate = todayMetrics?.conversionRate ??
    (todayLeads > 0 ? Number(((appointmentsConfirmed / todayLeads) * 100).toFixed(1)) : 0);

  const remindersByChannel = todaysReminders.reduce((acc, r) => {
    const key = r.channel;
    if (!acc[key]) acc[key] = { sent: 0, delivered: 0 };
    acc[key].sent += 1;
    if (r.status === 'DELIVERED') acc[key].delivered += 1;
    return acc;
  }, {} as Record<string, { sent: number; delivered: number }>);

  const stats = {
    totalPatients, patientsGrowth: 0, todayLeads, leadGrowth: 0,
    appointmentsToday: todayMetrics?.appointmentsScheduled ?? todaysAppointments,
    appointmentsBooked: appointmentsConfirmed, newPatientsThisMonth, returningPatients,
    totalAppointmentsAllTime, upcomingAppointmentsAllTime, pastAppointmentsAllTime,
    appointmentsPendingAllTime, appointmentsConfirmedAllTime,
    callsToday: todayMetrics?.callsTotal ?? (inboundCalls + outboundCalls),
    callsAnswered: todayMetrics?.callsAnswered ?? (cs0.completed ?? 0),
    missedCalls: todayMetrics?.callsMissed ?? missedCalls,
    callbacksDone: todayMetrics?.callbacksDone ?? callbacksDone,
    whatsappSent: todayMetrics?.whatsappSent ?? (remindersByChannel['WHATSAPP']?.sent ?? 0),
    whatsappDelivered: todayMetrics?.whatsappDelivered ?? (remindersByChannel['WHATSAPP']?.delivered ?? 0),
    conversionRate, avgResponseTime: todayMetrics?.avgResponseTimeSec ?? 0,
    satisfaction: todayMetrics?.satisfactionScore ?? 0, aiAccuracy: todayMetrics?.aiAccuracy ?? 0,
    revenueToday, monthlyRevenue: todayMetrics?.monthlyRevenue ?? 0,
    chatbotLeads: todayMetrics?.chatbotLeads ?? 0,
    voiceLeads: todayMetrics?.voiceLeads ?? inboundCalls,
    whatsappLeads: todayMetrics?.whatsappLeads ?? 0,
  };

  // Source pie
  const sourceCounts = todayMetrics
    ? { chat: todayMetrics.chatbotLeads, whatsapp: todayMetrics.whatsappLeads, voice: todayMetrics.voiceLeads, outbound: todayMetrics.outboundLeads, direct: todayMetrics.directLeads }
    : await prisma.patient.findMany({ where: { organizationId: orgId, createdAt: { gte: today0, lte: today1 } }, select: { source: true }, take: 2000 })
        .then((rows) => {
          const c = { chat: 0, whatsapp: 0, voice: 0, outbound: 0, direct: 0 };
          for (const r of rows) {
            const s = (r.source ?? '').toLowerCase();
            if (s.includes('whatsapp') || s === 'wa') c.whatsapp += 1;
            else if (s.includes('voice') || s.includes('call')) c.voice += 1;
            else if (s.includes('outbound')) c.outbound += 1;
            else if (s.includes('chat') || s.includes('bot') || s.includes('website')) c.chat += 1;
            else c.direct += 1;
          }
          return c;
        }).catch(() => ({ chat: 0, whatsapp: 0, voice: 0, outbound: 0, direct: 0 }));

  const sourceTotal = Math.max(1, sourceCounts.chat + sourceCounts.whatsapp + sourceCounts.voice + sourceCounts.outbound + sourceCounts.direct);
  const sourceData = [
    { name: 'Website Chat', value: Math.round((sourceCounts.chat / sourceTotal) * 100), color: '#00c4ff', count: sourceCounts.chat },
    { name: 'WhatsApp AI', value: Math.round((sourceCounts.whatsapp / sourceTotal) * 100), color: '#00e5a0', count: sourceCounts.whatsapp },
    { name: 'Voice Inbound', value: Math.round((sourceCounts.voice / sourceTotal) * 100), color: '#a78bfa', count: sourceCounts.voice },
    { name: 'Outbound Call', value: Math.round((sourceCounts.outbound / sourceTotal) * 100), color: '#ffb347', count: sourceCounts.outbound },
    { name: 'Direct', value: Math.max(0, 100 - (Math.round((sourceCounts.chat / sourceTotal) * 100) + Math.round((sourceCounts.whatsapp / sourceTotal) * 100) + Math.round((sourceCounts.voice / sourceTotal) * 100) + Math.round((sourceCounts.outbound / sourceTotal) * 100))), color: '#5a7a9a', count: sourceCounts.direct },
  ];

  const weeklyData = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(today0);
    d.setDate(d.getDate() - (6 - idx));
    return {
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      leads: idx === 6 ? todaysPatients : 0,
      appointments: idx === 6 ? appointmentsConfirmed : 0,
      conversions: idx === 6 ? Math.round(conversionRate) : 0,
      revenue: idx === 6 ? Math.round((revenueToday ?? 0) / 100) : 0,
    };
  });

  const deptData = departments.map((d) => ({ dept: d.name, leads: d.totalLeads, bookings: d.totalBookings, revenue: d.totalRevenue }));

  const recentLeads = recentPatients.slice(0, 12).map((p) => {
    const name = p.fullName || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Unknown';
    return {
      id: p.id, name, phone: p.phone ?? '—',
      source: (p.source ?? 'direct').toLowerCase(),
      intent: (p.intent ?? 'enquiry').toLowerCase(),
      dept: p.department?.name ?? 'General',
      priority: (p.tier ?? 'WARM').toString().toLowerCase() === 'hot' ? 'hot' : 'warm',
      status: (p.patientStatus ?? 'NEW').toString().toLowerCase(),
      time: fmtTimeOnly(p.createdAt),
    };
  });

  const hours = [9, 10, 11, 12, 13, 14, 15, 16];
  const bucketMap: Record<number, { inbound: number; outbound: number; missed: number; booked: number }> = {};
  for (const h of hours) bucketMap[h] = { inbound: 0, outbound: 0, missed: 0, booked: 0 };
  for (const r of callBucketsRows) {
    if (!bucketMap[r.hour]) continue;
    bucketMap[r.hour] = { inbound: r.inbound, outbound: r.outbound, missed: r.missed, booked: r.booked };
  }
  const callData = hours.map((h) => ({ time: bucketLabel(h), ...bucketMap[h] }));

  const aiAgentsRaw = aiAgentMetrics.length > 0 ? aiAgentMetrics : agents.map((a) => ({
    agent: { id: a.id, name: a.name, agentType: a.agentType, isActive: true, updatedAt: a.updatedAt },
    callsOrChats: a.callsToday ?? 0, booked: a.bookedToday ?? 0, conversionRate: a.conversionRate ?? 0,
  })) as any[];

  const aiAgents = aiAgentsRaw.slice(0, 8).map((m: any, idx: number) => ({
    id: idx + 1, name: m.agent?.name ?? 'AI Agent',
    type: m.agent?.agentType === 'RECEPTION' ? 'inbound' : m.agent?.agentType === 'FOLLOW_UP' ? 'outbound' : 'chat',
    status: m.agent?.isActive ?? true ? 'active' : 'paused',
    callsToday: m.callsOrChats ?? 0, booked: m.booked ?? 0,
    conv: Math.round(m.conversionRate ?? 0), last: toRelative(m.agent?.updatedAt),
  }));

  return { stats, sourceData, weeklyData, deptData, recentLeads, callData, aiAgents };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const apiStartTime = Date.now();

  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const orgId = user.organizationId;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    const cacheKey = `${orgId}:overview:${startOfDay().toISOString().slice(0, 10)}`;

    // Cache check
    if (!forceRefresh) {
      const cached = globalForCache.overviewDashboardCache?.get(cacheKey);
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
    const payload = await getOverviewData(orgId);

    // Cache result
    globalForCache.overviewDashboardCache?.set(cacheKey, {
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
    console.error('[Overview Dashboard API] Error:', { error, duration_ms: totalDuration });
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500, headers: { 'X-Response-Time': `${totalDuration}ms` } }
    );
  }
}
