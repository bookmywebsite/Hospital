/**
 * Voice Call Status Callback Handler
 * Receives call status updates from Twilio
 * Updates conversation records with final call status and metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;

    console.log(`[Status Callback] CallSid: ${callSid}, Status: ${callStatus}, Duration: ${callDuration}s`);

    // Update conversation record
    await prisma.conversation.updateMany({
      where: { twilioCallSid: callSid },
      data: {
        status:
          callStatus === 'completed'
            ? 'CLOSED'
            : callStatus === 'failed'
              ? 'CLOSED'
              : callStatus === 'busy'
                ? 'CLOSED'
                : callStatus === 'no-answer'
                  ? 'CLOSED'
                  : callStatus === 'answered'
                    ? 'ACTIVE'
                    : 'ACTIVE',
        endedAt: [
          'completed',
          'failed',
          'busy',
          'no-answer',
          'canceled',
        ].includes(callStatus)
          ? new Date()
          : undefined,
        callDuration: callDuration ? parseInt(callDuration) : undefined,
      },
    });

    return NextResponse.json({ received: true, status: 'ok' });
  } catch (error: any) {
    console.error('[Status Callback] Error:', error);
    // Return success to Twilio to prevent retries
    return NextResponse.json({ received: true, status: 'error' });
  }
}
