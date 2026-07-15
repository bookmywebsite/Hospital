import { NextResponse } from 'next/server';
import { createCallWorker } from '@/lib/queue/call-worker';

let workerStarted = false;

export async function POST() {
  try {
    if (!workerStarted) {
      createCallWorker();
      workerStarted = true;
      return NextResponse.json({ success: true, message: 'Call worker started' });
    }
    return NextResponse.json({ success: true, message: 'Worker already running' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ workerRunning: workerStarted });
}