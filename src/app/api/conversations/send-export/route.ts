import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { sendWhatsAppMessage } from '@/lib/communications';

export const dynamic = 'force-dynamic';

function sanitizePhone(input: string) {
  const t = input.trim();
  if (!t) return '';
  if (t.startsWith('+')) return t;
  return `+${t.replace(/[^\d]/g, '')}`;
}

function toLines(conv: any) {
  const lines: string[] = [];
  lines.push(`Conversation ID: ${conv.id}`);
  lines.push(`Channel: ${conv.channel}`);
  lines.push(`Status: ${conv.status}`);
  lines.push(`Started At: ${new Date(conv.startedAt).toLocaleString('en-IN')}`);
  lines.push('');
  lines.push('Transcript');
  lines.push('----------');
  for (const m of conv.messages ?? []) {
    const role = (m.role ?? 'user').toUpperCase();
    const t = new Date(m.createdAt).toLocaleString('en-IN');
    lines.push(`[${t}] ${role}: ${m.content ?? ''}`);
  }
  return lines;
}

function buildPdfBuffer(lines: string[]) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.fontSize(14).text('Conversation Export', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    for (const line of lines) doc.text(line);
    doc.end();
  });
}

function buildExcelBuffer(conv: any) {
  const meta = [
    { key: 'Conversation ID', value: conv.id },
    { key: 'Channel', value: conv.channel },
    { key: 'Status', value: conv.status },
    { key: 'Started At', value: new Date(conv.startedAt).toISOString() },
  ];
  const rows = (conv.messages ?? []).map((m: any) => ({
    timestamp: new Date(m.createdAt).toISOString(),
    role: m.role ?? '',
    content: m.content ?? '',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Meta');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Transcript');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const {
      conversationId,
      format,
      destinationType, // email | whatsapp
      destination,
      sendToLead,
    } = body ?? {};

    if (!conversationId || !format) {
      return NextResponse.json({ error: 'conversationId and format are required' }, { status: 400 });
    }
    if (!['pdf', 'excel'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: user.organizationId },
      include: {
        lead: { select: { email: true, phone: true } },
        messages: { orderBy: { createdAt: 'asc' }, select: { role: true, content: true, createdAt: true } },
      },
    });
    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const resolvedType = sendToLead
      ? (conv.lead?.email ? 'email' : conv.lead?.phone ? 'whatsapp' : null)
      : destinationType;
    if (!resolvedType || !['email', 'whatsapp'].includes(resolvedType)) {
      return NextResponse.json({ error: 'No valid destination found for this conversation lead' }, { status: 400 });
    }

    const resolvedDestination = sendToLead
      ? (resolvedType === 'email' ? (conv.lead?.email ?? '') : (conv.lead?.phone ?? ''))
      : String(destination ?? '').trim();
    if (!resolvedDestination) {
      return NextResponse.json({ error: 'Destination missing' }, { status: 400 });
    }

    const fileBase = `conversation_${conv.id}_${format === 'pdf' ? 'export.pdf' : 'export.xlsx'}`;
    const lines = toLines(conv);
    const buffer = format === 'pdf' ? await buildPdfBuffer(lines) : buildExcelBuffer(conv);

    if (resolvedType === 'email') {
      const to = String(resolvedDestination).trim();
      if (!to.includes('@')) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
      await sendEmail({
        to,
        subject: `Conversation Export (${format.toUpperCase()})`,
        html: `<p>Please find the attached conversation export.</p>`,
        text: 'Please find the attached conversation export.',
        attachments: [
          {
            content: buffer.toString('base64'),
            filename: fileBase,
            type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            disposition: 'attachment',
          },
        ] as any,
      } as any);

      return NextResponse.json({ success: true, message: 'Conversation export sent to email' });
    }

    // WhatsApp destination: send download link to generated file endpoint.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
    if (!appUrl) {
      return NextResponse.json({ error: 'APP URL missing. Set NEXT_PUBLIC_APP_URL to send to WhatsApp.' }, { status: 500 });
    }
    const token = encodeURIComponent(conv.id);
    const link = `${appUrl.replace(/\/$/, '')}/api/conversations/export-file?id=${token}&format=${format}`;

    const result = await sendWhatsAppMessage(String(resolvedDestination), `Here is your conversation export (${format.toUpperCase()}): ${link}`);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send export via WhatsApp' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Conversation export link sent to WhatsApp' });
  } catch (error: any) {
    console.error('[Conversation Send Export]', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to send export' }, { status: 500 });
  }
}

