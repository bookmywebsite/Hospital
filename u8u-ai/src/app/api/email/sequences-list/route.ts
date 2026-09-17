import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface EnrollBody {
  patientId?: string;
  leadId?: string;
  sequenceId: string;
}

/**
 * GET /api/email/sequences-list
 * Get available sequences for quick actions/enrollment
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const orgId = user.organizationId;

    const sequences = await prisma.emailSequence.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        totalEnrolled: true,
        totalCompleted: true,
        steps: {
          select: {
            stepNumber: true,
            name: true,
            delayDays: true,
          },
          orderBy: { stepNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      sequences: sequences.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        stepCount: s.steps.length,
        enrolled: s.totalEnrolled,
        completed: s.totalCompleted,
        steps: s.steps,
      })),
    });
  } catch (error: any) {
    console.error('[Get Sequences] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch sequences' }, { status: 500 });
  }
}
