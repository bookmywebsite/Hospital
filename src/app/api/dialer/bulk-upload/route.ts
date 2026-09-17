// PATH: src/app/api/dialer/bulk-upload/route.ts
// CSV upload → Patient records + CallQueue rows staggered over calling window.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'No org' }, { status: 404 });

    const agent = await prisma.agent.findFirst({
      where: { organizationId: user.organizationId, isDefault: true, isActive: true },
    });
    if (!agent) return NextResponse.json({ error: 'No active agent' }, { status: 404 });

    const form = await request.formData();
    const file = form.get('file') as File | null;
    const purpose = (form.get('purpose') as string) || 'missed_call_followup';
    const langDefault = (form.get('language') as string) || 'en-IN';

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const text = await file.text();
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(1);

    const rows = lines
      .map((line) => {
        const [phone, firstName, language] = line.split(',').map((p) => p.trim().replace(/"/g, ''));
        return { phone, firstName: firstName || null, language: language || langDefault };
      })
      .filter((r) => r.phone && r.phone.replace(/\D/g, '').length >= 10);

    if (!rows.length) return NextResponse.json({ error: 'No valid numbers in CSV' }, { status: 400 });

    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const istHour = ist.getHours();
    let baseTime = new Date(now);

    if (istHour < 9 || istHour >= 21) {
      baseTime = new Date(now);
      if (istHour >= 21) baseTime.setDate(baseTime.getDate() + 1);
      baseTime.setUTCHours(3, 30, 0, 0);
    }

    const intervalMs = Math.max(6000, Math.floor((12 * 60 * 60 * 1000) / rows.length));

    let created = 0;
    let skipped = 0;
    let queued = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      let phone = row.phone.replace(/\D/g, '');
      if (phone.length === 10) phone = '+91' + phone;
      else if (!phone.startsWith('+')) phone = '+' + phone;

      let patient = await prisma.patient.findFirst({
        where: { organizationId: user.organizationId, phone },
      });

      if (!patient) {
        try {
          patient = await prisma.patient.create({
            data: {
              organizationId: user.organizationId,
              phone,
              firstName: row.firstName,
              source: 'csv_upload',
              patientStatus: 'NEW',
              preferredLanguage: row.language,
            },
          });
          created++;
        } catch {
          patient = await prisma.patient.findFirst({
            where: { organizationId: user.organizationId, phone },
          });
        }
      } else if (row.firstName && !patient.firstName) {
        await prisma.patient
          .update({
            where: { id: patient.id },
            data: { firstName: row.firstName, preferredLanguage: row.language },
          })
          .catch(() => null);
      }

      if (!patient || patient.doNotContact) {
        skipped++;
        continue;
      }

      const scheduledFor = new Date(baseTime.getTime() + i * intervalMs);

      await prisma.callQueue.create({
        data: {
          organizationId: user.organizationId,
          agentId: agent.id,
          patientId: patient.id,
          leadId: null,
          scheduledFor,
          language: row.language,
          priority: 5,
          status: 'QUEUED',
          maxAttempts: 3,
          notes: purpose,
        },
      });

      queued++;
    }

    const durationHours = Math.round(((rows.length * intervalMs) / 3600000) * 10) / 10;

    return NextResponse.json({
      success: true,
      total: rows.length,
      created,
      skipped,
      queued,
      firstCallAt: baseTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      spreadHours: durationHours,
      message: `${queued} calls queued. Spread over ~${durationHours}h starting ${baseTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    console.error('[BulkUpload]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
