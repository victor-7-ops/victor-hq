import { Agent } from '@/lib/types'
import { readFileSync, existsSync } from 'fs'
import { loadRegistry } from '@/lib/agents-registry'
import { getCrons } from '@/lib/crons'

export async function getAgents(): Promise<Agent[]> {
  const workspacePath = process.env.WORKSPACE_PATH || ''
  const registry = loadRegistry()

  // Fetch crons and group by agentId so agents include their scheduled tasks
  let cronsByAgent: Map<string, Awaited<ReturnType<typeof getCrons>>> = new Map()
  try {
    const allCrons = await getCrons()
    for (const cron of allCrons) {
      if (cron.agentId) {
        const list = cronsByAgent.get(cron.agentId) ?? []
        list.push(cron)
        cronsByAgent.set(cron.agentId, list)
      }
    }
  } catch {
    // Cron fetch failure shouldn't break agent loading
  }

  return registry.map((entry) => {
    let soul: string | null = null
    if (entry.soulPath && workspacePath) {
      try {
        const fullPath = workspacePath + '/' + entry.soulPath
        if (existsSync(fullPath)) {
          soul = readFileSync(fullPath, 'utf-8')
        }
      } catch {
        soul = null
      }
    }
    return {
      ...entry,
      soul,
      crons: cronsByAgent.get(entry.id) ?? [],
    }
  })
}

export async function getAgent(id: string): Promise<Agent | null> {
  const agents = await getAgents()
  return agents.find((a) => a.id === id) ?? null
}
