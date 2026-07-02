'use client';
import { useQuery } from '@tanstack/react-query';
import type { TokenUsageData } from '@/lib/parsers/token-usage';

export function useTokenUsage() {
  return useQuery<TokenUsageData>({
    queryKey: ['token-usage'],
    queryFn: () => fetch('/api/token-usage').then(r => r.json()),
    refetchInterval: 60_000,
  });
}
