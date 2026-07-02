/**
 * Pulse Stream — SSE endpoint for System Pulse live updates.
 *
 * Streams typed events to the client when OpenClaw data changes:
 *   - cost_update:     Session file changed → includes today's spend snapshot
 *   - agent_update:    Session file changed → client should refetch agents
 *   - gateway_update:  Gateway log changed → client should refetch gateway
 *   - security_update: Config/device file changed → client should refetch security
 *   - heartbeat:       Keepalive every 15s with current data hash
 *
 * READ-ONLY: This module NEVER writes to .openclaw.
 */

import { NextResponse } from 'next/server';
import { logEvents, startWatcher } from '@/lib/watchers/log-watcher';
import { getConfig } from '@/lib/db/queries';
import { getSessionFileHash } from '@/lib/parsers/session-cost';

export const dynamic = 'force-dynamic';

// Map watcher categories to pulse event types
function toPulseEventType(watcherType: string): string | null {
  switch (watcherType) {
    case 'agent_update':
      return 'agent_update';
    case 'log_update':
      return 'gateway_update';
    case 'config_update':
    case 'device_update':
      return 'security_update';
    case 'cron_update':
      return 'cron_update';
    default:
      return null;
  }
}

// Debounce per event type to avoid flooding the client
const lastEmitted: Record<string, number> = {};
const DEBOUNCE_MS = 2000; // Min 2s between events of same type

export async function GET() {
  // Start the file watcher using the user's configured data directory
  const config = getConfig();
  startWatcher(config.openclawDataDir);

  let lastHash = getSessionFileHash();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event with current hash
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'connected',
              hash: lastHash,
              timestamp: new Date().toISOString(),
            })}\n\n`,
          ),
        );
      } catch {
        // Stream already closed
      }

      const onUpdate = (data: {
        type: string;
        file: string;
        timestamp: string;
      }) => {
        const pulseType = toPulseEventType(data.type);
        if (!pulseType) return;

        // Debounce
        const now = Date.now();
        if (lastEmitted[pulseType] && now - lastEmitted[pulseType] < DEBOUNCE_MS) {
          return;
        }
        lastEmitted[pulseType] = now;

        // Check if session files have actually changed (for cost events)
        let costChanged = false;
        if (pulseType === 'agent_update') {
          const newHash = getSessionFileHash();
          costChanged = newHash !== lastHash;
          lastHash = newHash;
        }

        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: pulseType,
                file: data.file,
                costChanged,
                timestamp: data.timestamp,
              })}\n\n`,
            ),
          );
        } catch {
          cleanup();
        }
      };

      logEvents.on('update', onUpdate);

      // Heartbeat every 15s with current hash
      const heartbeat = setInterval(() => {
        try {
          const newHash = getSessionFileHash();
          const changed = newHash !== lastHash;
          if (changed) lastHash = newHash;

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'heartbeat',
                hash: newHash,
                changed,
                timestamp: new Date().toISOString(),
              })}\n\n`,
            ),
          );
        } catch {
          cleanup();
        }
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        logEvents.removeListener('update', onUpdate);
      };

      // Keep stream reference alive
      controller.enqueue(encoder.encode(''));
      return () => cleanup();
    },
    cancel() {
      // ReadableStream cancel — cleanup handled above
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
