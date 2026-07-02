#!/usr/bin/env npx tsx
/**
 * One-time backfill: reconcile all data from legacy TS files into canonical SQLite DB.
 *
 * Usage:  npx tsx scripts/backfill-canonical.ts
 *
 * Reports: scanned / inserted / deduped (already existed) / rejected counts.
 * Safe to run multiple times — uses INSERT OR IGNORE so existing rows are preserved.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── Resolve DB path (same logic as lib/db/schema.ts) ───
const DB_DIR = process.env.DATA_DIR || path.join(process.env.HOME || '', '.openclaw-dashboard');
const DB_PATH = path.join(DB_DIR, 'data.db');

if (!fs.existsSync(DB_PATH)) {
  console.error(`[Backfill] ERROR: Database not found at ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ─── Category mappings (from seed-feeds.ts) ───
const CATEGORY_ICONS: Record<string, string> = {
  'ai-models': 'Cpu',
  'agent-orchestration': 'MessageSquare',
  'frontend-tooling': 'Code',
  'knowledge-graphs': 'BookOpen',
  'dev-tools': 'Zap',
  security: 'Shield',
};

const CATEGORY_LABELS: Record<string, string> = {
  'ai-models': 'AI Model Releases',
  'agent-orchestration': 'Agent Orchestration',
  'frontend-tooling': 'Engineering Tools & Frameworks',
  'knowledge-graphs': 'Knowledge Graphs',
  'dev-tools': 'Dev Tools',
  security: 'Security',
};

// ─── Counters ───
const report = {
  tech: { scanned: 0, inserted: 0, deduped: 0, rejected: 0 },
  market: { scanned: 0, inserted: 0, deduped: 0, rejected: 0 },
  practitioner: { scanned: 0, inserted: 0, deduped: 0, rejected: 0 },
};

// ─── Prepared statements (INSERT OR IGNORE preserves existing rows) ───
const insertTech = db.prepare(`
  INSERT OR IGNORE INTO tech_updates (url, category_id, category_label, category_icon, title, summary, source, date, source_ref, date_iso)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMarket = db.prepare(`
  INSERT OR IGNORE INTO market_signals (url, type, source, competitor, source_ref, title, context, analysis, tags_json, date, date_iso)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertPractitioner = db.prepare(`
  INSERT OR IGNORE INTO practitioner_signals (url, type, platform, author, source_ref, title, verbatim, context, relevance, tags_json, date, date_iso)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// ─── Also restore any soft-deleted rows whose URL is in the source files ───
const restoreTech = db.prepare(`UPDATE tech_updates SET deleted = 0 WHERE url = ? AND deleted = 1`);
const restoreMarket = db.prepare(`UPDATE market_signals SET deleted = 0 WHERE url = ? AND deleted = 1`);
const restorePractitioner = db.prepare(`UPDATE practitioner_signals SET deleted = 0 WHERE url = ? AND deleted = 1`);

// ─── Load TS source files dynamically ───
async function loadTechSignals(): Promise<any[]> {
  try {
    const mod = await import(path.resolve(__dirname, '../lib/techRadarData'));
    return mod.techSignals || [];
  } catch (err) {
    console.error('[Backfill] Failed to load techRadarData.ts:', err);
    return [];
  }
}

async function loadMarketSignals(): Promise<any[]> {
  try {
    const mod = await import(path.resolve(__dirname, '../lib/marketNewsData'));
    return mod.marketNewsData || [];
  } catch (err) {
    console.error('[Backfill] Failed to load marketNewsData.ts:', err);
    return [];
  }
}

async function loadPractitionerSignals(): Promise<any[]> {
  try {
    const mod = await import(path.resolve(__dirname, '../lib/signalHunterData'));
    return mod.signalHunterData || [];
  } catch (err) {
    console.error('[Backfill] Failed to load signalHunterData.ts:', err);
    return [];
  }
}

// ─── Main backfill ───
async function main() {
  console.log(`[Backfill] Canonical DB: ${DB_PATH}`);
  console.log(`[Backfill] Starting reconciliation from legacy TS files...\n`);

  // Tech Updates
  const techSignals = await loadTechSignals();
  const techTx = db.transaction(() => {
    for (const signal of techSignals) {
      report.tech.scanned++;
      if (!signal.url || !signal.title) { report.tech.rejected++; continue; }

      const result = insertTech.run(
        signal.url,
        signal.category,
        CATEGORY_LABELS[signal.category] || signal.category,
        CATEGORY_ICONS[signal.category] || '',
        signal.title,
        signal.summary || '',
        signal.source || '',
        signal.date || null,
        signal.source || null,
        signal.date || null,
      );

      if (result.changes > 0) {
        report.tech.inserted++;
      } else {
        report.tech.deduped++;
      }

      // Restore if soft-deleted
      restoreTech.run(signal.url);
    }
  });
  techTx();

  // Market Signals
  const marketSignals = await loadMarketSignals();
  const marketTx = db.transaction(() => {
    for (const signal of marketSignals) {
      report.market.scanned++;
      if (!signal.url || !signal.title) { report.market.rejected++; continue; }

      const result = insertMarket.run(
        signal.url,
        signal.type,
        signal.source || '',
        signal.competitor || null,
        signal.source || null,
        signal.title,
        signal.context || '',
        '',
        JSON.stringify(signal.tags || []),
        signal.date || null,
        signal.date || null,
      );

      if (result.changes > 0) {
        report.market.inserted++;
      } else {
        report.market.deduped++;
      }

      restoreMarket.run(signal.url);
    }
  });
  marketTx();

  // Practitioner Signals
  const practitionerSignals = await loadPractitionerSignals();
  const practTx = db.transaction(() => {
    for (const signal of practitionerSignals) {
      report.practitioner.scanned++;
      if (!signal.url || !signal.title) { report.practitioner.rejected++; continue; }

      const result = insertPractitioner.run(
        signal.url,
        signal.type,
        signal.platform || '',
        signal.author || null,
        signal.platform || null,
        signal.title,
        signal.verbatim || '',
        signal.context || '',
        signal.relevance || 0,
        JSON.stringify(signal.tags || []),
        signal.date || null,
        signal.date_iso || signal.date || null,
      );

      if (result.changes > 0) {
        report.practitioner.inserted++;
      } else {
        report.practitioner.deduped++;
      }

      restorePractitioner.run(signal.url);
    }
  });
  practTx();

  db.close();

  // ─── Report ───
  console.log('═══════════════════════════════════════════════════');
  console.log('  BACKFILL REPORT — Legacy TS → Canonical SQLite');
  console.log('═══════════════════════════════════════════════════');
  for (const [domain, counts] of Object.entries(report)) {
    console.log(`\n  ${domain.toUpperCase()}:`);
    console.log(`    Scanned:  ${counts.scanned}`);
    console.log(`    Inserted: ${counts.inserted} (new)`);
    console.log(`    Deduped:  ${counts.deduped} (already in DB)`);
    console.log(`    Rejected: ${counts.rejected} (missing url/title)`);
  }

  const totalInserted = report.tech.inserted + report.market.inserted + report.practitioner.inserted;
  const totalDeduped = report.tech.deduped + report.market.deduped + report.practitioner.deduped;
  console.log(`\n  TOTAL: ${totalInserted} inserted, ${totalDeduped} deduped`);
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('[Backfill] Fatal:', err);
  process.exit(1);
});
