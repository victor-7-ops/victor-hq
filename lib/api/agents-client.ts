import type { Agent } from '@/lib/types'

/** Raw shape returned by GET /api/agents before normalization. */
interface RawAgent {
  id: string
  reportsTo?: string | null
  directReports?: string[]
  parentId?: string | null
  [key: string]: unknown
}

/**
 * /api/agents returns { agents: [...] } with parentId-shaped items (no
 * reportsTo/directReports). Consumers that render an org chart need those
 * fields, so synthesize them from parentId when absent. Cycle-safe: only
 * ever derives directReports by scanning for children, never walks parent
 * chains, so a cyclic parentId graph can't cause infinite recursion.
 */
export function normalizeAgents(raw: RawAgent[]): Agent[] {
  return raw.map((ag) => ({
    ...ag,
    reportsTo: ag.reportsTo ?? ag.parentId ?? null,
    directReports:
      ag.directReports ??
      raw
        .filter((c) => (c.reportsTo ?? c.parentId) === ag.id)
        .map((c) => c.id),
  })) as Agent[]
}

/** Fetch and unwrap GET /api/agents into a normalized Agent[] — the single
 *  source of truth for every consumer (chat, kanban, memory, nav, search,
 *  settings, onboarding, home map, costs page, etc.). */
export async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch('/api/agents')
  if (!res.ok) throw new Error('Failed to fetch agents')
  const data: unknown = await res.json()
  const raw: RawAgent[] = Array.isArray(data)
    ? (data as RawAgent[])
    : ((data as { agents?: RawAgent[] })?.agents ?? [])
  return normalizeAgents(raw)
}
