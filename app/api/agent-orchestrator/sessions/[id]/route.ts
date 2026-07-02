import { sendToSession, killSession } from '@/lib/agent-orchestrator'
import { apiErrorResponse } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json().catch(() => null)
    if (body?.action === 'kill') {
      await killSession(id)
    } else if (body?.action === 'send' && typeof body.message === 'string' && body.message.trim() && body.message.length <= 32_000) {
      await sendToSession(id, body.message)
    } else {
      return apiErrorResponse(new Error('action must be "kill", or "send" with a non-empty message (max 32000 chars)'), 'Invalid action', 400)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to act on session')
  }
}
