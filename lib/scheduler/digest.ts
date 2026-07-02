/**
 * Daily Digest Scheduler
 * ======================
 * Generates a daily summary at 5:00 AM and stores it as a Memory Log entry.
 */

import cron from 'node-cron';
import { parseAgentData, parseGatewayStatus } from '@/lib/parsers/openclaw-logs';
import { getConfig, createMemoryEntry, getAlerts, getDailyCosts } from '@/lib/db/queries';
import { formatCost, formatTokens, formatUptime } from '@/lib/utils';

let scheduled = false;

export function startDigestScheduler() {
  if (scheduled) return;
  scheduled = true;

  // Run at 5:00 AM every day
  cron.schedule('0 5 * * *', () => {
    generateDailyDigest().catch(err => {
      console.error('[Digest] Failed to generate daily digest:', err);
    });
  });

  console.log('[Digest] Daily digest scheduler started — runs at 5:00 AM');
}

export async function generateDailyDigest(): Promise<string> {
  const config = getConfig();
  const agents = parseAgentData(config.openclawDataDir);
  const gateway = parseGatewayStatus(config.openclawDataDir);
  const alerts = getAlerts(false); // Unacknowledged
  const dailyCosts = getDailyCosts(7);

  // Fleet status
  const onlineCount = agents.filter(a => a.status === 'online').length;
  const errorCount = agents.filter(a => a.status === 'error').length;
  const offlineAgents = agents.filter(a => a.status === 'offline').map(a => a.name);

  // Cost
  const todayCost = agents.reduce((s, a) => s + a.costUSD, 0);
  const totalTokens = agents.reduce((s, a) => s + a.tokensIn + a.tokensOut, 0);
  const avg7d = dailyCosts.length > 0
    ? dailyCosts.reduce((s: number, d: any) => s + d.total_cost, 0) / dailyCosts.length
    : 0;

  // Tasks
  const tasksCompleted = agents.reduce((s, a) => s + a.taskCompletedCount, 0);
  const tasksFailed = agents.reduce((s, a) => s + a.taskFailedCount, 0);

  // Context warnings
  const contextWarnings = agents
    .filter(a => a.contextWindowUsedPercent > 85)
    .map(a => `${a.name} at ${a.contextWindowUsedPercent}% context`);

  // Build digest content (use null for lines to omit, '' for blank lines)
  const rawLines: (string | null)[] = [
    `## Daily Digest — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`,
    '',
    `### Fleet Status`,
    `- ${agents.length} agents total: ${onlineCount} online, ${errorCount} errors`,
    offlineAgents.length > 0 ? `- Offline: ${offlineAgents.join(', ')}` : '- All agents responsive',
    `- Gateway: port ${gateway.port}, uptime ${formatUptime(gateway.uptime)}`,
    '',
    `### Cost & Usage`,
    `- Yesterday's cost: ${formatCost(todayCost)} (7-day avg: ${formatCost(avg7d)})`,
    `- Tokens used: ${formatTokens(totalTokens)}`,
    todayCost > 0 && avg7d > 0 && todayCost > avg7d * 1.5 ? `- ⚠ Cost ${Math.round((todayCost / avg7d - 1) * 100)}% above average` : null,
    '',
    `### Tasks`,
    `- Completed: ${tasksCompleted}`,
    `- Failed: ${tasksFailed}`,
    '',
    `### Security`,
    alerts.length > 0 ? `- ${alerts.length} unacknowledged alert(s)` : '- No security alerts',
    '',
  ];

  if (contextWarnings.length > 0) {
    rawLines.push('### Context Warnings');
    contextWarnings.forEach(w => rawLines.push(`- ${w}`));
    rawLines.push('');
  }

  const content = rawLines.filter((l): l is string => l !== null).join('\n');

  // Store as memory entry
  const entry = createMemoryEntry({
    type: 'session_summary',
    title: `Daily Digest — ${new Date().toLocaleDateString()}`,
    content,
    agentId: null,
    tags: ['digest', 'daily'],
    isRead: false,
    metadata: {
      fleetTotal: agents.length,
      fleetOnline: onlineCount,
      costToday: todayCost,
      costAvg7d: avg7d,
      tokensToday: totalTokens,
      tasksCompleted,
      tasksFailed,
      alertCount: alerts.length,
    },
  });

  console.log(`[Digest] Generated daily digest: ${entry.id}`);
  return entry.id;
}
