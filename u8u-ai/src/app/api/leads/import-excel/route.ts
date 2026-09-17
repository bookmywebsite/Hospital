import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

function normHeader(v: unknown) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function pick(row: Record<string, any>, ...keys: string[]) {
  for (const k of keys) {
    const kk = normHeader(k);
    for (const rk of Object.keys(row)) {
      if (normHeader(rk) === kk) return row[rk];
    }
  }
  return undefined;
}

function asString(v: any) {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  return String(v).trim();
}

function normalizePhone(v: string) {
  if (!v) return '';
  // Remove all non-digit characters except + 
  let s = v.replace(/[^\d+\-()]/g, '');
  // Remove hyphens and parentheses
  s = s.replace(/[-()]/g, '');
  if (!s) return '';
  
  // Ensure starts with + for international format or digits
  if (s.startsWith('+')) return s;
  
  // If Indian number without country code, add it
  if (s.length === 10 || (s.length > 10 && !s.startsWith('91'))) {
    return '+91' + s.slice(-10);
  }
  
  // If already has country code (91 for India)
  if (s.startsWith('91') && s.length >= 12) {
    return '+' + s;
  }
  
  return '+' + s;
}

function syntheticEmailFromRow(phone: string, firstName: string, lastName: string, rowIndex: number) {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits) return `lead_${digits}@import.local`;
  const seed = `${firstName}_${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (seed) return `${seed}_${rowIndex}@import.local`;
  return `lead_row_${rowIndex}@import.local`;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const orgId = user.organizationId;

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return NextResponse.json({ error: 'Empty workbook' }, { status: 400 });

    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    if (!rows.length) return NextResponse.json({ error: 'No rows found' }, { status: 400 });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ row: number; error: string }> = [];

    // Validate all rows first
    const validRows: Array<{
      rowNum: number;
      email: string;
      phone: string;
      firstName: string;
      lastName: string;
      company?: string;
      jobTitle?: string;
      source: string;
      preferredLanguage: string;
      notes?: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const firstName = asString(pick(r, 'firstName', 'first_name', 'First Name', 'name', 'full_name'));
      const lastName = asString(pick(r, 'lastName', 'last_name', 'Last Name', 'surname'));
      const phone = normalizePhone(asString(pick(r, 'phone', 'Phone', 'phone_number', 'Phone Number', 'mobile', 'mobile_number', 'contact', 'contact_number')));
      const rawEmail = asString(pick(r, 'email', 'Email', 'email_address', 'email id', 'mail', 'e-mail'));
      const email = rawEmail || syntheticEmailFromRow(phone, firstName, lastName, i + 2);
      const company = asString(pick(r, 'company', 'Company'));
      const jobTitle = asString(pick(r, 'jobTitle', 'job_title', 'Job Title'));
      const source = asString(pick(r, 'source', 'Source')) || 'excel';
      const preferredLanguage = asString(pick(r, 'preferredLanguage', 'preferred_language', 'Preferred Language')) || 'EN';
      const notes = asString(pick(r, 'notes', 'Notes'));

      // Validation
      if (!email && !phone && !firstName) {
        errors.push({ row: i + 2, error: 'Missing identity fields: need email, phone, or name' });
        continue;
      }

      if (!email) {
        errors.push({ row: i + 2, error: 'Email is required (or will be auto-generated from phone)' });
        continue;
      }

      // Invalid phone warning
      if (!phone && !rawEmail) {
        errors.push({ row: i + 2, error: 'No valid phone number found - synthetic email will be used' });
      }

      validRows.push({
        rowNum: i + 2,
        email: email.toLowerCase().trim(),
        phone: phone || '',
        firstName,
        lastName,
        company,
        jobTitle,
        source,
        preferredLanguage,
        notes,
      });
    }

    if (validRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid records to import',
        created: 0,
        updated: 0,
        skipped: rows.length,
        errors: errors.slice(0, 50),
      }, { status: 400 });
    }

    // Batch upsert for better performance
    try {
      // Get existing leads for batch update optimization
      const existingEmails = await prisma.lead.findMany({
        where: {
          organizationId: orgId,
          email: { in: validRows.map((r) => r.email) },
        },
        select: { email: true, id: true },
      });

      const existingEmailSet = new Set(existingEmails.map((e) => e.email));

      // Separate creates and updates
      const toCreate = validRows.filter((r) => !existingEmailSet.has(r.email));
      const toUpdate = validRows.filter((r) => existingEmailSet.has(r.email));

      // Batch create
      if (toCreate.length > 0) {
        try {
          await prisma.lead.createMany({
            data: toCreate.map((r) => ({
              organizationId: orgId,
              email: r.email,
              firstName: r.firstName || null,
              lastName: r.lastName || null,
              phone: r.phone || null,
              company: r.company || null,
              jobTitle: r.jobTitle || null,
              source: r.source,
              preferredLanguage: r.preferredLanguage || 'en-IN',
              qualificationNotes: r.notes || null,
              status: 'NEW' as any,
            })),
            skipDuplicates: true,
          });
          created += toCreate.length;
        } catch (e: any) {
          console.error('Batch create error:', e);
          // Fallback to sequential for creates
          for (const r of toCreate) {
            try {
              await prisma.lead.create({
                data: {
                  organizationId: orgId,
                  email: r.email,
                  firstName: r.firstName || null,
                  lastName: r.lastName || null,
                  phone: r.phone || null,
                  company: r.company || null,
                  jobTitle: r.jobTitle || null,
                  source: r.source,
                  preferredLanguage: r.preferredLanguage || 'en-IN',
                  qualificationNotes: r.notes || null,
                  status: 'NEW' as any,
                },
              });
              created += 1;
            } catch (err: any) {
              errors.push({ row: r.rowNum, error: err?.message ?? 'Failed to create' });
            }
          }
        }
      }

      // Sequential updates (safer for concurrent access)
      for (const r of toUpdate) {
        try {
          await prisma.lead.update({
            where: { organizationId_email: { organizationId: orgId, email: r.email } },
            data: {
              firstName: r.firstName || undefined,
              lastName: r.lastName || undefined,
              phone: r.phone || undefined,
              company: r.company || undefined,
              jobTitle: r.jobTitle || undefined,
              source: r.source || undefined,
              preferredLanguage: r.preferredLanguage || undefined,
              qualificationNotes: r.notes || undefined,
            },
          });
          updated += 1;
        } catch (e: any) {
          errors.push({ row: r.rowNum, error: e?.message ?? 'Failed to update' });
        }
      }

      skipped = errors.length;
    } catch (error: any) {
      console.error('Batch import error:', error);
      return NextResponse.json({
        success: false,
        error: 'Batch processing failed',
        created,
        updated,
        skipped: validRows.length - created - updated,
        errors: errors.slice(0, 50),
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, created, updated, skipped, errors: errors.slice(0, 50) });
  } catch (error) {
    console.error('[Lead Excel Import] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

