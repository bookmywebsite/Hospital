import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

export const dynamic = 'force-dynamic';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const format = (searchParams.get('format') ?? 'pdf').toLowerCase();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (!['pdf', 'excel'].includes(format)) return NextResponse.json({ error: 'Invalid format' }, { status: 400 });

    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' }, select: { role: true, content: true, createdAt: true } } },
    });
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const filename = `conversation_${conv.id}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    const buffer =
      format === 'pdf'
        ? await buildPdfBuffer(toLines(conv))
        : buildExcelBuffer(conv);

    // Convert Buffer to Uint8Array to satisfy TypeScript Response API types
    const bodyData = new Uint8Array(buffer);

    return new Response(bodyData, {
      status: 200,
      headers: {
        'Content-Type':
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[Conversation Export File]', error);
    return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 });
  }
}

