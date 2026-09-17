import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { safeDbQuery, handleApiError, getMetrics, parsePagination } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 8;

interface CreateAppointmentBody {
  patientId?: string;
  departmentId?: string;
  doctorId?: string;
  scheduledAt: string; // ISO date
  appointmentType?: string;
  duration?: number;
  notes?: string;
  bookedVia?: string;
}

// GET - Fetch appointments for today or a specific period
export async function GET(req: NextRequest) {
  const t0 = Date.now();

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await safeDbQuery(
      () => prisma.user.findUnique({
        where: { clerkId: userId },
        select: { organizationId: true },
      }),
      2000
    );

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const orgId = user.organizationId;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const { page, limit, skip } = parsePagination(searchParams);

    // Parse date range
    let scheduledAtFilter: any = {};
    if (dateFrom || dateTo) {
      if (dateFrom) scheduledAtFilter.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        scheduledAtFilter.lte = to;
      }
    } else {
      // Default to today if no dates specified
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      scheduledAtFilter = { gte: today, lt: tomorrow };
    }

    const where: any = {
      organizationId: orgId,
      scheduledAt: scheduledAtFilter,
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    const [appointments, total] = await Promise.all([
      safeDbQuery(
        () => prisma.appointment.findMany({
          where,
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                fullName: true,
                phone: true,
                email: true,
              },
            },
            doctor: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: limit,
        }),
        3000,
        []
      ),
      safeDbQuery(() => prisma.appointment.count({ where }), 2000, 0),
    ]);

    const metrics = getMetrics(t0);

    return NextResponse.json(
      {
        success: true,
        appointments: (appointments || []).map((a) => ({
          id: a.id,
          patientId: a.patientId,
          patient: a.patient
            ? {
                id: a.patient.id,
                name: a.patient.fullName || `${a.patient.firstName} ${a.patient.lastName}`.trim(),
                phone: a.patient.phone,
                email: a.patient.email,
              }
            : null,
          doctorId: a.doctorId,
          doctor: a.doctor,
          departmentId: a.departmentId,
          department: a.department,
          scheduledAt: a.scheduledAt.toISOString(),
          duration: a.duration,
          status: a.status,
          type: a.appointmentType,
          notes: a.notes,
          bookedVia: a.bookedVia,
          bookedAt: a.bookedAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total: total || 0,
          pages: Math.ceil((total || 0) / limit),
          hasMore: page < Math.ceil((total || 0) / limit),
        },
        meta: metrics,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=15',
          'X-Response-Time': `${metrics.duration_ms}ms`,
        },
      }
    );
  } catch (error: any) {
    const duration = Date.now() - t0;
    console.error('[Appointments GET] Error:', error);
    return handleApiError(error, duration);
  }
}

// POST - Create new appointment
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const orgId = user.organizationId;
    const body: CreateAppointmentBody = await req.json();

    // Validate required fields
    if (!body.patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    if (!body.scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 });
    }

    const scheduledAt = new Date(body.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 });
    }

    // Check patient exists
    const patient = await prisma.patient.findFirst({
      where: {
        id: body.patientId,
        organizationId: orgId,
      },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        organizationId: orgId,
        patientId: body.patientId,
        departmentId: body.departmentId || null,
        doctorId: body.doctorId || null,
        scheduledAt,
        appointmentType: body.appointmentType || 'OPD',
        duration: body.duration || 30,
        notes: body.notes || null,
        bookedVia: body.bookedVia || 'manual',
        status: 'SCHEDULED',
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, fullName: true, phone: true, email: true } },
        doctor: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    // Update patient status
    await prisma.patient.update({
      where: { id: body.patientId },
      data: {
        patientStatus: 'APPOINTMENT_PENDING',
        lastContactedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      appointment: {
        id: appointment.id,
        patientId: appointment.patientId,
        patient: appointment.patient
          ? {
              id: appointment.patient.id,
              name: appointment.patient.fullName || `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim(),
              phone: appointment.patient.phone,
              email: appointment.patient.email,
            }
          : null,
        doctorId: appointment.doctorId,
        doctor: appointment.doctor,
        departmentId: appointment.departmentId,
        department: appointment.department,
        scheduledAt: appointment.scheduledAt.toISOString(),
        duration: appointment.duration,
        status: appointment.status,
        type: appointment.appointmentType,
        notes: appointment.notes,
        bookedVia: appointment.bookedVia,
        bookedAt: appointment.bookedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Appointments POST] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create appointment' }, { status: 500 });
  }
}

// PATCH - Update appointment
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const orgId = user.organizationId;
    const body = await req.json();
    const { appointmentId, status, notes, scheduledAt, doctorId, departmentId, appointmentType, duration } = body;

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 });
    }

    // Verify appointment belongs to org
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId: orgId,
      },
      include: { patient: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Update appointment
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...(status && { status: status.toUpperCase() }),
        ...(notes && { notes }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(doctorId !== undefined && { doctorId: doctorId || null }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
        ...(appointmentType && { appointmentType }),
        ...(duration && { duration: Number(duration) }),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, fullName: true, phone: true, email: true } },
        doctor: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    // Update patient status based on appointment status
    if (status === 'CONFIRMED') {
      await prisma.patient.update({
        where: { id: appointment.patientId },
        data: { patientStatus: 'APPOINTMENT_CONFIRMED' },
      });
    } else if (status === 'RESCHEDULED') {
      await prisma.patient.update({
        where: { id: appointment.patientId },
        data: { patientStatus: 'APPOINTMENT_PENDING' },
      });
    } else if (status === 'COMPLETED') {
      await prisma.patient.update({
        where: { id: appointment.patientId },
        data: { patientStatus: 'VISITED', totalVisits: { increment: 1 } },
      });
    } else if (status === 'CANCELLED' || status === 'NO_SHOW') {
      await prisma.patient.update({
        where: { id: appointment.patientId },
        data: { patientStatus: 'LOST' },
      });
    }

    return NextResponse.json({
      success: true,
      appointment: {
        id: updated.id,
        patientId: updated.patientId,
        patient: updated.patient
          ? {
              id: updated.patient.id,
              name: updated.patient.fullName || `${updated.patient.firstName} ${updated.patient.lastName}`.trim(),
              phone: updated.patient.phone,
              email: updated.patient.email,
            }
          : null,
        doctor: updated.doctor,
        department: updated.department,
        scheduledAt: updated.scheduledAt.toISOString(),
        status: updated.status,
        notes: updated.notes,
      },
    });
  } catch (error: any) {
    console.error('[Appointments PATCH] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update appointment' }, { status: 500 });
  }
}
