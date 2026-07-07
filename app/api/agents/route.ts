import { NextResponse } from 'next/server';
import { parseAgentData } from '@/lib/parsers/openclaw-logs';
import {
  getOpenClawSessions,
  aggregateSessionsByAgent,
  deriveStatusFromAge,
  calculateContextPercent,
  getOpenClawModels,
  getModelDisplayName,
} from '@/lib/parsers/openclaw-cli';
import { calculateTokenCost } from '@/lib/parsers/cost-calculator';
import { getConfig, getAgentMetricsSummary } from '@/lib/db/queries';
import type { AgentData } from '@/types';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

function detectProvider(model: string): AgentData['provider'] {
  const lower = model.toLowerCase();
  if (lower.includes('claude') || lower.includes('anthropic')) return 'anthropic';
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('openai')) return 'openai';
  if (lower.includes('gemini') || lower.includes('google')) return 'google';
  if (lower.includes('minimax')) return 'minimax';
  if (lower.includes('groq')) return 'groq';
  if (lower.includes('zai') || lower.includes('vercel-ai-gateway')) return 'openai';
  return 'anthropic';
}

function agentNameFromId(id: string): string {
  const names: Record<string, string> = {
    main: 'Orchestrator',
    researcher: 'Researcher',
    developer: 'Developer',
    'qa-frontend': 'QA Frontend',
    unknown: 'Unknown Agent',
  };
  return names[id] || id.charAt(0).toUpperCase() + id.slice(1);
}

