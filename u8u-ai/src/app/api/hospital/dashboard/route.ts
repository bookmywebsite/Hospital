// @ts-nocheck
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

type CachedDashboardPayload = {
  expiresAt: number;
  payload: unknown;
};

const globalForDashboardCache = globalThis as unknown as {
  hospitalDashboardCache?: Map<string, CachedDashboardPayload>;
};

if (!globalForDashboardCache.hospitalDashboardCache) {
  globalForDashboardCache.hospitalDashboardCache = new Map();
}

const DASHBOARD_CACHE_TTL_MS = 30000;

// ─── Date helpers ────────────────────────────────────────────────────────────
function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
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

// ─── Section handlers ─────────────────────────────────────────────────────────

async function getOverview(orgId: string) {
  const today0 = startOfDay();
  const today1 = endOfDay();
  const month0 = startOfMonth(today0);
  const weekStart = new Date(today0);
  weekStart.setDate(weekStart.getDate() - 7);

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
  ]);

  const [todaysReminders, todaysConversationsActiveCount] = await Promise.all([
    prisma.reminderLog.findMany({
      where: { appointment: { organizationId: orgId }, createdAt: { gte: today0, lte: today1 } },
      select: { channel: true, status: true },
      take: 100,
    }).catch(() => []),
    prisma.conversation.count({
      where: { organizationId: orgId, startedAt: { gte: today0, lte: today1 }, status: 'ACTIVE', channel: { in: ['CHAT', 'WHATSAPP'] } },
    }).catch(() => 0),
  ]);

  const callStats = await prisma.$queryRaw<Array<{ inbound: number; outbound: number; missed: number; booked: number; callbacks: number; completed: number }>>`
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
  `.catch(() => []);

  const [departments, recentPatients, appointmentsConfirmed, revenueResult] = await Promise.all([
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
    todayMetrics?.appointmentsConfirmed
      ? Promise.resolve(todayMetrics.appointmentsConfirmed)
      : prisma.appointment.count({ where: { organizationId: orgId, scheduledAt: { gte: today0, lte: today1 }, status: 'CONFIRMED' } }).catch(() => 0),
    todayMetrics?.revenueToday
      ? Promise.resolve(todayMetrics.revenueToday)
      : prisma.appointment.aggregate({
          where: { organizationId: orgId, scheduledAt: { gte: today0, lte: today1 }, billingAmount: { not: null } },
          _sum: { billingAmount: true },
        }).then((r) => r._sum.billingAmount ?? 0).catch(() => 0),
  ]);

  const cs0 = callStats?.[0] ?? { inbound: 0, outbound: 0, missed: 0, booked: 0, callbacks: 0, completed: 0 };
  const inboundCalls = cs0.inbound ?? 0;
  const outboundCalls = cs0.outbound ?? 0;
  const missedCalls = cs0.missed ?? 0;
  const callbacksDone = cs0.callbacks ?? 0;
  const activeChats = todayMetrics?.activeChats ?? todaysConversationsActiveCount;
  const revenueToday = revenueResult;
  const todayLeads = todayMetrics?.totalLeads ?? todaysPatients;
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

  return { stats, sourceData, weeklyData, deptData, recentLeads };
}

