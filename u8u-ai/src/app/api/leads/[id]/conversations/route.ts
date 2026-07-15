import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// GET /api/leads/[id]/conversations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: leadId } = await params;

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const conversations = await prisma.conversation.findMany({
      where:   { leadId, organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select: {
        id:            true,
        channel:       true,
        status:        true,
        messageCount:  true,
        startedAt:     true,
        lastMessageAt: true,
        endedAt:       true,
      },
    });

    return NextResponse.json({ success: true, conversations });
  } catch (error) {
    console.error('[Lead Conversations] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}