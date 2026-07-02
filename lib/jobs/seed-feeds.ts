/**
 * LEGACY seed function — DEPRECATED.
 *
 * The canonical write path is now:
 *   1. researcher-run.ts → writes directly to SQLite DB
 *   2. POST /api/tech-updates and POST /api/market-intel
 *
 * This function is retained as a no-op stub so existing imports
 * (scheduler.ts, layout.tsx) don't break. The TS data files
 * (techRadarData.ts, marketNewsData.ts, signalHunterData.ts) are
 * frozen legacy snapshots — all new data flows through the DB.
 *
 * The destructive softDeleteStale() logic has been removed because
 * it wiped rows written via the API that weren't in the TS files.
 */

export function seedFeeds() {
  console.log('[SeedFeeds] No-op — canonical writes go directly to SQLite DB. Legacy seed disabled.');
}
