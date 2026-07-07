// lib/parsers/openclaw-cli.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const NULL_REDIRECT = process.platform === 'win32' ? '2>NUL' : '2>/dev/null';

// ============================================
// TTL Cache — avoids re-executing CLI commands
// on every polling request (every 30 s).
// ============================================

const cache = new Map<string, { data: unknown; expires: number }>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expires > now) return entry.data as T;
  const data = await fn();
  cache.set(key, { data, expires: now + ttlMs });
  return data;
}

/** Extract JSON from CLI output that may contain ANSI-colored plugin logs */
function safeParseCliJson(raw: string): unknown {
  const clean = raw.replace(/\x1b\[[0-9;]*m/g, '');
  try { return JSON.parse(clean); } catch {}
  const arrStart = clean.indexOf('[');
  const objStart = clean.indexOf('{');
  const start = arrStart === -1 ? objStart : objStart === -1 ? arrStart : Math.min(arrStart, objStart);
  if (start === -1) throw new Error('No JSON in CLI output');
  const opener = clean[start];
  const closer = opener === '[' ? ']' : '}';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < clean.length; i++) {
    const ch = clean[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === opener) depth++;
    else if (ch === closer && --depth === 0) return JSON.parse(clean.slice(start, i + 1));
  }
  throw new Error('Unterminated JSON');
}

// ============================================
// Model Display Name Mapping
// ============================================

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'vercel-ai-gateway/zai/glm-5': 'GLM 5',
  'google/gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'kilocode/anthropic/claude-sonnet-4.5': 'Sonnet 4.5',
  'kilocode/minimax/minimax-m2.5:free': 'MiniMax M2.5',
  'openai/gpt-5.3-codex': 'GPT 5.3 Codex',
  'vercel-ai-gateway/zai/glm-4.7-flashx': 'GLM 4.7 FlashX',
  'vercel-ai-gateway/zai/glm-4.5-air': 'GLM 4.5 Air',
  'kilocode/openai/gpt-5.2': 'GPT 5.2',
  'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
  'kilocode/google/gemini-3-flash-preview': 'Gemini 3 Flash',
  'vercel-ai-gateway/moonshot/kimi-k2.5': 'Kimi K2.5',
  // Short forms from session data
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'zai/glm-5': 'GLM 5',
  'zai/glm-4.7-flashx': 'GLM 4.7 FlashX',
  'minimax/minimax-m2.5:free': 'MiniMax M2.5',
  'moonshot/kimi-k2.5': 'Kimi K2.5',
};

export function getModelDisplayName(modelId: string | undefined): string {
  if (!modelId) return 'Unknown';
  return MODEL_DISPLAY_NAMES[modelId] || MODEL_DISPLAY_NAMES[modelId.toLowerCase()] || modelId;
}

// ============================================
// OpenClaw Models CLI
// ============================================

export interface OpenClawModelsOutput {
  defaultModel: string;
  fallbacks: string[];
  aliases: Record<string, string>;
  allowed: string[];
}

