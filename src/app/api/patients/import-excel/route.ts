import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

function toPhone(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 10) return null;
  return `+${digits}`;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Excel file is required' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });

    if (!rows.length) {
      return NextResponse.json({ error: 'No rows found in file' }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const firstName = String(row.firstName || row.FirstName || row['First Name'] || '').trim();
      const lastName = String(row.lastName || row.LastName || row['Last Name'] || '').trim();
      const fullName = String(row.fullName || row.FullName || row.Name || '').trim();
      const phone = toPhone(row.phone || row.Phone || row.Mobile || row.mobile);
      const email = String(row.email || row.Email || '').trim() || null;
      const ageValue = String(row.age || row.Age || '').trim();
      const gender = String(row.gender || row.Gender || '').trim() || null;
      const preferredLanguage =
        String(row.language || row.Language || row.preferredLanguage || '').trim().toUpperCase() || 'EN';

      if (!phone && !email) {
        skipped++;
        continue;
      }

      const existing = await prisma.patient.findFirst({
        where: {
          organizationId: user.organizationId,
          OR: [
            ...(phone ? [{ phone }] : []),
            ...(email ? [{ email }] : []),
          ],
        },
      });

      if (existing) {
        await prisma.patient.update({
          where: { id: existing.id },
          data: {
            firstName: firstName || existing.firstName,
            lastName: lastName || existing.lastName,
            fullName: fullName || `${firstName} ${lastName}`.trim() || existing.fullName,
            phone: phone || existing.phone,
            email: email || existing.email,
            age: ageValue ? parseInt(ageValue, 10) : existing.age,
            gender: gender || existing.gender,
            preferredLanguage,
            source: existing.source || 'excel_import',
          },
        });
        updated++;
        continue;
      }

      await prisma.patient.create({
        data: {
          organizationId: user.organizationId,
          firstName: firstName || null,
          lastName: lastName || null,
          fullName: fullName || `${firstName} ${lastName}`.trim() || null,
          phone,
          email,
          age: ageValue ? parseInt(ageValue, 10) : null,
          gender,
          preferredLanguage,
          source: 'excel_import',
          patientStatus: 'NEW',
        },
      });
      created++;
    }

    return NextResponse.json({
      success: true,
      total: rows.length,
      created,
      updated,
      skipped,
    });
  } catch (error: any) {
    console.error('[Patients Import Excel]', error);
    return NextResponse.json({ error: error.message || 'Failed to import patients' }, { status: 500 });
  }
}
