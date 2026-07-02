import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── Canonical DB access (standalone — no Next.js runtime needed) ───
const DB_DIR = process.env.DATA_DIR || path.join(process.env.HOME || '', '.openclaw-dashboard');
const DB_PATH = path.join(DB_DIR, 'data.db');

function getResearcherDb(): Database.Database {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

function upsertTechUpdate(db: Database.Database, item: TechDigestItem & { date_iso?: string }): void {
  db.prepare(`
    INSERT OR REPLACE INTO tech_updates (url, category_id, category_label, category_icon, title, summary, source, date, source_ref, date_iso)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.url, item.category_id, item.category_label,
    '', item.title, item.summary || '',
    item.source || '', item.date_iso || null, item.source || null,
    item.date_iso || new Date().toISOString().slice(0, 10),
  );
}

function upsertMarketSignal(db: Database.Database, item: MarketSignalItem): void {
  db.prepare(`
    INSERT OR REPLACE INTO market_signals (url, type, source, competitor, source_ref, title, context, analysis, tags_json, date, date_iso)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.url, item.type, item.source || '', null,
    item.source || null, item.title, item.context || '',
    '', '[]', item.date_iso || null,
    item.date_iso || new Date().toISOString().slice(0, 10),
  );
}

// ─── Interfaces ───

interface MarketSignalItem {
  url: string;
  type: string;
  source: string;
  title: string;
  context: string;
  date_iso: string;
}

interface TechDigestItem {
  url: string;
  category_id: string;
  category_label: string;
  title: string;
  summary: string;
  source: string;
  date_iso?: string;
}

interface ResearchResult {
  marketSignals: MarketSignalItem[];
  techDigest: TechDigestItem[];
}

const MARKET_TOPICS = [
  "Figma",
  "Miro", 
  "user research platforms",
  "AI design tools",
  "collaboration software funding"
];

const TECH_TOPICS = [
  { query: "Next.js 14", category_id: "dev-tooling", category_label: "Dev Tooling" },
  { query: "FastAPI", category_id: "dev-tooling", category_label: "Dev Tooling" },
  { query: "agentic workflows", category_id: "llm-research", category_label: "LLM Research" },
  { query: "LangGraph", category_id: "llm-research", category_label: "LLM Research" },
  { query: "Recharts", category_id: "ui-ux-trends", category_label: "UI/UX Trends" },
  { query: "knowledge graphs", category_id: "llm-research", category_label: "LLM Research" }
];

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function parseSource(title: string): string {
  const sources = ['TechCrunch', 'The Verge', 'Hacker News', 'GitHub', 'Bloomberg', 'Forbes', 'Wired', 'Ars Technica', 'Product Hunt'];
  for (const source of sources) {
    if (title.toLowerCase().includes(source.toLowerCase())) {
      return source;
    }
  }
  return 'Web';
}

function determineSignalType(query: string, title: string): string {
  const lowerTitle = title.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  if (lowerTitle.includes('funding') || lowerTitle.includes('raised') || lowerTitle.includes('series')) {
    return 'funding-round';
  }
  if (lowerTitle.includes('acquir') || lowerTitle.includes('acquisition') || lowerTitle.includes('buy')) {
    return 'acquisition';
  }
  if (lowerTitle.includes('feature') || lowerTitle.includes('launch') || lowerTitle.includes('release')) {
    return 'competitor-feature';
  }
  if (lowerQuery.includes('funding')) {
    return 'funding-round';
  }
  return 'market-trend';
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return 'Web';
  }
}

async function performSearch(query: string, freshness: string = 'pw'): Promise<unknown[]> {
  try {
    const cmd = `openclaw web_search --query "${query}" --freshness ${freshness} --count 5`;
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
    const parsed = JSON.parse(output);
    
    if (parsed.citations && Array.isArray(parsed.citations)) {
      return parsed.citations;
    }
    if (parsed.results && Array.isArray(parsed.results)) {
      return parsed.results;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Search error for "${query}": ${errMsg}\n`);
    return [];
  }
}

async function gatherMarketSignals(): Promise<MarketSignalItem[]> {
  const signals: MarketSignalItem[] = [];
  const today = getTodayDate();
  
  for (const topic of MARKET_TOPICS) {
    const results = await performSearch(topic);
    
    for (const item of results.slice(0, 3)) {
      const typedItem = item as { title?: string; url?: string; snippet?: string; source?: string };
      
      const title = typedItem.title || 'Untitled';
      const url = typedItem.url || '';
      const snippet = typedItem.snippet || '';
      
      signals.push({
        url,
        type: determineSignalType(topic, title),
        source: typedItem.source || parseSource(title),
        title,
        context: `Related to "${topic}": ${snippet.substring(0, 150)}`,
        date_iso: today
      });
    }
  }
  
  return signals;
}

async function gatherTechDigest(): Promise<TechDigestItem[]> {
  const digest: TechDigestItem[] = [];
  
  for (const topic of TECH_TOPICS) {
    const results = await performSearch(topic.query);
    
    for (const item of results.slice(0, 2)) {
      const typedItem = item as { title?: string; url?: string; snippet?: string; source?: string };
      
      const title = typedItem.title || 'Untitled';
      const url = typedItem.url || '';
      const snippet = typedItem.snippet || '';
      
      digest.push({
        url,
        category_id: topic.category_id,
        category_label: topic.category_label,
        title,
        summary: snippet.substring(0, 200),
        source: typedItem.source || extractDomain(url)
      });
    }
  }
  
  return digest;
}

async function main() {
  try {
    const [marketSignals, techDigest] = await Promise.all([
      gatherMarketSignals(),
      gatherTechDigest()
    ]);

    // ─── Write directly to canonical SQLite DB ───
    const db = getResearcherDb();
    let techInserted = 0;
    let marketInserted = 0;

    for (const item of techDigest) {
      try {
        upsertTechUpdate(db, item);
        techInserted++;
      } catch (err) {
        process.stderr.write(`[DB] Failed to upsert tech update ${item.url}: ${err}\n`);
      }
    }

    for (const item of marketSignals) {
      try {
        upsertMarketSignal(db, item);
        marketInserted++;
      } catch (err) {
        process.stderr.write(`[DB] Failed to upsert market signal ${item.url}: ${err}\n`);
      }
    }

    db.close();

    const result: ResearchResult = { marketSignals, techDigest };
    // Still output JSON for logging/debugging, but DB is the canonical write target
    process.stderr.write(`[Researcher] Canonical DB write complete: ${techInserted} tech, ${marketInserted} market signals.\n`);
    process.stdout.write(JSON.stringify(result, null, 2));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Fatal error: ${errMsg}\n`);

    const errorResult: ResearchResult = { marketSignals: [], techDigest: [] };
    process.stdout.write(JSON.stringify(errorResult));
    process.exit(1);
  }
}

main();