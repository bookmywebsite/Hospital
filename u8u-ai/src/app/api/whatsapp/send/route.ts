import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/communications';

// POST /api/whatsapp/send
// Send a WhatsApp message to a lead
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body   = await request.json();
    const { leadId, message, useAI, agentId } = body;

    if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: user.organizationId },
    });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (!lead.phone) return NextResponse.json({ error: 'Lead has no phone number' }, { status: 400 });

    let messageText = message;

    // AI generate if requested
    if (useAI) {
      let agent = null;
      if (agentId) {
        agent = await prisma.agent.findUnique({ where: { id: agentId } });
      }
      if (!agent) {
        agent = await prisma.agent.findFirst({
          where: { organizationId: user.organizationId, isDefault: true },
        });
      }
      const { generateEmailContent } = await import('@/lib/email');
      const generated = await generateEmailContent({
        agentName:     agent?.name ?? 'PrimePro',
        agentRole:     agent?.role ?? 'AI Sales Assistant',
        companyName:   agent?.companyName    ?? '',
        leadFirstName: lead.firstName       ?? '',
        leadCompany:   lead.company         ?? '',
        painPoints:    lead.painPoints      ?? [],
        stepNumber:    1,
        totalSteps:    1,
        tone:          agent?.tone ?? 'conversational',
      });
      // Use plain text for WhatsApp
      messageText = generated.text;
    }

    if (!messageText) {
      return NextResponse.json({ error: 'message or useAI required' }, { status: 400 });
    }

    const result = await sendWhatsAppMessage(lead.phone, messageText);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send WhatsApp message' }, { status: 500 });
    }

    // Log activity
    await prisma.activity.create({
      data: {
        leadId:      lead.id,
        type:        'whatsapp_sent',
        title:       'WhatsApp message sent',
        description: messageText.slice(0, 100),
        actorType:   'user',
        actorId:     user.id,
        metadata:    { messageSid: result.messageId ?? null },
      },
    });

    // Update lead
    await prisma.lead.update({
      where: { id: lead.id },
      data:  { lastContactedAt: new Date() },
    });

    return NextResponse.json({ success: true, messageSid: result.messageId });
  } catch (error: any) {
    console.error('[WhatsApp Send] Error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to send WhatsApp message' },
      { status: 500 }
    );
  }
}