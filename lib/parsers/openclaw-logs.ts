/**
 * OpenClaw Log Parser
 * ===================
 * Parses data from the OpenClaw data directory (default: ~/.openclaw).
 *
 * Directory structure explored on 2026-02-21:
 * - openclaw.json           — Main config (model routing, plugins, gateway, channels)
 * - .env                    — 1Password vault refs for API keys
 * - logs/gateway.log        — Gateway lifecycle events (plaintext)
 * - logs/config-audit.jsonl — Config change audit trail
 * - logs/commands.log       — Session creation events (JSONL)
 * - agents/main/sessions/sessions.json — Session registry (token counts, system prompts, skills)
 * - agents/main/sessions/*.jsonl       — Individual session logs
 * - agents/main/agent/models.json      — Provider/model definitions + pricing
 * - devices/paired.json     — 3 paired devices with tokens
 * - cron/jobs.json           — 2 scheduled jobs
 * - cron/runs/*.jsonl        — Cron execution history
 * - delivery-queue/*.json    — Failed message deliveries
 * - identity/device.json     — Device identity + keys
 * - memory/main.sqlite       — Agent memory (binary, not parsed)
 * - sandbox/containers.json  — 1 sandbox container
 * - extensions/              — devclaw v1.4.0, secureclaw v2.2.0
 * - .secureclaw/             — C2 blocklist, firewall rules
 * - workspace/               — Agent personality docs (AGENTS.md, SOUL.md, etc.)
 * - exec-approvals.json      — Approval daemon socket config
 * - update-check.json        — Version check timestamp
 */

import fs from 'fs';
import path from 'path';
import type {
  AgentData, AgentTask, GatewayStatus, ProviderHealth,
  ConfigAuditEntry, PairedDevice, CronJob, ProviderConnection,
} from '@/types';
import { resolveHomePath, safeJsonParse, getOpenclawHome } from '@/lib/utils';

// ============================================
// TTL + mtime Cache
// Caches parsed results for up to `ttlMs`.  The key includes the
// file path and its mtime so the cache auto-invalidates when the
// underlying file changes on disk.
// ============================================

const fileCache = new Map<string, { data: unknown; expires: number; mtimeMs: number }>();

function cachedByFile<T>(filePath: string, ttlMs: number, fn: () => T): T {
  const now = Date.now();
  let currentMtime = 0;
  try {
    currentMtime = fs.statSync(filePath).mtimeMs;
  } catch {
    // File may not exist — just run fn() uncached
    return fn();
  }

  const entry = fileCache.get(filePath);
  if (entry && entry.expires > now && entry.mtimeMs === currentMtime) {
    return entry.data as T;
  }
  const data = fn();
  fileCache.set(filePath, { data, expires: now + ttlMs, mtimeMs: currentMtime });
  return data;
}

/**
 * Cache for directory-level results (e.g. parseAgentData which scans
 * multiple files).  Uses a composite key and the mtime of the
 * directory itself (updated when files are added/removed).
 */
const dirCache = new Map<string, { data: unknown; expires: number; mtimeMs: number }>();

function cachedByDir<T>(dirPath: string, ttlMs: number, fn: () => T): T {
  const now = Date.now();
  let currentMtime = 0;
  try {
    currentMtime = fs.statSync(dirPath).mtimeMs;
  } catch {
    return fn();
  }

  const entry = dirCache.get(dirPath);
  if (entry && entry.expires > now && entry.mtimeMs === currentMtime) {
    return entry.data as T;
  }
  const data = fn();
  dirCache.set(dirPath, { data, expires: now + ttlMs, mtimeMs: currentMtime });
  return data;
}

function getDataDir(configDir?: string): string {
  return resolveHomePath(configDir || getOpenclawHome());
}

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function readJsonIfExists<T>(filePath: string, fallback: T): T {
  const content = readFileIfExists(filePath);
  if (!content) return fallback;
  return safeJsonParse(content, fallback);
}

// --- Main Config ---

export interface OpenClawConfig {
  meta?: { version?: string; lastTouched?: string };
  gateway?: { port?: number; loopback?: boolean; authToken?: string; tailscaleServe?: any };
  agents?: { defaults?: { model?: string }; heartbeat?: any; sandbox?: any };
  plugins?: { enabled?: string[]; installs?: any };
  channels?: { telegram?: any };
  ui?: { assistantName?: string };
  tools?: any;
  env?: Record<string, string>;
}

export function parseMainConfig(dataDir?: string): OpenClawConfig {
  const dir = getDataDir(dataDir);
  return readJsonIfExists(path.join(dir, 'openclaw.json'), {});
}

// --- Gateway Status ---

