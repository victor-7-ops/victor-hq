import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { getAOCache, setAOCache } from '@/lib/db/queries'

export type AOSessionStatus =
  | 'working' | 'pr_open' | 'draft' | 'ci_failed' | 'review_pending'
  | 'changes_requested' | 'approved' | 'mergeable' | 'merged'
  | 'needs_input' | 'idle' | 'terminated' | 'no_signal'

export interface AOSession {
  id: string
  projectId: string
  issueId?: string
  kind: 'worker' | 'orchestrator'
  harness: string
  activity: { state: 'active' | 'idle' | 'waiting_input' | 'exited'; lastActivityAt: string }
  isTerminated: boolean
  status: AOSessionStatus
  branch?: string
  previewUrl?: string
}

export interface AOProject {
  id: string
  path: string
  name: string
  kind: string
  sessionPrefix: string
}

const cache = new Map<string, { data: unknown; expires: number }>()
const TTL_MS = 8_000

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const entry = cache.get(key)
  if (entry && entry.expires > now) return Promise.resolve(entry.data as T)
  return fn().then(data => {
    cache.set(key, { data, expires: now + TTL_MS })
    return data
  })
}

/** Discover the Agent Orchestrator daemon's base URL via ~/.ao/running.json, falling back to the default port. */
export function getAOBaseUrl(): string {
  try {
    const raw = readFileSync(join(homedir(), '.ao', 'running.json'), 'utf-8')
    const { port } = JSON.parse(raw) as { port: number }
    if (port) return `http://127.0.0.1:${port}`
  } catch {
    // running.json missing or unreadable -- fall through to default
  }
  return 'http://127.0.0.1:3001'
}

async function aoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getAOBaseUrl()}/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`Agent Orchestrator API ${path} failed: ${res.status} ${body}`)
  }
  return (body ? JSON.parse(body) : undefined) as T
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Keep only array entries that carry the fields the dashboard actually renders. */
function validSessions(items: unknown): AOSession[] {
  if (!Array.isArray(items)) return []
  return items.filter(
    (s): s is AOSession =>
      isRecord(s) && typeof s.id === 'string' && typeof s.status === 'string' && typeof s.projectId === 'string'
  )
}

function validProjects(items: unknown): AOProject[] {
  if (!Array.isArray(items)) return []
  return items.filter(
    (p): p is AOProject => isRecord(p) && typeof p.id === 'string' && typeof p.name === 'string'
  )
}

export interface AOListResult<T> {
  items: T[]
  stale: boolean
  cachedAt: string | null
}

/** Fetch live data via `fn`, caching it in SQLite on success. On failure, fall back
 *  to the last-known cached data (marked stale) instead of throwing -- list endpoints
 *  only; mutations still propagate errors. */
async function withOfflineFallback<T>(
  cacheKey: string,
  fn: () => Promise<T[]>,
): Promise<AOListResult<T>> {
  try {
    const items = await fn()
    setAOCache(cacheKey, items)
    return { items, stale: false, cachedAt: null }
  } catch (err) {
    const cached = getAOCache<T[]>(cacheKey)
    if (cached) {
      return { items: cached.data, stale: true, cachedAt: cached.cachedAt }
    }
    throw err
  }
}

export function listProjects(): Promise<AOListResult<AOProject>> {
  return withOfflineFallback('projects', () =>
    cached('projects', async () => {
      const data = await aoFetch<{ projects: unknown }>('/projects')
      return validProjects(data.projects)
    }),
  )
}

export function listSessions(): Promise<AOListResult<AOSession>> {
  return withOfflineFallback('sessions', () =>
    cached('sessions', async () => {
      const data = await aoFetch<{ sessions: unknown }>('/sessions')
      return validSessions(data.sessions)
    }),
  )
}

export function registerProject(path: string, name?: string): Promise<AOProject> {
  return aoFetch<AOProject>('/projects', {
    method: 'POST',
    body: JSON.stringify({ path, name }),
  }).finally(() => cache.delete('projects'))
}

/** Set the default coding harness for a project so sessions don't need one specified per-spawn. */
export function setProjectHarness(projectId: string, harness: string): Promise<void> {
  return aoFetch<void>(`/projects/${encodeURIComponent(projectId)}/config`, {
    method: 'PUT',
    body: JSON.stringify({ config: { worker: { agent: harness } } }),
  }).finally(() => cache.delete('projects'))
}

export interface SpawnSessionInput {
  projectId: string
  prompt?: string
  issueId?: string
  branch?: string
  displayName?: string
}

export function spawnSession(input: SpawnSessionInput): Promise<AOSession> {
  return aoFetch<AOSession>('/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  }).finally(() => cache.delete('sessions'))
}

export function sendToSession(sessionId: string, message: string): Promise<void> {
  return aoFetch<void>(`/sessions/${encodeURIComponent(sessionId)}/send`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export function killSession(sessionId: string): Promise<void> {
  return aoFetch<void>(`/sessions/${encodeURIComponent(sessionId)}/kill`, { method: 'POST' })
}
