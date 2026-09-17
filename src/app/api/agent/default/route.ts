import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const maxDuration = 5;

const CACHE_MS = 30000; // 30 seconds
const defaultAgentCache = new Map<string, { data: any; expiry: number }>();

export async function GET() {
  const startTime = Date.now();

  try {
    // Get current user with timeout
    const clerkUser = await Promise.race([
  currentUser(),
  new Promise<Awaited<ReturnType<typeof currentUser>>>((_, reject) =>
    setTimeout(() => reject(new Error('Auth timeout')), 5000)
  ),
]).catch(() => null);

    if (!clerkUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to get user with timeout
    let user: any;
    try {
      user = await Promise.race([
        prisma.user.findUnique({
          where: { clerkId: clerkUser.id },
          select: { organizationId: true },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('User lookup timeout')), 5000)
        ),
      ]);
    } catch (err) {
      console.error('[Agent Default] User lookup timeout:', err);
      return NextResponse.json(
        { error: 'Database connection timeout' },
        { status: 503 }
      );
    }

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Check cache
    const cacheKey = user.organizationId;
    const cached = defaultAgentCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: { 'X-Cache': 'HIT' },
      });
    }

    // Fetch default agent with timeout
    let agent: any;
    try {
      agent = await Promise.race([
        prisma.agent.findFirst({
          where: {
            organizationId: user.organizationId,
            isDefault: true,
          },
          select: {
            id: true,
            name: true,
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Agent query timeout')), 5000)
        ),
      ]);
    } catch (err) {
      console.error('[Agent Default] Agent query timeout:', err);
      return NextResponse.json(
        { error: 'Database query timeout' },
        { status: 503 }
      );
    }

    const response = {
      agentId: agent?.id ?? '',
      agentName: agent?.name ?? 'PrimePro',
      isDefault: !!agent,
    };

    // Cache the response
    defaultAgentCache.set(cacheKey, {
      data: response,
      expiry: Date.now() + CACHE_MS,
    });

    const duration = Date.now() - startTime;

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=15',
        'X-Response-Time': `${duration}ms`,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Agent Default]', {
      error: errorMsg,
      duration_ms: duration,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}