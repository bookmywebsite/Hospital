import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// ── GET /api/settings ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const org = await (prisma as any).organization.findUnique({
      where:   { id: user.organizationId },
      include: { agents: { where: { isDefault: true }, take: 1 } },
    });

    const integrations = {
      sendgrid: !!process.env.SENDGRID_API_KEY && !!process.env.SENDGRID_FROM_EMAIL,
      twilio:   !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
      exotel:   !!process.env.EXOTEL_SID && !!process.env.EXOTEL_API_KEY && !!process.env.EXOTEL_API_TOKEN,
      whatsapp: !!process.env.TWILIO_WHATSAPP_NUMBER || !!process.env.EXOTEL_WHATSAPP_NUMBER,
      groq:     !!process.env.GROQ_API_KEY,
      stripe:   !!process.env.STRIPE_SECRET_KEY,
      redis:    !!process.env.REDIS_URL,
    };

    const maskedValues = {
      sendgridKey:    mask(process.env.SENDGRID_API_KEY),
      sendgridEmail:  process.env.SENDGRID_FROM_EMAIL ?? '',
      sendgridName:   process.env.SENDGRID_FROM_NAME  ?? '',
      twilioSid:      mask(process.env.TWILIO_ACCOUNT_SID),
      twilioPhone:    process.env.TWILIO_PHONE_NUMBER ?? '',
      exotelSid:      mask(process.env.EXOTEL_SID),
      exotelApiKey:   mask(process.env.EXOTEL_API_KEY),
      exotelPhone:    process.env.EXOTEL_VIRTUAL_NUMBER ?? '',
      voiceWsUrl:     process.env.VOICE_WS_SERVER_URL || process.env.VOICE_AI_BASE_URL || '',
      whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER ?? process.env.EXOTEL_WHATSAPP_NUMBER ?? '',
      groqKey:        mask(process.env.GROQ_API_KEY),
      stripeKey:      mask(process.env.STRIPE_SECRET_KEY),
      redisUrl:       mask(process.env.REDIS_URL),
      appUrl:         process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    };

    return NextResponse.json({
      success: true,
      org: {
        id:               org?.id,
        name:             org?.name,
        slug:             org?.slug,
        plan:             org?.plan,
        callStartHour:    org?.callStartHour  ?? 9,
        callEndHour:      org?.callEndHour    ?? 21,
        assignmentMode:   org?.assignmentMode ?? 'ROUND_ROBIN',
        emailLimit:       org?.emailLimit,
        emailsUsed:       org?.emailsUsed,
        conversationLimit: org?.conversationLimit,
        conversationsUsed: org?.conversationsUsed ?? 0,
      },
      agent:        org?.agents?.[0] ?? null,
      integrations,
      maskedValues,
    });
  } catch (error) {
    console.error('[Settings GET]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// ── POST /api/settings ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body   = await request.json();
    const action = body.action as string;

    // ── Update organization ───────────────────────────────────────────────────
    if (action === 'update_org') {
      const updateData: Record<string, unknown> = {};
      if (body.name            != null) updateData.name           = body.name;
      if (body.callStartHour   != null) updateData.callStartHour  = body.callStartHour;
      if (body.callEndHour     != null) updateData.callEndHour    = body.callEndHour;
      if (body.assignmentMode  != null) updateData.assignmentMode = body.assignmentMode;

      await (prisma as any).organization.update({
        where: { id: user.organizationId },
        data:  updateData,
      });
      return NextResponse.json({ success: true });
    }

    // ── Update agent ──────────────────────────────────────────────────────────
    if (action === 'update_agent') {
      const { agentId, name, welcomeMessage, companyName,
              companyDescription, productDescription, valueProposition,
              tone, personality } = body;

      if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });

      const agentData: Record<string, unknown> = {};
      if (name               != null) agentData.name               = name;
      if (welcomeMessage     != null) agentData.welcomeMessage     = welcomeMessage;
      if (companyName        != null) agentData.companyName        = companyName;
      if (companyDescription != null) agentData.companyDescription = companyDescription;
      if (productDescription != null) agentData.productDescription = productDescription;
      if (valueProposition   != null) agentData.valueProposition   = valueProposition;
      if (tone               != null) agentData.tone               = tone;
      if (personality        != null) agentData.personality        = personality;

      await prisma.agent.update({ where: { id: agentId }, data: agentData as any });
      return NextResponse.json({ success: true });
    }

    // ── Verify integration ────────────────────────────────────────────────────
    if (action === 'verify_integration') {
      const result = await verifyIntegration(body.service as string);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Settings POST]', error);
    return NextResponse.json({ error: error.message ?? 'Failed' }, { status: 500 });
  }
}