export function parseGatewayStatus(dataDir?: string): GatewayStatus {
  const dir = getDataDir(dataDir);
  const config = parseMainConfig(dataDir);

  // Try to detect gateway PID from gateway.log
  const gatewayLog = readFileIfExists(path.join(dir, 'logs', 'gateway.log'));
  let pid: number | null = null;
  let version = (config.meta as any)?.lastTouchedVersion || config.meta?.version || 'unknown';
  let uptime = 0;

  if (gatewayLog) {
    // Look for PID in log lines
    const pidMatch = gatewayLog.match(/pid[:\s]+(\d+)/i);
    if (pidMatch) pid = parseInt(pidMatch[1], 10);

    // Look for startup timestamp to calc uptime
    const lines = gatewayLog.split('\n').filter(Boolean);
    const lastStartLine = [...lines].reverse().find(l =>
      l.includes('gateway start') || l.includes('Gateway started') || l.includes('listening')
    );
    if (lastStartLine) {
      const tsMatch = lastStartLine.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
      if (tsMatch) {
        const startTime = new Date(tsMatch[1]);
        uptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
      }
    }
  }

  // Check device token validity
  const deviceAuth = readJsonIfExists<Record<string, unknown> | null>(path.join(dir, 'identity', 'device.json'), null);
  const deviceTokenValid = !!(deviceAuth as any)?.deviceId;

  // Determine cache retention mode
  let cacheRetentionMode: 'short' | 'long' | 'unknown' = 'unknown';
  if (config.agents?.defaults) {
    const agentConfig = config.agents as any;
    if (agentConfig.contextPruningTTL || agentConfig.cacheRetention) {
      const ttl = agentConfig.contextPruningTTL || agentConfig.cacheRetention;
      cacheRetentionMode = ttl > 3600 ? 'long' : 'short';
    }
  }

  // Tailscale endpoint
  let tailscaleEndpoint: string | null = null;
  if (config.gateway?.tailscaleServe) {
    const ts = config.gateway.tailscaleServe;
    tailscaleEndpoint = typeof ts === 'string' ? ts : ts?.url || null;
  }

  // Provider health from probe sessions
  const providerHealth = parseProviderHealth(dir);

  return {
    port: config.gateway?.port || 18789,
    pid,
    uptime: Math.max(0, uptime),
    version,
    deviceTokenValid,
    cacheRetentionMode,
    tailscaleEndpoint,
    providerHealth,
  };
}

function parseProviderHealth(dir: string): Record<string, ProviderHealth> {
  const sessionsDir = path.join(dir, 'agents', 'main', 'sessions');
  const health: Record<string, ProviderHealth> = {
    anthropic: 'down',
    openai: 'down',
    google: 'down',
  };

  try {
    const files = fs.readdirSync(sessionsDir);
    for (const provider of Object.keys(health)) {
      const probeFile = files.find(f => f.startsWith(`probe-${provider}`));
      if (probeFile) {
        const content = readFileIfExists(path.join(sessionsDir, probeFile));
        if (content) {
          // If probe session exists and has content, provider was reachable
          health[provider] = 'healthy';
          // Check for errors in content
          if (content.includes('error') || content.includes('Error') || content.includes('rate_limit')) {
            health[provider] = 'degraded';
          }
        }
      }
    }
  } catch {
    // Directory not readable
  }

  return health;
}

// --- Agent Data ---

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  main: 'OpenClaw',
  developer: 'Developer',
  'qa-frontend': 'QA Frontend',
  researcher: 'Researcher',
  'bulk-task': 'Bulk Task',
};

export function parseAgentData(dataDir?: string, options?: { timeframe?: { days: number } }): AgentData[] {
  const dir = getDataDir(dataDir);
  const agentsBaseDir = path.join(dir, 'agents');

  // When no timeframe filter is used we can safely cache the full result
  // for 30 seconds, keyed by the agents directory mtime.
  if (!options?.timeframe) {
    return cachedByDir<AgentData[]>(agentsBaseDir, 30_000, () =>
      parseAgentDataInner(dir, dataDir, options),
    );
  }
  return parseAgentDataInner(dir, dataDir, options);
}

