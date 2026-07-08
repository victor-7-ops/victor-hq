import type { AgentData, AgentTask } from '@/types';
import { fs, path, getDataDir, readFileIfExists, readJsonIfExists, cachedByDir } from './shared';
import { parseMainConfig } from './main-config';

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
