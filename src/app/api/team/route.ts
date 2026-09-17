import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// GET /api/team — list team members
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const members = await (prisma as any).teamMember.findMany({
      where:   { organizationId: user.organizationId },
      include: { user: { select: { firstName: true, lastName: true, email: true, imageUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, members });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST /api/team — add team member or update availability
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const { action, memberId, isAvailable, maxLeadsPerDay, skills, languages } = body;

    // Toggle availability
    if (action === 'toggle_availability' && memberId) {
      const member = await (prisma as any).teamMember.update({
        where: { id: memberId },
        data:  { isAvailable },
      });
      return NextResponse.json({ success: true, member });
    }

    // Update member settings
    if (action === 'update' && memberId) {
      const member = await (prisma as any).teamMember.update({
        where: { id: memberId },
        data: {
          ...(maxLeadsPerDay !== undefined && { maxLeadsPerDay }),
          ...(skills         !== undefined && { skills }),
          ...(languages      !== undefined && { languages }),
        },
      });
      return NextResponse.json({ success: true, member });
    }

    // Add current user as team member
    if (action === 'add_self') {
      // Check if already a team member
      const existing = await (prisma as any).teamMember.findUnique({
        where: { userId: user.id },
      });

      if (existing) {
        return NextResponse.json({ success: true, member: existing, alreadyExists: true });
      }

      const member = await (prisma as any).teamMember.create({
        data: {
          organizationId: user.organizationId,
          userId:         user.id,
          isAvailable:    true,
          maxLeadsPerDay: maxLeadsPerDay ?? 50,
          skills:         skills    ?? [],
          languages:      languages ?? ['EN'],
        },
      });

      return NextResponse.json({ success: true, member });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Team API]', error);
    return NextResponse.json({ error: error.message ?? 'Failed' }, { status: 500 });
  }
}