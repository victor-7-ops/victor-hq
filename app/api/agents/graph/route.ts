import { NextResponse } from 'next/server';
import { parseAgentData } from '@/lib/parsers/openclaw-logs';
import {
  getOpenClawSessions,
  aggregateSessionsByAgent,
  deriveStatusFromAge,
  getOpenClawModels,
  getModelDisplayName,
} from '@/lib/parsers/openclaw-cli';
import { calculateTokenCost } from '@/lib/parsers/cost-calculator';
import { getConfig } from '@/lib/db/queries';
import type {
  ConstellationNode,
  ConstellationEdge,
  ConstellationGraph,
  ConstellationRole,
  ConstellationStatus,
} from '@/types/constellation';
import type { AgentData } from '@/types';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/graph
 *
 * Read-only endpoint that returns a normalized graph of agent nodes + edges
 * for the Constellation visualization. Reuses existing data pipelines
 * (parseAgentData, CLI sessions, cost calculator) — no writes to .openclaw.
 */
export async function GET() {
  try {
    const config = getConfig();
    const parsedAgents = parseAgentData(config.openclawDataDir);
    const modelsConfig = getOpenClawModels();

    // CLI sessions for live status + interaction edges
    let cliSessions: ReturnType<typeof getOpenClawSessions> = {
      path: null,
      stores: [],
      allAgents: true,
      count: 0,
      activeMinutes: null,
      sessions: [],
    };
    try {
      cliSessions = getOpenClawSessions();
    } catch {
      // CLI not available — will use parsed data only
    }
    const aggregated = aggregateSessionsByAgent(cliSessions.sessions);

    // Build agent map with live data merged
    const agentMap = new Map<string, AgentData>();
    for (const agent of parsedAgents) {
      agentMap.set(agent.id, { ...agent });
    }

    for (const [agentId, sessionData] of Array.from(aggregated.entries())) {
      const { latestSession, totalTokensIn, totalTokensOut } = sessionData;
      let found: AgentData | undefined;
      for (const [, agent] of Array.from(agentMap.entries())) {
        if (
          agent.id.toLowerCase() === agentId.toLowerCase() ||
          agent.sessionKey?.toLowerCase() === agentId.toLowerCase() ||
          agent.name.toLowerCase() === agentId.toLowerCase()
        ) {
          found = agent;
          break;
        }
      }
      if (found) {
        found.status = deriveStatusFromAge(latestSession.ageMs);
        found.tokensIn = totalTokensIn;
        found.tokensOut = totalTokensOut;
        found.model = latestSession.model;
        found.lastActiveAt = new Date(latestSession.updatedAt).toISOString();
      }
    }

    let agents = Array.from(agentMap.values());

    // Fallback: ensure we always have agents from config even if parsing failed
    if (agents.length === 0) {
      const fallbackAgents: AgentData[] = [
        { id: 'agent-main', name: 'Orchestrator', role: 'orchestrator', status: 'online', model: modelsConfig.defaultModel, tokensIn: 0, tokensOut: 0, costUSD: 0, contextWindowUsedPercent: 0, latencyMs: 0, errorCount: 0, lastActiveAt: new Date().toISOString(), uptime: 0, taskCompletedCount: 0, taskFailedCount: 0, recentTasks: [], parentId: null, sessionKey: 'main', lastError: null, driftScore: null, fallbacks: modelsConfig.fallbacks, provider: 'anthropic' },
        { id: 'agent-researcher', name: 'Researcher', role: 'sub-agent', status: 'online', model: modelsConfig.fallbacks[0] || modelsConfig.defaultModel, tokensIn: 0, tokensOut: 0, costUSD: 0, contextWindowUsedPercent: 0, latencyMs: 0, errorCount: 0, lastActiveAt: new Date().toISOString(), uptime: 0, taskCompletedCount: 0, taskFailedCount: 0, recentTasks: [], parentId: 'agent-main', sessionKey: 'researcher', lastError: null, driftScore: null, fallbacks: [], provider: 'google' },
        { id: 'agent-developer', name: 'Developer', role: 'sub-agent', status: 'online', model: modelsConfig.fallbacks[1] || modelsConfig.defaultModel, tokensIn: 0, tokensOut: 0, costUSD: 0, contextWindowUsedPercent: 0, latencyMs: 0, errorCount: 0, lastActiveAt: new Date().toISOString(), uptime: 0, taskCompletedCount: 0, taskFailedCount: 0, recentTasks: [], parentId: 'agent-main', sessionKey: 'developer', lastError: null, driftScore: null, fallbacks: [], provider: 'minimax' },
        { id: 'agent-qa-frontend', name: 'DS Parity QA', role: 'sub-agent', status: 'online', model: modelsConfig.fallbacks[2] || modelsConfig.defaultModel, tokensIn: 0, tokensOut: 0, costUSD: 0, contextWindowUsedPercent: 0, latencyMs: 0, errorCount: 0, lastActiveAt: new Date().toISOString(), uptime: 0, taskCompletedCount: 0, taskFailedCount: 0, recentTasks: [], parentId: 'agent-main', sessionKey: 'qa-frontend', lastError: null, driftScore: null, fallbacks: [], provider: 'anthropic' },
      ];
      agents = fallbackAgents;
    }

    // Compute costs
    for (const agent of agents) {
      const costs = calculateTokenCost(agent.tokensIn, agent.tokensOut, agent.model);
      agent.costUSD = costs.total;
    }

    // --- Build constellation nodes ---
    const nodes: ConstellationNode[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: mapRole(a),
      modelPrimary: getModelDisplayName(a.model),
      modelFallbacks:
        a.role === 'orchestrator'
          ? modelsConfig.fallbacks.map(getModelDisplayName)
          : undefined,
      status: mapStatus(a.status),
      lastSeenAt: a.lastActiveAt,
      tokensUsed24h: a.tokensIn + a.tokensOut,
      costUSD24h: a.costUSD,
      errorCount24h: a.errorCount,
      contextPercent: a.contextWindowUsedPercent,
      provider: a.provider,
      recentTaskCount: a.recentTasks?.length ?? a.taskCompletedCount,
      lastError: a.lastError,
    }));

    // --- Inject advisory board agents ---
    const ADVISORY_AGENTS: ConstellationNode[] = [
      { id: 'system-architect', name: 'System Architect', role: 'researcher', status: 'idle', modelPrimary: 'Gemini 3.1 Pro', provider: 'google' },
      { id: 'cost-optimizer', name: 'Cost Optimizer', role: 'researcher', status: 'idle', modelPrimary: 'Kimi K2.5', provider: 'other' },
      { id: 'gtm-strategist', name: 'GTM Strategist', role: 'designer', status: 'idle', modelPrimary: 'Claude Sonnet 4.5', provider: 'anthropic' },
    ];
    for (const advisory of ADVISORY_AGENTS) {
      if (!nodes.find((n) => n.id === advisory.id)) {
        nodes.push(advisory);
      }
    }

    // --- Build edges ---
    // Primary topology: orchestrator -> sub-agents via parentId
    const edges: ConstellationEdge[] = [];
    const orchestrator = agents.find((a) => a.role === 'orchestrator');

    for (const agent of agents) {
      if (agent.parentId) {
        edges.push({
          id: `edge-${agent.parentId}-${agent.id}`,
          from: agent.parentId,
          to: agent.id,
          type: 'delegation',
          lastEventAt: agent.lastActiveAt,
          ratePerMin: agent.status === 'online' ? 2 : agent.status === 'idle' ? 0.3 : 0,
          strength: agent.status === 'online' ? 0.9 : agent.status === 'idle' ? 0.4 : 0.1,
        });
      } else if (orchestrator && agent.id !== orchestrator.id) {
        // No explicit parent — infer connection to orchestrator
        edges.push({
          id: `edge-${orchestrator.id}-${agent.id}`,
          from: orchestrator.id,
          to: agent.id,
          type: 'delegation',
          lastEventAt: agent.lastActiveAt,
          ratePerMin: agent.status === 'online' ? 1 : 0.1,
          strength: agent.status === 'online' ? 0.6 : 0.2,
        });
      }
    }

    // Cross-agent edges from session requesterSession relationships
    for (const session of cliSessions.sessions) {
      if (session.kind === 'group' && orchestrator) {
        // Group sessions indicate orchestrator-mediated multi-agent work
        const agentNode = nodes.find(
          (n) =>
            n.id.toLowerCase().includes(session.agentId.toLowerCase()) ||
            n.name.toLowerCase() === session.agentId.toLowerCase(),
        );
        if (agentNode && agentNode.id !== orchestrator.id) {
          const edgeId = `edge-session-${orchestrator.id}-${agentNode.id}`;
          if (!edges.find((e) => e.id === edgeId)) {
            edges.push({
              id: edgeId,
              from: orchestrator.id,
              to: agentNode.id,
              type: 'message',
              lastEventAt: new Date(session.updatedAt).toISOString(),
              ratePerMin: 0.5,
              strength: 0.5,
            });
          }
        }
      }
    }

    // Single edge from orchestrator to advisory cluster (via first agent as gateway)
    if (orchestrator) {
      const gatewayId = ADVISORY_AGENTS[0].id;
      const edgeId = `edge-${orchestrator.id}-${gatewayId}`;
      if (!edges.find((e) => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          from: orchestrator.id,
          to: gatewayId,
          type: 'message',
          ratePerMin: 0.02,
          strength: 0.2,
        });
      }
    }

    // Inter-advisory edges (fully connected triangle)
    const advisoryIds = ADVISORY_AGENTS.map((n) => n.id);
    for (let i = 0; i < advisoryIds.length; i++) {
      for (let j = i + 1; j < advisoryIds.length; j++) {
        const edgeId = `edge-advisory-${advisoryIds[i]}-${advisoryIds[j]}`;
        if (!edges.find((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            from: advisoryIds[i],
            to: advisoryIds[j],
            type: 'message',
            ratePerMin: 0.01,
            strength: 0.3,
          });
        }
      }
    }

    const graph: ConstellationGraph = {
      nodes,
      edges,
      computedAt: new Date().toISOString(),
      isLive: cliSessions.sessions.length > 0,
    };

    return NextResponse.json(graph);
  } catch (error: unknown) {
    return NextResponse.json(
      { nodes: [], edges: [], computedAt: new Date().toISOString(), isLive: false, error: errorMessage(error) },
      { status: 500 },
    );
  }
}

function mapRole(agent: AgentData): ConstellationRole {
  if (agent.role === 'orchestrator') return 'orchestrator';
  const name = agent.name.toLowerCase();
  if (name.includes('dev') || name.includes('engineer') || name.includes('code')) return 'developer';
  if (name.includes('qa') || name.includes('test') || name.includes('quality')) return 'qa';
  if (name.includes('research') || name.includes('analyst')) return 'researcher';
  if (name.includes('design') || name.includes('ui') || name.includes('ux')) return 'designer';
  return 'other';
}

function mapStatus(status: AgentData['status']): ConstellationStatus {
  if (status === 'online') return 'active';
  return status;
}
