import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface DashboardSettings {
  timezone?: string;
  callStartHour?: number;
  callEndHour?: number;
  enableNotifications?: boolean;
  defaultLanguage?: string;
  autoAssignment?: boolean;
  assignmentMode?: string;
}

/**
 * GET /api/dashboard/settings
 * Get current dashboard settings for user's organization
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { organization: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const org = user.organization!;

    return NextResponse.json({
      success: true,
      settings: {
        organizationId: org.id,
        organizationName: org.name,
        timezone: user.timezone || 'Asia/Kolkata',
        callStartHour: org.callStartHour || 9,
        callEndHour: org.callEndHour || 21,
        assignmentMode: org.assignmentMode || 'ROUND_ROBIN',
        defaultLanguages: org.defaultLanguages || ['EN', 'HI'],
        hospitalName: org.hospitalName,
        userTimezone: user.timezone || 'Asia/Kolkata',
        userRole: user.role,
      },
    });
  } catch (error: any) {
    console.error('[Dashboard Settings GET] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/dashboard/settings
 * Update dashboard settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const orgId = user.organizationId;
    const body: DashboardSettings = await req.json();

    const updates: any = {};

    // User-specific updates
    if (body.timezone) {
      await prisma.user.update({
        where: { clerkId: userId },
        data: { timezone: body.timezone },
      });
    }

    // Organization-wide updates (only admins)
    if (user.role === 'admin' || user.role === 'owner') {
      if (typeof body.callStartHour !== 'undefined') updates.callStartHour = body.callStartHour;
      if (typeof body.callEndHour !== 'undefined') updates.callEndHour = body.callEndHour;
      if (body.assignmentMode) updates.assignmentMode = body.assignmentMode;
      if (body.defaultLanguage) {
        const langs = body.defaultLanguage.split(',').map((l) => l.trim().toUpperCase());
        updates.defaultLanguages = langs;
      }

      const updated = await prisma.organization.update({
        where: { id: orgId },
        data: updates,
      });

      return NextResponse.json({
        success: true,
        message: 'Settings updated',
        settings: {
          callStartHour: updated.callStartHour,
          callEndHour: updated.callEndHour,
          assignmentMode: updated.assignmentMode,
          defaultLanguages: updated.defaultLanguages,
        },
      });
    } else {
      // Non-admin user, only update personal timezone
      return NextResponse.json({
        success: true,
        message: 'Personal settings updated',
        settings: { timezone: body.timezone || user.timezone },
      });
    }
  } catch (error: any) {
    console.error('[Dashboard Settings PATCH] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update settings' }, { status: 500 });
  }
}
