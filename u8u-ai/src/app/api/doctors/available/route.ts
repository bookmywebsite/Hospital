import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const { department, date } = Object.fromEntries(request.nextUrl.searchParams);

    // Build where clause
    let where: any = {
      organizationId: user.organizationId,
      isActive: true,
    };

    if (department) {
      where.department = { name: department };
    }

    // Fetch available doctors - Optimized with field selection and limit
    const doctors = await prisma.doctor.findMany({
      where,
      select: {
        id: true,
        name: true,
        specialization: true,
        availability: true,
        department: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
      take: 100, // Reasonable limit for dropdowns
    });

    // Filter by availability if date provided
    let available = doctors;
    if (date) {
      const selectedDate = new Date(date);
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][selectedDate.getDay()];

      available = doctors.filter(doctor => {
        if (!doctor.availability || typeof doctor.availability !== 'object') return true;
        const avail = doctor.availability as Record<string, any>;
        const dayAvail = avail[dayName];
        return dayAvail && dayAvail.isAvailable !== false;
      });
    }

    return NextResponse.json({ success: true, doctors: available });
  } catch (error: any) {
    console.error('[Doctors Available API]', error);
    return NextResponse.json({ error: error.message ?? 'Failed to fetch doctors' }, { status: 500 });
  }
}
