import { getAOBaseUrl } from '@/lib/agent-orchestrator'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/** Passthrough proxy for Agent Orchestrator's SSE change stream, so the browser can
 *  subscribe cross-origin-free from the dashboard's own origin. */
export async function GET(request: NextRequest) {
  const lastEventId = request.headers.get('last-event-id')
  const upstream = await fetch(`${getAOBaseUrl()}/api/v1/events`, {
    headers: lastEventId ? { 'Last-Event-ID': lastEventId } : {},
  })

  if (!upstream.ok || !upstream.body) {
    return new Response('Agent Orchestrator events stream unavailable', { status: 502 })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
