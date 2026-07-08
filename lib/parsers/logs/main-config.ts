import type { GatewayStatus, ProviderHealth } from '@/types';
import { fs, path, getDataDir, readFileIfExists, readJsonIfExists } from './shared';

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

export function parseProviderHealth(dir: string): Record<string, ProviderHealth> {
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
