import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/notifications
 * Get recent notifications for the logged-in user's organization
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const orgId = user.organizationId;

    // Get recent activity and alerts
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const today1 = new Date(today0);
    today1.setHours(23, 59, 59, 999);

    // Fetch missed appointments
    const missedAppointments = await prisma.appointment.findMany({
      where: {
        organizationId: orgId,
        status: 'NO_SHOW',
        scheduledAt: { gte: today0, lte: today1 },
      },
      select: { id: true, patient: { select: { fullName: true } } },
      take: 5,
    });

    // Fetch missed calls/callbacks
    const missedCalls = await prisma.callLog.findMany({
      where: {
        patient: { organizationId: orgId },
        status: { in: ['NO_ANSWER', 'BUSY', 'FAILED'] },
        startedAt: { gte: today0, lte: today1 },
      },
      distinct: ['toNumber'],
      take: 5,
    });

    // Fetch new leads
    const newLeads = await prisma.patient.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: today0, lte: today1 },
      },
      select: { id: true, fullName: true, source: true },
      take: 5,
    });

    const notifications = [
      ...missedAppointments.map((apt) => ({
        id: `apt-${apt.id}`,
        type: 'no_show',
        title: 'Missed Appointment',
        message: `${apt.patient?.fullName || 'Patient'} didn't show up`,
        severity: 'warning',
        timestamp: new Date().toISOString(),
      })),
      ...missedCalls.map((call, idx) => ({
        id: `call-${idx}`,
        type: 'missed_call',
        title: 'Missed Call',
        message: `Missed calls need follow-up - ${call.fromNumber}`,
        severity: 'info',
        timestamp: new Date().toISOString(),
      })),
      ...newLeads.map((lead) => ({
        id: `lead-${lead.id}`,
        type: 'new_lead',
        title: 'New Lead',
        message: `${lead.fullName || 'New contact'} via ${lead.source || 'website'}`,
        severity: 'info',
        timestamp: new Date().toISOString(),
      })),
    ];

    return NextResponse.json({
      success: true,
      notifications: notifications.slice(0, 10),
      unreadCount: notifications.filter((n) => n.severity === 'warning').length,
    });
  } catch (error: any) {
    console.error('[Notifications] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch notifications' }, { status: 500 });
  }
}
