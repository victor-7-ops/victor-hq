import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'unknown';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'just now';
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function resolveHomePath(p: string): string {
  if (p.startsWith('~/')) {
    return p.replace('~', process.env.HOME || '/tmp');
  }
  return p;
}

/** Default OpenClaw data directory, overridable via OPENCLAW_HOME env var. */
export function getOpenclawHome(): string {
  return process.env.OPENCLAW_HOME || '~/.openclaw';
}

/** Default project repo path, overridable via PROJECT_REPO_PATH env var. */
export function getProjectRepoPath(): string | null {
  return process.env.PROJECT_REPO_PATH || null;
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'bg-red-500/20 text-red-400';
    case 'high':     return 'bg-orange-500/20 text-orange-400';
    case 'medium':   return 'bg-yellow-500/20 text-yellow-400';
    case 'low':      return 'bg-blue-500/20 text-blue-400';
    default:         return 'bg-gray-500/20 text-gray-400';
  }
}

export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
