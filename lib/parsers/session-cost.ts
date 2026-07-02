/**
 * Session Cost Adapter — READ-ONLY data extraction from OpenClaw session files.
 *
 * Scans agent session JSONL files for messages with embedded usage + cost data.
 * Path pattern: agents/{agentId}/sessions/{sessionId}.jsonl
 * This is the single source of truth for spend/token metrics.
 *
 * HARD RULE: This module ONLY READS from .openclaw — NEVER writes.
 *
 * Data format (from JSONL):
 *   type: message, with message.usage.cost.total for spend tracking
 */

import fs from 'fs';
import path from 'path';
import { getOpenclawHome } from '@/lib/utils';

// ============================================
//  Types
// ============================================

export interface SessionCostEntry {
  timestamp: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  cacheWrite: number;
  costTotal: number;
  costInput: number;
  costOutput: number;
  costCacheRead: number;
  costCacheWrite: number;
  agentId: string;
  sessionId: string;
}

export interface AgentCostSummary {
  agentId: string;
  agentName: string;
  todaySpend: number;
  todayTokensIn: number;
  todayTokensOut: number;
  todayCacheRead: number;
  todayCacheWrite: number;
  lifetimeSpend: number;
  lifetimeTokensIn: number;
  lifetimeTokensOut: number;
  providers: Record<string, number>; // provider → cost
  lastActivity: string | null;
}

export interface CostSnapshot {
  /** ISO timestamp when this snapshot was computed */
  computedAt: string;
  /** Source directory */
  source: string;
  /** Today's total spend */
  todaySpend: number;
  /** Spend grouped by provider */
  spendByProvider: Record<string, number>;
  /** Spend grouped by agent */
  spendByAgent: Record<string, number>;
  /** Today's total cache write cost */
  cacheWriteCost: number;
  /** Today's total compute (non-cache) cost */
  computeCost: number;
  /** Today's total tokens in */
  totalTokensIn: number;
  /** Today's total tokens out */
  totalTokensOut: number;
  /** Per-agent summaries */
  agents: AgentCostSummary[];
  /** All entries (for charting/drill-down) */
  entries: SessionCostEntry[];
}

// ============================================
//  Agent name mapping
// ============================================

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  main: 'OpenClaw',
  developer: 'Developer',
  'qa-frontend': 'QA Frontend',
  researcher: 'Researcher',
  'claude-code': 'Claude Code',
  'bulk-task': 'Bulk Task',
};

// ============================================
//  File scanner
// ============================================

function getOpenClawDir(): string {
  const env = process.env.OPENCLAW_HOME;
  if (env && !env.startsWith('~')) return env;
  const home = process.env.HOME || '';
  return env ? env.replace('~', home) : path.join(home, '.openclaw');
}

