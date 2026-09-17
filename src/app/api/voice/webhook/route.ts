import { NextRequest, NextResponse } from 'next/server';
import { handleInboundCall, processSpeechInput } from '@/lib/agents/voice';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params = Object.fromEntries(formData.entries()) as Record<string, string>;
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId && params.SpeechResult) {
      const twiml = await processSpeechInput({ conversationId, speechResult: params.SpeechResult });
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    if (params.CallSid && !conversationId) {
      const agentId = searchParams.get('agentId') || process.env.DEFAULT_AGENT_ID || '';
      const result = await handleInboundCall({ callSid: params.CallSid, from: params.From, to: params.To, agentId });
      return new NextResponse(result.twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('[Voice Webhook] Error:', error);
    return new NextResponse('Error', { status: 500 });
  }
}