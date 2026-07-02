'use client';

import { useQuery } from '@tanstack/react-query';

export interface SystemMetrics {
  ok: boolean;
  cpu: { percent: number; cores: number };
  ram: { usedBytes: number; totalBytes: number; percent: number };
  swap: { usedBytes: number; totalBytes: number; percent: number };
  disk: { path: string; usedBytes: number; totalBytes: number; percent: number };
  versions: {
    openclaw: string;
    gateway: { status: string; pid: number | null; uptime: string; memory: string };
  };
  collectedAt: string;
}

export function useSystemMetrics() {
  return useQuery<SystemMetrics>({
    queryKey: ['system-metrics'],
    queryFn: () => fetch('/api/system').then((r) => r.json()),
    refetchInterval: 10_000,
  });
}
