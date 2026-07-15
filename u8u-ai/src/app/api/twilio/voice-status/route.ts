/**
 * Twilio Call Status Webhook
 * Receives updates when call status changes (ringing, answered, completed, failed)
 * Route: POST /api/twilio/voice-status
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = (formData.get('CallSid') as string) || '';
    const status = (formData.get('CallStatus') as string) || '';
    const duration = parseInt((formData.get('CallDuration') as string) || '0', 10);

    if (!callSid) {
      return NextResponse.json({ received: false, error: 'Missing CallSid' }, { status: 400 });
    }

    console.log(`[Call Status] ${callSid}: ${status} (duration: ${duration}s)`);

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      initiated: 'initiated',
      ringing: 'ringing',
      'in-progress': 'in-progress',
      completed: 'completed',
      busy: 'failed',
      'no-answer': 'no-answer',
      canceled: 'failed',
      failed: 'failed',
    };

    const mappedStatus = statusMap[status] || status;

    // Update conversation or call log
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { twilioCallSid: callSid },
      });

      if (conversation) {
        const updateData: any = {
          status: mappedStatus === 'completed' ? 'CLOSED' : 'ACTIVE',
        };

        if (mappedStatus === 'completed') {
          updateData.endedAt = new Date();
          updateData.callDuration = duration;
        } else if (mappedStatus === 'in-progress') {
          updateData.startedAt = new Date();
        }

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: updateData,
        });

        console.log(`[Status Update] Conversation ${conversation.id}: ${mappedStatus}`);
      }

      // Also update CallLog if exists
      const callLog = await prisma.callLog.findUnique({
        where: { callSid },
      });

      if (callLog) {
        const updateData: any = {
          status: mappedStatus === 'completed' ? 'COMPLETED' : 'IN_PROGRESS',
          duration: duration || undefined,
        };

        if (mappedStatus === 'completed') {
          updateData.endedAt = new Date();
        } else if (mappedStatus === 'in-progress') {
          updateData.answeredAt = new Date();
        }

        await prisma.callLog.update({
          where: { id: callLog.id },
          data: updateData,
        });

        console.log(`[Status Update] CallLog ${callLog.id}: ${mappedStatus}`);
      }
    } catch (dbError: any) {
      console.error('[Status Update] Database error:', dbError);
    }

    return NextResponse.json({ received: true, status: mappedStatus });
  } catch (error: any) {
    console.error('[Voice Status] Error:', error);
    return NextResponse.json(
      { received: false, error: error.message },
      { status: 500 }
    );
  }
}
