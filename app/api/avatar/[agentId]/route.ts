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

const FALLBACK_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#22c55e', '#ef4444', '#0ea5e9']

/** Generate a deterministic initials-avatar SVG for agents with no avatar file. */
function fallbackAvatarSvg(agentId: string): NextResponse {
  const initials = agentId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?'

  let hash = 0
  for (let i = 0; i < agentId.length; i++) hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0
  const color = FALLBACK_COLORS[hash % FALLBACK_COLORS.length]

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" rx="24" fill="${color}"/>
    <text x="64" y="64" font-family="system-ui, sans-serif" font-size="52" font-weight="600" fill="#fff" text-anchor="middle" dominant-baseline="central">${initials}</text>
  </svg>`

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
    },
  })
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
    return fallbackAvatarSvg(agentId)
  }

  // Read IDENTITY.md to get avatar filename
  const wsIdentity = safeRead(join(agentWorkspace, 'IDENTITY.md'))
  if (!wsIdentity) {
    return fallbackAvatarSvg(agentId)
  }

  const parsed = parseIdentity(wsIdentity)
  if (!parsed.avatar) {
    return fallbackAvatarSvg(agentId)
  }

  const avatarPath = join(agentWorkspace, parsed.avatar)
  if (!existsSync(avatarPath)) {
    return fallbackAvatarSvg(agentId)
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
