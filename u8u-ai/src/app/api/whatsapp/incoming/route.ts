import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processAgentMessage } from '@/lib/agents/brain';
import { sendWhatsAppMessage } from '@/lib/communications';

// POST /api/whatsapp/incoming
// Twilio calls this when a WhatsApp message is received
export async function POST(request: NextRequest) {
  try {
    const cloned   = request.clone();
    const formData = await cloned.formData();

    const from    = formData.get('From')        as string ?? ''; // whatsapp:+91XXXXXXXXXX
    const to      = formData.get('To')          as string ?? ''; // whatsapp:+14155238886
    const body    = formData.get('Body')        as string ?? '';
    const msgSid  = formData.get('MessageSid')  as string ?? '';

    console.log(`[WhatsApp] From: ${from} | Message: "${body}"`);

    // Extract phone number (remove "whatsapp:" prefix)
    const phone = from.replace('whatsapp:', '');

    // Find default agent
    const agent = await prisma.agent.findFirst({
      where:   { isDefault: true, isActive: true },
      include: { organization: true },
    });

    if (!agent) {
      await sendWhatsAppReply(to, from, "Sorry, our AI agent is not available right now.");
      return new NextResponse('OK', { status: 200 });
    }

    // Find or create lead by phone
    let lead = await prisma.lead.findFirst({
      where: { organizationId: agent.organizationId, phone },
    });

    if (!lead) {
      // Create new lead from WhatsApp contact
      lead = await prisma.lead.create({
        data: {
          organizationId: agent.organizationId,
          email:          `wa_${phone.replace('+', '')}@whatsapp.PrimePro.ai`,
          phone,
          source:         'whatsapp',
          status:         'NEW',
        },
      });

      await prisma.activity.create({
        data: {
          leadId:      lead.id,
          type:        'lead_created',
          title:       'Lead created via WhatsApp',
          description: `WhatsApp contact: ${phone}`,
          actorType:   'agent',
          actorId:     agent.id,
        },
      });
    }

    // Find or create WhatsApp conversation
    const sessionId = `wa_${phone.replace('+', '')}`;
    let conversation = await prisma.conversation.findFirst({
      where:   { sessionId, status: 'ACTIVE' },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId: agent.organizationId,
          agentId:        agent.id,
          leadId:         lead.id,
          channel:        'CHAT',
          status:         'ACTIVE',
          sessionId,
          phoneFrom:      phone,
          phoneTo:        to.replace('whatsapp:', ''),
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      // Update lead status
      await prisma.lead.update({
        where: { id: lead.id },
        data:  { status: 'CONTACTED', lastContactedAt: new Date() },
      });
    }

    // Save incoming message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role:           'user',
        content:        body,
        senderType:     'lead',
      },
    });

    // Get AI response from brain
    const agentResponse = await processAgentMessage(body, {
      agent,
      lead,
      conversationHistory: conversation.messages,
      channel:             'chat',
      sessionId,
    });

    // Save AI response
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role:           'assistant',
        content:        agentResponse.message,
        senderType:     'agent',
      },
    });

    // Update conversation stats
    await prisma.conversation.update({
      where: { id: conversation.id },
      data:  { lastMessageAt: new Date(), messageCount: { increment: 2 } },
    });

    // Update lead if qualified
    if (agentResponse.leadUpdates && Object.keys(agentResponse.leadUpdates).length > 0) {
      await prisma.lead.update({
        where: { id: lead.id },
        data:  agentResponse.leadUpdates,
      });
    }

    // Send AI reply back via WhatsApp
    await sendWhatsAppReply(to, from, agentResponse.message);

    // TwiML response (empty — we send manually above)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );

  } catch (error) {
    console.error('[WhatsApp Incoming] Error:', error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

// ── Send WhatsApp message via configured provider ─────────────────────────
async function sendWhatsAppReply(from: string, to: string, body: string) {
  const phone = to.startsWith('whatsapp:') ? to.replace('whatsapp:', '') : to;
  const result = await sendWhatsAppMessage(phone, body);
  if (!result.success) {
    console.error('[WhatsApp Reply] failed', result.error);
  }
}