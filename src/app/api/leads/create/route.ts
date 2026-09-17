import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const {
      email, firstName, lastName, phone, company,
      jobTitle, source, notes, preferredLanguage,
    } = body;

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    // Check if lead already exists
    const existing = await prisma.lead.findFirst({
      where: { organizationId: user.organizationId, email },
    });
    if (existing) {
      return NextResponse.json({ error: 'Lead with this email already exists' }, { status: 409 });
    }

    const lead = await prisma.lead.create({
      data: {
        organizationId:   user.organizationId,
        email,
        firstName:        firstName        || null,
        lastName:         lastName         || null,
        phone:            phone            || null,
        company:          company          || null,
        jobTitle:         jobTitle         || null,
        source:           source           || 'manual',
        preferredLanguage: preferredLanguage || 'en-IN',
        status:           'NEW',
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        leadId:      lead.id,
        type:        'lead_created',
        title:       'Lead created manually',
        description: notes ? `Notes: ${notes}` : 'Added via dashboard',
        actorType:   'user',
        actorId:     user.id,
        metadata:    { source: 'dashboard', createdBy: user.id },
      },
    });

    return NextResponse.json({ success: true, lead });
  } catch (error: any) {
    console.error('[Create Lead]', error);
    return NextResponse.json({ error: error.message ?? 'Failed' }, { status: 500 });
  }
}