// src/lib/scheduler/cron.ts
// Auto-runs processPendingJobs every minute in background
// Works in both local dev and production

let cronInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export function startCronWorker() {
  if (cronInterval) return; // already started

  console.log('✅ Scheduler cron started — running every 30 seconds');

  // Run immediately on start
  runCron();

  // Then every 30 seconds
  cronInterval = setInterval(runCron, 30 * 1000);
}

export function stopCronWorker() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('Scheduler cron stopped');
  }
}

async function runCron() {
  if (isRunning) return; // prevent overlap
  isRunning = true;

  try {
    const { processPendingJobs } = await import('./scheduler');
    const result = await processPendingJobs();

    if (result.processed > 0 || result.failed > 0) {
      console.log(`[Cron 30s] Processed: ${result.processed}, Failed: ${result.failed}`);
      result.details.forEach((d) => console.log(`[Cron 30s] ${d}`));
    }
  } catch (err: any) {
    console.error('[Cron] Error:', err.message);
  } finally {
    isRunning = false;
  }
}