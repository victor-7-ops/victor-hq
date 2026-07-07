import { listProjects, listSessions, registerProject } from '@/lib/agent-orchestrator'
import { getAllProjectOwners, setProjectOwner } from '@/lib/db/queries'
import { apiErrorResponse } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const [projectsResult, sessionsResult] = await Promise.all([listProjects(), listSessions()])
    const owners = getAllProjectOwners().reduce<Record<string, string>>((acc, o) => {
      acc[o.projectId] = o.agentId
      return acc
    }, {})
    const stale = projectsResult.stale || sessionsResult.stale
    return NextResponse.json({
      projects: projectsResult.items,
      sessions: sessionsResult.items,
      owners,
      _meta: {
        stale,
        cachedAt: projectsResult.cachedAt || sessionsResult.cachedAt || null,
      },
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load Agent Orchestrator state')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const path = typeof body?.path === 'string' ? body.path.trim() : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined
    const ownerAgentId = typeof body?.ownerAgentId === 'string' ? body.ownerAgentId.trim() : undefined
    if (!path || /[\x00-\x1f]/.test(path)) {
      return apiErrorResponse(new Error('path must be a non-empty string without control characters'), 'Invalid project path', 400)
    }
    const project = await registerProject(path, name || undefined)
    if (ownerAgentId) setProjectOwner(project.id, ownerAgentId)
    return NextResponse.json(project)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to register project')
  }
}
