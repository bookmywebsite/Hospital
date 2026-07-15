// @ts-nocheck
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// ─── Date helpers ────────────────────────────────────────────────────────────
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
  crmDashboardCache?: Map<string, CachedDashboardPayload>;
};

if (!globalForCache.crmDashboardCache) {
  globalForCache.crmDashboardCache = new Map();
}

const CACHE_TTL_MS = 30000; // 30 seconds

// ─── Date helpers (refactored) ────────────────────────────────────────────────
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ─── Data fetcher ────────────────────────────────────────────────────────────
async function getCrmData(orgId: string) {
  const crmPatients = await prisma.patient.findMany({
    where: { organizationId: orgId },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      age: true,
      tags: true,
      totalVisits: true,
      lastVisitAt: true,
      patientStatus: true,
      department: { select: { name: true } },
    },
  }).catch(() => []);

  const patients = crmPatients.map((p) => {
    const name =
      p.fullName || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Unknown';
    return {
      id: p.id,
      name,
      phone: p.phone ?? '—',
      email: p.email ?? '—',
      age: p.age ?? null,
      dept: p.department?.name ?? 'General',
      tags: p.tags ?? [],
      visits: p.totalVisits ?? 0,
      lastVisit: toRelative(p.lastVisitAt),
      status:
        (p.patientStatus ?? 'NEW').toString().toLowerCase() === 'new' ? 'new' : 'active',
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
    if (!user?.organizationId)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const orgId = user.organizationId;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    const cacheKey = `${orgId}:crm:${startOfDay().toISOString().slice(0, 10)}`;

    // Check cache
    if (!forceRefresh) {
      const cached = globalForCache.crmDashboardCache?.get(cacheKey);
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
    const payload = await getCrmData(orgId);

    // Cache result
    globalForCache.crmDashboardCache?.set(cacheKey, {
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
    console.error('[CRM Dashboard API] Error:', { error, duration_ms: totalDuration });
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500, headers: { 'X-Response-Time': `${totalDuration}ms` } }
    );
  }
}
