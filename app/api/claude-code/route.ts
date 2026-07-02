import { NextRequest } from 'next/server'
import { query, type PermissionMode } from '@anthropic-ai/claude-agent-sdk'
import { apiErrorResponse } from '@/lib/api-error'
import fs from 'fs'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_PROMPT_LENGTH = 32_000

// Access levels the UI exposes, mapped to SDK permission settings.
// 'read' restricts to non-mutating tools; 'edit' auto-accepts file edits;
// 'full' bypasses permission prompts entirely (local single-user dashboard).
const ACCESS_LEVELS: Record<string, { permissionMode: PermissionMode; allowedTools?: string[] }> = {
  read: {
    permissionMode: 'default',
    allowedTools: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Task', 'TodoWrite'],
  },
  edit: { permissionMode: 'acceptEdits' },
  full: { permissionMode: 'bypassPermissions' },
}

interface ChatBody {
  prompt?: unknown
  sessionId?: unknown
  cwd?: unknown
  access?: unknown
}

export async function POST(request: NextRequest) {
  let body: ChatBody
  try {
    body = await request.json()
  } catch {
    return apiErrorResponse(new Error('Invalid JSON body'), 'Invalid JSON body', 400)
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return apiErrorResponse(
      new Error(`prompt must be a non-empty string (max ${MAX_PROMPT_LENGTH} chars)`),
      'Invalid prompt', 400
    )
  }

  const sessionId = typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : undefined
  const access = ACCESS_LEVELS[typeof body.access === 'string' ? body.access : 'read'] ?? ACCESS_LEVELS.read

  let cwd = process.cwd()
  if (typeof body.cwd === 'string' && body.cwd.trim()) {
    const candidate = body.cwd.trim()
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
      return apiErrorResponse(new Error(`Directory does not exist: ${candidate}`), 'Invalid cwd', 400)
    }
    cwd = candidate
  }

  const encoder = new TextEncoder()
  const abortController = new AbortController()
  request.signal.addEventListener('abort', () => abortController.abort())

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      try {
        const q = query({
          prompt,
          options: {
            cwd,
            resume: sessionId,
            permissionMode: access.permissionMode,
            ...(access.allowedTools ? { allowedTools: access.allowedTools } : {}),
            maxTurns: 50,
            abortController,
          },
        })

        for await (const message of q) {
          if (message.type === 'system' && message.subtype === 'init') {
            send({ type: 'init', sessionId: message.session_id, model: message.model })
          } else if (message.type === 'assistant') {
            for (const block of message.message.content) {
              if (block.type === 'text' && block.text) {
                send({ type: 'text', text: block.text })
              } else if (block.type === 'tool_use') {
                send({ type: 'tool', name: block.name, input: summarizeToolInput(block.input) })
              }
            }
          } else if (message.type === 'result') {
            send({
              type: 'result',
              sessionId: message.session_id,
              costUsd: 'total_cost_usd' in message ? message.total_cost_usd : null,
              durationMs: message.duration_ms,
              isError: message.is_error,
              ...(message.subtype !== 'success' ? { error: message.subtype } : {}),
            })
          }
        }
      } catch (err) {
        send({ type: 'error', error: err instanceof Error ? err.message : 'Claude Code stream failed' })
      } finally {
        controller.close()
      }
    },
    cancel() {
      abortController.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

/** Short human-readable summary of a tool call for the activity feed. */
function summarizeToolInput(input: unknown): string {
  if (typeof input !== 'object' || input === null) return ''
  const i = input as Record<string, unknown>
  const candidate = i.file_path ?? i.path ?? i.pattern ?? i.command ?? i.query ?? i.url ?? i.description
  const text = typeof candidate === 'string' ? candidate : ''
  return text.length > 120 ? text.slice(0, 117) + '…' : text
}
