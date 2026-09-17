import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const body = await request.json();
    const {
      firstName,
      lastName,
      fullName,
      phone,
      email,
      age,
      gender,
      departmentId,
      tier,
      source,
      intent,
      preferredLanguage = 'EN',
      tags = [],
      doNotContact = false,
    } = body;

    // Validation
    if (!phone && !email) {
      return NextResponse.json({ error: 'Phone or email is required' }, { status: 400 });
    }

    // Check if patient already exists by phone
    if (phone) {
      const existing = await prisma.patient.findFirst({
        where: { organizationId: user.organizationId, phone },
      });
      if (existing) {
        return NextResponse.json({ error: 'Patient with this phone already exists' }, { status: 409 });
      }
    }

    // Create patient
    const patient = await prisma.patient.create({
      data: {
        organizationId: user.organizationId,
        firstName: firstName || null,
        lastName: lastName || null,
        fullName: fullName || `${firstName || ''} ${lastName || ''}`.trim() || null,
        phone: phone || null,
        email: email || null,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        departmentId: departmentId || null,
        tier: tier || null,
        patientStatus: 'NEW',
        source: source || 'manual',
        intent: intent || null,
        preferredLanguage,
        tags: tags && Array.isArray(tags) ? tags : [],
        doNotContact,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        patientId: patient.id,
        type: 'patient_created',
        title: 'Patient created',
        description: `Added via dashboard by ${user.email}`,
        actorType: 'user',
        actorId: user.id,
        metadata: { source: 'dashboard', createdBy: user.id },
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, patient });
  } catch (error: any) {
    console.error('[Create Patient API]', error);
    return NextResponse.json({ error: error.message ?? 'Failed to create patient' }, { status: 500 });
  }
}
