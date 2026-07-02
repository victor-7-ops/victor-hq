import cron from 'node-cron';
import { runDailyMetricsAggregation } from './daily-metrics';

let isInitialized = false;

export function initializeScheduler() {
  if (isInitialized) {
    console.log('[Scheduler] Already initialized.');
    return;
  }

  console.log('[Scheduler] Initializing...');

  // NOTE: seedFeeds() cron removed — canonical writes now go directly to SQLite DB
  // via researcher-run.ts and POST /api/tech-updates | /api/market-intel.
  // The legacy TS-file-to-DB bridge is no longer needed.

  // Schedule daily metrics aggregation to run at 2:00 AM every day
  cron.schedule('0 2 * * *', runDailyMetricsAggregation, {
    timezone: "Europe/Amsterdam"
  });

  console.log('[Scheduler] Daily metrics (02:00) scheduled. Feed writes go directly to DB.');

  isInitialized = true;
}