function isToday(ts: string): boolean {
  const now = new Date();
  const date = new Date(ts);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isWithinDays(ts: string, days: number): boolean {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(ts).getTime() > since;
}

/**
 * Scans a single session JSONL file for cost entries.
 * Uses streaming-friendly line-by-line parsing to avoid loading huge files into DOM.
 */
function extractCostEntries(
  filePath: string,
  agentId: string,
  filter?: { sinceMs?: number },
): SessionCostEntry[] {
  const entries: SessionCostEntry[] = [];
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return entries;
  }

  const sessionId = path.basename(filePath, '.jsonl');

  for (const line of content.split('\n')) {
    if (!line || !line.includes('"usage"')) continue; // fast skip

    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'message') continue;

      const msg = entry.message;
      if (!msg?.usage?.cost) continue;

      const ts = entry.timestamp || msg.timestamp;
      if (!ts) continue;

      // Apply time filter
      if (filter?.sinceMs && new Date(ts).getTime() < filter.sinceMs) continue;

      const usage = msg.usage;
      const cost = usage.cost;

      entries.push({
        timestamp: typeof ts === 'number' ? new Date(ts).toISOString() : ts,
        provider: msg.provider || 'unknown',
        model: msg.model || 'unknown',
        tokensIn: usage.input || 0,
        tokensOut: usage.output || 0,
        cacheRead: usage.cacheRead || 0,
        cacheWrite: usage.cacheWrite || 0,
        costTotal: cost.total || 0,
        costInput: cost.input || 0,
        costOutput: cost.output || 0,
        costCacheRead: cost.cacheRead || 0,
        costCacheWrite: cost.cacheWrite || 0,
        agentId,
        sessionId,
      });
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

/**
 * Scans all agent session directories for cost data.
 * Returns a CostSnapshot with today's spend + per-provider/per-agent breakdowns.
 */
export function computeCostSnapshot(opts?: { days?: number; sinceMs?: number; untilMs?: number }): CostSnapshot {
  const dir = getOpenClawDir();
  const agentsDir = path.join(dir, 'agents');
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sinceMs = opts?.days
    ? Date.now() - opts.days * 24 * 60 * 60 * 1000
    : todayStart.getTime();

  const allEntries: SessionCostEntry[] = [];
  const agentSummaries: AgentCostSummary[] = [];

  let agentDirs: string[] = [];
  try {
    agentDirs = fs
      .readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name);
  } catch {
    // agents dir not found — return empty snapshot
    return emptySnapshot(dir);
  }

  for (const agentDir of agentDirs) {
    const sessionsDir = path.join(agentsDir, agentDir, 'sessions');
    let sessionFiles: string[] = [];
    try {
      sessionFiles = fs
        .readdirSync(sessionsDir)
        .filter(
          (f) =>
            f.endsWith('.jsonl') &&
            !f.includes('.reset.') &&
            !f.includes('.deleted.') &&
            !f.includes('.lock'),
        );
    } catch {
      continue;
    }

    const agentEntries: SessionCostEntry[] = [];

    for (const file of sessionFiles) {
      // Quick heuristic: skip probe sessions for cost computation
      if (file.startsWith('probe-')) continue;

      const filePath = path.join(sessionsDir, file);

      // Skip old files by mtime
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < sinceMs) continue;
      } catch {
        continue;
      }

      const entries = extractCostEntries(filePath, agentDir, { sinceMs });
      agentEntries.push(...entries);
    }

    allEntries.push(...agentEntries);

    // Build agent summary — use range-aware filtering when sinceMs is provided
    const rangeEntries = opts?.sinceMs
      ? agentEntries.filter((e) => {
          const t = new Date(e.timestamp).getTime();
          return t >= opts.sinceMs! && (!opts.untilMs || t <= opts.untilMs);
        })
      : agentEntries.filter((e) => isToday(e.timestamp));
    const providers: Record<string, number> = {};
    for (const e of rangeEntries) {
      providers[e.provider] = (providers[e.provider] || 0) + e.costTotal;
    }

    agentSummaries.push({
      agentId: agentDir,
      agentName: AGENT_DISPLAY_NAMES[agentDir] || agentDir,
      todaySpend: rangeEntries.reduce((s, e) => s + e.costTotal, 0),
      todayTokensIn: rangeEntries.reduce((s, e) => s + e.tokensIn, 0),
      todayTokensOut: rangeEntries.reduce((s, e) => s + e.tokensOut, 0),
      todayCacheRead: rangeEntries.reduce((s, e) => s + e.cacheRead, 0),
      todayCacheWrite: rangeEntries.reduce((s, e) => s + e.cacheWrite, 0),
      lifetimeSpend: agentEntries.reduce((s, e) => s + e.costTotal, 0),
      lifetimeTokensIn: agentEntries.reduce((s, e) => s + e.tokensIn, 0),
      lifetimeTokensOut: agentEntries.reduce((s, e) => s + e.tokensOut, 0),
      providers,
      lastActivity:
        agentEntries.length > 0
          ? agentEntries[agentEntries.length - 1].timestamp
          : null,
    });
  }

  // Aggregate range data — use range-aware filtering when sinceMs is provided
  const rangeEntries = opts?.sinceMs
    ? allEntries.filter((e) => {
        const t = new Date(e.timestamp).getTime();
        return t >= opts.sinceMs! && (!opts.untilMs || t <= opts.untilMs);
      })
    : allEntries.filter((e) => isToday(e.timestamp));
  const spendByProvider: Record<string, number> = {};
  const spendByAgent: Record<string, number> = {};
  let cacheWriteCost = 0;
  let computeCost = 0;

  for (const e of rangeEntries) {
    spendByProvider[e.provider] = (spendByProvider[e.provider] || 0) + e.costTotal;
    const agentName = AGENT_DISPLAY_NAMES[e.agentId] || e.agentId;
    spendByAgent[agentName] = (spendByAgent[agentName] || 0) + e.costTotal;
    cacheWriteCost += e.costCacheWrite;
    computeCost += e.costInput + e.costOutput;
  }

  return {
    computedAt: now.toISOString(),
    source: dir,
    todaySpend: rangeEntries.reduce((s, e) => s + e.costTotal, 0),
    spendByProvider,
    spendByAgent,
    cacheWriteCost,
    computeCost,
    totalTokensIn: rangeEntries.reduce((s, e) => s + e.tokensIn, 0),
    totalTokensOut: rangeEntries.reduce((s, e) => s + e.tokensOut, 0),
    agents: agentSummaries,
    entries: rangeEntries,
  };
}

