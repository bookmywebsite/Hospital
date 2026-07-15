import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/search?q=query
 * Global search across patients, leads, appointments
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const orgId = user.organizationId;
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim().toLowerCase();

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
        message: 'Enter at least 2 characters to search',
      });
    }

    const limit = 20;

    // Search patients
    const patients = await prisma.patient.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        tier: true,
        patientStatus: true,
      },
      take: limit,
    });

    // Search leads (for backward compat)
    const leads = await prisma.lead.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { company: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        tier: true,
        status: true,
      },
      take: limit,
    });

    // Search appointments
    const appointments = await prisma.appointment.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { patient: { fullName: { contains: query, mode: 'insensitive' } } },
          { patient: { phone: { contains: query } } },
          { doctor: { name: { contains: query, mode: 'insensitive' } } },
          { department: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { name: true } },
        department: { select: { name: true } },
      },
      take: limit,
    });

    const results = [
      ...patients.map((p) => ({
        id: `patient-${p.id}`,
        type: 'patient',
        title: p.fullName || `${p.firstName} ${p.lastName}`.trim(),
        subtitle: p.email || p.phone || 'No contact',
        meta: p.tier || 'Regular',
        entityId: p.id,
      })),
      ...leads.map((l) => ({
        id: `lead-${l.id}`,
        type: 'lead',
        title: `${l.firstName} ${l.lastName}`.trim() || l.email || 'Unknown',
        subtitle: l.email || l.phone || l.company || 'No info',
        meta: l.company || l.tier || 'Lead',
        entityId: l.id,
      })),
      ...appointments.map((a) => ({
        id: `appointment-${a.id}`,
        type: 'appointment',
        title: a.patient?.fullName || 'Unknown Patient',
        subtitle: `${a.doctor?.name || 'Any'} · ${new Date(a.scheduledAt).toLocaleString('en-IN')}`,
        meta: a.status,
        entityId: a.id,
      })),
    ];

    return NextResponse.json({
      success: true,
      query,
      results: results.slice(0, 30),
      count: results.length,
    });
  } catch (error: any) {
    console.error('[Dashboard Search] Error:', error);
    return NextResponse.json({ error: error?.message || 'Search failed' }, { status: 500 });
  }
}
