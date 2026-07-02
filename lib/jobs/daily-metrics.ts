import { parseAgentData } from '@/lib/parsers/openclaw-logs';
import { upsertDailyCost } from '@/lib/db/queries';
import { getOpenclawHome } from '@/lib/utils';

export function runDailyMetricsAggregation() {
  console.log('[Job] Running daily metrics aggregation...');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // This will scan all .jsonl files, which is expensive.
  // We should optimize this later if it becomes too slow.
  const agents = parseAgentData(getOpenclawHome(), { timeframe: { days: 1 } });

  const totalCost = agents.reduce((sum, a) => sum + a.costUSD, 0);
  const totalTokens = agents.reduce((sum, a) => sum + a.tokensIn + a.tokensOut, 0);

  const costByProvider: Record<string, number> = {};
  const costByAgent: Record<string, number> = {};
  for (const agent of agents) {
    costByProvider[agent.provider] = (costByProvider[agent.provider] || 0) + agent.costUSD;
    costByAgent[agent.name] = (costByAgent[agent.name] || 0) + agent.costUSD;
  }

  upsertDailyCost(dateStr, {
    totalCost,
    totalTokens,
    costByProvider,
    costByAgent,
    cacheWriteCost: 0,
    computeCost: totalCost,
  });

  console.log(`[Job] Daily metrics for ${dateStr} aggregated. Cost: $${totalCost.toFixed(2)}`);
}