function parseAgentDataInner(dir: string, dataDir: string | undefined, options?: { timeframe?: { days: number } }): AgentData[] {
  const agents: AgentData[] = [];
  const config = parseMainConfig(dataDir) as any;
  console.log('[PARSER DEBUG] config.agents:', JSON.stringify(config.agents, null, 2));
  const defaultModel = config.agents?.defaults?.model?.primary || config.agents?.defaults?.model || 'claude-sonnet-4-6';
  console.log('[PARSER DEBUG] defaultModel:', defaultModel);
  const assistantName = config.ui?.assistantName || 'OpenClaw';

  // Get agent list from config - this is the authoritative source
  const agentList = config.agents?.list || [];
  const agentConfigMap = new Map(agentList.map((a: any) => [a.id, a]));
  console.log('[PARSER DEBUG] agentConfigMap:', Object.fromEntries(agentConfigMap));

  // Also scan agent directories for session data
  const agentsBaseDir = path.join(dir, 'agents');
  let agentDirs: string[] = [];
  try {
    agentDirs = fs.readdirSync(agentsBaseDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name);
  } catch {
    // Directory doesn't exist, will use config only
  }

  // Create a map to collect session data per agent
  const sessionDataMap = new Map<string, { tokensIn: number; tokensOut: number; latestUpdate: string; compactionCount: number; recentTasks: AgentTask[] }>();

  for (const agentDir of agentDirs) {
    const sessionsFile = path.join(agentsBaseDir, agentDir, 'sessions', 'sessions.json');
    const sessionsData = readJsonIfExists<any>(sessionsFile, {});

    const sessionEntries = Object.entries(sessionsData).filter(
      ([key]) => !key.startsWith('__') && key !== 'version'
    );

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let latestUpdate = '';
    let compactionCount = 0;

    if (options?.timeframe) {
      const sessionsDir = path.join(agentsBaseDir, agentDir, 'sessions');
      try {
        const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
        const since = Date.now() - (options.timeframe.days * 24 * 60 * 60 * 1000);

        for (const file of files) {
          const content = readFileIfExists(path.join(sessionsDir, file));
          if (!content) continue;

          for (const line of content.split('\n').filter(Boolean)) {
            try {
              const entry = JSON.parse(line);
              const entryTs = new Date(entry.timestamp).getTime();
              // Usage can be in entry.usage OR entry.message.usage
              const usage = entry.message?.usage || entry.usage;
              if (usage && entryTs > since) {
                // Session format uses "input"/"output", not "input_tokens"
                totalTokensIn += usage.input || usage.input_tokens || 0;
                totalTokensOut += usage.output || usage.output_tokens || 0;
              }
              if (entryTs > new Date(latestUpdate || 0).getTime()) {
                latestUpdate = new Date(entryTs).toISOString();
              }
            } catch {}
          }
        }
      } catch {}
    } else {
      for (const [, sessionDataRaw] of sessionEntries) {
        const s = sessionDataRaw as any;
        if (!s || typeof s !== 'object') continue;
        const totalTokens = s.totalTokens || 0;
        totalTokensIn += s.inputTokens || Math.floor(totalTokens * 0.3);
        totalTokensOut += s.outputTokens || Math.floor(totalTokens * 0.7);
        if (s.compactionCount) compactionCount += s.compactionCount;
        const updated = s.updatedAt ? String(s.updatedAt) : '';
        if (updated > latestUpdate) latestUpdate = updated;
      }
    }

    const recentTasks = parseSessionTasks(`agent:${agentDir}:main`, path.join(agentsBaseDir, agentDir));

    sessionDataMap.set(agentDir, {
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      latestUpdate,
      compactionCount,
      recentTasks,
    });
  }

  // Build agents from config list (authoritative source)
  for (const agentConfig of agentList) {
    const agentId = agentConfig.id as string;
    const isMain = agentId === 'main';
    const name = agentConfig.name || AGENT_DISPLAY_NAMES[agentId] || agentId.charAt(0).toUpperCase() + agentId.slice(1);
    const agentModel = agentConfig.model?.primary || defaultModel;

    // Get session data if available
    const sessionData = sessionDataMap.get(agentId);
    const tokensIn = sessionData?.tokensIn || 0;
    const tokensOut = sessionData?.tokensOut || 0;
    const latestUpdate = sessionData?.latestUpdate || '';
    const compactionCount = sessionData?.compactionCount || 0;
    const recentTasks = sessionData?.recentTasks || [];

    let status: AgentData['status'] = 'offline';
    if (latestUpdate) {
      const ts = Number(latestUpdate) > 1e12 ? new Date(Number(latestUpdate)) : new Date(latestUpdate);
      const minutesSinceUpdate = (Date.now() - ts.getTime()) / 60000;
      if (minutesSinceUpdate < 5) status = 'online';
      else if (minutesSinceUpdate < 60) status = 'idle';
    } else if (isMain) {
      // Main agent defaults to online if no session data
      status = 'online';
    }

    const errorCount = recentTasks.filter(t => t.status === 'failed').length;

    // Compute driftScore: 0 (normal) for agents with activity, null for inactive
    const hasTasks = recentTasks.length > 0;
    const driftScore = hasTasks || (tokensIn + tokensOut > 0) ? 0 : null;

    agents.push({
      id: `agent-${agentId}`,
      name,
      role: isMain ? 'orchestrator' : 'sub-agent',
      parentId: null,
      status,
      model: extractModelDisplayName(agentModel),
      provider: detectProvider(agentModel),
      tokensIn,
      tokensOut,
      costUSD: calculateCost(tokensIn, tokensOut, agentModel),
      contextWindowUsedPercent: estimateContextUsage(tokensIn + tokensOut, agentModel),
      latencyMs: 0,
      errorCount,
      lastError: recentTasks.find(t => t.errorMessage)?.errorMessage || null,
      lastActiveAt: latestUpdate ? (Number(latestUpdate) > 1e12 ? new Date(Number(latestUpdate)).toISOString() : latestUpdate) : new Date().toISOString(),
      uptime: 0,
      taskCompletedCount: recentTasks.filter(t => t.status === 'completed').length,
      taskFailedCount: errorCount,
      driftScore,
      recentTasks,
      sessionKey: `agent:${agentId}`,
      compactionCount,
    });
  }

  // Fallback: if no agents from config, create from filesystem or default
  if (agents.length === 0) {
    agents.push(createAgentFromConfig(assistantName, defaultModel, dir));
  }

  // Ensure orchestrator exists
  if (!agents.find(a => a.role === 'orchestrator')) {
    const orch = createAgentFromConfig(assistantName, defaultModel, dir);
    agents.unshift(orch);
  }

  // Set parent relationships
  const orchId = agents.find(a => a.role === 'orchestrator')?.id;
  for (const agent of agents) {
    if (agent.role === 'sub-agent' && orchId) {
      agent.parentId = orchId;
    }
  }

  return agents;
}

function createAgentFromConfig(name: string, model: string, dir: string): AgentData {
  return {
    id: 'agent-main',
    name,
    role: 'orchestrator',
    parentId: null,
    status: 'online',
    model,
    provider: detectProvider(model),
    tokensIn: 0,
    tokensOut: 0,
    costUSD: 0,
    contextWindowUsedPercent: 0,
    latencyMs: 0,
    errorCount: 0,
    lastError: null,
    lastActiveAt: new Date().toISOString(),
    uptime: 0,
    taskCompletedCount: 0,
    taskFailedCount: 0,
    driftScore: null,
    recentTasks: [],
    sessionKey: 'agent:main',
  };
}

