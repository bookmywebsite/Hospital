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
      patientId,
      appointmentType = 'OPD',
      departmentId,
      doctorId,
      scheduledAt,
      notes,
    } = body;

    if (!patientId || !scheduledAt) {
      return NextResponse.json({ 
        error: 'Patient ID and scheduled time are required' 
      }, { status: 400 });
    }

    // Verify patient belongs to organization
    const patient = await prisma.patient.findFirst({
      where: { 
        id: patientId,
        organizationId: user.organizationId 
      },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        organizationId: user.organizationId,
        patientId,
        appointmentType,
        departmentId: departmentId || null,
        doctorId: doctorId || null,
        scheduledAt: new Date(scheduledAt),
        status: 'SCHEDULED',
        notes: notes || null,
      },
      include: {
        patient: { select: { firstName: true, lastName: true, fullName: true } },
        doctor: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        patientId,
        type: 'appointment_created',
        title: 'Appointment booked',
        description: `${appointmentType} appointment scheduled for ${new Date(scheduledAt).toLocaleDateString()}`,
        actorType: 'user',
        actorId: user.id,
        metadata: { appointmentId: appointment.id },
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, appointment });
  } catch (error: any) {
    console.error('[Book Appointment API]', error);
    return NextResponse.json({ error: error.message ?? 'Failed to book appointment' }, { status: 500 });
  }
}
