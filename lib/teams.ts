import type { Agent } from "@/lib/types"

export interface Team {
  manager: Agent
  members: Agent[]
}

export function buildTeams(agents: Agent[]): { root: Agent | null; teams: Team[]; soloOps: Agent[] } {
  const roots = agents.filter((a) => a.reportsTo === null)
  if (roots.length === 0) return { root: null, teams: [], soloOps: [] }

  // Pick the root: prefer one with directReports, otherwise first
  const root = roots.find(r => r.directReports.length > 0) ?? roots[0]

  const byId = new Map(agents.map((a) => [a.id, a]))
  const accounted = new Set<string>([root.id])
  const teamManagers: Agent[] = []
  const soloOps: Agent[] = []

  // Process root's direct reports
  for (const rid of root.directReports) {
    const r = byId.get(rid)
    if (!r) continue
    accounted.add(rid)
    if (r.directReports.length > 0) {
      teamManagers.push(r)
    } else {
      soloOps.push(r)
    }
  }

  // Handle agents not in root's directReports (flat hierarchy / multi-workspace)
  for (const agent of agents) {
    if (accounted.has(agent.id)) continue
    if (agent.reportsTo === null || !byId.has(agent.reportsTo)) {
      // Another root or orphan -- treat as soloOp
      soloOps.push(agent)
      accounted.add(agent.id)
    } else if (agent.reportsTo === root.id) {
      // Direct report of root not listed in directReports array
      accounted.add(agent.id)
      if (agent.directReports.length > 0) {
        teamManagers.push(agent)
      } else {
        soloOps.push(agent)
      }
    }
  }

  const teams: Team[] = teamManagers.map((mgr) => {
    const members: Agent[] = []
    const visited = new Set<string>([mgr.id])
    const queue = [...mgr.directReports]
    while (queue.length > 0) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      const a = byId.get(id)
      if (a) {
        members.push(a)
        queue.push(...a.directReports)
      }
    }
    return { manager: mgr, members }
  })

  return { root, teams, soloOps }
}
