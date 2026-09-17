import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    const leadId = params.id;
    const result = await prisma.lead.deleteMany({
      where: { id: leadId, organizationId: user.organizationId },
    });

    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Lead not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error: any) {
    console.error('[Lead Delete] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete lead' }, { status: 500 });
  }
}