function parseSessionToAgent(
  sessionKey: string, sessionInfo: any, dir: string,
  assistantName: string, defaultModel: string
): AgentData | null {
  if (!sessionInfo || typeof sessionInfo !== 'object') return null;

  const isMain = sessionKey === 'agent:main:main' || sessionKey === 'agent:main';
  const name = isMain ? assistantName : extractSessionName(sessionKey);
  const model = sessionInfo.model || defaultModel;
  const tokensTotal = sessionInfo.totalTokens || 0;
  const tokensIn = sessionInfo.inputTokens || Math.floor(tokensTotal * 0.3);
  const tokensOut = sessionInfo.outputTokens || Math.floor(tokensTotal * 0.7);
  const compactionCount = sessionInfo.compactionCount || 0;

  let status: AgentData['status'] = 'idle';
  if (sessionInfo.updatedAt) {
    const lastUpdate = new Date(sessionInfo.updatedAt);
    const minutesSinceUpdate = (Date.now() - lastUpdate.getTime()) / 60000;
    if (minutesSinceUpdate < 5) status = 'online';
    else if (minutesSinceUpdate < 60) status = 'idle';
    else status = 'offline';
  }

  const recentTasks = parseSessionTasks(sessionKey, dir);
  const errorCount = recentTasks.filter(t => t.status === 'failed').length;
  const lastError = recentTasks.find(t => t.errorMessage)?.errorMessage || null;

  return {
    id: sessionKey.replace(/[^a-zA-Z0-9]/g, '-'),
    name,
    role: isMain ? 'orchestrator' : 'sub-agent',
    parentId: null,
    status,
    model,
    provider: detectProvider(model),
    tokensIn,
    tokensOut,
    costUSD: calculateCost(tokensIn, tokensOut, model),
    contextWindowUsedPercent: estimateContextUsage(tokensTotal, model),
    latencyMs: 0,
    errorCount,
    lastError,
    lastActiveAt: sessionInfo.updatedAt || new Date().toISOString(),
    uptime: sessionInfo.updatedAt ? Math.floor((Date.now() - new Date(sessionInfo.updatedAt).getTime()) / 1000) : 0,
    taskCompletedCount: recentTasks.filter(t => t.status === 'completed').length,
    taskFailedCount: recentTasks.filter(t => t.status === 'failed').length,
    driftScore: null,
    recentTasks,
    sessionKey,
    compactionCount,
  };
}

function extractSessionName(sessionKey: string): string {
  const parts = sessionKey.split(':');
  if (parts.includes('telegram')) {
    const type = parts.includes('direct') ? 'Direct' : 'Group';
    return `Telegram ${type}`;
  }
  if (parts.includes('cron')) return 'Cron Job';
  return parts[parts.length - 1] || 'Unknown';
}

function parseSessionTasks(sessionKey: string, dir: string): AgentTask[] {
  const sessionsDir = path.join(dir, 'sessions');

  return cachedByDir<AgentTask[]>(sessionsDir, 30_000, () => {
    const tasks: AgentTask[] = [];

    try {
      // Get JSONL files sorted by mtime (most recent first)
      const allFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
      const filesWithStats = allFiles.map(f => {
        const fp = path.join(sessionsDir, f);
        try {
          const stat = fs.statSync(fp);
          return { name: f, path: fp, mtime: stat.mtimeMs };
        } catch {
          return null;
        }
      }).filter(Boolean) as { name: string; path: string; mtime: number }[];

      filesWithStats.sort((a, b) => b.mtime - a.mtime);

      // Process last 5 session files
      for (const fileInfo of filesWithStats.slice(0, 5)) {
        const content = readFileIfExists(fileInfo.path);
        if (!content) continue;

        const lines = content.split('\n').filter(Boolean);

        // Track session-level info
        let sessionStartTs = '';
        let lastAssistantTs = '';

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);

            // Track session start
            if (entry.type === 'session' && entry.timestamp) {
              sessionStartTs = entry.timestamp;
            }

            // Parse assistant messages — the actual JSONL format nests under message.*
            if (entry.type === 'message' && entry.message?.role === 'assistant') {
              const msg = entry.message;
              const usage = msg.usage;
              const content = msg.content;
              const ts = entry.timestamp || '';

              // Extract description from content
              let description = 'Agent response';
              if (Array.isArray(content)) {
                // Look for text content first
                const textBlock = content.find((c: any) => c.type === 'text' && c.text);
                if (textBlock) {
                  description = textBlock.text.slice(0, 200);
                } else {
                  // Look for tool calls
                  const toolCalls = content.filter((c: any) => c.type === 'toolCall');
                  if (toolCalls.length > 0) {
                    const toolNames = toolCalls.map((tc: any) => tc.name).join(', ');
                    description = `Tool calls: ${toolNames}`;
                  }
                }
              } else if (typeof content === 'string') {
                description = content.slice(0, 200);
              }

              // Extract tool call names
              const toolCalls = Array.isArray(content)
                ? content.filter((c: any) => c.type === 'toolCall').map((c: any) => c.name)
                : [];

              const totalTokens = usage?.totalTokens || 0;
              const cost = usage?.cost?.total || 0;
              const model = msg.model || '';
              const stopReason = msg.stopReason || '';

              tasks.push({
                id: entry.id || `task-${tasks.length}`,
                agentId: sessionKey,
                description,
                status: stopReason === 'stop' || stopReason === 'toolUse' ? 'completed' : 'running',
                startedAt: lastAssistantTs || sessionStartTs || ts,
                completedAt: ts,
                tokensUsed: totalTokens,
                costUSD: cost,
                errorMessage: null,
                model,
                toolCalls,
              });

              lastAssistantTs = ts;
            }
          } catch {}
        }

        // We have enough tasks from recent sessions
        if (tasks.length >= 10) break;
      }
    } catch {}

    // Return the most recent 10 tasks
    return tasks.slice(-10);
  });
}