/**
 * Compute daily cost history from session files.
 * Returns an array of { date, cost, tokens } for the last N days.
 * Optionally includes per-agent breakdown when opts.includeAgentBreakdown is true.
 */
export function computeDailyHistory(
  days: number = 30,
  opts?: { includeAgentBreakdown?: boolean },
): { date: string; cost: number; tokens: number; byAgent?: Record<string, { cost: number; tokens: number }> }[] {
  const dir = getOpenClawDir();
  const agentsDir = path.join(dir, 'agents');
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const includeAgents = opts?.includeAgentBreakdown ?? false;

  const dailyMap: Record<string, { cost: number; tokens: number; byAgent: Record<string, { cost: number; tokens: number }> }> = {};

  let agentDirs: string[] = [];
  try {
    agentDirs = fs
      .readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name);
  } catch {
    return [];
  }

  for (const agentDir of agentDirs) {
    const sessionsDir = path.join(agentsDir, agentDir, 'sessions');
    let sessionFiles: string[] = [];
    try {
      sessionFiles = fs
        .readdirSync(sessionsDir)
        .filter((f) => f.endsWith('.jsonl') && !f.includes('.lock'));
    } catch {
      continue;
    }

    for (const file of sessionFiles) {
      if (file.startsWith('probe-')) continue;
      const filePath = path.join(sessionsDir, file);

      const entries = extractCostEntries(filePath, agentDir, { sinceMs });
      for (const e of entries) {
        const date = e.timestamp.slice(0, 10);
        if (!dailyMap[date]) dailyMap[date] = { cost: 0, tokens: 0, byAgent: {} };
        dailyMap[date].cost += e.costTotal;
        dailyMap[date].tokens += e.tokensIn + e.tokensOut;

        if (includeAgents) {
          const agentName = AGENT_DISPLAY_NAMES[e.agentId] || e.agentId;
          if (!dailyMap[date].byAgent[agentName]) {
            dailyMap[date].byAgent[agentName] = { cost: 0, tokens: 0 };
          }
          dailyMap[date].byAgent[agentName].cost += e.costTotal;
          dailyMap[date].byAgent[agentName].tokens += e.tokensIn + e.tokensOut;
        }
      }
    }
  }

  return Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      cost: data.cost,
      tokens: data.tokens,
      ...(includeAgents ? { byAgent: data.byAgent } : {}),
    }));
}

/**
 * Compute hourly cost history from session files.
 * Returns an array of { hour, cost, tokens } for the last N hours.
 * Hour key format: "2026-02-28T14" (ISO date + hour).
 */
export function computeHourlyHistory(
  hours: number = 24,
): { hour: string; cost: number; tokens: number }[] {
  const dir = getOpenClawDir();
  const agentsDir = path.join(dir, 'agents');
  const sinceMs = Date.now() - hours * 60 * 60 * 1000;

  const hourlyMap: Record<string, { cost: number; tokens: number }> = {};

  let agentDirs: string[] = [];
  try {
    agentDirs = fs
      .readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name);
  } catch {
    return [];
  }

  for (const agentDir of agentDirs) {
    const sessionsDir = path.join(agentsDir, agentDir, 'sessions');
    let sessionFiles: string[] = [];
    try {
      sessionFiles = fs
        .readdirSync(sessionsDir)
        .filter((f) => f.endsWith('.jsonl') && !f.includes('.lock'));
    } catch {
      continue;
    }

    for (const file of sessionFiles) {
      if (file.startsWith('probe-')) continue;
      const filePath = path.join(sessionsDir, file);

      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < sinceMs) continue;
      } catch {
        continue;
      }

      const entries = extractCostEntries(filePath, agentDir, { sinceMs });
      for (const e of entries) {
        const hour = e.timestamp.slice(0, 13); // e.g. "2026-02-28T14"
        if (!hourlyMap[hour]) hourlyMap[hour] = { cost: 0, tokens: 0 };
        hourlyMap[hour].cost += e.costTotal;
        hourlyMap[hour].tokens += e.tokensIn + e.tokensOut;
      }
    }
  }

  return Object.entries(hourlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, data]) => ({
      hour,
      cost: data.cost,
      tokens: data.tokens,
    }));
}

/**
 * Detailed daily history with per-model, per-provider, and per-agent breakdowns.
 * Used by modal drill-downs (on-demand, not polled).
 */
