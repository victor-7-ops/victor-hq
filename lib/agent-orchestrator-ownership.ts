import type { AOProject, AOSession } from './agent-orchestrator'
import { COLUMNS, STATUS_TO_COLUMN, type Column } from './agent-orchestrator-columns'
import type { Agent } from './types'

export interface AgentRollup {
  total: number
  byColumn: Record<Column, number>
  sessions: AOSession[]
}

function emptyRollup(): AgentRollup {
  return {
    total: 0,
    byColumn: { working: 0, needs_you: 0, in_review: 0, ready_to_merge: 0 },
    sessions: [],
  }
}

/** Group sessions by the fleet agent that owns their project (via projectId -> agentId map). */
export function rollupSessionsByAgent(
  sessions: AOSession[],
  projects: AOProject[],
  owners: Map<string, string>
): Map<string, AgentRollup> {
  const result = new Map<string, AgentRollup>()
  const projectIds = new Set(projects.map(p => p.id))

  for (const session of sessions) {
    if (!projectIds.has(session.projectId)) continue
    const agentId = owners.get(session.projectId)
    if (!agentId) continue

    const col = STATUS_TO_COLUMN[session.status]
    if (!col) continue

    let rollup = result.get(agentId)
    if (!rollup) {
      rollup = emptyRollup()
      result.set(agentId, rollup)
    }
    rollup.total += 1
    rollup.byColumn[col] += 1
    rollup.sessions.push(session)
  }

  return result
}

/** Sum an agent's own rollup plus every descendant's, walking directReports (same BFS shape as lib/teams.ts::buildTeams). */
export function rollupForHierarchy(
  agentId: string,
  agents: Agent[],
  perAgentRollup: Map<string, AgentRollup>
): AgentRollup {
  const byId = new Map(agents.map(a => [a.id, a]))
  const visited = new Set<string>([agentId])
  const queue = [agentId]
  const combined = emptyRollup()

  while (queue.length > 0) {
    const id = queue.shift()!
    const own = perAgentRollup.get(id)
    if (own) {
      combined.total += own.total
      for (const col of COLUMNS) combined.byColumn[col] += own.byColumn[col]
      combined.sessions.push(...own.sessions)
    }
    const agent = byId.get(id)
    if (!agent) continue
    for (const childId of agent.directReports) {
      if (visited.has(childId)) continue
      visited.add(childId)
      queue.push(childId)
    }
  }

  return combined
}
