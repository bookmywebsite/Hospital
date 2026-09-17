import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { safeDbQuery, handleApiError, getMetrics } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 8;

export async function GET() {
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
      return NextResponse.json({ agents: [] });
    }

    const [agents, convCounts] = await Promise.all([
      safeDbQuery(
        () => prisma.agent.findMany({
          where: { organizationId: user.organizationId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        2000,
        []
      ),
      safeDbQuery(
        () => prisma.conversation.groupBy({
          by: ['agentId'],
          where: { organizationId: user.organizationId },
          _count: { id: true },
        }),
        2000,
        []
      ),
    ]);

    const countMap = Object.fromEntries(
      (convCounts || []).map((c: any) => [c.agentId, c._count?.id ?? 0])
    );

    const metrics = getMetrics(t0);

    return NextResponse.json(
      {
        success: true,
        agents: (agents || []).map(a => ({
          ...a,
          conversationCount: countMap[a.id] ?? 0,
        })),
        meta: metrics,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=15',
          'X-Response-Time': `${metrics.duration_ms}ms`,
        },
      }
    );
  } catch (error) {
    const duration = Date.now() - t0;
    console.error('[Agents GET]', error);
    return handleApiError(error, duration);
  }
}