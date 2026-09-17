import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { safeDbQuery, parsePagination, handleApiError, getMetrics } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 8;

export async function GET(request: NextRequest) {
  const t0 = Date.now();

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await safeDbQuery(
      () => prisma.user.findUnique({
        where: { clerkId: userId },
        select: { organizationId: true },
      }),
      2000
    );

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const { page, limit, skip } = parsePagination(searchParams);

    const where: any = {
      organizationId: user.organizationId,
    };

    if (q && q.length >= 2) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [patientCount, patients] = await Promise.all([
      safeDbQuery(() => prisma.patient.count({ where }), 2000, 0),
      safeDbQuery(
        () => prisma.patient.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }],
          skip,
          take: limit,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            phone: true,
            email: true,
            patientStatus: true,
            lastVisitAt: true,
            department: { select: { name: true } },
          },
        }),
        3000,
        []
      ),
    ]);

    const metrics = getMetrics(t0);

    return NextResponse.json(
      {
        success: true,
        patients: (patients || []).map((p) => ({
          ...p,
          name: p.fullName || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Unknown',
        })),
        pagination: {
          page,
          limit,
          total: patientCount || 0,
          pages: Math.ceil((patientCount || 0) / limit),
          hasMore: page < Math.ceil((patientCount || 0) / limit),
        },
        meta: metrics,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=15',
          'X-Response-Time': `${metrics.duration_ms}ms`,
        },
      }
    );
  } catch (error: any) {
    const duration = Date.now() - t0;
    console.error('[Patients GET]', error);
    return handleApiError(error, duration);
  }
}
