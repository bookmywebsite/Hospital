import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { enrollLeadInSequence } from '@/lib/email';

// GET /api/email/sequences
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const sequences = await prisma.emailSequence.findMany({
      where:   { organizationId: user.organizationId },
      include: {
        steps:       { orderBy: { stepNumber: 'asc' } },
        agent:       { select: { id: true, name: true } },
        enrollments: { where: { status: 'active' }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, sequences });
  } catch (error) {
    console.error('[Sequences GET]', error);
    return NextResponse.json({ error: 'Failed to fetch sequences' }, { status: 500 });
  }
}

// POST /api/email/sequences
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();

    // ── Toggle sequence active/paused ─────────────────────────────────────────
    if (body.action === 'toggle') {
      const { sequenceId, isActive } = body;
      if (!sequenceId) return NextResponse.json({ error: 'sequenceId required' }, { status: 400 });

      // Verify belongs to org
      const seq = await prisma.emailSequence.findFirst({
        where: { id: sequenceId, organizationId: user.organizationId },
      });
      if (!seq) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });

      await prisma.emailSequence.update({
        where: { id: sequenceId },
        data:  { isActive: !!isActive },
      });

      return NextResponse.json({ success: true, isActive: !!isActive });
    }

    // ── Enroll lead ───────────────────────────────────────────────────────────
    if (body.action === 'enroll') {
      const { sequenceId, leadId } = body;
      if (!sequenceId || !leadId) {
        return NextResponse.json({ error: 'sequenceId and leadId required' }, { status: 400 });
      }
      await enrollLeadInSequence(sequenceId, leadId, prisma);
      return NextResponse.json({ success: true, message: 'Lead enrolled in sequence' });
    }

    // ── Create new sequence ───────────────────────────────────────────────────
    const { name, description, agentId, targetTier, steps } = body;
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const sequence = await prisma.emailSequence.create({
      data: {
        organizationId: user.organizationId,
        name,
        description:    description ?? null,
        agentId:        agentId     ?? null,
        targetTier:     targetTier  ?? null,
        isActive:       true,
        steps: {
          create: (steps ?? []).map((step: any, index: number) => ({
            stepNumber:      index + 1,
            name:            step.name           ?? `Step ${index + 1}`,
            delayDays:       step.delayDays       ?? 0,
            delayHours:      step.delayHours      ?? 0,
            subjectTemplate: step.subjectTemplate ?? null,
            bodyTemplate:    step.bodyTemplate    ?? null,
            useAI:           step.useAI           ?? true,
            skipIfReplied:   step.skipIfReplied   ?? true,
            skipIfMeeting:   step.skipIfMeeting   ?? true,
          })),
        },
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    return NextResponse.json({ success: true, sequence });
  } catch (error) {
    console.error('[Sequences POST]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}