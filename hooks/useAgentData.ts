'use client';
import { useQuery } from '@tanstack/react-query';
import type { AgentData, GatewayStatus } from '@/types';

export function useAgents() {
  return useQuery<{ agents: AgentData[] }>({
    queryKey: ['agents'],
    queryFn: () => fetch('/api/agents').then(r => r.json()),
    refetchInterval: 30_000,
  });
}

export function useGateway() {
  return useQuery<GatewayStatus>({
    queryKey: ['gateway'],
    queryFn: () => fetch('/api/gateway').then(r => r.json()),
    refetchInterval: 30_000,
  });
}

export function useProviders() {
  return useQuery<{
    providers: Record<string, {
      models: string[];
      status: 'ok' | 'auth' | 'error';
      avgLatencyMs: number | null;
      errors: string[];
    }>;
    probeTime: number;
    totalProbed: number;
  }>({
    queryKey: ['providers'],
    queryFn: () => fetch('/api/providers').then(r => r.json()),
    refetchInterval: 60000, // Refresh every 60 seconds
  });
}
