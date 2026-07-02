'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LiveLogLine } from '@/lib/types'
import { parseSSEBuffer } from '@/lib/sse'
import { Play, Pause, Copy, X, Search, ChevronRight } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboard'

/* ── Constants ────────────────────────────────────────────────── */

const MAX_LINES = 500
const WIDGET_EVENT = 'clawport:open-stream-widget'

const LEVELS = ['info', 'warn', 'error', 'debug'] as const
type Level = typeof LEVELS[number]

const LEVEL_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  info:  { bg: 'rgba(48,209,88,0.12)', color: 'var(--system-green)', label: 'INF' },
  warn:  { bg: 'rgba(255,159,10,0.12)', color: 'var(--system-orange)', label: 'WRN' },
  error: { bg: 'rgba(255,69,58,0.12)',  color: 'var(--system-red)',    label: 'ERR' },
  debug: { bg: 'var(--fill-secondary)', color: 'var(--text-tertiary)', label: 'DBG' },
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts.slice(0, 8)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatCopyLine(line: LiveLogLine): string {
  return `[${formatTime(line.time)}] [${line.level}] ${line.message}`
}

function prettyRaw(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

/* ── LogRow ───────────────────────────────────────────────────── */

function LogRow({ line }: { line: LiveLogLine }) {
  const [open, setOpen] = useState(false)
  const lvl = LEVEL_STYLE[line.level] ?? LEVEL_STYLE.debug

  return (
    <div style={{
      borderBottom: '1px solid var(--separator)',
      background: line.level === 'error' ? 'rgba(255,69,58,0.03)' : undefined,
    }}>
      <button
        onClick={() => line.raw && setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '5px 12px',
          gap: 8,
          border: 'none',
          background: 'transparent',
          cursor: line.raw ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        {line.raw ? (
          <ChevronRight size={10} style={{
            color: 'var(--text-tertiary)',
            flexShrink: 0,
            transition: 'transform 150ms var(--ease-smooth)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }} />
        ) : (
          <span style={{ width: 10, flexShrink: 0 }} />
        )}
        <span className="font-mono" style={{
          color: 'var(--text-tertiary)', fontSize: 10, flexShrink: 0, minWidth: 58,
        }}>
          {formatTime(line.time)}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
          padding: '1px 5px', borderRadius: 3,
          background: lvl.bg, color: lvl.color, flexShrink: 0, lineHeight: '14px',
        }}>
          {lvl.label}
        </span>
        <span className="font-mono" style={{
          color: line.level === 'error' ? 'var(--system-red)' : 'var(--text-secondary)',
          fontSize: 10, lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, minWidth: 0,
        }}>
          {line.message}
        </span>
      </button>
      {open && line.raw && (
        <div style={{
          padding: '6px 12px 8px 30px',
          borderTop: '1px solid var(--separator)',
          background: 'var(--fill-secondary)',
        }}>
          <pre className="font-mono" style={{
            fontSize: 9, lineHeight: 1.5, color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
          }}>
            {prettyRaw(line.raw)}
          </pre>
        </div>
      )}
    </div>
  )
}

/* ── Component ────────────────────────────────────────────────── */

export function LiveStreamWidget() {
  const logsOpen = useDashboardStore(s => s.logsOpen)
  const setLogsOpen = useDashboardStore(s => s.setLogsOpen)

  const [lines, setLines] = useState<LiveLogLine[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<Set<Level>>(new Set(LEVELS))

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  /* ── Filtering ─────────────────────────────────────────────── */

  const filteredLines = useMemo(() => {
    const q = search.toLowerCase()
    return lines.filter(line => {
      if (!levelFilter.has(line.level as Level)) return false
      if (q && !line.message.toLowerCase().includes(q)) return false
      return true
    })
  }, [lines, search, levelFilter])

  const isFiltering = search !== '' || levelFilter.size < LEVELS.length

  /* ── Auto-scroll ──────────────────────────────────────────── */

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filteredLines, autoScroll])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 40
    if (!atBottom) setAutoScroll(false)
    else setAutoScroll(true)
  }, [])

  /* ── Level toggle ──────────────────────────────────────────── */

  const toggleLevel = useCallback((level: Level) => {
    setLevelFilter(prev => {
      const next = new Set(prev)
      if (next.has(level)) {
        if (next.size > 1) next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })
  }, [])

  /* ── Stream lifecycle ─────────────────────────────────────── */

  const startStream = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)
    setError(null)

    fetch('/api/logs/stream', { signal: controller.signal })
      .then(res => {
        if (!res.ok || !res.body) throw new Error(`Stream failed: HTTP ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) { setStreaming(false); return }
            buffer += decoder.decode(value, { stream: true })
            const result = parseSSEBuffer(buffer)
            buffer = result.remainder
            if (result.errors.length > 0) setError(result.errors[0])
            if (result.lines.length > 0) {
              setLines(prev => [...prev, ...result.lines].slice(-MAX_LINES))
            }
            return pump()
          })
        }
        return pump()
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Stream connection failed')
        setStreaming(false)
      })
  }, [])

  const stopStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setStreaming(false)
  }, [])

  /* ── Actions ──────────────────────────────────────────────── */

  const handleCopy = useCallback(async () => {
    const text = filteredLines.map(formatCopyLine).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [filteredLines])

  /* ── DOM event listener (Activity page "Open Live Logs") ──── */

  useEffect(() => {
    function onOpen() {
      setLogsOpen(true)
    }
    window.addEventListener(WIDGET_EVENT, onOpen)
    return () => window.removeEventListener(WIDGET_EVENT, onOpen)
  }, [setLogsOpen])

  /* ── Cleanup on unmount ───────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [])

  /* ── Don't render if closed ────────────────────────────────── */

  if (!logsOpen) return null

  /* ── Inline panel (flex child, not fixed) ───────────────────── */

  return (
    <div
      className="panel-slide-in hidden md:flex md:flex-col"
      style={{
        width: 380,
        flexShrink: 0,
        borderLeft: '1px solid var(--separator)',
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--separator)',
          gap: 8,
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: streaming ? 'var(--system-green)' : 'var(--text-tertiary)',
          animation: streaming ? 'lsw-pulse 2s ease-in-out infinite' : undefined,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 'var(--text-footnote)', fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-primary)',
        }}>
          Live Logs
        </span>
        {lines.length > 0 && (
          <span style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)' }}>
            {isFiltering ? `${filteredLines.length} / ${lines.length}` : `${lines.length}`}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button
            onClick={handleCopy}
            className="focus-ring"
            title={isFiltering ? 'Copy filtered logs' : 'Copy all logs'}
            disabled={filteredLines.length === 0}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-sm)', border: 'none',
              background: copied ? 'var(--accent-fill)' : 'transparent',
              color: copied ? 'var(--accent)' : 'var(--text-tertiary)',
              cursor: filteredLines.length === 0 ? 'default' : 'pointer',
              opacity: filteredLines.length === 0 ? 0.3 : 1,
              transition: 'all 150ms var(--ease-smooth)',
            }}
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => setLogsOpen(false)}
            className="focus-ring"
            title="Close panel"
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'transparent', color: 'var(--text-tertiary)',
              cursor: 'pointer', transition: 'color 150ms var(--ease-smooth)',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Search + filter bar ────────────────────────────────── */}
      <div className="flex items-center flex-shrink-0" style={{
        padding: '6px 10px',
        borderBottom: '1px solid var(--separator)',
        gap: 6,
      }}>
        <div className="flex items-center" style={{
          flex: 1,
          minWidth: 0,
          height: 28,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--fill-secondary)',
          padding: '0 8px',
          gap: 6,
        }}>
          <Search size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '11px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-tertiary)', fontSize: '11px', padding: 0,
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          )}
        </div>

        <div className="flex items-center" style={{ gap: 3, flexShrink: 0 }}>
          {LEVELS.map(level => {
            const s = LEVEL_STYLE[level]
            const active = levelFilter.has(level)
            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                title={`${active ? 'Hide' : 'Show'} ${level} logs`}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: 'none',
                  cursor: 'pointer',
                  lineHeight: '14px',
                  background: active ? s.bg : 'transparent',
                  color: active ? s.color : 'var(--text-quaternary)',
                  opacity: active ? 1 : 0.5,
                  transition: 'all 150ms var(--ease-smooth)',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '6px 14px',
          background: 'rgba(255,69,58,0.06)',
          borderBottom: '1px solid rgba(255,69,58,0.15)',
          fontSize: 'var(--text-caption2)',
          color: 'var(--system-red)',
          flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {/* ── Log area ──────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
      >
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{
            height: '100%', color: 'var(--text-secondary)',
            gap: 'var(--space-2)', padding: 'var(--space-4)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)' }}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span style={{ fontSize: 'var(--text-caption1)', fontWeight: 'var(--weight-medium)' }}>
              {streaming ? 'Waiting for log data...' : 'Click Play to start streaming'}
            </span>
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{
            height: '100%', color: 'var(--text-tertiary)',
            gap: 'var(--space-2)', padding: 'var(--space-4)',
          }}>
            <Search size={20} />
            <span style={{ fontSize: 'var(--text-caption1)', fontWeight: 'var(--weight-medium)' }}>
              No matching logs
            </span>
          </div>
        ) : (
          <div>
            {filteredLines.map((line, i) => <LogRow key={i} line={line} />)}
          </div>
        )}
      </div>

      {/* ── Footer toolbar ────────────────────────────────────── */}
      <div className="flex items-center flex-shrink-0" style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--separator)',
        gap: 8,
      }}>
        <button
          onClick={streaming ? stopStream : startStream}
          className="focus-ring flex items-center"
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none', cursor: 'pointer',
            fontSize: 'var(--text-caption1)',
            fontWeight: 'var(--weight-semibold)',
            gap: 5,
            background: streaming ? 'rgba(255,69,58,0.1)' : 'var(--accent-fill)',
            color: streaming ? 'var(--system-red)' : 'var(--accent)',
            transition: 'all 200ms var(--ease-smooth)',
          }}
        >
          {streaming ? <Pause size={12} /> : <Play size={12} />}
          {streaming ? 'Pause' : 'Play'}
        </button>

        {!autoScroll && filteredLines.length > 0 && (
          <button
            onClick={() => setAutoScroll(true)}
            className="focus-ring"
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none', cursor: 'pointer',
              fontSize: 'var(--text-caption2)',
              fontWeight: 'var(--weight-medium)',
              background: 'var(--fill-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            Scroll to bottom
          </button>
        )}
      </div>

      <style>{`@keyframes lsw-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
