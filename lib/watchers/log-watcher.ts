/**
 * File Watcher + SSE Emitter
 * ==========================
 * Monitors the OpenClaw data directory for file changes using chokidar.
 * Emits Server-Sent Events to connected clients.
 */

import { watch, type FSWatcher } from 'chokidar';
import { resolveHomePath, getOpenclawHome } from '@/lib/utils';
import { EventEmitter } from 'events';

// Global event emitter for SSE
export const logEvents = new EventEmitter();
logEvents.setMaxListeners(50);

let watcher: FSWatcher | null = null;

export function startWatcher(dataDir: string = getOpenclawHome()) {
  if (watcher) return; // Already watching

  const resolvedDir = resolveHomePath(dataDir);

  watcher = watch(resolvedDir, {
    persistent: true,
    ignoreInitial: true,
    depth: 4,
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/browser/**',        // Chrome profile is huge, skip
      '**/extensions/**',     // Extension files don't change often
      '**/*.sqlite',          // Binary files
      '**/*.db',
    ],
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher.on('change', (filePath: string) => {
    const relativePath = filePath.replace(resolvedDir, '');
    const eventType = categorizeChange(relativePath);

    logEvents.emit('update', {
      type: eventType,
      file: relativePath,
      timestamp: new Date().toISOString(),
    });
  });

  watcher.on('add', (filePath: string) => {
    const relativePath = filePath.replace(resolvedDir, '');
    logEvents.emit('update', {
      type: 'file_added',
      file: relativePath,
      timestamp: new Date().toISOString(),
    });
  });

  watcher.on('error', (error: unknown) => {
    console.error('[LogWatcher] Error:', error instanceof Error ? error.message : error);
  });

  console.log(`[LogWatcher] Watching ${resolvedDir}`);
}

export function stopWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

function categorizeChange(filePath: string): string {
  if (filePath.includes('/logs/')) return 'log_update';
  if (filePath.includes('/sessions/')) return 'agent_update';
  if (filePath.includes('/cron/')) return 'cron_update';
  if (filePath.includes('/delivery-queue/')) return 'delivery_update';
  if (filePath.includes('/devices/')) return 'device_update';
  if (filePath.includes('openclaw.json')) return 'config_update';
  if (filePath.includes('/sandbox/')) return 'sandbox_update';
  return 'file_change';
}
