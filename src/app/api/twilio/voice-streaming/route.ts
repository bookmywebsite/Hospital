/**
 * Streaming Voice Route - Uses Twilio Media Streams + WebSocket
 * Replaces the old Gather-based polling system
 * Route: POST /api/twilio/voice-streaming
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

function xmlEsc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatPhone(phone: string): string {
  let num = phone.replace(/\D/g, '');
  if (num.length === 10) num = '91' + num;
  return num.startsWith('+') ? phone : '+' + num;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = (formData.get('CallSid') as string) || '';
    const from = (formData.get('From') as string) || '';
    const to = (formData.get('To') as string) || '';
    const answeredBy = (formData.get('AnsweredBy') as string) || '';

    const { searchParams } = new URL(request.url);
    const callType = searchParams.get('callType') || 'inbound';
    const purpose = searchParams.get('purpose') || '';
    const language = searchParams.get('language') || 'en-IN';
    const agentId = searchParams.get('agentId') || '';
    const patientIdParam = searchParams.get('patientId') || '';
    const organizationId = searchParams.get('organizationId') || '';

    console.log(`[Voice Streaming] ${callType} from=${from} to=${to} sid=${callSid}`);

    // Hang up if voicemail detected
    if (answeredBy.toLowerCase().startsWith('machine')) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Get agent configuration
    const agent = agentId
      ? await prisma.agent.findUnique({
          where: { id: agentId },
          include: { organization: true },
        })
      : await prisma.agent.findFirst({
          where: { isDefault: true, isActive: true },
          include: { organization: true },
        });

    if (!agent) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service unavailable. Goodbye.</Say><Hangup/></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Get WebSocket server URL
    const wsServerUrl = process.env.VOICE_WS_SERVER_URL || process.env.VOICE_AI_BASE_URL;
    if (!wsServerUrl) {
      console.error('[Voice Streaming] VOICE_WS_SERVER_URL not configured');
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Configuration error. Goodbye.</Say><Hangup/></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const wcUrl = wsServerUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    // Build TwiML to connect Twilio to our WebSocket Media Streams
    const customParams = {
      callSid,
      organizationId: agent.organizationId,
      agentId: agent.id,
      agentName: agent.name,
      callType,
      direction: callType === 'outbound' ? 'OUTBOUND' : 'INBOUND',
      callerNumber: from,
      calledNumber: to,
      systemPrompt: agent.systemPrompt || `You are ${agent.name}, AI health assistant.`,
      greeting: agent.welcomeMessage || 'Thank you for calling. How can I help?',
      language: agent.languages?.[0] || language,
      hospitalName: process.env.HOSPITAL_NAME || agent.companyName || agent.organization?.hospitalName || 'Hospital',
      hospitalAddress: process.env.HOSPITAL_ADDRESS || '',
      hospitalPhone: process.env.HOSPITAL_PHONE || '',
      hospitalEmail: process.env.HOSPITAL_EMAIL || '',
    };

    // Build parameter XML
    let paramsXML = '';
    Object.entries(customParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        paramsXML += `<Parameter name="${xmlEsc(key)}" value="${xmlEsc(String(value))}" />\n`;
      }
    });

    // TwiML: Connect call to WebSocket Media Streams
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wcUrl}/media">
      ${paramsXML}
    </Stream>
  </Connect>
</Response>`;

    console.log('[Voice Streaming] Connecting to:', wcUrl);

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error: any) {
    console.error('[Voice Streaming] Error:', error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Goodbye.</Say><Hangup/></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}
