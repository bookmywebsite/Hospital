import { NextResponse } from 'next/server';
import { verifyIntegration } from '@/lib/communications';

function mask(value?: string) {
  if (!value) return '';
  if (value.length < 8) return '****';
  return `${value.slice(0, 4)}****${value.slice(-2)}`;
}

export async function GET() {
  try {
    const diagnostics = {
      sidConfigured: !!process.env.EXOTEL_SID,
      apiKeyConfigured: !!process.env.EXOTEL_API_KEY,
      apiTokenConfigured: !!process.env.EXOTEL_API_TOKEN,
      callerIdConfigured: !!(process.env.EXOTEL_VIRTUAL_NUMBER || process.env.EXOTEL_CALLER_ID),
      callbackBaseConfigured: !!(process.env.CALLBACK_BASE_URL || process.env.WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL),
      voiceWsConfigured: !!(process.env.VOICE_WS_SERVER_URL || process.env.VOICE_AI_BASE_URL),
      sidMasked: mask(process.env.EXOTEL_SID),
      apiKeyMasked: mask(process.env.EXOTEL_API_KEY),
      callerId: process.env.EXOTEL_VIRTUAL_NUMBER || process.env.EXOTEL_CALLER_ID || '',
    };

    const providerCheck = await verifyIntegration('exotel');

    return NextResponse.json({
      success: providerCheck.success,
      providerCheck,
      diagnostics,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unable to run Exotel diagnostics',
      },
      { status: 500 },
    );
  }
}
