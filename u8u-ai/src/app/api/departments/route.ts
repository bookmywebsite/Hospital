import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const departments = await prisma.department.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });

    return NextResponse.json({ success: true, departments });
  } catch (error: any) {
    console.error('[Departments GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch departments' }, { status: 500 });
  }
}
