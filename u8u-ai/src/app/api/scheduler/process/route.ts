import { NextRequest, NextResponse } from 'next/server';
import { processPendingJobs } from '@/lib/scheduler/scheduler';
import { resetDailyLeadCounts } from '@/lib/assignment/engine';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isDev      = process.env.NODE_ENV === 'development';

    if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processPendingJobs();

    // Reset daily lead counts at midnight IST (18:30 UTC)
    const utcHour   = new Date().getUTCHours();
    const utcMinute = new Date().getUTCMinutes();

    if (utcHour === 18 && utcMinute < 5) {
      const orgs = await prisma.organization.findMany({ select: { id: true } });
      for (const org of orgs) {
        await resetDailyLeadCounts(org.id);
      }
    }

    return NextResponse.json({
      success:   true,
      processed: result.processed,
      failed:    result.failed,
      details:   result.details,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron Processor]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const pendingCount = await (prisma as any).scheduledJob
    .count({ where: { status: 'PENDING' } })
    .catch(() => 0);

  return NextResponse.json({
    status:  'ok',
    pending: pendingCount,
    time:    new Date().toISOString(),
  });
}