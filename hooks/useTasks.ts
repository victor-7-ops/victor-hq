'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DevTask, Sprint } from '@/types';

export function useTasks() {
  return useQuery<{ tasks: DevTask[] }>({
    queryKey: ['tasks'],
    queryFn: () => fetch('/api/tasks').then(r => r.json()),
    refetchInterval: 30000,
  });
}

export function useSprints() {
  return useQuery<{ sprints: Sprint[] }>({
    queryKey: ['sprints'],
    queryFn: () => fetch('/api/sprints').then(r => r.json()),
    refetchInterval: 30000,
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<DevTask> & { id: string }) =>
      fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