export function getOpenClawModels(): Promise<OpenClawModelsOutput> {
  // `openclaw models status` can take 30-40s on this machine (slow OAuth
  // token check). Runs via async exec so it no longer blocks the Node event
  // loop; a long cache TTL still matters far more here than for cheap calls.
  return cached<OpenClawModelsOutput>('models', 10 * 60_000, async () => {
    try {
      const { stdout } = await execAsync(`openclaw models status --json ${NULL_REDIRECT}`, {
        encoding: 'utf-8',
        timeout: 45000,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = safeParseCliJson(stdout) as any;
      return {
        defaultModel: parsed.defaultModel || parsed.resolvedDefault || '',
        fallbacks: parsed.fallbacks || [],
        aliases: parsed.aliases || {},
        allowed: parsed.allowed || [],
      };
    } catch (error) {
      console.error('[openclaw-cli] Failed to get models:', error);
      return { defaultModel: '', fallbacks: [], aliases: {}, allowed: [] };
    }
  });
}

// ============================================
// OpenClaw Sessions CLI
// ============================================

export interface OpenClawSession {
  key: string;
  agentId: string;
  model: string;
  modelProvider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokens: number;
  ageMs: number;
  updatedAt: number;
  sessionId: string;
  kind: 'direct' | 'group';
}

export interface OpenClawSessionsOutput {
  path: string | null;
  stores: Array<{ agentId: string; path: string }>;
  allAgents: boolean;
  count: number;
  activeMinutes: number | null;
  sessions: OpenClawSession[];
}

/**
 * Execute openclaw sessions --all-agents --json and return parsed output
 */
export function getOpenClawSessions(): Promise<OpenClawSessionsOutput> {
  return cached<OpenClawSessionsOutput>('sessions', 30_000, async () => {
    try {
      const { stdout } = await execAsync(`openclaw sessions --all-agents --json ${NULL_REDIRECT}`, {
        encoding: 'utf-8',
        timeout: 20000,
      });
      return safeParseCliJson(stdout) as OpenClawSessionsOutput;
    } catch (error) {
      console.error('[openclaw-cli] Failed to get sessions:', error);
      return {
        path: null,
        stores: [],
        allAgents: true,
        count: 0,
        activeMinutes: null,
        sessions: []
      };
    }
  });
}

/**
 * Derive agent status from ageMs
 * - online: updated within 5 minutes
 * - idle: updated within 60 minutes
 * - offline: older than 60 minutes
 */
export function deriveStatusFromAge(ageMs: number): 'online' | 'idle' | 'offline' {
  const fiveMinutes = 5 * 60 * 1000;
  const sixtyMinutes = 60 * 60 * 1000;

  if (ageMs < fiveMinutes) return 'online';
  if (ageMs < sixtyMinutes) return 'idle';
  return 'offline';
}

/**
 * Calculate context window usage percentage
 */
export function calculateContextPercent(totalTokens: number, contextTokens: number): number {
  if (!contextTokens || contextTokens === 0) return 0;
  if (!totalTokens || totalTokens === 0) return 0;
  return Math.min(100, Math.round((totalTokens / contextTokens) * 100));
}

/**
 * Aggregate session data by agent ID
 * Returns the most recent session for each agent with aggregated token counts
 */
export function aggregateSessionsByAgent(sessions: OpenClawSession[]): Map<string, {
  latestSession: OpenClawSession;
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokens: number;
  sessionCount: number;
}> {
  const agentMap = new Map<string, {
    latestSession: OpenClawSession;
    totalTokensIn: number;
    totalTokensOut: number;
    totalTokens: number;
    sessionCount: number;
  }>();

  for (const session of sessions) {
    const existing = agentMap.get(session.agentId);

    if (!existing || session.updatedAt > existing.latestSession.updatedAt) {
      agentMap.set(session.agentId, {
        latestSession: session,
        totalTokensIn: (existing?.totalTokensIn || 0) + (session.inputTokens || 0),
        totalTokensOut: (existing?.totalTokensOut || 0) + (session.outputTokens || 0),
        totalTokens: (existing?.totalTokens || 0) + (session.totalTokens || 0),
        sessionCount: (existing?.sessionCount || 0) + 1,
      });
    } else {
      existing.totalTokensIn += session.inputTokens || 0;
      existing.totalTokensOut += session.outputTokens || 0;
      existing.totalTokens += session.totalTokens || 0;
      existing.sessionCount += 1;
    }
  }

  return agentMap;
}

// ============================================
// Provider Probe
// ============================================

export interface ProviderProbeResult {
  model: string;
  profile: string;
  status: 'ok' | 'auth' | 'timeout' | 'error';
  latencyMs: number | null;
  errorMessage?: string;
}

export interface ProviderProbeOutput {
  results: ProviderProbeResult[];
  probeTime: number;
  totalProbed: number;
}

/**
 * Parse the text output from `openclaw models status --probe`
 */
export function parseProbeOutput(output: string): ProviderProbeOutput {
  const results: ProviderProbeResult[] = [];
  const lines = output.split('\n');

  let currentModel = '';
  let currentProfile = '';
  let currentStatus = '';
  let errorMessage = '';

  for (const line of lines) {
    // Match table rows like: | model | profile | status . latency |
    const rowMatch = line.match(/│\s*([^│]+?)\s*│\s*([^│]+?)\s*│\s*([^│]+?)\s*│/);

    if (rowMatch) {
      const [, model, profile, statusCol] = rowMatch;

      // Skip header rows
      if (model.includes('Model') || model.includes('───')) continue;

      // If we have a previous model pending, save it
      if (currentModel && currentStatus) {
        results.push(parseProbeResult(currentModel, currentProfile, currentStatus, errorMessage));
      }

      currentModel = model.trim();
      currentProfile = profile.trim();
      currentStatus = statusCol.trim();
      errorMessage = '';

      // Check for error message on next line (starts with ↳)
      const errorMatch = currentStatus.match(/↳\s*(.+)/);
      if (errorMatch) {
        errorMessage = errorMatch[1].trim();
        currentStatus = currentStatus.replace(/↳.*/, '').trim();
      }
    }

    // Check for continuation line with error (↳)
    const errorLineMatch = line.match(/↳\s*(.+)/);
    if (errorLineMatch && currentModel) {
      errorMessage = errorLineMatch[1].trim();
    }
  }

  // Don't forget the last entry
  if (currentModel && currentStatus) {
    results.push(parseProbeResult(currentModel, currentProfile, currentStatus, errorMessage));
  }

  return {
    results,
    probeTime: Date.now(),
    totalProbed: results.length,
  };
}

function parseProbeResult(model: string, profile: string, statusCol: string, errorMessage: string): ProviderProbeResult {
  // Parse status: "ok . 3.3s" or "ok . 205ms" or "auth . 188ms"
  const statusMatch = statusCol.match(/(ok|auth|timeout|error)?\s*·?\s*(\d+(?:\.\d+)?)(ms|s)?/i);

  let status: ProviderProbeResult['status'] = 'error';
  let latencyMs: number | null = null;

  if (statusMatch) {
    status = (statusMatch[1]?.toLowerCase() as any) || 'ok';
    const latency = parseFloat(statusMatch[2]);
    const unit = statusMatch[3];

    if (unit === 's') {
      latencyMs = latency * 1000;
    } else {
      latencyMs = latency;
    }
  }

  return {
    model: model.trim(),
    profile: profile.trim(),
    status,
    latencyMs,
    errorMessage: errorMessage || undefined,
  };
}

/**
 * Run provider probe and return parsed results
 * Note: This takes ~10 seconds as it makes actual API calls
 */
export async function runProviderProbe(): Promise<ProviderProbeOutput> {
  try {
    const { stdout } = await execAsync('openclaw models status --probe 2>&1', {
      encoding: 'utf-8',
      timeout: 30000, // 30 second timeout
    });
    return parseProbeOutput(stdout);
  } catch (error) {
    console.error('[openclaw-cli] Failed to run probe:', error);
    return { results: [], probeTime: Date.now(), totalProbed: 0 };
  }
}


// ============================================
// Gateway Status CLI
// ============================================

export interface OpenClawGatewayStatus {
  mode: string;
  url: string;
  reachable: boolean;
  connectLatencyMs: number;
  version: string;
  pid: number | null;
  runtimeState: string;
  error: string | null;
}

export interface OpenClawStatusOutput {
  gateway: OpenClawGatewayStatus;
  sessions: { count: number };
  agents: { defaultId: string };
}

export function getOpenClawStatus(): Promise<OpenClawStatusOutput> {
  return cached<OpenClawStatusOutput>('status', 30_000, async () => {
    try {
      const { stdout } = await execAsync('openclaw status --json 2>&1', {
        encoding: 'utf-8',
        timeout: 20000,
      });
      const parsed = JSON.parse(stdout);

      // Extract gateway info
      const gateway = parsed.gateway || {};
      const gatewayService = parsed.gatewayService || {};

      // Parse PID from runtimeShort like "running (pid 25350, state active)"
      let pid: number | null = null;
      let runtimeState = '';
      const runtimeMatch = gatewayService.runtimeShort?.match(/running \(pid (\d+), state (\w+)\)/);
      if (runtimeMatch) {
        pid = parseInt(runtimeMatch[1], 10);
        runtimeState = runtimeMatch[2];
      }

      return {
        gateway: {
          mode: gateway.mode || 'unknown',
          url: gateway.url || '',
          reachable: gateway.reachable ?? false,
          connectLatencyMs: gateway.connectLatencyMs ?? 0,
          version: gateway.self?.version || '',
          pid,
          runtimeState,
          error: gateway.error,
        },
        sessions: {
          count: parsed.sessions?.count || 0,
        },
        agents: {
          defaultId: parsed.agents?.defaultId || 'main',
        },
      };
    } catch (error) {
      console.error('[openclaw-cli] Failed to get status:', error);
      return {
        gateway: {
          mode: 'unknown',
          url: '',
          reachable: false,
          connectLatencyMs: 0,
          version: '',
          pid: null,
          runtimeState: '',
          error: String(error),
        },
        sessions: { count: 0 },
        agents: { defaultId: 'main' },
      };
    }
  });
}

// ============================================
