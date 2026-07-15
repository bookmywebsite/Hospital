import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { id } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            phone: true,
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            phone: true,
            appointments: {
              orderBy: { scheduledAt: 'desc' },
              take: 1,
              select: {
                id: true,
                scheduledAt: true,
                status: true,
                appointmentType: true,
                bookedVia: true,
                department: { select: { name: true } },
                doctor: { select: { name: true } },
              },
            },
          },
        },
        agent: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 500,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            senderType: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('[Conversation detail API]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
