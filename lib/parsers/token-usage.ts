import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenBucket {
  model: string;
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  totalTokens: number;
  cost: number;
}

export interface SubAgentRun {
  task: string;
  model: string;
  cost: number;
  durationSec: number;
  status: string;
  timestamp: string;
  date: string;
}

export interface DailyChartEntry {
  date: string;
  label: string;
  total: number;
  tokens: number;
  calls: number;
  models: Record<string, number>;
}

export interface TokenUsageData {
  today: TokenBucket[];
  week: TokenBucket[];
  month: TokenBucket[];
  all: TokenBucket[];
  subagentToday: TokenBucket[];
  subagentWeek: TokenBucket[];
  subagentMonth: TokenBucket[];
  subagentAll: TokenBucket[];
  subagentRuns: SubAgentRun[];
  dailyChart: DailyChartEntry[];
}

// ---------------------------------------------------------------------------
// Model name normalisation
// ---------------------------------------------------------------------------

function normalizeModelName(model: string): string {
  const ml = model.toLowerCase();
  // Strip provider prefix (e.g. "anthropic/claude-opus-4-6")
  const stripped = ml.includes('/') ? ml.split('/').pop()! : ml;
  if (stripped.includes('opus-4-6')) return 'Claude Opus 4.6';
  if (stripped.includes('opus')) return 'Claude Opus 4.5';
  if (stripped.includes('sonnet')) return 'Claude Sonnet';
  if (stripped.includes('haiku')) return 'Claude Haiku';
  if (stripped.includes('grok-4-fast') || stripped.includes('grok-4.1-fast')) return 'Grok 4.1 Fast';
  if (stripped.includes('grok-4') || stripped.includes('grok4')) return 'Grok 4';
  if (stripped.includes('gemini-3.1-pro')) return 'Gemini 3.1 Pro';
  if (stripped.includes('gemini-3-flash')) return 'Gemini 3 Flash';
  if (stripped.includes('gemini-2.5-pro')) return 'Gemini 2.5 Pro';
  if (stripped.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
  if (stripped.includes('minimax-m2.5')) return 'MiniMax M2.5';
  if (stripped.includes('minimax')) return 'MiniMax';
  if (stripped.includes('glm-5')) return 'GLM-5';
  if (stripped.includes('kimi') || stripped.includes('k2p5') || stripped.includes('k2.5')) return 'Kimi K2.5';
  if (stripped.includes('gpt-5')) return 'GPT-5';
  if (stripped.includes('devstral')) return 'Devstral';
  if (stripped.includes('deepseek')) return 'DeepSeek';
  return model;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return YYYY-MM-DD for an ISO timestamp string. */
function toDateStr(ts: string): string {
  return ts.slice(0, 10);
}

/** Start-of-day Date for a YYYY-MM-DD string (local time). */
function startOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Accumulate values into a bucket map keyed by normalised model name. */
function addToBucket(
  map: Map<string, TokenBucket>,
  model: string,
  input: number,
  output: number,
  cacheRead: number,
  totalTokens: number,
  cost: number,
) {
  const existing = map.get(model);
  if (existing) {
    existing.calls += 1;
    existing.input += input;
    existing.output += output;
    existing.cacheRead += cacheRead;
    existing.totalTokens += totalTokens;
    existing.cost += cost;
  } else {
    map.set(model, {
      model,
      calls: 1,
      input,
      output,
      cacheRead,
      totalTokens,
      cost,
    });
  }
}

/** Convert a bucket map to a sorted array (highest cost first). */
function bucketsToArray(map: Map<string, TokenBucket>): TokenBucket[] {
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

// ---------------------------------------------------------------------------
// Session key helpers — detect sub-agent sessions
// ---------------------------------------------------------------------------

/**
 * Read sessions.json from an agent directory and return a Map from sessionId
 * to session key string.  Sub-agent sessions have keys containing "subagent:".
 */
function loadSessionKeyMap(agentDir: string): Map<string, string> {
  const map = new Map<string, string>();
  const sessionsJsonPath = path.join(agentDir, 'sessions', 'sessions.json');
  try {
    const raw = fs.readFileSync(sessionsJsonPath, 'utf-8');
    const parsed = JSON.parse(raw);
    // sessions.json format: { "sessionKey": { "sessionId": "uuid", ... } }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      for (const [sessionKey, value] of Object.entries(parsed)) {
        if (value && typeof value === 'object') {
          const sid = (value as any).sessionId;
          if (sid) {
            map.set(String(sid), sessionKey);
          }
        }
      }
    }
  } catch {
    // Missing or unreadable — not an error
  }
  return map;
}

// ---------------------------------------------------------------------------
// Module-level cache (30 s TTL)
// ---------------------------------------------------------------------------

let _cache: { data: TokenUsageData; ts: number } | null = null;
const CACHE_TTL_MS = 30_000;

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export function computeTokenUsage(openclawPath: string): TokenUsageData {
  // Return cached result if fresh enough
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return _cache.data;
  }

  const agentsDir = path.join(openclawPath, 'agents');

  // Period boundaries
  const todayStart = daysAgo(0);
  const weekStart = daysAgo(7);
  const monthStart = daysAgo(30);
  const todayDate = todayStr();

  // Bucket maps: regular sessions
  const allMap = new Map<string, TokenBucket>();
  const monthMap = new Map<string, TokenBucket>();
  const weekMap = new Map<string, TokenBucket>();
  const todayMap = new Map<string, TokenBucket>();

  // Bucket maps: sub-agent sessions
  const saAllMap = new Map<string, TokenBucket>();
  const saMonthMap = new Map<string, TokenBucket>();
  const saWeekMap = new Map<string, TokenBucket>();
  const saTodayMap = new Map<string, TokenBucket>();

  // Sub-agent run tracking
  const subagentRuns: SubAgentRun[] = [];

  // Daily chart accumulation (last 30 days)
  // Key: "YYYY-MM-DD", value: { total cost, tokens, calls, per-model cost }
  const dailyMap = new Map<
    string,
    { total: number; tokens: number; calls: number; models: Map<string, number> }
  >();

  // Initialize daily map with last 30 days
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dailyMap.set(key, { total: 0, tokens: 0, calls: 0, models: new Map() });
  }

  // Enumerate agent directories
  let agentDirs: string[] = [];
  try {
    agentDirs = fs
      .readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(agentsDir, d.name));
  } catch {
    // agents dir missing — return empty result
    const empty: TokenUsageData = {
      today: [],
      week: [],
      month: [],
      all: [],
      subagentToday: [],
      subagentWeek: [],
      subagentMonth: [],
      subagentAll: [],
      subagentRuns: [],
      dailyChart: [],
    };
    _cache = { data: empty, ts: Date.now() };
    return empty;
  }

  for (const agentDir of agentDirs) {
    // Load session key map for sub-agent detection
    const sessionKeyMap = loadSessionKeyMap(agentDir);

    const sessionsDir = path.join(agentDir, 'sessions');
    let jsonlFiles: string[] = [];
    try {
      jsonlFiles = fs
        .readdirSync(sessionsDir)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => path.join(sessionsDir, f));
    } catch {
      continue;
    }

    for (const filePath of jsonlFiles) {
      // Derive sessionId from filename (strip .jsonl)
      const sessionId = path.basename(filePath, '.jsonl');
      const sessionKey = sessionKeyMap.get(sessionId) ?? '';
      const isSubagent = sessionKey.includes('subagent:');

      // Track sub-agent run-level aggregates
      let runCost = 0;
      let runModel = '';
      let runFirstTs = '';
      let runLastTs = '';
      let runStatus = 'unknown';

      let fileContent: string;
      try {
        fileContent = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const lines = fileContent.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        let record: any;
        try {
          record = JSON.parse(line);
        } catch {
          continue;
        }

        // We need an assistant message with non-zero totalTokens
        const msg = record.message;
        if (!msg || msg.role !== 'assistant') continue;

        const usage = msg.usage ?? record.usage;
        if (!usage || !usage.totalTokens) continue;

        const rawModel: string = msg.model ?? record.model ?? 'unknown';
        const model = normalizeModelName(rawModel);
        const input = usage.input ?? usage.inputTokens ?? usage.input_tokens ?? 0;
        const output = usage.output ?? usage.outputTokens ?? usage.output_tokens ?? 0;
        const cacheRead = usage.cacheRead ?? usage.cacheReadInputTokens ?? usage.cache_read_input_tokens ?? 0;
        const totalTokens = usage.totalTokens ?? 0;
        const rawCost = usage.cost?.total ?? 0;
        const cost = typeof rawCost === 'number' && rawCost > 0 ? rawCost : 0;

        const timestamp: string = record.timestamp ?? '';
        const dateStr = timestamp ? toDateStr(timestamp) : '';
        const recordDate = dateStr ? startOfDay(dateStr) : null;

        // All messages go into regular buckets
        addToBucket(allMap, model, input, output, cacheRead, totalTokens, cost);

        // Sub-agent messages ALSO go into sub-agent buckets
        if (isSubagent) {
          addToBucket(saAllMap, model, input, output, cacheRead, totalTokens, cost);
        }

        if (recordDate) {
          if (recordDate >= monthStart) {
            addToBucket(monthMap, model, input, output, cacheRead, totalTokens, cost);
            if (isSubagent) addToBucket(saMonthMap, model, input, output, cacheRead, totalTokens, cost);
          }
          if (recordDate >= weekStart) {
            addToBucket(weekMap, model, input, output, cacheRead, totalTokens, cost);
            if (isSubagent) addToBucket(saWeekMap, model, input, output, cacheRead, totalTokens, cost);
          }
          if (dateStr === todayDate) {
            addToBucket(todayMap, model, input, output, cacheRead, totalTokens, cost);
            if (isSubagent) addToBucket(saTodayMap, model, input, output, cacheRead, totalTokens, cost);
          }

          // Daily chart (only for regular sessions to avoid double counting)
          const dailyEntry = dailyMap.get(dateStr);
          if (dailyEntry) {
            dailyEntry.total += cost;
            dailyEntry.tokens += totalTokens;
            dailyEntry.calls += 1;
            dailyEntry.models.set(model, (dailyEntry.models.get(model) ?? 0) + cost);
          }
        }

        // Sub-agent run tracking
        if (isSubagent) {
          runCost += cost;
          if (!runModel) runModel = model;
          if (!runFirstTs && timestamp) runFirstTs = timestamp;
          if (timestamp) runLastTs = timestamp;
        }
      }

      // Emit sub-agent run summary
      if (isSubagent && (runCost > 0 || runModel)) {
        let durationSec = 0;
        if (runFirstTs && runLastTs) {
          const t0 = new Date(runFirstTs).getTime();
          const t1 = new Date(runLastTs).getTime();
          if (!isNaN(t0) && !isNaN(t1)) {
            durationSec = Math.max(0, Math.round((t1 - t0) / 1000));
          }
        }

        // Extract task description from the session key
        const taskMatch = sessionKey.match(/subagent:\s*(.+)/);
        const task = taskMatch ? taskMatch[1].trim() : sessionId;

        subagentRuns.push({
          task,
          model: runModel || 'unknown',
          cost: runCost,
          durationSec,
          status: runStatus,
          timestamp: runFirstTs || '',
          date: runFirstTs ? toDateStr(runFirstTs) : '',
        });
      }
    }
  }

  // Build daily chart entries
  // First, determine top 6 models by total cost across all daily entries
  const modelTotalCost = new Map<string, number>();
  for (const entry of dailyMap.values()) {
    for (const [m, c] of entry.models) {
      modelTotalCost.set(m, (modelTotalCost.get(m) ?? 0) + c);
    }
  }
  const topModels = Array.from(modelTotalCost.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([m]) => m);
  const topModelSet = new Set(topModels);

  const dailyChart: DailyChartEntry[] = [];
  const sortedDays = Array.from(dailyMap.keys()).sort();
  for (const day of sortedDays) {
    const entry = dailyMap.get(day)!;
    // Collapse non-top models into "Other"
    const models: Record<string, number> = {};
    let otherCost = 0;
    for (const [m, c] of entry.models) {
      if (topModelSet.has(m)) {
        models[m] = (models[m] ?? 0) + c;
      } else {
        otherCost += c;
      }
    }
    if (otherCost > 0) {
      models['Other'] = otherCost;
    }

    // Friendly label: "Mar 9"
    const d = new Date(`${day}T12:00:00`);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    dailyChart.push({
      date: day,
      label,
      total: entry.total,
      tokens: entry.tokens,
      calls: entry.calls,
      models,
    });
  }

  // Sort sub-agent runs newest first
  subagentRuns.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));

  const result: TokenUsageData = {
    today: bucketsToArray(todayMap),
    week: bucketsToArray(weekMap),
    month: bucketsToArray(monthMap),
    all: bucketsToArray(allMap),
    subagentToday: bucketsToArray(saTodayMap),
    subagentWeek: bucketsToArray(saWeekMap),
    subagentMonth: bucketsToArray(saMonthMap),
    subagentAll: bucketsToArray(saAllMap),
    subagentRuns,
    dailyChart,
  };

  _cache = { data: result, ts: Date.now() };
  return result;
}
