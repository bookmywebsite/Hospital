/**
 * Trigger Outbound Voice Calls
 * POST /api/voice/outbound
 * Initiates an AI voice call to a contact number
 */

import { NextRequest, NextResponse } from 'next/server';
import { makeOutboundCall } from '@/lib/communications';
import { prisma } from '@/lib/prisma';
import { twilioClient } from '@/lib/twilio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId,
      contactPhone,     // +919876543210
      contactName,
      contactEmail,
      additionalData,   // custom context
    } = body;

    // Validate required fields
    if (!agentId || !contactPhone) {
      return NextResponse.json(
        { error: 'agentId and contactPhone are required' },
        { status: 400 }
      );
    }

    // Get the agent
    const agent = await prisma.voiceAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || !agent.isActive) {
      return NextResponse.json(
        { error: 'Agent not found or inactive' },
        { status: 404 }
      );
    }

    // Get Twilio phone number
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!twilioNumber) {
      return NextResponse.json(
        { error: 'TWILIO_PHONE_NUMBER not configured' },
        { status: 500 }
      );
    }

    // Create conversation record for tracking
    const conversation = await prisma.conversation.create({
      data: {
        organizationId: agent.organizationId || 'default',
        agentId: agent.id,
        channel: 'VOICE',
        status: 'ACTIVE',
        callDirection: 'OUTBOUND',
        phoneTo: contactPhone,
      },
    });

    // Build webhook URL for when call status changes
    const statusWebhookUrl = `${process.env.VOICE_AI_BASE_URL}/api/voice/status`;
    const connectWebhookUrl = `${process.env.VOICE_AI_BASE_URL}/api/voice/outbound/connect`;

    // Make the call using the configured communications provider
    const outboundResult = await makeOutboundCall({
      to: contactPhone,
      agentId: agentId,
      organizationId: agent.organizationId || 'default',
      language: 'EN', // Default language for voice AI
    });

    // Handle the result - communications wrapper returns string for success, object for error
    let callSid: string;
    if (typeof outboundResult === 'string') {
      callSid = outboundResult;
    } else if (outboundResult && typeof outboundResult === 'object' && outboundResult.success) {
      callSid = outboundResult.callSid || 'unknown';
    } else {
      throw new Error((outboundResult as any)?.error || 'Failed to start outbound call');
    }

    console.log(`[Outbound] Call initiated: ${callSid} to ${contactPhone}`);

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        twilioCallSid: callSid,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      callId: callSid,
      conversationId: conversation.id,
      status: 'RINGING',
    });
  } catch (error: any) {
    console.error('[Outbound] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate call' },
      { status: 500 }
    );
  }
}

// GET endpoint to check call status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');

    if (!callId) {
      return NextResponse.json(
        { error: 'callId parameter required' },
        { status: 400 }
      );
    }

    const call = await twilioClient.calls(callId).fetch();

    return NextResponse.json({
      callId: call.sid,
      status: call.status,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
    });
  } catch (error: any) {
    console.error('[Outbound GET] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
