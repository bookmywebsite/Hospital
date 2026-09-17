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
  aiChatDashboardCache?: Map<string, CachedDashboardPayload>;
};

if (!globalForCache.aiChatDashboardCache) {
  globalForCache.aiChatDashboardCache = new Map();
}

const CACHE_TTL_MS = 30000; // 30 seconds

// ─── Data fetcher ────────────────────────────────────────────────────────────
async function getAiChatData(orgId: string) {
  const today0 = startOfDay();
  const today1 = endOfDay();

  const todayMetrics = await prisma.dailyMetrics.findUnique({
    where: { organizationId_date: { organizationId: orgId, date: today0 } },
  }).catch(() => null);

  const [
    todaysConversationsActiveCount,
    agents,
    aiAgentMetrics,
    intents,
    todaysReminders,
    appointmentsConfirmedCount,
  ] = await Promise.all([
    prisma.conversation.count({
      where: { organizationId: orgId, startedAt: { gte: today0, lte: today1 }, status: 'ACTIVE', channel: { in: ['CHAT', 'WHATSAPP'] } },
    }).catch(() => 0),
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
    prisma.appointment.count({
      where: { organizationId: orgId, scheduledAt: { gte: today0, lte: today1 }, status: 'CONFIRMED' },
    }).catch(() => 0),
  ]);

  const activeChats = todayMetrics?.activeChats ?? todaysConversationsActiveCount;
  const appointmentsConfirmed = todayMetrics?.appointmentsConfirmed ?? appointmentsConfirmedCount;

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

  const faqTopics = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count, handled: '—', trend: '—' }));

  const aiAgentsRaw = aiAgentMetrics.length > 0
    ? aiAgentMetrics
    : agents.map((a) => ({
        agent: { id: a.id, name: a.name, agentType: a.agentType, isActive: true, updatedAt: a.updatedAt },
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
    const cacheKey = `${orgId}:ai_chat:${startOfDay().toISOString().slice(0, 10)}`;

    // Check cache
    if (!forceRefresh) {
      const cached = globalForCache.aiChatDashboardCache?.get(cacheKey);
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
    const payload = await getAiChatData(orgId);

    // Cache result
    globalForCache.aiChatDashboardCache?.set(cacheKey, {
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
    console.error('[AI Chat Dashboard API] Error:', { error, duration_ms: totalDuration });
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500, headers: { 'X-Response-Time': `${totalDuration}ms` } }
    );
  }
}
