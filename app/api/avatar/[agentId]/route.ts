import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { requireEnv } from '@/lib/env'
import { parseIdentity } from '@/lib/agents-registry'
import { listCliAgents } from '@/lib/agents-registry'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

/**
 * GET /api/avatar/[agentId]
 *
 * Serves avatar images from agent workspaces.
 * Reads IDENTITY.md to find the Avatar filename, then serves the file.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params

  const workspacePath = requireEnv('WORKSPACE_PATH')
  const openclawRoot = resolve(workspacePath, '..')

  // Find the agent's workspace
  let agentWorkspace: string | null = null

  // Check if this is the root agent
  const identityContent = safeRead(join(workspacePath, 'IDENTITY.md'))
  if (identityContent) {
    const identity = parseIdentity(identityContent)
    const rootId = identity.name
      ? identity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'main'
      : 'main'
    if (rootId === agentId) {
      agentWorkspace = workspacePath
    }
  }

  // Check CLI agents
  if (!agentWorkspace) {
    const openclawBin = process.env.OPENCLAW_BIN
    if (openclawBin) {
      const cliAgents = listCliAgents(openclawBin)
      if (cliAgents) {
        const match = cliAgents.find(a => a.id === agentId)
        if (match?.workspace && existsSync(match.workspace)) {
          agentWorkspace = match.workspace
        }
      }
    }
  }

  // Direct path fallback
  if (!agentWorkspace) {
    const direct = join(openclawRoot, 'agents', agentId, 'workspace')
    if (existsSync(direct)) agentWorkspace = direct
  }

  if (!agentWorkspace) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  // Read IDENTITY.md to get avatar filename
  const wsIdentity = safeRead(join(agentWorkspace, 'IDENTITY.md'))
  if (!wsIdentity) {
    return NextResponse.json({ error: 'No identity file' }, { status: 404 })
  }

  const parsed = parseIdentity(wsIdentity)
  if (!parsed.avatar) {
    return NextResponse.json({ error: 'No avatar configured' }, { status: 404 })
  }

  const avatarPath = join(agentWorkspace, parsed.avatar)
  if (!existsSync(avatarPath)) {
    return NextResponse.json({ error: 'Avatar file not found' }, { status: 404 })
  }

  // Security: ensure the resolved path is within the workspace
  const resolved = resolve(avatarPath)
  if (!resolved.startsWith(resolve(agentWorkspace))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 403 })
  }

  const ext = parsed.avatar.substring(parsed.avatar.lastIndexOf('.')).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  const imageData = readFileSync(avatarPath)

  return new NextResponse(imageData, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=300',
    },
  })
}

function safeRead(path: string): string | null {
  try {
    if (!existsSync(path)) return null
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}
