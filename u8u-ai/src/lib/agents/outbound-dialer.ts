import { prisma } from '@/lib/prisma';
import { getVoiceConfig, generateGreeting } from '@/lib/voice/language-config';
import { makeOutboundCall as communicationsMakeOutboundCall } from '@/lib/communications';
import { twilioClient } from '@/lib/twilio';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL!;

function toTwilioVoiceLang(code: string): string {
  if (code.includes('-')) return code;
  const m: Record<string, string> = {
    EN: 'en-IN',
    HI: 'hi-IN',
    KN: 'kn-IN',
    TA: 'ta-IN',
    TE: 'te-IN',
    ML: 'ml-IN',
    MR: 'mr-IN',
    BN: 'bn-IN',
    GU: 'gu-IN',
    PA: 'pa-IN',
    OR: 'or-IN',
  };
  return m[code.toUpperCase()] ?? 'en-IN';
}

export async function makeOutboundCall(params: {
  leadId:      string;
  agentId:     string;
  phoneNumber: string;
  language:    string;
  callQueueId: string;
  purpose?:    string;
}): Promise<{ success: boolean; callSid: string; leadId: string }> {
  const { leadId, agentId, phoneNumber, language, callQueueId, purpose = 'missed_call_followup' } = params;

  const formatted = formatPhone(phoneNumber);
  const twilioLang = toTwilioVoiceLang(language);

  const voiceQs = new URLSearchParams({
    agentId,
    leadId,
    callType: 'outbound',
    purpose,
    language: twilioLang,
  });

  const statusQs = new URLSearchParams({ leadId, callQueueId });

  const callResult = await communicationsMakeOutboundCall({
    to: formatted,
    url: `${BASE_URL}/api/twilio/voice?${voiceQs.toString()}`,
    statusCallback: `${BASE_URL}/api/twilio/status?${statusQs.toString()}`,
    statusCallbackMethod: 'POST',
    timeout: 30,
  });

  if (!callResult.success) {
    throw new Error(callResult.error || 'Failed to initiate outbound call');
  }

  console.log(`Outbound call initiated: ${callResult.callSid} to ${formatted} [${language}]`);

  // Log to Activity
  await prisma.activity.create({
    data: {
      leadId,
      type:        'call_initiated',
      title:       `Outbound call initiated [${language}]`,
      description: `Calling ${formatted} | CallSid: ${callResult.callSid}`,
      actorType:   'agent',
      actorId:     agentId,
      metadata: {
        callSid:   callResult.callSid,
        direction: 'OUTBOUND',
        status:    'RINGING',
        from:      process.env.EXOTEL_VIRTUAL_NUMBER || process.env.EXOTEL_CALLER_ID || process.env.TWILIO_PHONE_NUMBER,
        to:        formatted,
        language,
        callQueueId,
      },
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data:  { lastContactedAt: new Date() },
  }).catch(() => {});

  return { success: true, callSid: callResult.callSid, leadId };
}

export function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return cleaned;
}

export async function cancelCall(callSid: string, leadId: string): Promise<void> {
  await twilioClient.calls(callSid).update({ status: 'canceled' });
  await prisma.activity.create({
    data: {
      leadId,
      type:      'call_cancelled',
      title:     'Call cancelled',
      actorType: 'system',
      metadata:  { callSid },
    },
  }).catch(() => {});
}