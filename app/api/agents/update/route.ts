import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { requireEnv } from '@/lib/env'
import { listCliAgents } from '@/lib/agents-registry'

/**
 * Resolve the workspace directory for a given agent ID.
 *
 * Resolution order:
 *   1. Direct match: ~/.openclaw/agents/{agentId}/workspace
 *   2. CLI lookup: ask `openclaw agents list` for the agent's workspace path
 *   3. Root agent: if agentId matches the default CLI agent, use primary WORKSPACE_PATH
 */
function resolveAgentWorkspace(agentId: string): string | null {
  const workspacePath = requireEnv('WORKSPACE_PATH')
  const agentsBase = resolve(workspacePath, '..', 'agents')

  // 1. Direct match by agent ID
  const direct = join(agentsBase, agentId, 'workspace')
  if (existsSync(direct)) return direct

  // 2. CLI lookup — the CLI knows each agent's actual workspace path
  const openclawBin = process.env.OPENCLAW_BIN
  if (openclawBin) {
    const cliAgents = listCliAgents(openclawBin)
    if (cliAgents) {
      const match = cliAgents.find(a => a.id === agentId)
      if (match?.workspace && existsSync(match.workspace)) return match.workspace

      // 3. Root agent: if agentId is the default agent, use primary workspace
      const defaultAgent = cliAgents.find(a => a.isDefault) || cliAgents[0]
      if (defaultAgent && defaultAgent.id === agentId) return workspacePath
    }
  }

  return null
}

/**
 * POST /api/agents/update
 *
 * Syncs agent identity changes back to the OpenClaw IDENTITY.md file.
 * Accepts: { agentId, name?, emoji?, profileImage? }
 *
 * Profile images are saved as workspace files and referenced by path.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, name, emoji, profileImage } = body as {
      agentId: string
      name?: string
      emoji?: string
      profileImage?: string | null
    }

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    const agentWorkspace = resolveAgentWorkspace(agentId)
    if (!agentWorkspace) {
      return NextResponse.json({ error: `Agent workspace not found: ${agentId}` }, { status: 404 })
    }

    const identityPath = join(agentWorkspace, 'IDENTITY.md')
    let content = ''

    if (existsSync(identityPath)) {
      content = readFileSync(identityPath, 'utf-8')
    }

    const changes: string[] = []

    // Update name in IDENTITY.md
    if (name !== undefined) {
      if (content.match(/\*\*Name:\*\*\s*.+/i)) {
        content = content.replace(/(\*\*Name:\*\*\s*).+/i, `$1${name}`)
      } else {
        content = ensureField(content, 'Name', name)
      }
      changes.push(`name → ${name}`)
    }

    // Update emoji in IDENTITY.md
    if (emoji !== undefined) {
      if (content.match(/\*\*Emoji:\*\*\s*.+/i)) {
        content = content.replace(/(\*\*Emoji:\*\*\s*).+/i, `$1${emoji}`)
      } else {
        content = ensureField(content, 'Emoji', emoji)
      }
      changes.push(`emoji → ${emoji}`)
    }

    // Handle profile image — save as file and update Avatar field
    if (profileImage !== undefined) {
      if (profileImage === null) {
        // Remove avatar reference
        if (content.match(/\*\*Avatar:\*\*\s*.+/i)) {
          content = content.replace(/(\*\*Avatar:\*\*\s*).+/i, '$1')
        }
        changes.push('avatar removed')
      } else if (profileImage.startsWith('data:image/')) {
        // Save base64 image to workspace
        const ext = profileImage.startsWith('data:image/png') ? 'png' : 'jpg'
        const fileName = `${agentId}-avatar.${ext}`
        const filePath = join(agentWorkspace, fileName)

        const base64Data = profileImage.split(',')[1]
        if (base64Data) {
          writeFileSync(filePath, Buffer.from(base64Data, 'base64'))

          if (content.match(/\*\*Avatar:\*\*\s*.+/i)) {
            content = content.replace(/(\*\*Avatar:\*\*\s*).+/i, `$1${fileName}`)
          } else {
            content = ensureField(content, 'Avatar', fileName)
          }
          changes.push(`avatar → ${fileName}`)
        }
      }
    }

    if (changes.length === 0) {
      return NextResponse.json({ ok: true, changes: [] })
    }

    // Write the updated IDENTITY.md
    writeFileSync(identityPath, content, 'utf-8')

    return NextResponse.json({ ok: true, changes })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Ensure a field exists in an IDENTITY.md file.
 * If the file has the standard format, appends the field in the right place.
 */
function ensureField(content: string, field: string, value: string): string {
  const line = `- **${field}:** ${value}`
  if (!content.trim()) {
    return `# IDENTITY.md\n\n${line}\n`
  }
  // Insert after the last existing field line
  const fieldPattern = /^- \*\*.+\*\*:.+$/gm
  let lastFieldIndex = -1
  let match
  while ((match = fieldPattern.exec(content)) !== null) {
    lastFieldIndex = match.index + match[0].length
  }
  if (lastFieldIndex >= 0) {
    return content.slice(0, lastFieldIndex) + '\n' + line + content.slice(lastFieldIndex)
  }
  // No existing fields — append after heading
  const headingMatch = content.match(/^#.+\n/m)
  if (headingMatch) {
    const insertAt = headingMatch.index! + headingMatch[0].length
    return content.slice(0, insertAt) + '\n' + line + '\n' + content.slice(insertAt)
  }
  return content + '\n' + line + '\n'
}
