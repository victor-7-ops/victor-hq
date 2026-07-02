'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * usePulseStream — connects to the SSE pulse-stream endpoint and
 * invalidates React Query caches in real-time when OpenClaw data changes.
 *
 * Returns metadata about stream connectivity and last-updated times
 * per data source for "Last updated" / "Source: OpenClaw" indicators.
 */

export interface PulseStreamState {
  /** Whether the SSE connection is open */
  connected: boolean;
  /** Last event timestamp per source category */
  lastUpdated: Record<string, string>;
  /** Total events received since connection */
  eventCount: number;
  /** Source label for all data */
  source: string;
}

// Query keys matching our React Query setup
const QUERY_KEY_MAP: Record<string, string[][]> = {
  agent_update: [['agents'], ['cost']],
  gateway_update: [['gateway']],
  security_update: [['security']],
  cost_update: [['cost']],
  cron_update: [['identity']],
};

export function usePulseStream(): PulseStreamState {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Record<string, string>>({});
  const [eventCount, setEventCount] = useState(0);

  // Batched invalidation — flushes after 200ms of no new events
  const scheduleInvalidation = useCallback(
    (keys: string[][]) => {
      for (const key of keys) {
        pendingKeysRef.current.add(key[0]);
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const pending = pendingKeysRef.current;
        pendingKeysRef.current = new Set();
        for (const key of pending) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }, 200);
    },
    [queryClient],
  );

  const handleEvent = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const { type, timestamp, costChanged, changed } = data;

        if (type === 'connected') {
          setConnected(true);
          return;
        }

        if (type === 'heartbeat') {
          if (changed) {
            scheduleInvalidation([['cost'], ['agents']]);
          }
          setLastUpdated((prev) => ({ ...prev, heartbeat: timestamp }));
          return;
        }

        // Update last-updated timestamp for this event type
        setLastUpdated((prev) => ({ ...prev, [type]: timestamp }));
        setEventCount((c) => c + 1);

        // Invalidate relevant React Query caches (batched)
        const queryKeys = QUERY_KEY_MAP[type];
        if (queryKeys) {
          const filtered = queryKeys.filter((key) => {
            if (type === 'agent_update' && key[0] === 'cost' && !costChanged) return false;
            return true;
          });
          if (filtered.length > 0) scheduleInvalidation(filtered);
        }
      } catch {
        // Malformed event — skip
      }
    },
    [scheduleInvalidation],
  );

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/pulse-stream');

    es.onmessage = handleEvent;

    es.onopen = () => {
      setConnected(true);
      // Clear any pending reconnect
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconnect after 5s
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };

    eventSourceRef.current = es;
  }, [handleEvent]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [connect]);

  return {
    connected,
    lastUpdated,
    eventCount,
    source: 'OpenClaw',
  };
}
