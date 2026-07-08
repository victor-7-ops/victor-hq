import type { CronJob, ProviderConnection } from '@/types';
import { fs, path, getDataDir, readFileIfExists, readJsonIfExists } from './shared';
import { parseMainConfig, parseProviderHealth } from './main-config';

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
