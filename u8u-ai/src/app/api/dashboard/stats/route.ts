import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const orgId = user.organizationId;

    // All sequential — pgBouncer safe
    const totalLeads = await prisma.lead.count({ where: { organizationId: orgId } });
    const hotLeads = await prisma.lead.count({ where: { organizationId: orgId, tier: 'HOT' } });
    const warmLeads = await prisma.lead.count({ where: { organizationId: orgId, tier: 'WARM' } });
    const newLeads = await prisma.lead.count({ where: { organizationId: orgId, status: 'NEW' } });
    const contactedLeads = await prisma.lead.count({ where: { organizationId: orgId, status: 'CONTACTED' } });
    const qualifiedLeads = await prisma.lead.count({ where: { organizationId: orgId, status: 'QUALIFIED' } });
    const meetingSetLeads = await prisma.lead.count({ where: { organizationId: orgId, status: 'MEETING_SET' } });
    const wonLeads = await prisma.lead.count({ where: { organizationId: orgId, status: 'WON' } });
    const totalConversations = await prisma.conversation.count({ where: { organizationId: orgId } });
    const voiceCalls = await prisma.conversation.count({ where: { organizationId: orgId, channel: 'VOICE' } });
    const emailConvs = await prisma.conversation.count({ where: { organizationId: orgId, channel: 'EMAIL' } });
    const meetingsBooked = await prisma.meeting.count({ where: { organizationId: orgId } });
    const scheduledJobs = await (prisma as any).scheduledJob.count({ where: { status: 'PENDING' } }).catch(() => 0);

    const chatConvs = Math.max(0, totalConversations - voiceCalls - emailConvs);
    const convRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0.0';
    const qualRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;
    const contactRate = totalLeads > 0 ? Math.round(((totalLeads - newLeads) / totalLeads) * 100) : 0;

    return NextResponse.json({
      totalLeads, hotLeads, warmLeads, newLeads,
      contactedLeads, qualifiedLeads, meetingSetLeads, wonLeads,
      totalConversations, voiceCalls, emailConvs, chatConvs,
      meetingsBooked, scheduledJobs,
      convRate, qualRate, contactRate,
    });
  } catch (error) {
    console.error('[Dashboard Stats]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}