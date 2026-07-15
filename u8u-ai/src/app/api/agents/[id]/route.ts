import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Verify agent belongs to org
    const agent = await prisma.agent.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
    });
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    if (agent.isDefault) {
      return NextResponse.json({ error: 'Cannot delete the default agent. Set another agent as default first.' }, { status: 400 });
    }

    await prisma.agent.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Delete Agent]', error);
    return NextResponse.json({ error: error.message ?? 'Failed' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const agent = await prisma.agent.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
    });
    if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const convCount = await prisma.conversation.count({
      where: { agentId: params.id },
    });

    return NextResponse.json({ agent: { ...agent, conversationCount: convCount } });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}