export interface DailyDetailedEntry {
  date: string;
  cost: number;
  tokens: number;
  byModel: Record<string, { cost: number; tokens: number }>;
  byProvider: Record<string, { cost: number; tokens: number }>;
  byAgent: Record<string, { cost: number; tokens: number }>;
}

export function computeDailyHistoryDetailed(days: number = 30): DailyDetailedEntry[] {
  const dir = getOpenClawDir();
  const agentsDir = path.join(dir, 'agents');
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const dailyMap: Record<
    string,
    {
      cost: number;
      tokens: number;
      byModel: Record<string, { cost: number; tokens: number }>;
      byProvider: Record<string, { cost: number; tokens: number }>;
      byAgent: Record<string, { cost: number; tokens: number }>;
    }
  > = {};

  let agentDirs: string[] = [];
  try {
    agentDirs = fs
      .readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name);
  } catch {
    return [];
  }

  for (const agentDir of agentDirs) {
    const sessionsDir = path.join(agentsDir, agentDir, 'sessions');
    let sessionFiles: string[] = [];
    try {
      sessionFiles = fs
        .readdirSync(sessionsDir)
        .filter((f) => f.endsWith('.jsonl') && !f.includes('.lock'));
    } catch {
      continue;
    }

    for (const file of sessionFiles) {
      if (file.startsWith('probe-')) continue;
      const filePath = path.join(sessionsDir, file);

      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < sinceMs) continue;
      } catch {
        continue;
      }

      const entries = extractCostEntries(filePath, agentDir, { sinceMs });
      for (const e of entries) {
        const date = e.timestamp.slice(0, 10);
        if (!dailyMap[date]) {
          dailyMap[date] = { cost: 0, tokens: 0, byModel: {}, byProvider: {}, byAgent: {} };
        }
        const day = dailyMap[date];
        day.cost += e.costTotal;
        day.tokens += e.tokensIn + e.tokensOut;

        // By model
        const modelKey = e.model || 'unknown';
        if (!day.byModel[modelKey]) day.byModel[modelKey] = { cost: 0, tokens: 0 };
        day.byModel[modelKey].cost += e.costTotal;
        day.byModel[modelKey].tokens += e.tokensIn + e.tokensOut;

        // By provider
        const providerKey = e.provider || 'unknown';
        if (!day.byProvider[providerKey]) day.byProvider[providerKey] = { cost: 0, tokens: 0 };
        day.byProvider[providerKey].cost += e.costTotal;
        day.byProvider[providerKey].tokens += e.tokensIn + e.tokensOut;

        // By agent
        const agentName = AGENT_DISPLAY_NAMES[e.agentId] || e.agentId;
        if (!day.byAgent[agentName]) day.byAgent[agentName] = { cost: 0, tokens: 0 };
        day.byAgent[agentName].cost += e.costTotal;
        day.byAgent[agentName].tokens += e.tokensIn + e.tokensOut;
      }
    }
  }

  return Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      cost: data.cost,
      tokens: data.tokens,
      byModel: data.byModel,
      byProvider: data.byProvider,
      byAgent: data.byAgent,
    }));
}

/**
 * Returns a hash of file mtimes for relevant session files.
 * Used as an ETag to detect changes without re-parsing.
 */
export function getSessionFileHash(): string {
  const dir = getOpenClawDir();
  const agentsDir = path.join(dir, 'agents');
  let hash = '';

  try {
    const agentDirs = fs
      .readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name);

    for (const agentDir of agentDirs) {
      const sessionsDir = path.join(agentsDir, agentDir, 'sessions');
      try {
        const files = fs
          .readdirSync(sessionsDir)
          .filter((f) => f.endsWith('.jsonl') && !f.includes('.lock'));
        for (const file of files.slice(-3)) {
          // Only check most recent files
          try {
            const stat = fs.statSync(path.join(sessionsDir, file));
            hash += `${agentDir}/${file}:${stat.mtimeMs},`;
          } catch {}
        }
      } catch {}
    }
  } catch {}

  // Also check gateway log
  try {
    const stat = fs.statSync(path.join(dir, 'logs', 'gateway.log'));
    hash += `gw:${stat.mtimeMs}`;
  } catch {}

  return hash;
}

function emptySnapshot(source: string): CostSnapshot {
  return {
    computedAt: new Date().toISOString(),
    source,
    todaySpend: 0,
    spendByProvider: {},
    spendByAgent: {},
    cacheWriteCost: 0,
    computeCost: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    agents: [],
    entries: [],
  };
}
