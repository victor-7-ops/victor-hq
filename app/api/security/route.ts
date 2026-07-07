import { NextRequest, NextResponse } from 'next/server';
import { getAlerts, createAlert, acknowledgeAlert, getUnacknowledgedAlertCount } from '@/lib/db/queries';
import { getConfig } from '@/lib/db/queries';
import { parsePairedDevices, parseMainConfig, parseSecurityPosture } from '@/lib/parsers/openclaw-logs';
import { resolveHomePath } from '@/lib/utils';
import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { errorMessage } from '@/lib/api-error';
import { redactSecrets } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

const IS_DARWIN = os.platform() === 'darwin';

export async function GET() {
  try {
    const config = getConfig();
    const dataDir = config.openclawDataDir;
    const alerts = getAlerts();
    const unacknowledgedCount = getUnacknowledgedAlertCount();
    const devices = parsePairedDevices(dataDir);
    const securityPosture = parseSecurityPosture(dataDir);
    const openclawConfig = parseMainConfig(dataDir);

    // FileVault status (macOS only)
    let fileVaultEnabled = false;
    if (IS_DARWIN) {
      try {
        const result = execSync('fdesetup status 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
        fileVaultEnabled = result.includes('On');
      } catch {
        // Cannot determine
      }
    }

    // Git hooks check
    let gitHooksExist = false;
    if (config.projectRepoPath) {
      const hookPath = path.join(resolveHomePath(config.projectRepoPath), '.git', 'hooks', 'pre-commit');
      gitHooksExist = fs.existsSync(hookPath);
    }

    // Tailscale status (skip in containers without tailscale)
    let tailscaleConnected = false;
    let tailscaleEndpoint: string | null = null;
    try {
      const result = execSync('tailscale status --json 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
      const ts = JSON.parse(result);
      tailscaleConnected = ts.BackendState === 'Running';
      tailscaleEndpoint = ts.Self?.DNSName || null;
    } catch {
      // Tailscale not installed or not running
    }

    // API key age check from config audit
    const envPath = path.join(resolveHomePath(dataDir), '.env');
    let envExists = false;
    try { envExists = fs.existsSync(envPath); } catch {}

    return NextResponse.json({
      alerts,
      unacknowledgedCount,
      devices,
      fileVaultEnabled,
      gitHooksExist,
      tailscaleConnected,
      tailscaleEndpoint,
      envExists,
      gatewayPort: openclawConfig.gateway?.port || parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10),
      securityPosture: redactSecrets(securityPosture),
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'acknowledge') {
      if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      acknowledgeAlert(body.id);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'create') {
      const id = createAlert({
        type: body.type || 'error_spike',
        severity: body.severity || 'info',
        title: body.title || '',
        description: body.description || '',
        rawLog: body.rawLog || null,
      });
      return NextResponse.json({ id });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
