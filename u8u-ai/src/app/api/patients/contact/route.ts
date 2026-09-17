import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { sendSMSMessage, sendWhatsAppMessage, makeOutboundCall } from '@/lib/communications';

export const dynamic = 'force-dynamic';

function twilioVoiceLang(code: string): string {
  if (code.includes('-')) return code;
  const map: Record<string, string> = {
    EN: 'en-IN',
    HI: 'hi-IN',
    KN: 'kn-IN',
    TA: 'ta-IN',
    TE: 'te-IN',
    ML: 'ml-IN',
  };
  return map[code.toUpperCase()] ?? 'en-IN';
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const body = await request.json();
    const {
      patientId,
      action,
      channel = 'WHATSAPP',
      message,
      purpose = 'missed_call_followup',
    } = body;

    if (!patientId || !action) {
      return NextResponse.json({ error: 'patientId and action are required' }, { status: 400 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, organizationId: user.organizationId },
      select: {
        id: true,
        firstName: true,
        fullName: true,
        phone: true,
        preferredLanguage: true,
      },
    });
    if (!patient?.phone) {
      return NextResponse.json({ error: 'Patient phone not found' }, { status: 404 });
    }

    if (action === 'message') {
      const text =
        message?.trim() ||
        `Hello ${patient.firstName || patient.fullName || 'there'}, this is a follow-up from our hospital team. Please reply or call us if you need assistance.`;

      const requestSmsBackup = body?.sendSmsBackup;
      const sendSmsBackup = requestSmsBackup === undefined ? true : Boolean(requestSmsBackup);
      const requestedChannel = channel === 'SMS' ? 'SMS' : 'WHATSAPP';

      let primaryResult =
        requestedChannel === 'SMS'
          ? await sendSMSMessage(patient.phone, text)
          : await sendWhatsAppMessage(patient.phone, text);

      let backupResult: Awaited<ReturnType<typeof sendSMSMessage>> | null = null;
      if (requestedChannel === 'WHATSAPP' && sendSmsBackup) {
        backupResult = await sendSMSMessage(patient.phone, text);
      }

      const success = primaryResult.success || Boolean(backupResult?.success);
      if (!success) {
        return NextResponse.json(
          {
            error: primaryResult.error || backupResult?.error || 'Failed to send message',
          },
          { status: 500 },
        );
      }

      await prisma.activity.create({
        data: {
          patientId: patient.id,
          type: requestedChannel === 'SMS' ? 'sms_sent' : 'whatsapp_sent',
          title: requestedChannel === 'SMS' ? 'SMS sent' : 'WhatsApp accepted',
          description: text.slice(0, 120),
          actorType: 'user',
          actorId: user.id,
          metadata: {
            channel: requestedChannel,
            primaryMessageId: primaryResult.messageId ?? null,
            primarySuccess: primaryResult.success,
            whatsappProviderStatus: 'providerStatus' in primaryResult ? (primaryResult.providerStatus ?? null) : null,
            smsBackupEnabled: sendSmsBackup,
            smsBackupMessageId: backupResult?.messageId ?? null,
            smsBackupSuccess: backupResult?.success ?? null,
          },
        },
      }).catch(() => null);

      return NextResponse.json({
        success: true,
        channel: requestedChannel,
        primary: {
          success: primaryResult.success,
          messageId: primaryResult.messageId ?? null,
          providerStatus: 'providerStatus' in primaryResult ? (primaryResult.providerStatus ?? null) : null,
        },
        smsBackup: backupResult
          ? { success: backupResult.success, messageId: backupResult.messageId ?? null }
          : null,
      });
    }

    if (action === 'call') {
      const agent = await prisma.agent.findFirst({
        where: { organizationId: user.organizationId, isDefault: true, isActive: true },
        select: { id: true },
      });
      if (!agent) return NextResponse.json({ error: 'No active agent found' }, { status: 404 });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!baseUrl) {
        return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not configured' }, { status: 500 });
      }

      const voiceQuery = new URLSearchParams({
        callType: 'outbound',
        purpose,
        patientId: patient.id,
        agentId: agent.id,
        language: twilioVoiceLang(patient.preferredLanguage || 'en-IN'),
      });
      const statusQuery = new URLSearchParams({ patientId: patient.id });

      const callUrl = `${baseUrl}/api/twilio/voice?${voiceQuery.toString()}`;
      const statusUrl = `${baseUrl}/api/twilio/status?${statusQuery.toString()}`;

      const callResult = await makeOutboundCall({
        to: patient.phone,
        url: callUrl,
        statusCallback: statusUrl,
        statusCallbackMethod: 'POST',
        timeout: 30,
      });

      if (!callResult.success) {
        return NextResponse.json(
          { error: callResult.error || 'Failed to initiate call' },
          { status: 500 }
        );
      }

      await prisma.activity.create({
        data: {
          patientId: patient.id,
          type: 'manual_outbound_call',
          title: 'Manual outbound call started',
          description: `Purpose: ${purpose}`,
          actorType: 'user',
          actorId: user.id,
          metadata: { callSid: callResult.callSid, purpose },
        },
      }).catch(() => null);

      return NextResponse.json({ success: true, callSid: callResult.callSid });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Patient Contact]', error);
    return NextResponse.json({ error: error.message || 'Failed to process action' }, { status: 500 });
  }
}
