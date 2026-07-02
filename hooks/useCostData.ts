'use client';
import { useQuery } from '@tanstack/react-query';
import type { CostData } from '@/types';

export function useCostData(range?: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (range) params.set('range', range);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();

  return useQuery<CostData & { avg7d: number; totalTokens: number; granularity?: string; range?: string; hourlyHistory?: { hour: string; cost: number; tokens: number }[] }>({
    queryKey: ['cost', range || '30d', from, to],
    queryFn: () => fetch(`/api/cost${qs ? '?' + qs : ''}`).then(r => r.json()),
    refetchInterval: 60_000,
  });
}
