import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/webhooks/sendgrid
// Handles: open, click, bounce, delivered, spam_report events
export async function POST(request: NextRequest) {
  try {
    const events = await request.json();

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    for (const event of events) {
      const { event: eventType, sg_message_id, email: toEmail, timestamp } = event;
      const eventTime = timestamp ? new Date(timestamp * 1000) : new Date();

      // Find email record by SendGrid message ID
      const sendGridId = sg_message_id?.split('.')[0]; // Strip suffix
      if (!sendGridId) continue;

      const emailRecord = await prisma.email.findFirst({
        where: { sendGridId },
      });

      if (!emailRecord) continue;

      switch (eventType) {
        case 'delivered':
          await prisma.email.update({
            where: { id: emailRecord.id },
            data:  { status: 'DELIVERED' },
          });
          break;

        case 'open':
          await prisma.email.update({
            where: { id: emailRecord.id },
            data:  {
              status:    'OPENED',
              openCount: { increment: 1 },
              openedAt:  emailRecord.openedAt ?? eventTime,
            },
          });
          // Update lead stats - only if leadId exists
          if (emailRecord.leadId) {
            await prisma.lead.update({
              where: { id: emailRecord.leadId },
              data:  { emailsOpened: { increment: 1 } },
            });
          }
          break;

        case 'click':
          await prisma.email.update({
            where: { id: emailRecord.id },
            data:  { status: 'CLICKED', clickCount: { increment: 1 } },
          });
          break;

        case 'bounce':
        case 'dropped':
          await prisma.email.update({
            where: { id: emailRecord.id },
            data:  { status: 'BOUNCED', bouncedAt: eventTime },
          });
          break;

        case 'spamreport':
          await prisma.email.update({
            where: { id: emailRecord.id },
            data:  { status: 'BOUNCED' },
          });
          break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SendGrid Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}