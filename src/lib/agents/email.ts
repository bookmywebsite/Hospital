import sgMail from '@sendgrid/mail';
import { prisma } from '@/lib/prisma';
import type { Email } from '@prisma/client';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  leadId: string;
}): Promise<Email> {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || '';
  const fromName = process.env.SENDGRID_FROM_NAME || 'Sales';

  const [response] = await sgMail.send({
    to: params.to,
    from: { email: fromEmail, name: fromName },
    subject: params.subject,
    text: params.body,
    html: params.body.replace(/\n/g, '<br>'),
  });

  const email = await prisma.email.create({
    data: {
      leadId: params.leadId,
      direction: 'OUTBOUND',
      subject: params.subject,
      body: params.body,
      fromEmail,
      fromName,
      toEmail: params.to,
      status: 'SENT',
      sendGridId: response.headers['x-message-id'],
      sentAt: new Date(),
    },
  });

  await prisma.lead.update({
    where: { id: params.leadId },
    data: { emailsSent: { increment: 1 }, lastContactedAt: new Date() },
  });

  return email;
}

export async function processInboundEmail(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<Email | null> {
  const lead = await prisma.lead.findFirst({ where: { email: params.from } });
  if (!lead) return null;

  const email = await prisma.email.create({
    data: {
      leadId: lead.id,
      direction: 'INBOUND',
      subject: params.subject,
      body: params.body,
      fromEmail: params.from,
      toEmail: params.to,
      status: 'DELIVERED',
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastRespondedAt: new Date(), status: lead.status === 'CONTACTED' ? 'ENGAGED' : lead.status },
  });

  return email;
}