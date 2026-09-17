import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const maxDuration = 10;

// GET /api/leads - Optimized with pagination and connection limits
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with timeout
    const user = await Promise.race([
      prisma.user.findUnique({ where: { clerkId: userId } }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout')), 5000)
      ),
    ]).catch(() => null);

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') ?? '').trim();
    const tier = searchParams.get('tier');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'));
    const skip = (page - 1) * limit;

    // Build WHERE clause optimally
    const where: any = { organizationId: user.organizationId };

    // Filter by status
    if (status) where.status = status;

    // Filter by tier
    if (tier) where.tier = tier;

    // Filter by date range
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    // Exclude anonymous leads (always apply)
    where.NOT = { email: { endsWith: '@chat.PrimePro.ai' } };

    // Search using separate text search if provided
    if (search && search.length >= 2) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Run count and fetch in parallel
    const [leadsCount, leads] = await Promise.all([
      prisma.lead.count({ where }).catch(() => 0),
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: true,
          phone: true,
          score: true,
          tier: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        leads,
        pagination: {
          page,
          limit,
          total: leadsCount,
          pages: Math.ceil(leadsCount / limit),
        },
        _meta: { duration_ms: duration },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=10',
        },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Leads API] Error:', { error: errorMsg, duration_ms: duration });

    // Return appropriate error based on cause
    if (errorMsg.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timeout - database busy' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await Promise.race([
      prisma.user.findUnique({ where: { clerkId: userId } }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout')), 5000)
      ),
    ]).catch(() => null);

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === 'string') : [];
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'No lead IDs provided' }, { status: 400 });
    }

    const result = await prisma.lead.deleteMany({
      where: {
        organizationId: user.organizationId,
        id: { in: ids },
      },
    });

    return NextResponse.json({ success: true, deleted: result.count }, { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Leads DELETE] Error:', { error: errorMsg, duration_ms: duration });

    if (errorMsg.includes('timeout')) {
      return NextResponse.json({ error: 'Request timeout - database busy' }, { status: 503 });
    }

    return NextResponse.json({ error: 'Failed to delete leads' }, { status: 500 });
  }
}