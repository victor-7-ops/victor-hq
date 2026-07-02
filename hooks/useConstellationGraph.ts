'use client';
import { useQuery } from '@tanstack/react-query';
import type { ConstellationGraph } from '@/types/constellation';

const FALLBACK_GRAPH: ConstellationGraph = {
  nodes: [
    { id: 'orchestrator', name: 'Orchestrator', role: 'orchestrator', status: 'idle', modelPrimary: 'Claude Sonnet 4.6', provider: 'anthropic', tokensUsed24h: 0, costUSD24h: 0, errorCount24h: 0 },
    { id: 'dev-1', name: 'Developer', role: 'developer', status: 'offline', modelPrimary: 'Claude Sonnet 4.6', provider: 'anthropic' },
    { id: 'qa-1', name: 'QA Frontend', role: 'qa', status: 'offline', modelPrimary: 'Claude Haiku', provider: 'anthropic' },
    { id: 'researcher-1', name: 'Researcher', role: 'researcher', status: 'offline', modelPrimary: 'Gemini Pro', provider: 'google' },
    { id: 'bulk-task', name: 'Bulk Task', role: 'developer', status: 'offline', modelPrimary: 'Claude Sonnet 4.6', provider: 'anthropic' },
    { id: 'system-architect', name: 'System Architect', role: 'researcher', status: 'idle', modelPrimary: 'Gemini 3.1 Pro', provider: 'google' },
    { id: 'cost-optimizer', name: 'Cost Optimizer', role: 'researcher', status: 'idle', modelPrimary: 'Kimi K2.5', provider: 'other' },
    { id: 'gtm-strategist', name: 'GTM Strategist', role: 'designer', status: 'idle', modelPrimary: 'Claude Sonnet 4.5', provider: 'anthropic' },
  ],
  edges: [
    { id: 'e1', from: 'orchestrator', to: 'dev-1', type: 'delegation', strength: 0.3, ratePerMin: 0.1 },
    { id: 'e2', from: 'orchestrator', to: 'qa-1', type: 'delegation', strength: 0.2, ratePerMin: 0.05 },
    { id: 'e3', from: 'orchestrator', to: 'researcher-1', type: 'delegation', strength: 0.2, ratePerMin: 0.05 },
    { id: 'e4', from: 'orchestrator', to: 'bulk-task', type: 'delegation', strength: 0.2, ratePerMin: 0.05 },
    { id: 'e5', from: 'orchestrator', to: 'system-architect', type: 'message', strength: 0.2, ratePerMin: 0.02 },
    { id: 'e-sa-1', from: 'system-architect', to: 'cost-optimizer', type: 'message', strength: 0.3, ratePerMin: 0.01 },
    { id: 'e-co-1', from: 'cost-optimizer', to: 'gtm-strategist', type: 'message', strength: 0.3, ratePerMin: 0.01 },
    { id: 'e-gs-1', from: 'gtm-strategist', to: 'system-architect', type: 'message', strength: 0.3, ratePerMin: 0.01 },
  ],
  computedAt: new Date().toISOString(),
  isLive: false,
};

export function useConstellationGraph() {
  return useQuery<ConstellationGraph>({
    queryKey: ['constellation-graph'],
    queryFn: async () => {
      const res = await fetch('/api/agents/graph');
      if (!res.ok) return FALLBACK_GRAPH;
      const data = await res.json();
      // If no nodes returned, use fallback
      if (!data.nodes || data.nodes.length === 0) {
        return { ...FALLBACK_GRAPH, isLive: false };
      }
      return data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: FALLBACK_GRAPH,
  });
}