export async function GET() {
  try {
    const [modelsConfig, cliSessions] = await Promise.all([getOpenClawModels(), getOpenClawSessions()]);
    const config = getConfig();
    const parsedAgents = parseAgentData(config.openclawDataDir);
    const dbMetrics = getAgentMetricsSummary();
    const aggregatedSessions = aggregateSessionsByAgent(cliSessions.sessions);

    const agentMap = new Map<string, AgentData>();
    for (const agent of parsedAgents) {
      agentMap.set(agent.id, agent);
    }

    for (const metric of dbMetrics) {
      const matchKey = metric.agentId;
      let matched = false;

      for (const [id, agent] of Array.from(agentMap.entries())) {
        const idLower = id.toLowerCase();
        const nameLower = agent.name.toLowerCase();
        if (
          idLower.includes(matchKey) ||
          nameLower === matchKey ||
          agent.sessionKey?.includes(matchKey)
        ) {
          agent.tokensIn = Math.max(agent.tokensIn, metric.totalTokensIn);
          agent.tokensOut = Math.max(agent.tokensOut, metric.totalTokensOut);
          if (metric.avgLatencyMs > 0) agent.latencyMs = metric.avgLatencyMs;
          agent.errorCount = Math.max(agent.errorCount, metric.errorCount);
          matched = true;
          break;
        }
      }

      if (!matched && matchKey !== 'unknown') {
        const orchAgent = parsedAgents.find((a) => a.role === 'orchestrator');
        const model = metric.lastModel || 'claude-sonnet-4-6';
        const minutesSinceActive = metric.lastActive
          ? (Date.now() - new Date(metric.lastActive).getTime()) / 60000
          : Infinity;

        let status: AgentData['status'] = 'offline';
        if (minutesSinceActive < 5) status = 'online';
        else if (minutesSinceActive < 60) status = 'idle';

        const newAgent: AgentData = {
          id: `db-agent-${matchKey}`,
          name: agentNameFromId(matchKey),
          role: 'sub-agent',
          parentId: orchAgent?.id || null,
          status,
          model,
          provider: detectProvider(model),
          tokensIn: metric.totalTokensIn,
          tokensOut: metric.totalTokensOut,
          costUSD: 0,
          contextWindowUsedPercent: 0,
          latencyMs: metric.avgLatencyMs,
          errorCount: metric.errorCount,
          lastError: null,
          lastActiveAt: metric.lastActive || new Date().toISOString(),
          uptime: 0,
          taskCompletedCount: metric.totalRequests - metric.errorCount,
          taskFailedCount: metric.errorCount,
          driftScore: metric.totalRequests > 0 ? 0 : null,
          recentTasks: [],
          sessionKey: matchKey,
        };
        agentMap.set(newAgent.id, newAgent);
      }
    }

    for (const [agentId, sessionData] of Array.from(aggregatedSessions.entries())) {
      const { latestSession, totalTokensIn, totalTokensOut } = sessionData;
      
      let foundAgent: AgentData | undefined;
      for (const [id, agent] of Array.from(agentMap.entries())) {
        const idLower = id.toLowerCase();
        if (idLower === agentId.toLowerCase() || 
            agent.sessionKey?.toLowerCase() === agentId.toLowerCase() ||
            agent.name.toLowerCase() === agentId.toLowerCase()) {
          foundAgent = agent;
          break;
        }
      }

      if (foundAgent) {
        foundAgent.status = deriveStatusFromAge(latestSession.ageMs);
        foundAgent.tokensIn = totalTokensIn;
        foundAgent.tokensOut = totalTokensOut;
        foundAgent.contextWindowUsedPercent = calculateContextPercent(
          latestSession.totalTokens || 0,
          latestSession.contextTokens || 0
        );
        foundAgent.model = latestSession.model;
        foundAgent.provider = detectProvider(latestSession.model);
        foundAgent.lastActiveAt = new Date(latestSession.updatedAt).toISOString();
      } else {
        const orchAgent = parsedAgents.find((a) => a.role === 'orchestrator');
        const newAgent: AgentData = {
          id: `cli-agent-${agentId}`,
          name: agentNameFromId(agentId),
          role: agentId === 'main' ? 'orchestrator' : 'sub-agent',
          parentId: agentId === 'main' ? null : (orchAgent?.id || null),
          status: deriveStatusFromAge(latestSession.ageMs),
          model: latestSession.model,
          provider: detectProvider(latestSession.model),
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
          costUSD: 0,
          contextWindowUsedPercent: calculateContextPercent(
            latestSession.totalTokens || 0,
            latestSession.contextTokens || 0
          ),
          latencyMs: 0,
          errorCount: 0,
          lastError: null,
          lastActiveAt: new Date(latestSession.updatedAt).toISOString(),
          uptime: 0,
          taskCompletedCount: 0,
          taskFailedCount: 0,
          driftScore: totalTokensIn + totalTokensOut > 0 ? 0 : null,
          recentTasks: [],
          sessionKey: agentId,
        };
        agentMap.set(newAgent.id, newAgent);
      }
    }

    let agents = Array.from(agentMap.values());
    
    // Fallback: ensure we always have agents from config even if parsing failed
    if (agents.length === 0) {
      const fallbackAgents = [
        { id: 'agent-main', name: 'Orchestrator', role: 'orchestrator', model: modelsConfig.defaultModel },
        { id: 'agent-researcher', name: 'Researcher', role: 'sub-agent', model: modelsConfig.fallbacks[0] || modelsConfig.defaultModel },
        { id: 'agent-developer', name: 'Developer', role: 'sub-agent', model: modelsConfig.fallbacks[1] || modelsConfig.defaultModel },
        { id: 'agent-qa-frontend', name: 'DS Parity QA', role: 'sub-agent', model: modelsConfig.fallbacks[2] || modelsConfig.defaultModel },
      ];
      
      for (const fallback of fallbackAgents) {
        const newAgent: AgentData = {
          id: fallback.id,
          name: fallback.name,
          role: fallback.role as 'orchestrator' | 'sub-agent',
          parentId: fallback.role === 'orchestrator' ? null : 'agent-main',
          status: 'online',
          model: fallback.model,
          provider: detectProvider(fallback.model),
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
          sessionKey: fallback.id.replace('agent-', ''),
        };
        agents.push(newAgent);
      }
    }
    
    // Calculate cost and add display names
    let totalFleetCost = 0;
    for (const agent of agents) {
      // Calculate cost from tokens
      const costs = calculateTokenCost(agent.tokensIn, agent.tokensOut, agent.model);
      agent.costUSD = costs.total;
      totalFleetCost += costs.total;
      
      // Add model display name
      (agent as any).modelDisplayName = getModelDisplayName(agent.model);
      if (agent.role === 'orchestrator') {
        agent.fallbacks = modelsConfig.fallbacks;
      }
    }
    
    const activeCount = agents.filter(a => a.status === 'online' || a.status === 'idle').length;
    
    const response = {
      agents,
      activeCount,
      totalAgents: agents.length,
      fleetCost: totalFleetCost,
      modelsConfig: {
        defaultModel: modelsConfig.defaultModel,
        defaultModelDisplayName: getModelDisplayName(modelsConfig.defaultModel),
        fallbacks: modelsConfig.fallbacks,
        fallbackDisplayNames: modelsConfig.fallbacks.map(getModelDisplayName),
      },
    };
    
    return NextResponse.json(response);
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error), agents: [] }, { status: 500 });
  }
}
