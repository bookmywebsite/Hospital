/**
 * Outbound Call Connection Handler - Streaming Version
 * Called when the contact picks up an outbound voice call
 * Connects to Media Streams WebSocket for real-time AI conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const answeredBy = formData.get('AnsweredBy') as string;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || '';
    const conversationId = searchParams.get('conversationId') || '';

    console.log(`[Outbound Connect] Call ${callSid} answered by: ${answeredBy}`);

    // If voicemail detected, hang up
    if (answeredBy && answeredBy.startsWith('machine')) {
      console.log(`[Outbound Connect] Voicemail detected, hanging up`);
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Thank you for your time. We'll try again later.</Say>
          <Hangup/>
        </Response>`;
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Get the agent
    const agent = agentId
      ? await prisma.voiceAgent.findUnique({
          where: { id: agentId },
        })
      : await prisma.voiceAgent.findFirst({
          where: { isActive: true },
        });

    if (!agent) {
      console.error('[Outbound Connect] No agent found');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Our system is currently unavailable. Please try again later.</Say>
          <Hangup/>
        </Response>`;
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Get WebSocket URL
    const wsUrl = (process.env.VOICE_WS_SERVER_URL || process.env.VOICE_AI_BASE_URL || '')
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');

    if (!wsUrl) {
      console.error('[Outbound Connect] VOICE_WS_SERVER_URL not configured');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Technical error. Call will end.</Say>
          <Hangup/>
        </Response>`;
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Build WebSocket URL with parameters
    const params = new URLSearchParams({
      callSid,
      conversationId,
      agentId: agent.id,
      direction: 'outbound',
      language: agent.language,
    });

    // Return TwiML that connects to Media Streams
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="${wsUrl}/media?${params.toString()}">
            <Parameter name="CallSid" value="${callSid}" />
            <Parameter name="conversationId" value="${conversationId}" />
            <Parameter name="direction" value="outbound" />
          </Stream>
        </Connect>
      </Response>`;

    console.log(`[Outbound Connect] Streaming call ${callSid} to ${wsUrl}`);

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error: any) {
    console.error('[Outbound Connect] Error:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>An error occurred. Goodbye.</Say>
        <Hangup/>
      </Response>`;
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
      status: 500,
    });
  }
}