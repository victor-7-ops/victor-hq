import { NextResponse } from 'next/server';
import { getConfig, getCompactionLog } from '@/lib/db/queries';
import {
  parseMainConfig, parseGatewayStatus, parseProviderConnections,
  parseConfigAudit, parseExtensions, parseSandboxStatus, parseWorkspaceDocs,
} from '@/lib/parsers/openclaw-logs';
import { resolveHomePath } from '@/lib/utils';
import fs from 'fs';
import path from 'path';
import { errorMessage } from '@/lib/api-error';
import { redactJsonString, redactSecrets } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getConfig();
    const dataDir = config.openclawDataDir;
    const openclawConfig = parseMainConfig(dataDir);
    const gateway = parseGatewayStatus(dataDir);
    const providers = parseProviderConnections(dataDir);
    const configAudit = parseConfigAudit(dataDir);
    const extensions = parseExtensions(dataDir);
    const sandbox = parseSandboxStatus(dataDir);
    const compactionLog = getCompactionLog();

    // Read raw config for display
    let rawConfig = '';
    try {
      rawConfig = redactJsonString(fs.readFileSync(
        path.join(resolveHomePath(dataDir), 'openclaw.json'),
        'utf-8'
      ));
    } catch {}

    return NextResponse.json({
      openclawConfig: redactSecrets(openclawConfig),
      gateway,
      providers: redactSecrets(providers),
      configAudit,
      extensions,
      sandbox,
      compactionLog,
      rawConfig,
      assistantName: openclawConfig.ui?.assistantName || 'Orchestrator',
      version: openclawConfig.meta?.version || 'unknown',
      _meta: {
        source: 'openclaw',
        computedAt: new Date().toISOString(),
        dataDir: dataDir,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
