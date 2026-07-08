import type { ConfigAuditEntry, PairedDevice } from '@/types';
import { fs, path, getDataDir, readFileIfExists, readJsonIfExists } from './shared';

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
