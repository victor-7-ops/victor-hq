import { NextResponse } from 'next/server';
import { runProviderProbe } from '@/lib/parsers/openclaw-cli';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

// Cache the probe results for 60 seconds
let cachedProbe: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60000;

export async function GET() {
  try {
    if (cachedProbe && Date.now() - cachedProbe.timestamp < CACHE_TTL) {
      return NextResponse.json(cachedProbe.data);
    }
    
    const probeResult = await runProviderProbe();
    
    // Group by provider
    const byProvider: Record<string, {
      models: string[];
      status: 'ok' | 'auth' | 'error';
      avgLatencyMs: number | null;
      errors: string[];
    }> = {};
    
    for (const result of probeResult.results) {
      const provider = result.model.split('/')[0] || 'unknown';
      
      if (!byProvider[provider]) {
        byProvider[provider] = { models: [], status: 'ok', avgLatencyMs: null, errors: [] };
      }
      
      byProvider[provider].models.push(result.model);
      
      if (result.status === 'auth') {
        byProvider[provider].status = 'auth';
      } else if (result.status === 'error' && byProvider[provider].status !== 'auth') {
        byProvider[provider].status = 'error';
      }
      
      if (result.errorMessage) {
        byProvider[provider].errors.push(result.errorMessage);
      }
    }
    
    // Calculate average latency per provider
    for (const provider of Object.keys(byProvider)) {
      const providerResults = probeResult.results.filter(r => r.model.startsWith(provider + '/'));
      const latencies = providerResults.filter(r => r.latencyMs !== null).map(r => r.latencyMs!);
      if (latencies.length > 0) {
        byProvider[provider].avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      }
    }
    
    const response = {
      providers: byProvider,
      probeTime: probeResult.probeTime,
      totalProbed: probeResult.totalProbed,
    };
    
    cachedProbe = { data: response, timestamp: Date.now() };
    
    return NextResponse.json(response);
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error), providers: {} }, { status: 500 });
  }
}
