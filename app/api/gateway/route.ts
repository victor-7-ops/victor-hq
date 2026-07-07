import { NextResponse } from 'next/server';
import { getOpenClawStatus } from '@/lib/parsers/openclaw-cli';
import { parseGatewayStatus } from '@/lib/parsers/openclaw-logs';
import { getConfig } from '@/lib/db/queries';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get live status from CLI
    const cliStatus = await getOpenClawStatus();
    
    // Also get static parsed data for additional fields
    const config = getConfig();
    const parsedStatus = parseGatewayStatus(config.openclawDataDir);
    
    // Merge: CLI data takes precedence for live values
    const gateway = {
      port: parseInt(cliStatus.gateway.url?.match(/:(\d+)/)?.[1] || '18789', 10),
      pid: cliStatus.gateway.pid,
      uptime: 0, // Would need daemon start time to calculate
      version: cliStatus.gateway.version || parsedStatus.version,
      deviceTokenValid: parsedStatus.deviceTokenValid,
      cacheRetentionMode: parsedStatus.cacheRetentionMode,
      tailscaleEndpoint: parsedStatus.tailscaleEndpoint,
      providerHealth: parsedStatus.providerHealth,
      // New fields from CLI
      reachable: cliStatus.gateway.reachable,
      connectLatencyMs: cliStatus.gateway.connectLatencyMs,
      runtimeState: cliStatus.gateway.runtimeState,
    };
    
    return NextResponse.json(gateway);
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
