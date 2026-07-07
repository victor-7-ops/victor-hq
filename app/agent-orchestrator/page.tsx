'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Send, Skull, FolderPlus, ExternalLink } from 'lucide-react'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/lib/utils'
import type { AOProject, AOSession } from '@/lib/agent-orchestrator'
import { COLUMNS, COLUMN_DOT, COLUMN_LABELS, STATUS_TO_COLUMN, type Column } from '@/lib/agent-orchestrator-columns'

const QUERY_KEY = ['agent-orchestrator']

interface AOState {
  projects: AOProject[]
  sessions: AOSession[]
  owners: Record<string, string>
  stale: boolean
  cachedAt: string | null
}

interface AgentOption {
  id: string
  name: string
}

async function fetchAOState(): Promise<AOState> {
  const res = await fetch('/api/agent-orchestrator')
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed: ${res.status}`)
  }
  const data = await res.json()
  return {
    projects: Array.isArray(data.projects) ? data.projects : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    owners: data.owners && typeof data.owners === 'object' ? data.owners : {},
    stale: Boolean(data._meta?.stale),
    cachedAt: data._meta?.cachedAt ?? null,
  }
}

async function fetchAgentOptions(): Promise<AgentOption[]> {
  const res = await fetch('/api/agents')
  if (!res.ok) return []
  const data = await res.json().catch(() => null)
  const list = Array.isArray(data) ? data : Array.isArray(data?.agents) ? data.agents : []
  return list.map((a: any) => ({ id: a.id, name: a.name })).filter((a: AgentOption) => a.id && a.name)
}

async function patchJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error ?? `Request failed: ${res.status}`)
  }
}

async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error ?? `Request failed: ${res.status}`)
  }
}

export default function AgentOrchestratorPage() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<AOSession | null>(null)
  const [message, setMessage] = useState('')
  const [projectPath, setProjectPath] = useState('')
  const [connection, setConnection] = useState<'live' | 'reconnecting'>('reconnecting')
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAOState,
    refetchInterval: 15000,
    retry: 2,
  })
  const projects = data?.projects ?? []
  const sessions = data?.sessions ?? []
  const owners = data?.owners ?? {}
  const stale = data?.stale ?? false

  const { data: agentOptions = [] } = useQuery({
    queryKey: ['agent-orchestrator', 'agent-options'],
    queryFn: fetchAgentOptions,
    staleTime: 60_000,
  })

  // Live updates via SSE. EventSource auto-reconnects, but if the proxy route
  // itself errors (daemon down) the browser gives up, so we recreate with backoff.
  useEffect(() => {
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let retryDelay = 3000
    let disposed = false

    const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })

    const connect = () => {
      if (disposed) return
      es = new EventSource('/api/agent-orchestrator/events')
      es.onopen = () => {
        retryDelay = 3000
        setConnection('live')
      }
      es.addEventListener('session_updated', invalidate)
      es.addEventListener('pr_updated', invalidate)
      es.onerror = () => {
        setConnection('reconnecting')
        if (es?.readyState === EventSource.CLOSED) {
          es.close()
          retryTimer = setTimeout(connect, retryDelay)
          retryDelay = Math.min(retryDelay * 2, 30000)
        }
      }
    }

    connect()
    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      es?.close()
    }
  }, [queryClient])

  const sendMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      postJson(`/api/agent-orchestrator/sessions/${encodeURIComponent(id)}`, { action: 'send', message: text }),
    onSuccess: () => {
      setMessage('')
      setActionError(null)
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Failed to send message'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const killMutation = useMutation({
    mutationFn: (id: string) =>
      postJson(`/api/agent-orchestrator/sessions/${encodeURIComponent(id)}`, { action: 'kill' }),
    onSuccess: (_data, id) => {
      if (selected?.id === id) setSelected(null)
      setActionError(null)
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Failed to kill session'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const registerMutation = useMutation({
    mutationFn: (path: string) => postJson('/api/agent-orchestrator', { path }),
    onSuccess: () => {
      setProjectPath('')
      setActionError(null)
    },
    onError: err => setActionError(err instanceof Error ? err.message : 'Failed to register project'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const assignMutation = useMutation({
    mutationFn: ({ projectId, agentId }: { projectId: string; agentId: string | null }) =>
      patchJson(`/api/agent-orchestrator/projects/${encodeURIComponent(projectId)}`, { ownerAgentId: agentId }),
    onError: err => setActionError(err instanceof Error ? err.message : 'Failed to assign project'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  function handleSend() {
    if (!selected || !message.trim() || sendMutation.isPending) return
    sendMutation.mutate({ id: selected.id, text: message })
  }

  function projectName(id: string): string {
    return projects.find(p => p.id === id)?.name ?? id
  }

  function ownerName(projectId: string): string | null {
    const agentId = owners[projectId]
    if (!agentId) return null
    return agentOptions.find(a => a.id === agentId)?.name ?? agentId
  }

  if (error && !isLoading) {
    return (
      <ErrorState
        message="Agent Orchestrator is not running. Start the daemon and retry."
        onRetry={() => refetch()}
      />
    )
  }

  const byColumn: Record<Column, AOSession[]> = {
    working: [], needs_you: [], in_review: [], ready_to_merge: [],
  }
  for (const s of sessions) {
    const col = STATUS_TO_COLUMN[s.status]
    if (col) byColumn[col].push(s)
  }

  const registering = registerMutation.isPending
  const sending = sendMutation.isPending

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--separator)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ fontSize: 'var(--text-title2)', fontWeight: 700, color: 'var(--text-primary)' }}>
                Agent Orchestrator
              </h1>
              <p style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)' }}>
                Live agent sessions flowing from work → review → merge.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="flex items-center gap-1.5"
                style={{ fontSize: 'var(--text-caption1)', color: connection === 'live' ? 'var(--system-green)' : 'var(--system-yellow, #eab308)' }}
                title={connection === 'live' ? 'Live updates connected' : 'Live updates disconnected — data may be stale'}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: connection === 'live' ? 'var(--system-green)' : 'var(--system-yellow, #eab308)',
                }} />
                {connection === 'live' ? 'Live' : 'Reconnecting'}
              </span>
              <button
                onClick={() => refetch()}
                className="focus-ring"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                aria-label="Refresh"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
            <input
              value={projectPath}
              onChange={e => setProjectPath(e.target.value)}
              placeholder="Repo path to register (e.g. C:\...\picklespace)"
              style={{
                flex: 1, maxWidth: 420, background: 'var(--fill-secondary)', border: 'none',
                borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--text-footnote)',
                color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <button
              onClick={() => registerMutation.mutate(projectPath.trim())}
              disabled={registering || !projectPath.trim()}
              className="focus-ring"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'var(--fill-secondary)',
                border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px',
                fontSize: 'var(--text-footnote)', color: 'var(--text-primary)', cursor: 'pointer',
                opacity: registering || !projectPath.trim() ? 0.5 : 1,
              }}
            >
              <FolderPlus size={14} /> {registering ? 'Registering…' : 'Register Project'}
            </button>
          </div>
          {actionError && (
            <div role="alert" style={{ marginTop: 8, fontSize: 'var(--text-caption1)', color: 'var(--system-red)' }}>
              {actionError}
            </div>
          )}
          {stale && (
            <div
              role="status"
              className="flex items-center gap-2"
              style={{
                marginTop: 8, fontSize: 'var(--text-caption1)', color: 'var(--system-yellow, #eab308)',
                background: 'var(--fill-secondary)', borderRadius: 'var(--radius-sm)', padding: '6px 10px',
              }}
            >
              Agent Orchestrator not running — showing cached data
              {data?.cachedAt ? ` from ${formatRelativeTime(data.cachedAt)}` : ''}.
              <button onClick={() => refetch()} className="focus-ring" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', textDecoration: 'underline', padding: 0 }}>
                Retry
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-4 gap-4" style={{ padding: 24 }}>
            {COLUMNS.map(c => (
              <div key={c} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ flex: 1, gap: 8, padding: 24 }}>
            <div style={{ fontSize: 'var(--text-subheadline)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              No agent sessions yet
            </div>
            <div style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 360 }}>
              {projects.length === 0
                ? 'Register a project path above to start orchestrating agents on it.'
                : 'Sessions will appear here as agents start working on your registered projects.'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 overflow-auto" style={{ padding: 24, flex: 1, opacity: stale ? 0.6 : 1 }}>
            {COLUMNS.map(col => (
              <div key={col}>
                <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLUMN_DOT[col] }} />
                  <span style={{ fontSize: 'var(--text-caption1)', fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    {COLUMN_LABELS[col]}
                  </span>
                  <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>{byColumn[col].length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {byColumn[col].map(session => (
                    <button
                      key={session.id}
                      onClick={() => setSelected(session)}
                      className="focus-ring"
                      style={{
                        textAlign: 'left', background: selected?.id === session.id ? 'var(--fill-tertiary)' : 'var(--fill-secondary)',
                        border: 'none', borderRadius: 'var(--radius-md)', padding: 12, cursor: 'pointer',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div style={{ fontSize: 'var(--text-subheadline)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {projectName(session.projectId)}
                        </div>
                        {ownerName(session.projectId) && (
                          <span style={{
                            fontSize: 'var(--text-caption2, 10px)', color: 'var(--text-tertiary)',
                            background: 'var(--fill-tertiary)', borderRadius: 'var(--radius-sm)', padding: '2px 6px',
                            whiteSpace: 'nowrap',
                          }}>
                            {ownerName(session.projectId)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                        {session.harness} · {session.branch ?? session.id}
                      </div>
                      {session.activity?.lastActivityAt && (
                        <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {formatRelativeTime(session.activity.lastActivityAt)}
                        </div>
                      )}
                    </button>
                  ))}
                  {byColumn[col].length === 0 && (
                    <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', padding: '8px 4px' }}>
                      No sessions
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div style={{ width: 320, borderLeft: '1px solid var(--separator)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--separator)' }}>
            <div style={{ fontSize: 'var(--text-subheadline)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {projectName(selected.projectId)}
            </div>
            <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
              {selected.harness} · {selected.kind} · {selected.status}
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>
                Assign to agent
              </label>
              <select
                value={owners[selected.projectId] ?? ''}
                onChange={e => assignMutation.mutate({ projectId: selected.projectId, agentId: e.target.value || null })}
                disabled={assignMutation.isPending}
                style={{
                  width: '100%', background: 'var(--fill-secondary)', border: 'none',
                  borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: 'var(--text-footnote)',
                  color: 'var(--text-primary)', outline: 'none',
                }}
              >
                <option value="">Unassigned</option>
                {agentOptions.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            {selected.previewUrl && (
              <a
                href={selected.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring"
                style={{
                  marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 'var(--text-caption1)', color: 'var(--accent-energy)', textDecoration: 'none',
                }}
              >
                <ExternalLink size={12} /> Preview
              </a>
            )}
            <button
              onClick={() => killMutation.mutate(selected.id)}
              disabled={killMutation.isPending}
              className="focus-ring"
              style={{
                marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--fill-secondary)',
                border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 10px',
                fontSize: 'var(--text-caption1)', color: 'var(--system-red)', cursor: 'pointer',
                opacity: killMutation.isPending ? 0.5 : 1,
              }}
            >
              <Skull size={13} /> {killMutation.isPending ? 'Killing…' : 'Kill session'}
            </button>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ padding: 12, borderTop: '1px solid var(--separator)' }}>
            <div className="flex items-center gap-2">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={`Message this session...`}
                rows={1}
                disabled={sending}
                style={{
                  flex: 1, background: 'var(--fill-secondary)', border: 'none', borderRadius: 'var(--radius-sm)',
                  outline: 'none', resize: 'none', color: 'var(--text-primary)', fontSize: 'var(--text-subheadline)',
                  padding: '8px 10px', maxHeight: 120, opacity: sending ? 0.5 : 1,
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="focus-ring"
                style={{
                  background: 'var(--fill-secondary)', border: 'none', borderRadius: 'var(--radius-sm)',
                  width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-primary)', opacity: sending || !message.trim() ? 0.5 : 1,
                }}
                aria-label="Send"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