function detectProvider(model: string): AgentData['provider'] {
  const lower = model.toLowerCase();

  // Handle kilocode/provider/model format
  if (lower.startsWith('kilocode/')) {
    const parts = lower.split('/');
    if (parts.length >= 2) {
      const providerPart = parts[1];
      if (providerPart.includes('anthropic')) return 'anthropic';
      if (providerPart.includes('openai')) return 'openai';
      if (providerPart.includes('google')) return 'google';
      if (providerPart.includes('minimax')) return 'minimax';
      if (providerPart.includes('groq')) return 'groq';
      if (providerPart.includes('moonshotai')) return 'openrouter'; // Moonshot via OpenRouter
      if (providerPart.includes('z-ai')) return 'openrouter'; // Z-AI via OpenRouter
    }
  }

  // Fallback to model name detection
  if (lower.includes('claude') || lower.includes('anthropic')) return 'anthropic';
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('openai')) return 'openai';
  if (lower.includes('gemini') || lower.includes('google')) return 'google';
  if (lower.includes('minimax')) return 'minimax';
  if (lower.includes('groq')) return 'groq';
  return 'anthropic';
}

function extractModelDisplayName(model: string): string {
  // Handle kilocode/provider/model format
  if (model.toLowerCase().startsWith('kilocode/')) {
    const parts = model.split('/');
    if (parts.length >= 3) {
      // Convert model slug to display name
      const modelSlug = parts[2];
      return modelSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace(/:free$/i, ' (Free)')
        .replace(/:preview$/i, ' Preview');
    }
  }
  return model;
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // --- Anthropic ---
  'claude-3-opus-20240229': { input: 15, output: 75 },
  'anthropic/claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet-20240229': { input: 3, output: 15 },
  'anthropic/claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-sonnet-4.5': { input: 3, output: 15 },
  'anthropic/claude-sonnet-4.5': { input: 3, output: 15 },

  // --- OpenAI ---
  'gpt-4o': { input: 2.50, output: 10.00 },
  'openai/gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'openai/gpt-4-turbo': { input: 10, output: 30 },
  'openai/gpt-5.2': { input: 2.50, output: 10.00 }, // Assuming gpt-4o pricing
  'gpt-5.2': { input: 2.50, output: 10.00 },

  // --- Google ---
  'gemini-1.5-pro-latest': { input: 1.25, output: 5.00 },
  'google/gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash-latest': { input: 0.0375, output: 0.15 },
  'google/gemini-1.5-flash': { input: 0.0375, output: 0.15 },
  'google/gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'google/gemini-2.5-flash': { input: 0.0375, output: 0.15 },
  'gemini-2.5-flash': { input: 0.0375, output: 0.15 },
  'gemini-3-pro-preview': { input: 1.25, output: 5.00 }, // New Gemini 3 series
  'google/gemini-3-pro-preview': { input: 1.25, output: 5.00 },
  'gemini-3-flash-preview': { input: 0.0375, output: 0.15 },
  'google/gemini-3-flash-preview': { input: 0.0375, output: 0.15 },

  // --- Moonshot AI ---
  'kimi-k2.5': { input: 2.00, output: 8.00 },
  'moonshotai/kimi-k2.5': { input: 2.00, output: 8.00 },

  // --- Z-AI ---
  'glm-5': { input: 1.00, output: 4.00 },
  'z-ai/glm-5': { input: 1.00, output: 4.00 },
  'glm-5:free': { input: 0, output: 0 },

  // --- Other ---
  'minimax/abacus-v1-m2-8k': { input: 0.15, output: 1.20 },
  'minimax/MiniMax-M2.5': { input: 0.15, output: 1.20 },
  'minimax-m2.5': { input: 0.15, output: 1.20 },
  'minimax/minimax-m2.5': { input: 0.15, output: 1.20 },
  'minimax-m2.5:free': { input: 0, output: 0 },
};

function calculateCost(tokensIn: number, tokensOut: number, model: string): number {
  const pricing = MODEL_PRICING[model] || { input: 3, output: 15 };
  return (tokensIn * pricing.input + tokensOut * pricing.output) / 1_000_000;
}

function estimateContextUsage(totalTokens: number, model: string): number {
  let contextWindow = 200_000;
  if (model.includes('gemini')) contextWindow = 1_000_000;
  else if (model.includes('gpt')) contextWindow = 128_000;
  return Math.min(100, Math.round((totalTokens / contextWindow) * 100));
}

// --- Config Audit ---

