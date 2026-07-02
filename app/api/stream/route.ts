import { NextResponse } from 'next/server';
import { logEvents, startWatcher } from '@/lib/watchers/log-watcher';
import { getConfig } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Start the file watcher using the user's configured data directory
  const config = getConfig();
  startWatcher(config.openclawDataDir);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const onUpdate = (data: any) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream closed
          cleanup();
        }
      };

      logEvents.on('update', onUpdate);

      // Send heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`)
          );
        } catch {
          cleanup();
        }
      }, 30000);

      const cleanup = () => {
        clearInterval(heartbeat);
        logEvents.removeListener('update', onUpdate);
      };

      // Wire cleanup to stream cancellation
      controller.enqueue(encoder.encode('')); // no-op to keep reference
      return () => cleanup();
    },
    cancel() {
      // ReadableStream cancel callback — handled by cleanup above
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
