#!/usr/bin/env node
/**
 * Seed the OpenClaw Dashboard database with demo data.
 * Run: node scripts/seed-demo.mjs
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const DB_DIR = process.env.DATA_DIR || join(process.env.HOME || '', '.openclaw-dashboard');
const DB_PATH = join(DB_DIR, 'data.db');

mkdirSync(DB_DIR, { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`Seeding database at: ${DB_PATH}`);

// Run essential migrations first
const MIGRATIONS_SQL = `
CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY CHECK(id = 1), openclaw_path TEXT NOT NULL DEFAULT '~/.openclaw', project_repo_path TEXT NOT NULL DEFAULT '', github_repo TEXT, daily_spend_threshold REAL NOT NULL DEFAULT 15, key_rotation_reminder_days INTEGER NOT NULL DEFAULT 30, accent_color TEXT NOT NULL DEFAULT '#3b82f6', mission_title TEXT NOT NULL DEFAULT 'OpenClaw', profile_image TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT OR IGNORE INTO config (id) VALUES (1);
CREATE TABLE IF NOT EXISTS memory_entries (id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('session_summary','decision','note','alert')), title TEXT NOT NULL, content TEXT NOT NULL, agent TEXT, tags_json TEXT NOT NULL DEFAULT '[]', started_at TEXT, completed_at TEXT, duration_sec INTEGER, tokens INTEGER NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0, pending_review INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), project_id TEXT NOT NULL DEFAULT 'default');
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(type);
CREATE INDEX IF NOT EXISTS idx_memory_created ON memory_entries(created_at);
CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, priority TEXT NOT NULL DEFAULT 'medium', deadline TEXT, tags TEXT NOT NULL DEFAULT '[]', assignee TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE TABLE IF NOT EXISTS daily_metrics (date TEXT PRIMARY KEY, cost_usd REAL NOT NULL DEFAULT 0, tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0, cache_write_cost REAL NOT NULL DEFAULT 0, compute_cost REAL NOT NULL DEFAULT 0, providers_json TEXT NOT NULL DEFAULT '{}', agents_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS tech_updates (url TEXT PRIMARY KEY, category_id TEXT NOT NULL, category_label TEXT NOT NULL, category_icon TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', date TEXT, source_ref TEXT, ingested_at TEXT NOT NULL DEFAULT (datetime('now')), deleted INTEGER NOT NULL DEFAULT 0, date_iso TEXT);
CREATE TABLE IF NOT EXISTS market_signals (url TEXT PRIMARY KEY, type TEXT NOT NULL, source TEXT NOT NULL DEFAULT '', competitor TEXT, source_ref TEXT, title TEXT NOT NULL, context TEXT NOT NULL DEFAULT '', analysis TEXT NOT NULL DEFAULT '', tags_json TEXT NOT NULL DEFAULT '[]', date TEXT, ingested_at TEXT NOT NULL DEFAULT (datetime('now')), deleted INTEGER NOT NULL DEFAULT 0, date_iso TEXT);
CREATE TABLE IF NOT EXISTS practitioner_signals (url TEXT PRIMARY KEY, type TEXT NOT NULL, platform TEXT NOT NULL DEFAULT '', author TEXT, source_ref TEXT, title TEXT NOT NULL, verbatim TEXT NOT NULL DEFAULT '', context TEXT NOT NULL DEFAULT '', relevance REAL NOT NULL DEFAULT 0, tags_json TEXT NOT NULL DEFAULT '[]', date TEXT, ingested_at TEXT NOT NULL DEFAULT (datetime('now')), deleted INTEGER NOT NULL DEFAULT 0, date_iso TEXT);
CREATE TABLE IF NOT EXISTS reference_files (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', tags_json TEXT NOT NULL DEFAULT '[]', project_id TEXT NOT NULL DEFAULT 'default', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS competitors (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Uncategorized', project_id TEXT NOT NULL DEFAULT 'default', last_updated TEXT, swot_json TEXT, updates_json TEXT, feedback_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), deleted INTEGER NOT NULL DEFAULT 0, watched INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS alerts (id TEXT PRIMARY KEY, category TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info', title TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', details TEXT, acknowledged INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_alerts_ack ON alerts(acknowledged);
CREATE TABLE IF NOT EXISTS agent_performance_metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, timestamp TEXT NOT NULL DEFAULT (datetime('now')), tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0, latency_ms REAL NOT NULL DEFAULT 0, success INTEGER NOT NULL DEFAULT 1, model TEXT, task_id TEXT);
CREATE TABLE IF NOT EXISTS ds_run_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, phase TEXT NOT NULL CHECK(phase IN ('foundations','component','qa','stress')), component TEXT, batch TEXT, status TEXT NOT NULL CHECK(status IN ('green','yellow','red')), fidelity REAL NOT NULL, token_reuse REAL NOT NULL, variant_coverage REAL NOT NULL, raw_values REAL NOT NULL, qa_pass INTEGER NOT NULL, iterations INTEGER NOT NULL, cost_usd REAL NOT NULL, latency_ms REAL NOT NULL, alerts TEXT NOT NULL DEFAULT '[]', timestamp TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS task_overrides (id TEXT PRIMARY KEY, title TEXT, description TEXT, status TEXT, priority TEXT, type TEXT, tags_json TEXT, sprint_id TEXT, assigned_agent TEXT, last_commit_ref TEXT, due_date TEXT, design_status TEXT, manual_notes TEXT, cost_usd REAL, updated_at TEXT NOT NULL DEFAULT (datetime('now')), project_id TEXT NOT NULL DEFAULT 'default');
CREATE TABLE IF NOT EXISTS task_history (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, change_json TEXT NOT NULL DEFAULT '{}', changed_at TEXT NOT NULL DEFAULT (datetime('now')), project_id TEXT NOT NULL DEFAULT 'default');
CREATE TABLE IF NOT EXISTS onboarded (id INTEGER PRIMARY KEY CHECK(id = 1), value INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO onboarded (id, value) VALUES (1, 0);
`;

db.exec(MIGRATIONS_SQL);
console.log('Migrations applied.');

// ── Config ──
db.prepare(`INSERT OR REPLACE INTO config (id, openclaw_path, project_repo_path, daily_spend_threshold, accent_color) VALUES (1, '~/.openclaw', '~/my-project', 15, '#3b82f6')`).run();

// ── Memory Entries ──
const memoryEntries = [
  { type: 'session_summary', title: 'Onboarding flow redesign', content: 'Redesigned the 10-step onboarding wizard. Added auto-detection for prerequisites, gateway connection testing, and agent discovery.', agent: 'architect', tags: ['onboarding', 'ux'] },
  { type: 'decision', title: 'Switch to Tailwind v4', content: 'Decided to migrate from Tailwind v3 to v4 for the new @theme token system and improved CSS variable support.', agent: 'architect', tags: ['tailwind', 'css'] },
  { type: 'note', title: 'Cost anomaly detection', content: 'Implemented ratio-based anomaly detection for daily costs. Threshold set at 2x the 7-day moving average.', agent: 'analyst', tags: ['costs', 'monitoring'] },
  { type: 'alert', title: 'Gateway connection timeout', content: 'The OpenClaw gateway experienced intermittent timeouts during peak hours. Increased timeout from 5s to 15s.', agent: 'devops', tags: ['gateway', 'reliability'] },
  { type: 'session_summary', title: 'Kanban board implementation', content: 'Built full kanban board with drag-and-drop columns, ticket chat threads, and agent assignment capabilities.', agent: 'developer', tags: ['kanban', 'feature'] },
  { type: 'decision', title: 'Use SQLite for local persistence', content: 'Chose better-sqlite3 over PostgreSQL for zero-config local deployment. All data stored at ~/.openclaw-dashboard/data.db.', agent: 'architect', tags: ['database', 'architecture'] },
  { type: 'note', title: 'Memory health scoring', content: 'Agent memory chunks scored on freshness (0-100), completeness (0-100), and relevance (0-100). Overall health is weighted average.', agent: 'analyst', tags: ['memory', 'health'] },
  { type: 'session_summary', title: 'DAG pipeline builder', content: 'Implemented visual DAG editor using @xyflow/react. Jobs can be connected with dependency chains and scheduled via cron expressions.', agent: 'developer', tags: ['crons', 'visualization'] },
];

for (const entry of memoryEntries) {
  db.prepare(`INSERT OR IGNORE INTO memory_entries (id, type, title, content, agent, tags_json, tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    randomUUID(), entry.type, entry.title, entry.content, entry.agent, JSON.stringify(entry.tags), Math.floor(Math.random() * 50000) + 1000, Math.random() * 0.5
  );
}

// ── Todos ──
const todos = [
  { title: 'Add WebSocket support for real-time updates', priority: 'high', status: 'open', assignee: 'Agent 1' },
  { title: 'Implement dark/light theme toggle', priority: 'medium', status: 'open', assignee: 'Agent 2' },
  { title: 'Write unit tests for cost calculator', priority: 'high', status: 'done', assignee: 'Agent 3' },
  { title: 'Add CSV export for cost reports', priority: 'low', status: 'open', assignee: 'Agent 1' },
  { title: 'Optimize constellation graph rendering', priority: 'medium', status: 'open', assignee: 'Agent 4' },
  { title: 'Add pagination to memory log', priority: 'low', status: 'done', assignee: 'Agent 2' },
  { title: 'Security audit on API routes', priority: 'high', status: 'open', assignee: 'Agent 3' },
];

for (const todo of todos) {
  db.prepare(`INSERT OR IGNORE INTO todos (id, title, priority, status, assignee) VALUES (?, ?, ?, ?, ?)`).run(
    randomUUID(), todo.title, todo.priority, todo.status, todo.assignee
  );
}

// ── Daily Metrics (cost data for last 14 days) ──
for (let i = 13; i >= 0; i--) {
  const date = new Date();
  date.setDate(date.getDate() - i);
  const dateStr = date.toISOString().split('T')[0];
  const baseCost = 3 + Math.random() * 12;
  const tokensIn = Math.floor(50000 + Math.random() * 200000);
  const tokensOut = Math.floor(20000 + Math.random() * 80000);

  db.prepare(`INSERT OR REPLACE INTO daily_metrics (date, cost_usd, tokens_in, tokens_out, cache_write_cost, compute_cost, providers_json, agents_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    dateStr,
    Math.round(baseCost * 100) / 100,
    tokensIn,
    tokensOut,
    Math.round(baseCost * 0.1 * 100) / 100,
    Math.round(baseCost * 0.9 * 100) / 100,
    JSON.stringify({ 'anthropic': Math.round(baseCost * 0.7 * 100) / 100, 'openai': Math.round(baseCost * 0.3 * 100) / 100 }),
    JSON.stringify({ 'architect': Math.round(baseCost * 0.3 * 100) / 100, 'developer': Math.round(baseCost * 0.4 * 100) / 100, 'analyst': Math.round(baseCost * 0.2 * 100) / 100, 'devops': Math.round(baseCost * 0.1 * 100) / 100 })
  );
}

// ── Tech Updates ──
const techUpdates = [
  { url: 'https://example.com/react-19-stable', category_id: 'frameworks', category_label: 'Frameworks', title: 'React 19 reaches stable', summary: 'React 19 introduces Server Components, Actions, and improved hydration.', source: 'React Blog', date_iso: '2026-03-15' },
  { url: 'https://example.com/tailwind-v4', category_id: 'css', category_label: 'CSS', title: 'Tailwind CSS v4 released', summary: 'New @theme tokens, CSS-first configuration, and improved performance.', source: 'Tailwind Blog', date_iso: '2026-03-10' },
  { url: 'https://example.com/bun-1.2', category_id: 'runtime', category_label: 'Runtime', title: 'Bun 1.2 with improved Node.js compat', summary: 'Better Node.js compatibility and 30% faster install times.', source: 'Bun Blog', date_iso: '2026-03-12' },
  { url: 'https://example.com/claude-4', category_id: 'ai', category_label: 'AI/ML', title: 'Claude 4.5 model family released', summary: 'Anthropic releases Claude 4.5 Opus, Sonnet, and Haiku with 1M context.', source: 'Anthropic', date_iso: '2026-03-18' },
  { url: 'https://example.com/deno-2.2', category_id: 'runtime', category_label: 'Runtime', title: 'Deno 2.2 with workspace support', summary: 'Native monorepo support and improved npm compatibility.', source: 'Deno Blog', date_iso: '2026-03-08' },
];

for (const update of techUpdates) {
  db.prepare(`INSERT OR REPLACE INTO tech_updates (url, category_id, category_label, title, summary, source, date_iso) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    update.url, update.category_id, update.category_label, update.title, update.summary, update.source, update.date_iso
  );
}

// ── Market Signals ──
const marketSignals = [
  { url: 'https://example.com/signal-1', type: 'competitor_move', title: 'Competitor X launches AI agent marketplace', context: 'Direct competitor launched a marketplace for third-party AI agents.', analysis: 'This could fragment the agent ecosystem. We should consider platform partnerships.', tags: ['competition', 'marketplace'] },
  { url: 'https://example.com/signal-2', type: 'market_trend', title: 'Enterprise AI agent adoption up 340%', context: 'Gartner report shows massive enterprise adoption of AI agent frameworks.', analysis: 'The market is validating our approach. Focus on enterprise features.', tags: ['enterprise', 'growth'] },
  { url: 'https://example.com/signal-3', type: 'technology', title: 'MCP protocol gaining traction', context: 'Model Context Protocol (MCP) being adopted by major AI tool vendors.', analysis: 'We should ensure full MCP compatibility in our agent framework.', tags: ['mcp', 'protocol'] },
];

for (const signal of marketSignals) {
  db.prepare(`INSERT OR REPLACE INTO market_signals (url, type, title, context, analysis, tags_json, date_iso) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    signal.url, signal.type, signal.title, signal.context, signal.analysis, JSON.stringify(signal.tags), '2026-03-18'
  );
}

// ── Practitioner Signals ──
const practitionerSignals = [
  { url: 'https://reddit.com/r/ai/1', type: 'pain_point', platform: 'Reddit', title: 'Struggling with AI agent cost management', verbatim: 'We spent $2k last month on AI agents and have no idea where the money went. Need better observability.', relevance: 0.9, tags: ['costs', 'observability'] },
  { url: 'https://reddit.com/r/ai/2', type: 'feature_request', platform: 'Reddit', title: 'Need visual pipeline builder for AI workflows', verbatim: 'I wish there was a visual way to chain AI agents together, like a DAG builder for cron jobs.', relevance: 0.85, tags: ['pipelines', 'ux'] },
  { url: 'https://twitter.com/dev/1', type: 'positive_signal', platform: 'Twitter', title: 'Loving the local-first AI dashboard approach', verbatim: 'Finally found a dashboard that runs locally and doesn\'t send my data to the cloud. This is the way.', relevance: 0.8, tags: ['local-first', 'privacy'] },
];

for (const signal of practitionerSignals) {
  db.prepare(`INSERT OR REPLACE INTO practitioner_signals (url, type, platform, title, verbatim, relevance, tags_json, date_iso) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    signal.url, signal.type, signal.platform, signal.title, signal.verbatim, signal.relevance, JSON.stringify(signal.tags), '2026-03-18'
  );
}

// ── Reference Files ──
const referenceFiles = [
  { title: 'Architecture Decision Records', content: '<h2>ADR-001: Local-First Architecture</h2><p>All data stored locally in SQLite. No cloud dependency required.</p><h2>ADR-002: SSE over WebSocket</h2><p>Chose Server-Sent Events for real-time updates due to simpler implementation and automatic reconnection.</p>', tags: ['architecture', 'decisions'] },
  { title: 'Agent Onboarding Guide', content: '<h2>Creating a New Agent</h2><p>1. Create a directory under <code>agents/</code></p><p>2. Add a <code>SOUL.md</code> file with the agent\'s personality</p><p>3. Configure the agent in <code>agents.json</code></p>', tags: ['guide', 'agents'] },
  { title: 'API Reference Notes', content: '<h2>Gateway API</h2><p>The OpenClaw gateway exposes a REST API on the configured port. Authentication via Bearer token from <code>openclaw.json</code>.</p>', tags: ['api', 'reference'] },
];

for (const file of referenceFiles) {
  db.prepare(`INSERT OR IGNORE INTO reference_files (id, title, content, tags_json) VALUES (?, ?, ?, ?)`).run(
    randomUUID(), file.title, file.content, JSON.stringify(file.tags)
  );
}

// ── Competitors ──
const competitors = [
  { name: 'CrewAI', url: 'https://crewai.com', description: 'Multi-agent orchestration framework for building AI agent teams.', category: 'Agent Frameworks' },
  { name: 'AutoGen', url: 'https://microsoft.github.io/autogen', description: 'Microsoft\'s multi-agent conversation framework.', category: 'Agent Frameworks' },
  { name: 'LangGraph', url: 'https://langchain.com/langgraph', description: 'Graph-based orchestration for LLM agents by LangChain.', category: 'Agent Frameworks' },
  { name: 'Cursor', url: 'https://cursor.com', description: 'AI-powered code editor with deep IDE integration.', category: 'AI Dev Tools' },
  { name: 'Devin', url: 'https://cognition-labs.com', description: 'Autonomous AI software engineer by Cognition Labs.', category: 'AI Dev Tools' },
];

for (const comp of competitors) {
  db.prepare(`INSERT OR IGNORE INTO competitors (id, name, url, description, category) VALUES (?, ?, ?, ?, ?)`).run(
    randomUUID(), comp.name, comp.url, comp.description, comp.category
  );
}

// ── Security Alerts ──
const alerts = [
  { category: 'key_rotation', severity: 'warning', title: 'API key rotation due', message: 'Your OpenAI API key was last rotated 45 days ago.' },
  { category: 'gateway', severity: 'info', title: 'Gateway health check passed', message: 'All endpoints responding within normal latency.' },
  { category: 'access', severity: 'info', title: 'New device connected', message: 'Dashboard accessed from a new browser session.' },
];

for (const alert of alerts) {
  db.prepare(`INSERT OR IGNORE INTO alerts (id, category, severity, title, message) VALUES (?, ?, ?, ?, ?)`).run(
    randomUUID(), alert.category, alert.severity, alert.title, alert.message
  );
}

db.close();
console.log('Demo data seeded successfully!');
console.log('  - 8 memory entries');
console.log('  - 7 todos');
console.log('  - 14 days of cost metrics');
console.log('  - 5 tech updates');
console.log('  - 3 market signals');
console.log('  - 3 practitioner signals');
console.log('  - 3 reference files');
console.log('  - 5 competitors');
console.log('  - 3 security alerts');