export function parseConfigAudit(dataDir?: string): ConfigAuditEntry[] {
  const dir = getDataDir(dataDir);
  const content = readFileIfExists(path.join(dir, 'logs', 'config-audit.jsonl'));
  if (!content) return [];

  const entries: ConfigAuditEntry[] = [];
  for (const line of content.split('\n').filter(Boolean)) {
    try {
      const entry = JSON.parse(line);
      entries.push({
        timestamp: entry.timestamp || entry.ts || '',
        pid: entry.pid || 0,
        hashBefore: entry.hashBefore || entry.hash_before || '',
        hashAfter: entry.hashAfter || entry.hash_after || '',
        description: entry.description || entry.change || entry.message || 'Config change',
      });
    } catch {
      // Skip malformed lines
    }
  }

  return entries.reverse().slice(0, 50);
}

// --- Devices ---

export function parsePairedDevices(dataDir?: string): PairedDevice[] {
  const dir = getDataDir(dataDir);
  const data = readJsonIfExists<any>(path.join(dir, 'devices', 'paired.json'), {});

  if (!data.devices && !Array.isArray(data)) {
    // Try different formats
    const devices = data.version ? (data.devices || []) : (Array.isArray(data) ? data : []);
    if (!Array.isArray(devices)) {
      // It might be an object keyed by device ID
      return Object.entries(data).filter(([k]) => k !== 'version').map(([id, d]: [string, any]) => ({
        id,
        platform: d.platform || 'unknown',
        clientId: d.clientId || '',
        clientMode: d.clientMode || '',
        role: d.role || d.roles?.[0] || '',
        scopes: d.approvedScopes || d.scopes || [],
        tokenCreated: d.createdAtMs ? new Date(d.createdAtMs).toISOString() : '',
        lastRotated: d.tokens?.operator?.createdAtMs
          ? new Date(d.tokens.operator.createdAtMs).toISOString()
          : (d.createdAtMs ? new Date(d.createdAtMs).toISOString() : ''),
        lastUsed: d.tokens?.operator?.lastUsedAtMs
          ? new Date(d.tokens.operator.lastUsedAtMs).toISOString()
          : '',
      }));
    }
  }

  const devices = Array.isArray(data) ? data : (data.devices || []);
  return devices.map((d: any) => ({
    id: d.id || d.deviceId || '',
    platform: d.platform || 'unknown',
    clientId: d.clientId || '',
    clientMode: d.clientMode || '',
    role: d.role || '',
    scopes: d.scopes || [],
    tokenCreated: d.tokenCreatedAt || d.createdAt || '',
    lastRotated: d.lastRotatedAt || d.tokenCreatedAt || '',
    lastUsed: d.lastUsedAt || d.updatedAt || '',
  }));
}

// --- Security Posture (real data from .openclaw) ---

export interface OAuthTokenStatus {
  provider: string;
  profileId: string;
  expiresAt: string | null;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  lastUsed: string | null;
  errorCount: number;
}

export interface SecurityPosture {
  devices: PairedDevice[];
  deviceTokenAge: { days: number; updatedAt: string } | null;
  oauthTokens: OAuthTokenStatus[];
  configAuditSummary: {
    totalChanges: number;
    lastChange: string | null;
    suspiciousCount: number;
    recentChanges: ConfigAuditEntry[];
  };
  totalAuthErrors: number;
}

export function parseSecurityPosture(dataDir?: string): SecurityPosture {
  const dir = getDataDir(dataDir);

  // 1. Devices
  const devices = parsePairedDevices(dataDir);

  // 2. Device token age from identity/device-auth.json
  const deviceAuth = readJsonIfExists<any>(path.join(dir, 'identity', 'device-auth.json'), null);
  const tokenUpdatedMs = deviceAuth?.tokens?.operator?.updatedAtMs
    || deviceAuth?.tokens?.operator?.createdAtMs;
  const deviceTokenAge = tokenUpdatedMs
    ? {
        days: Math.floor((Date.now() - tokenUpdatedMs) / 86400000),
        updatedAt: new Date(tokenUpdatedMs).toISOString(),
      }
    : null;

  // 3. Scan OAuth tokens from all agent auth.json files
  const oauthTokens: OAuthTokenStatus[] = [];
  let totalAuthErrors = 0;
  const agentsDir = path.join(dir, 'agents');
  try {
    const agentDirs = fs.readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name);

    for (const agentDir of agentDirs) {
      const authFile = path.join(agentsDir, agentDir, 'agent', 'auth.json');
      const authData = readJsonIfExists<any>(authFile, null);
      if (!authData) continue;

      // Check OAuth providers (entries with 'expires')
      for (const [profileId, profileData] of Object.entries(authData)) {
        if (profileId === 'usageStats' || profileId === 'version') continue;
        const pd = profileData as any;
        if (pd?.expires) {
          const expiresMs = pd.expires;
          const now = Date.now();
          const isExpired = expiresMs < now;
          const daysUntilExpiry = isExpired ? 0 : Math.floor((expiresMs - now) / 86400000);
          oauthTokens.push({
            provider: profileId.split(':')[0] || profileId,
            profileId,
            expiresAt: new Date(expiresMs).toISOString(),
            isExpired,
            daysUntilExpiry,
            lastUsed: null,
            errorCount: 0,
          });
        }
      }

      // Check usage stats for errors
      const usageStats = authData.usageStats;
      if (usageStats && typeof usageStats === 'object') {
        for (const [statKey, statVal] of Object.entries(usageStats)) {
          const sv = statVal as any;
          if (sv?.errorCount) totalAuthErrors += sv.errorCount;
          // Update lastUsed for matching OAuth tokens
          const matching = oauthTokens.find((t) => t.profileId === statKey || statKey.startsWith(t.provider));
          if (matching && sv?.lastUsed) {
            matching.lastUsed = new Date(sv.lastUsed).toISOString();
          }
        }
      }
    }
  } catch {
    // agents dir not readable
  }

  // 4. Config audit summary
  const auditEntries = parseConfigAudit(dataDir);
  const suspiciousCount = auditEntries.filter((e: any) => {
    // Raw audit entries may have a 'suspicious' array (from the JSONL)
    return false; // We don't have access to raw suspicious field via parseConfigAudit
  }).length;

  const configAuditSummary = {
    totalChanges: auditEntries.length,
    lastChange: auditEntries.length > 0 ? auditEntries[0].timestamp : null,
    suspiciousCount,
    recentChanges: auditEntries.slice(0, 5),
  };

  return { devices, deviceTokenAge, oauthTokens, configAuditSummary, totalAuthErrors };
}