// ── Verify integration ────────────────────────────────────────────────────────

async function verifyIntegration(service: string): Promise<{ success: boolean; message: string }> {
  try {
    switch (service) {
      case 'sendgrid': {
        if (!process.env.SENDGRID_API_KEY) return { success: false, message: 'API key not set in .env.local' };
        const res = await fetch('https://api.sendgrid.com/v3/user/account', {
          headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
        });
        return res.ok
          ? { success: true,  message: 'SendGrid connected successfully' }
          : { success: false, message: 'Invalid SendGrid API key' };
      }

      case 'twilio': {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
          return { success: false, message: 'Twilio credentials not set in .env.local' };
        }
        const creds = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const res   = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`, {
          headers: { Authorization: `Basic ${creds}` },
        });
        return res.ok
          ? { success: true,  message: `Twilio connected · ${process.env.TWILIO_PHONE_NUMBER}` }
          : { success: false, message: 'Invalid Twilio credentials' };
      }

      case 'exotel': {
        if (!process.env.EXOTEL_SID || !process.env.EXOTEL_API_TOKEN) {
          return { success: false, message: 'EXOTEL_SID and EXOTEL_API_TOKEN must be set in .env.local' };
        }
        const username = process.env.EXOTEL_API_KEY || process.env.EXOTEL_SID;
        const auth = Buffer.from(`${username}:${process.env.EXOTEL_API_TOKEN}`).toString('base64');
        const sid = process.env.EXOTEL_SID;
        const res = await fetch(`https://api.in.exotel.com/v1/Accounts/${sid}/ExotelAccount.json`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        return res.ok
          ? { success: true, message: `Exotel connected · ${process.env.EXOTEL_VIRTUAL_NUMBER || process.env.EXOTEL_CALLER_ID || ''}` }
          : { success: false, message: 'Invalid Exotel credentials' };
      }

      case 'whatsapp': {
        if (!process.env.TWILIO_WHATSAPP_NUMBER && !process.env.EXOTEL_WHATSAPP_NUMBER) {
          return { success: false, message: 'WhatsApp number not set in .env.local' };
        }
        return {
          success: true,
          message: `WhatsApp configured: ${process.env.TWILIO_WHATSAPP_NUMBER || process.env.EXOTEL_WHATSAPP_NUMBER}`,
        };
      }

      case 'groq': {
        if (!process.env.GROQ_API_KEY) return { success: false, message: 'API key not set in .env.local' };
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        });
        return res.ok
          ? { success: true,  message: 'Groq AI connected successfully' }
          : { success: false, message: 'Invalid Groq API key' };
      }

      case 'redis': {
        if (!process.env.REDIS_URL) return { success: false, message: 'REDIS_URL not set in .env.local' };
        const { getRedisConnection } = await import('@/lib/queue/redis');
        const redis = getRedisConnection();
        await redis.ping();
        return { success: true, message: 'Redis connected successfully' };
      }

      case 'stripe': {
        if (!process.env.STRIPE_SECRET_KEY) return { success: false, message: 'STRIPE_SECRET_KEY not set in .env.local' };
        return { success: true, message: 'Stripe key configured' };
      }

      default:
        return { success: false, message: 'Unknown service' };
    }
  } catch (err: any) {
    return { success: false, message: err.message ?? 'Connection failed' };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mask(value?: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return value.slice(0, 4) + '••••••••' + value.slice(-4);
}