'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Square, Trash2, Terminal, Wrench } from 'lucide-react'

type AccessLevel = 'read' | 'edit' | 'full'

interface ToolActivity {
  name: string
  input: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  tools?: ToolActivity[]
}

const ACCESS_OPTIONS: { value: AccessLevel; label: string; hint: string }[] = [
  { value: 'read', label: 'Read-only', hint: 'Can read files and search, no changes' },
  { value: 'edit', label: 'Allow edits', hint: 'Auto-accepts file edits in the working directory' },
  { value: 'full', label: 'Full access', hint: 'Bypasses all permission prompts — use with care' },
]

export default function ClaudeCodePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState('')
  const [access, setAccess] = useState<AccessLevel>('read')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCost, setLastCost] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  async function handleSend() {
    const prompt = input.trim()
    if (!prompt || streaming) return
    setError(null)
    setInput('')
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'user', text: prompt }, { role: 'assistant', text: '', tools: [] }])

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/claude-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sessionId, cwd: cwd.trim() || undefined, access }),
        signal: abort.signal,
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `Request failed: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          let event: Record<string, unknown>
          try { event = JSON.parse(part.slice(6)) } catch { continue }

          if (event.type === 'init') {
            setSessionId(String(event.sessionId))
            if (event.model) setModel(String(event.model))
          } else if (event.type === 'text') {
            setMessages(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              next[next.length - 1] = { ...last, text: last.text + String(event.text) }
              return next
            })
          } else if (event.type === 'tool') {
            setMessages(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              next[next.length - 1] = {
                ...last,
                tools: [...(last.tools ?? []), { name: String(event.name), input: String(event.input ?? '') }],
              }
              return next
            })
          } else if (event.type === 'result') {
            if (event.sessionId) setSessionId(String(event.sessionId))
            if (typeof event.costUsd === 'number') setLastCost(event.costUsd)
            if (event.isError && event.error) setError(`Session ended: ${event.error}`)
          } else if (event.type === 'error') {
            setError(String(event.error))
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Failed to reach Claude Code')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  function handleNewSession() {
    abortRef.current?.abort()
    setMessages([])
    setSessionId(null)
    setModel(null)
    setLastCost(null)
    setError(null)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--separator)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2" style={{ fontSize: 'var(--text-title2)', fontWeight: 700, color: 'var(--text-primary)' }}>
              <Terminal size={20} /> Claude Code
            </h1>
            <p style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)' }}>
              Chat with Claude Code — it can read, search and edit code on this machine.
              {model && <span> · {model}</span>}
              {lastCost !== null && <span> · last turn ${lastCost.toFixed(4)}</span>}
            </p>
          </div>
          <button
            onClick={handleNewSession}
            className="focus-ring flex items-center gap-1.5"
            style={{
              background: 'var(--fill-secondary)', border: 'none', borderRadius: 'var(--radius-sm)',
              padding: '6px 12px', fontSize: 'var(--text-footnote)', color: 'var(--text-primary)', cursor: 'pointer',
            }}
          >
            <Trash2 size={13} /> New session
          </button>
        </div>
        <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
          <input
            value={cwd}
            onChange={e => setCwd(e.target.value)}
            disabled={sessionId !== null}
            placeholder="Working directory (default: dashboard repo)"
            style={{
              flex: 1, maxWidth: 420, background: 'var(--fill-secondary)', border: 'none',
              borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--text-footnote)',
              color: 'var(--text-primary)', outline: 'none', opacity: sessionId !== null ? 0.5 : 1,
            }}
          />
          <select
            value={access}
            onChange={e => setAccess(e.target.value as AccessLevel)}
            title={ACCESS_OPTIONS.find(o => o.value === access)?.hint}
            style={{
              background: 'var(--fill-secondary)', border: 'none', borderRadius: 'var(--radius-sm)',
              padding: '6px 10px', fontSize: 'var(--text-footnote)', color: 'var(--text-primary)', outline: 'none',
            }}
          >
            {ACCESS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ gap: 8 }}>
            <Terminal size={28} style={{ color: 'var(--text-tertiary)' }} />
            <div style={{ fontSize: 'var(--text-subheadline)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Start a conversation with Claude Code
            </div>
            <div style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 420 }}>
              Ask about this codebase, request changes, or point it at another repo with the working directory field.
              Access level: {ACCESS_OPTIONS.find(o => o.value === access)?.hint.toLowerCase()}.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4" style={{ maxWidth: 780, margin: '0 auto' }}>
            {messages.map((msg, i) => (
              <div key={i} className="flex flex-col gap-1.5" style={{ alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.tools && msg.tools.length > 0 && (
                  <div className="flex flex-col gap-1" style={{ maxWidth: '90%' }}>
                    {msg.tools.map((tool, j) => (
                      <div key={j} className="flex items-center gap-1.5" style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                        <Wrench size={11} />
                        <span style={{ fontWeight: 600 }}>{tool.name}</span>
                        {tool.input && <span className="truncate" style={{ fontFamily: 'monospace' }}>{tool.input}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {(msg.text || msg.role === 'user') && (
                  <div
                    style={{
                      maxWidth: '85%', borderRadius: 'var(--radius-md)', padding: '10px 14px',
                      background: msg.role === 'user' ? 'var(--accent-energy)' : 'var(--fill-secondary)',
                      color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                      fontSize: 'var(--text-subheadline)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}
                  >
                    {msg.text || (streaming && i === messages.length - 1 ? '…' : '')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" style={{ padding: '8px 24px', fontSize: 'var(--text-caption1)', color: 'var(--system-red)' }}>
          {error}
        </div>
      )}

      <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--separator)' }}>
        <div className="flex items-end gap-2" style={{ maxWidth: 780, margin: '0 auto' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask Claude Code anything… (Enter to send, Shift+Enter for newline)"
            rows={2}
            disabled={streaming}
            style={{
              flex: 1, background: 'var(--fill-secondary)', border: 'none', borderRadius: 'var(--radius-md)',
              outline: 'none', resize: 'none', color: 'var(--text-primary)', fontSize: 'var(--text-subheadline)',
              padding: '10px 12px', maxHeight: 160, opacity: streaming ? 0.6 : 1,
            }}
          />
          {streaming ? (
            <button
              onClick={handleStop}
              className="focus-ring"
              aria-label="Stop"
              style={{
                background: 'var(--fill-secondary)', border: 'none', borderRadius: 'var(--radius-md)',
                width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--system-red)',
              }}
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="focus-ring"
              aria-label="Send"
              style={{
                background: 'var(--accent-energy)', border: 'none', borderRadius: 'var(--radius-md)',
                width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff', opacity: input.trim() ? 1 : 0.5,
              }}
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
