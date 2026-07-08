import fs from 'fs';
import path from 'path';
import { resolveHomePath, safeJsonParse, getOpenclawHome } from '@/lib/utils';

// ============================================
// TTL + mtime Cache
// Caches parsed results for up to `ttlMs`.  The key includes the
// file path and its mtime so the cache auto-invalidates when the
// underlying file changes on disk.
// ============================================

const fileCache = new Map<string, { data: unknown; expires: number; mtimeMs: number }>();

export function cachedByFile<T>(filePath: string, ttlMs: number, fn: () => T): T {
  const now = Date.now();
  let currentMtime = 0;
  try {
    currentMtime = fs.statSync(filePath).mtimeMs;
  } catch {
    // File may not exist — just run fn() uncached
    return fn();
  }

  const entry = fileCache.get(filePath);
  if (entry && entry.expires > now && entry.mtimeMs === currentMtime) {
    return entry.data as T;
  }
  const data = fn();
  fileCache.set(filePath, { data, expires: now + ttlMs, mtimeMs: currentMtime });
  return data;
}

/**
 * Cache for directory-level results (e.g. parseAgentData which scans
 * multiple files).  Uses a composite key and the mtime of the
 * directory itself (updated when files are added/removed).
 */
const dirCache = new Map<string, { data: unknown; expires: number; mtimeMs: number }>();

export function cachedByDir<T>(dirPath: string, ttlMs: number, fn: () => T): T {
  const now = Date.now();
  let currentMtime = 0;
  try {
    currentMtime = fs.statSync(dirPath).mtimeMs;
  } catch {
    return fn();
  }

  const entry = dirCache.get(dirPath);
  if (entry && entry.expires > now && entry.mtimeMs === currentMtime) {
    return entry.data as T;
  }
  const data = fn();
  dirCache.set(dirPath, { data, expires: now + ttlMs, mtimeMs: currentMtime });
  return data;
}

export function getDataDir(configDir?: string): string {
  return resolveHomePath(configDir || getOpenclawHome());
}

export function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function readJsonIfExists<T>(filePath: string, fallback: T): T {
  const content = readFileIfExists(filePath);
  if (!content) return fallback;
  return safeJsonParse(content, fallback);
}

export { fs, path };
