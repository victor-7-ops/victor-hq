'use client';
import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useAgentStream() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingKeysRef = useRef<Set<string>>(new Set());

  const invalidateOnUpdate = useCallback((eventType: string) => {
    // Collect keys to invalidate
    switch (eventType) {
      case 'agent_update':
      case 'log_update':
        pendingKeysRef.current.add('agents');
        break;
      case 'config_update':
        pendingKeysRef.current.add('gateway');
        pendingKeysRef.current.add('identity');
        break;
      case 'cron_update':
      case 'delivery_update':
        pendingKeysRef.current.add('security');
        break;
      default:
        pendingKeysRef.current.add('agents');
    }

    // Debounce: flush after 200ms of no new events
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const keys = pendingKeysRef.current;
      pendingKeysRef.current = new Set();
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    }, 200);
  }, [queryClient]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      eventSource = new EventSource('/api/stream');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== 'heartbeat') {
            invalidateOnUpdate(data.type);
          }
        } catch {
          // Skip malformed events
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimer);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [invalidateOnUpdate]);
}
