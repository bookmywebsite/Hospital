import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const cloned       = request.clone();
    const formData     = await cloned.formData();
    const callSid      = formData.get('CallSid')      as string ?? '';
    const callStatus   = formData.get('CallStatus')   as string ?? '';
    const callDuration = formData.get('CallDuration') as string ?? '';
    const recordingUrl = formData.get('RecordingUrl') as string ?? '';

    const { searchParams } = new URL(request.url);
    const leadId      = searchParams.get('leadId')      ?? '';
    const callQueueId = searchParams.get('callQueueId') ?? '';
    const agentId     = searchParams.get('agentId')     ?? '';

    console.log(`[Outbound Status] ${callSid} | Status: ${callStatus} | Duration: ${callDuration}s`);

    // Close conversation if call ended
    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus)) {
      const conv = await prisma.conversation.findFirst({
        where: { twilioCallSid: callSid },
      });

      if (conv) {
        await prisma.conversation.update({
          where: { id: conv.id },
          data:  {
            status:       'CLOSED',
            endedAt:      new Date(),
            callDuration: callDuration ? parseInt(callDuration) : null,
          },
        }).catch(() => {});
      }
    }

    // Update queue activity
    if (callQueueId) {
      const finalStatus = callStatus === 'completed' ? 'COMPLETED'
        : callStatus === 'busy'      ? 'BUSY'
        : callStatus === 'no-answer' ? 'NO_ANSWER'
        : callStatus === 'failed'    ? 'FAILED'
        : 'COMPLETED';

      await prisma.activity.update({
        where: { id: callQueueId },
        data:  {
          description: `Status: ${finalStatus} | Duration: ${callDuration}s`,
          metadata: {
            status:       finalStatus,
            callSid,
            callStatus,
            duration:     callDuration ? parseInt(callDuration) : null,
            recordingUrl: recordingUrl || null,
          },
        },
      }).catch(() => {});
    }

    // Log call completion to activity
    if (leadId) {
      await prisma.activity.create({
        data: {
          leadId,
          type:        'call_completed',
          title:       `Call ${callStatus}`,
          description: callDuration ? `Duration: ${callDuration}s` : `Status: ${callStatus}`,
          actorType:   'agent',
          actorId:     agentId || 'system',
          metadata: {
            callSid,
            callStatus,
            duration:     callDuration ? parseInt(callDuration) : null,
            recordingUrl: recordingUrl || null,
          },
        },
      }).catch(() => {});

      // Update lead lastContactedAt only (safe field in existing schema)
      await prisma.lead.update({
        where: { id: leadId },
        data:  { lastContactedAt: new Date() },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Outbound Status]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}