async function getVoice(orgId: string) {
  const today0 = startOfDay();
  const today1 = endOfDay();

  const todayMetrics = await prisma.dailyMetrics.findUnique({
    where: { organizationId_date: { organizationId: orgId, date: today0 } },
  }).catch(() => null);

  const [callStats, callBucketsRows, agents, aiAgentMetrics, liveQueue] = await Promise.all([
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
    prisma.$queryRaw<Array<{ hour: number; inbound: number; outbound: number; missed: number; booked: number }>>`
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
      select: { id: true, name: true, agentType: true, callsToday: true, bookedToday: true, conversionRate: true },
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
        id: true, status: true, scheduledFor: true, priority: true,
        patient: { select: { fullName: true, firstName: true, lastName: true, phone: true, department: { select: { name: true } } } },
        lead: { select: { firstName: true, lastName: true, email: true, phone: true } },
        agent: { select: { name: true } },
      },
    }).catch(() => []),
  ]);

  // Voice scenario analytics
  const [inboundScenarioRows, outboundScenarioRows] = await Promise.all([
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
      where: { organizationId: orgId, attempts: { gt: 0 }, lastAttemptAt: { gte: today0, lte: today1 } },
      select: { notes: true },
      take: 2000,
    }).catch(() => []),
  ]);

  const cs0 = callStats?.[0] ?? { inbound: 0, outbound: 0, missed: 0, booked: 0, callbacks: 0, completed: 0 };
  const inboundCalls = cs0.inbound ?? 0;
  const outboundCalls = cs0.outbound ?? 0;
  const missedCalls = cs0.missed ?? 0;
  const bookedViaVoice = cs0.booked ?? 0;
  const callbacksDone = cs0.callbacks ?? 0;

  const hours = [9, 10, 11, 12, 13, 14, 15, 16];
  const bucketMap: Record<number, { inbound: number; outbound: number; missed: number; booked: number }> = {};
  for (const h of hours) bucketMap[h] = { inbound: 0, outbound: 0, missed: 0, booked: 0 };
  for (const r of callBucketsRows) {
    if (!bucketMap[r.hour]) continue;
    bucketMap[r.hour] = { inbound: r.inbound, outbound: r.outbound, missed: r.missed, booked: r.booked };
  }
  const callData = hours.map((h) => ({ time: bucketLabel(h), ...bucketMap[h] }));

  const aiAgentsRaw = aiAgentMetrics.length > 0 ? aiAgentMetrics : agents.map((a) => ({
    agent: { id: a.id, name: a.name, agentType: a.agentType, isActive: true },
    callsOrChats: a.callsToday ?? 0, booked: a.bookedToday ?? 0, conversionRate: a.conversionRate ?? 0,
  })) as any[];

  const aiAgents = aiAgentsRaw.slice(0, 8).map((m: any, idx: number) => ({
    id: idx + 1,
    name: m.agent?.name ?? 'AI Agent',
    type: m.agent?.agentType === 'RECEPTION' ? 'inbound' : m.agent?.agentType === 'FOLLOW_UP' ? 'outbound' : 'chat',
    status: (m.agent?.isActive ?? true) ? 'active' : 'paused',
    callsToday: m.callsOrChats ?? 0, booked: m.booked ?? 0,
    conv: Math.round(m.conversionRate ?? 0),
    last: toRelative(m.agent?.updatedAt),
  }));

  const liveQueueMapped = liveQueue.map((q, idx) => {
    const patientName = q.patient?.fullName || `${q.patient?.firstName ?? ''} ${q.patient?.lastName ?? ''}`.trim() ||
      `${q.lead?.firstName ?? ''} ${q.lead?.lastName ?? ''}`.trim() || (q.lead?.email ? q.lead.email.split('@')[0] : 'Unknown');
    const st = q.status === 'IN_PROGRESS' ? 'in-progress' : q.status === 'RINGING' ? 'ringing' : 'queued';
    return {
      id: q.id, name: patientName, phone: q.patient?.phone ?? q.lead?.phone ?? '—',
      status: st, dept: q.patient?.department?.name ?? 'General',
      agent: q.agent?.name ?? 'AI Agent', pos: st === 'queued' ? idx + 1 : undefined,
    };
  });

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
    { key: 'appointment_reminder', label: 'Appointment Reminder', color: '#00e5a0' },
    { key: 'missed_call_followup', label: 'Missed Call Follow-up', color: '#6366f1' },
    { key: 'health_checkup_promo', label: 'Health Checkup Promo', color: '#3b82f6' },
    { key: 'patient_reactivation', label: 'Patient Reactivation', color: '#ffb347' },
    { key: 'test_result_followup', label: 'Test Result Follow-up', color: '#22d3ee' },
    { key: 'treatment_conversion', label: 'Treatment Conversion', color: '#8b5cf6' },
    { key: 'feedback_review', label: 'Feedback & Review', color: '#34d399' },
    { key: 'maternity_followup', label: 'Maternity Follow-up', color: '#f472b6' },
    { key: 'medication_reminder', label: 'Medication Reminder', color: '#94a3b8' },
    { key: 'post_discharge', label: 'Post-Discharge Follow-up', color: '#64748b' },
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
      callbacks: { missed: todayMetrics?.callsMissed ?? missedCalls, done: callbacksDone, booked: todayMetrics?.callbacksBooked ?? 0 },
    },
    voiceScenarioStats: { inbound: inboundScenarioStats, outbound: outboundScenarioStats },
  };
}

async function getAiChat(orgId: string) {
  const today0 = startOfDay();
  const today1 = endOfDay();

  const todayMetrics = await prisma.dailyMetrics.findUnique({
    where: { organizationId_date: { organizationId: orgId, date: today0 } },
  }).catch(() => null);

  const [todaysConversationsActiveCount, agents, aiAgentMetrics, intents, todaysReminders] = await Promise.all([
    prisma.conversation.count({
      where: { organizationId: orgId, startedAt: { gte: today0, lte: today1 }, status: 'ACTIVE', channel: { in: ['CHAT', 'WHATSAPP'] } },
    }).catch(() => 0),
    prisma.agent.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, agentType: true, callsToday: true, bookedToday: true, conversionRate: true },
      take: 8,
    }).catch(() => []),
    prisma.aIAgentMetrics.findMany({
      where: { organizationId: orgId, date: today0 },
      select: { agentId: true, callsOrChats: true, booked: true },
      take: 8,
    }).catch(() => []),
    prisma.conversation.findMany({
      where: { organizationId: orgId, startedAt: { gte: today0, lte: today1 }, detectedIntent: { not: null } },
      select: { detectedIntent: true },
      take: 200,
    }).catch(() => []),
    prisma.reminderLog.findMany({
      where: { appointment: { organizationId: orgId }, createdAt: { gte: today0, lte: today1 } },
      select: { channel: true, status: true },
      take: 100,
    }).catch(() => []),
  ]);

  const appointmentsConfirmed = todayMetrics?.appointmentsConfirmed ??
    await prisma.appointment.count({ where: { organizationId: orgId, scheduledAt: { gte: today0, lte: today1 }, status: 'CONFIRMED' } }).catch(() => 0);

  const activeChats = todayMetrics?.activeChats ?? todaysConversationsActiveCount;

  const remindersByChannel = todaysReminders.reduce((acc, r) => {
    const key = r.channel;
    if (!acc[key]) acc[key] = { sent: 0, delivered: 0 };
    acc[key].sent += 1;
    if (r.status === 'DELIVERED') acc[key].delivered += 1;
    return acc;
  }, {} as Record<string, { sent: number; delivered: number }>);

  const intentCounts = intents
    .map((x) => (x.detectedIntent ?? '').trim())
    .filter(Boolean)
    .reduce((acc, v) => ((acc[v] = (acc[v] ?? 0) + 1), acc), {} as Record<string, number>);
  const faqTopics = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([topic, count]) => ({ topic, count, handled: '—', trend: '—' }));

  const aiAgentsRaw = aiAgentMetrics.length > 0 ? aiAgentMetrics : agents.map((a) => ({
    agent: { id: a.id, name: a.name, agentType: a.agentType, isActive: true },
    callsOrChats: a.callsToday ?? 0, booked: a.bookedToday ?? 0, conversionRate: a.conversionRate ?? 0,
  })) as any[];

  const aiAgents = aiAgentsRaw.slice(0, 8).map((m: any, idx: number) => ({
    id: idx + 1, name: m.agent?.name ?? 'AI Agent',
    type: m.agent?.agentType === 'RECEPTION' ? 'inbound' : m.agent?.agentType === 'FOLLOW_UP' ? 'outbound' : 'chat',
    status: (m.agent?.isActive ?? true) ? 'active' : 'paused',
    callsToday: m.callsOrChats ?? 0, booked: m.booked ?? 0,
    conv: Math.round(m.conversionRate ?? 0), last: toRelative(m.agent?.updatedAt),
  }));

  return {
    aiAgents,
    faqTopics,
    chat: {
      activeChats,
      bookedViaChat: appointmentsConfirmed,
      avgResponseSec: todayMetrics?.avgResponseTimeSec ?? 0,
    },
    remindersByChannel: {
      whatsapp: remindersByChannel['WHATSAPP'] ?? { sent: 0, delivered: 0 },
      sms: remindersByChannel['SMS'] ?? { sent: 0, delivered: 0 },
      voice: remindersByChannel['VOICE_CALL'] ?? { sent: 0, delivered: 0 },
    },
  };
}

async function getAppointments(orgId: string) {
  const today0 = startOfDay();

  const appointmentsList = await prisma.appointment.findMany({
    where: { organizationId: orgId },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
    select: {
      id: true, status: true, appointmentType: true, scheduledAt: true,
      patient: { select: { id: true, fullName: true, firstName: true, lastName: true } },
      doctor: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  }).catch(() => []);

  const appointments = appointmentsList.map((a) => {
    const uiStatus =
      a.status === 'CONFIRMED' ? 'confirmed' :
      a.status === 'REMINDER_SENT' ? 'reminder_sent' :
      a.status === 'NO_SHOW' ? 'no_show' :
      'pending';
    return {
      id: a.id,
      patient: {
        id: a.patient.id,
        fullName: a.patient.fullName || `${a.patient.firstName ?? ''} ${a.patient.lastName ?? ''}`.trim() || 'Unknown',
      },
      doctor: { id: a.doctor?.id ?? null, name: a.doctor?.name ?? 'Dr. Unassigned' },
      department: { id: a.department?.id ?? null, name: a.department?.name ?? 'General' },
      appointmentType: a.appointmentType ?? 'OPD',
      scheduledAt: a.scheduledAt,
      status: uiStatus,
      notes: null,
    };
  });

  return { appointments };
}

async function getCrm(orgId: string) {
  const crmPatients = await prisma.patient.findMany({
    where: { organizationId: orgId },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true, fullName: true, firstName: true, lastName: true,
      phone: true, email: true, age: true, tags: true,
      totalVisits: true, lastVisitAt: true, patientStatus: true,
      department: { select: { name: true } },
    },
  }).catch(() => []);

  const patients = crmPatients.map((p) => {
    const name = p.fullName || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Unknown';
    return {
      id: p.id, name, phone: p.phone ?? '—', email: p.email ?? '—',
      age: p.age ?? null, dept: p.department?.name ?? 'General',
      tags: p.tags ?? [], visits: p.totalVisits ?? 0,
      lastVisit: toRelative(p.lastVisitAt),
      status: (p.patientStatus ?? 'NEW').toString().toLowerCase() === 'new' ? 'new' : 'active',
    };
  });

  return { patients };
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
    const section = searchParams.get('section') || 'overview';
    const cacheKey = `${orgId}:${section}:${startOfDay().toISOString().slice(0, 10)}`;

    // Cache check
    const cached = globalForDashboardCache.hospitalDashboardCache!.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload, {
        headers: {
          'X-Dashboard-Cache': 'HIT',
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
          'X-Response-Time': `${Date.now() - apiStartTime}ms`,
        },
      });
    }

    // Route to the correct section handler
    let payload: unknown;
    switch (section) {
      case 'overview':
        payload = await getOverview(orgId);
        break;
      case 'voice':
        payload = await getVoice(orgId);
        break;
      case 'ai_chat':
        payload = await getAiChat(orgId);
        break;
      case 'appointments':
        payload = await getAppointments(orgId);
        break;
      case 'crm':
        payload = await getCrm(orgId);
        break;
      default:
        return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });
    }

    // Store in cache
    globalForDashboardCache.hospitalDashboardCache!.set(cacheKey, {
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
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
    console.error('[Hospital Dashboard API] Error:', { error, duration_ms: totalDuration });
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500, headers: { 'X-Response-Time': `${totalDuration}ms` } }
    );
  }
}