// --- Cron Jobs ---

export function parseCronJobs(dataDir?: string): CronJob[] {
  const dir = getDataDir(dataDir);
  const data = readJsonIfExists<any>(path.join(dir, 'cron', 'jobs.json'), {});
  const jobs = data.jobs || [];

  return jobs.map((j: any) => ({
    id: j.id || '',
    name: j.payload?.text || j.payload?.message || j.name || 'Unnamed Job',
    agent: j.agent || 'main',
    enabled: !!j.enabled,
    scheduleMs: j.schedule?.intervalMs || j.intervalMs || 0,
    lastRun: j.state?.lastRunAt || null,
    lastStatus: j.state?.lastStatus || null,
    lastDurationMs: j.state?.lastDurationMs || null,
  }));
}

// --- Provider Connections ---

export interface ModelInfo {
  id: string;
  name: string;
  reasoning: boolean;
  cost: { input: number; output: number; cacheRead?: number; cacheWrite?: number };
  contextWindow: number;
  lastUsed: string | null;
  active: boolean;
}

export interface ProviderConnectionEnhanced extends ProviderConnection {
  activeModels: string[];
  allModels: ModelInfo[];
  totalSpendToday: number;
  lastUsedModel: string | null;
}

export function parseProviderConnections(dataDir?: string): ProviderConnectionEnhanced[] {
  const dir = getDataDir(dataDir);
  const config = parseMainConfig(dataDir);
  const modelsFile = readJsonIfExists<any>(path.join(dir, 'agents', 'main', 'agent', 'models.json'), {});
  const health = parseProviderHealth(dir);
  const connections: ProviderConnectionEnhanced[] = [];

  // Read .env for key presence
  const envContent = readFileIfExists(path.join(dir, '.env'));
  const envKeys: Record<string, boolean> = {};
  if (envContent) {
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([A-Z_]+_API_KEY)/);
      if (match) {
        const provider = match[1].replace('_API_KEY', '').toLowerCase();
        envKeys[provider] = true;
      }
    }
  }

  // Get .env file mtime for key age
  let envMtimeMs: number | null = null;
  try {
    const envStat = fs.statSync(path.join(dir, '.env'));
    envMtimeMs = envStat.mtimeMs;
  } catch {}

  // Scan recent session entries for last-used timestamps per provider
  const providerLastUsed: Record<string, string> = {};
  const providerModelsUsed: Record<string, Set<string>> = {};
  const providerSpendToday: Record<string, number> = {};

  try {
    const agentsDir = path.join(dir, 'agents');
    const agentDirs = fs.readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name);

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const agentDir of agentDirs) {
      const sessionsDir = path.join(agentsDir, agentDir, 'sessions');
      let sessionFiles: string[] = [];
      try {
        sessionFiles = fs.readdirSync(sessionsDir)
          .filter((f) => f.endsWith('.jsonl') && !f.includes('.lock') && !f.startsWith('probe-'));
      } catch { continue; }

      for (const file of sessionFiles) {
        const filePath = path.join(sessionsDir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs < sevenDaysAgo) continue;
        } catch { continue; }

        // Use the existing extractCostEntries from session-cost module would create circular dep
        // Instead, do a lightweight scan for provider/model/timestamp
        let content: string;
        try { content = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }

        for (const line of content.split('\n')) {
          if (!line || !line.includes('"provider"')) continue;
          try {
            const entry = JSON.parse(line);
            const msg = entry.message || entry;
            const prov = msg.provider || entry.provider;
            const model = msg.model || entry.model;
            const ts = entry.timestamp || msg.timestamp;
            if (!prov || !ts) continue;

            const tsStr = typeof ts === 'number' ? new Date(ts).toISOString() : ts;

            if (!providerLastUsed[prov] || tsStr > providerLastUsed[prov]) {
              providerLastUsed[prov] = tsStr;
            }
            if (model) {
              if (!providerModelsUsed[prov]) providerModelsUsed[prov] = new Set();
              providerModelsUsed[prov].add(model);
            }

            // Today's spend
            if (msg.usage?.cost?.total && new Date(tsStr).getTime() >= todayStart.getTime()) {
              providerSpendToday[prov] = (providerSpendToday[prov] || 0) + msg.usage.cost.total;
            }
          } catch {}
        }
      }
    }
  } catch {}

  // Build provider list from models.json providers structure
  const providersConfig = modelsFile.providers || {};
  const seenProviders = new Set<string>();

  for (const [provName, provData] of Object.entries(providersConfig) as [string, any][]) {
    seenProviders.add(provName);
    const models: ModelInfo[] = (provData.models || []).map((m: any) => ({
      id: m.id || '',
      name: m.name || m.id || '',
      reasoning: !!m.reasoning,
      cost: m.cost || { input: 0, output: 0 },
      contextWindow: m.contextWindow || 0,
      lastUsed: null,
      active: providerModelsUsed[provName]?.has(m.id) || false,
    }));

    // Mark models with last-used timestamps
    if (providerModelsUsed[provName]) {
      for (const model of models) {
        if (providerModelsUsed[provName].has(model.id)) {
          model.active = true;
        }
      }
    }

    const activeModels = models.filter((m) => m.active).map((m) => m.id);
    const allModelIds = models.map((m) => m.id);

    const keyAgeDays = envMtimeMs ? Math.floor((Date.now() - envMtimeMs) / 86400000) : null;

    connections.push({
      provider: provName,
      status: health[provName] || (envKeys[provName] ? 'healthy' : (providerLastUsed[provName] ? 'healthy' : 'down')),
      models: allModelIds,
      lastSuccessfulCall: providerLastUsed[provName] || null,
      keyAgeDays,
      keyRotationDue: keyAgeDays !== null && keyAgeDays > 60,
      activeModels,
      allModels: models,
      totalSpendToday: providerSpendToday[provName] || 0,
      lastUsedModel: activeModels.length > 0 ? activeModels[activeModels.length - 1] : null,
    });
  }

  // Also add legacy hardcoded providers if not already found
  for (const provider of ['anthropic', 'openai', 'google', 'minimax']) {
    if (seenProviders.has(provider)) continue;
    connections.push({
      provider,
      status: health[provider] || (envKeys[provider] ? 'healthy' : 'down'),
      models: [],
      lastSuccessfulCall: providerLastUsed[provider] || null,
      keyAgeDays: envMtimeMs ? Math.floor((Date.now() - envMtimeMs) / 86400000) : null,
      keyRotationDue: false,
      activeModels: [],
      allModels: [],
      totalSpendToday: providerSpendToday[provider] || 0,
      lastUsedModel: null,
    });
  }

  // Sort by lastSuccessfulCall descending (most recently used first)
  connections.sort((a, b) => {
    if (!a.lastSuccessfulCall && !b.lastSuccessfulCall) return 0;
    if (!a.lastSuccessfulCall) return 1;
    if (!b.lastSuccessfulCall) return -1;
    return b.lastSuccessfulCall.localeCompare(a.lastSuccessfulCall);
  });

  return connections;
}

