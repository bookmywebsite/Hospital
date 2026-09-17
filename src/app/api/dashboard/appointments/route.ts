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
  appointmentsDashboardCache?: Map<string, CachedDashboardPayload>;
};

if (!globalForCache.appointmentsDashboardCache) {
  globalForCache.appointmentsDashboardCache = new Map();
}

const CACHE_TTL_MS = 30000; // 30 seconds

// ─── Date helpers ────────────────────────────────────────────────────────────
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ─── Data fetcher ────────────────────────────────────────────────────────────
async function getAppointmentsData(orgId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const appointmentsList = await prisma.appointment.findMany({
    where: { 
      organizationId: orgId,
      scheduledAt: { gte: today } 
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
    select: {
      id: true,
      status: true,
      appointmentType: true,
      scheduledAt: true,
      patient: { select: { id: true, fullName: true, firstName: true, lastName: true } },
      doctor: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  }).catch(() => []);

  const appointments = appointmentsList.map((a) => {
    const uiStatus =
      a.status === 'CONFIRMED' ? 'confirmed' :
      a.status === 'REMINDER_SENT' ? 'reminder_sent' :
      a.status === 'NO_SHOW' ? 'no_show' : 'pending';
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
    const cacheKey = `${orgId}:appointments:${startOfDay().toISOString().slice(0, 10)}`;

    // Cache check
    if (!forceRefresh) {
      const cached = globalForCache.appointmentsDashboardCache?.get(cacheKey);
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
    const payload = await getAppointmentsData(orgId);

    // Cache result
    globalForCache.appointmentsDashboardCache?.set(cacheKey, {
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
    console.error('[Appointments Dashboard API] Error:', { error, duration_ms: totalDuration });
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500, headers: { 'X-Response-Time': `${totalDuration}ms` } }
    );
  }
}
