'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DSRunReport, DSSummary } from '@/types';

interface DSReportsResponse {
  reports: DSRunReport[];
}

interface DSSummaryResponse extends DSSummary {
  availableComponents: string[];
  availableBatches: string[];
}

export function useDSReports(filters?: {
  component?: string; batch?: string; status?: string;
  phase?: string; runId?: string; limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.component) params.set('component', filters.component);
  if (filters?.batch) params.set('batch', filters.batch);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.phase) params.set('phase', filters.phase);
  if (filters?.runId) params.set('runId', filters.runId);
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();

  return useQuery<DSReportsResponse>({
    queryKey: ['ds-reports', filters],
    queryFn: () => fetch(`/api/ds/run-reports${qs ? `?${qs}` : ''}`).then((r) => r.json()),
    refetchInterval: 60_000,
  });
}

export function useDSSummary() {
  return useQuery<DSSummaryResponse>({
    queryKey: ['ds-summary'],
    queryFn: () => fetch('/api/ds/summary').then((r) => r.json()),
    refetchInterval: 60_000,
  });
}

export function useDSSeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetch('/api/ds/seed', { method: 'POST' }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ds-reports'] });
      queryClient.invalidateQueries({ queryKey: ['ds-summary'] });
    },
  });
}