// --- Delivery Queue ---

export function parseDeliveryQueue(dataDir?: string): { total: number; failed: number; errors: string[] } {
  const dir = getDataDir(dataDir);
  const queueDir = path.join(dir, 'delivery-queue');
  const errors: string[] = [];
  let total = 0;

  try {
    const files = fs.readdirSync(queueDir).filter(f => f.endsWith('.json'));
    total = files.length;
    for (const file of files.slice(0, 10)) {
      const data = readJsonIfExists<any>(path.join(queueDir, file), {});
      if (data.lastError) {
        errors.push(data.lastError);
      }
    }
  } catch {
    // Directory not readable
  }

  return { total, failed: errors.length, errors };
}

// --- Extensions ---

export function parseExtensions(dataDir?: string): { name: string; version: string; source: string }[] {
  const dir = getDataDir(dataDir);
  const extDir = path.join(dir, 'extensions');
  const extensions: { name: string; version: string; source: string }[] = [];

  try {
    const dirs = fs.readdirSync(extDir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const d of dirs) {
      const pkgPath = path.join(extDir, d.name, 'package.json');
      const pkg = readJsonIfExists<any>(pkgPath, {});
      extensions.push({
        name: pkg.name || d.name,
        version: pkg.version || 'unknown',
        source: pkg._resolved || 'local',
      });
    }
  } catch {
    // Not readable
  }

  return extensions;
}

// --- Workspace Docs ---

export function parseWorkspaceDocs(dataDir?: string): Record<string, string> {
  const dir = getDataDir(dataDir);
  const workspaceDir = path.join(dir, 'workspace');
  const docs: Record<string, string> = {};
  const docFiles = ['AGENTS.md', 'MEMORY.md', 'SOUL.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md', 'HEARTBEAT.md'];

  for (const file of docFiles) {
    const content = readFileIfExists(path.join(workspaceDir, file));
    if (content) docs[file] = content;
  }

  return docs;
}

// --- Sandbox ---

export function parseSandboxStatus(dataDir?: string): { containerName: string; image: string; lastUsed: string } | null {
  const dir = getDataDir(dataDir);
  const data = readJsonIfExists<any>(path.join(dir, 'sandbox', 'containers.json'), {});
  const containers = Array.isArray(data) ? data : (data.containers || [data]).filter(Boolean);

  if (containers.length === 0) return null;
  const c = containers[0];
  return {
    containerName: c.containerName || '',
    image: c.image || '',
    lastUsed: c.lastUsedAtMs ? new Date(c.lastUsedAtMs).toISOString() : '',
  };
}
