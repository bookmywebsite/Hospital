import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
    const cursor = searchParams.get('cursor');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: { organizationId: string; startedAt?: { gte?: Date; lte?: Date } } = {
      organizationId: user.organizationId,
    };
    if (from || to) {
      where.startedAt = {};
      if (from) where.startedAt.gte = new Date(from);
      if (to) where.startedAt.lte = new Date(to);
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        lead: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            phone: true,
          },
        },
        patient: {
          select: {
            firstName: true,
            lastName: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('[Conversations API]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}