'use client'
import React, { useState } from 'react'
import type { MediaAttachment } from '@/lib/conversations'
import { FileAttachment } from './FileAttachment'

/* ── Markdown rendering ──────────────────────────────────── */

export function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  // Match URLs, bold, inline code, italic — in priority order
  const regex = /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]'"])|(\*\*(.+?)\*\*)|(`([^`]+)`)|\*([^*]+)\*/g
  let last = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[1]) {
      // URL
      parts.push(
        <a
          key={match.index}
          href={match[1]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--system-blue)', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          {match[1]}
        </a>
      )
    } else if (match[2]) {
      // Bold
      parts.push(<strong key={match.index} style={{ fontWeight: 'var(--weight-bold)' }}>{match[3]}</strong>)
    } else if (match[4]) {
      // Inline code
      parts.push(
        <code key={match.index} style={{
          background: 'var(--code-bg)',
          border: '1px solid var(--code-border)',
          borderRadius: 5,
          padding: '1px 5px',
          fontSize: '0.88em',
          fontFamily: '"SF Mono", Menlo, monospace',
          color: 'var(--code-text)',
        }}>{match[5]}</code>
      )
    } else if (match[6]) {
      // Italic
      parts.push(<em key={match.index} style={{ fontStyle: 'italic', opacity: 0.85 }}>{match[6]}</em>)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function CodeBlock({ code, keyProp }: { code: string; keyProp: number }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div key={keyProp} className="code-block-wrapper">
      <button
        className="code-copy-btn focus-ring"
        onClick={handleCopy}
        aria-label="Copy code"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre><code>{code}</code></pre>
    </div>
  )
}

export function formatMessage(content: string): React.ReactNode {
  if (!content) return null
  const lines = content.split('\n')
  const result: React.ReactNode[] = []
  let inCodeBlock = false
  let codeLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeLines = []
      } else {
        inCodeBlock = false
        result.push(<CodeBlock key={i} keyProp={i} code={codeLines.join('\n')} />)
        codeLines = []
      }
      continue
    }
    if (inCodeBlock) { codeLines.push(line); continue }
    if (line.trim() === '') { result.push(<div key={`space-${i}`} style={{ height: 6 }} />); continue }
    if (line.match(/^[-*] /)) {
      result.push(
        <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 2 }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>&bull;</span>
          <span>{inlineFormat(line.slice(2))}</span>
        </div>
      )
      continue
    }
    if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)?.[1]
      result.push(
        <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 2 }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, fontWeight: 'var(--weight-semibold)', minWidth: 16 }}>{num}.</span>
          <span>{inlineFormat(line.replace(/^\d+\. /, ''))}</span>
        </div>
      )
      continue
    }
    if (line.startsWith('### ')) {
      result.push(
        <div key={i} style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-footnote)', marginTop: 'var(--space-2)', marginBottom: 2 }}>
          {inlineFormat(line.slice(4))}
        </div>
      )
      continue
    }
    if (line.startsWith('## ')) {
      result.push(
        <div key={i} style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-subheadline)', marginTop: 'var(--space-3)', marginBottom: 3 }}>
          {inlineFormat(line.slice(3))}
        </div>
      )
      continue
    }
    if (line.startsWith('# ')) {
      result.push(
        <div key={i} style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', marginTop: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
          {inlineFormat(line.slice(2))}
        </div>
      )
      continue
    }
    result.push(<div key={i} style={{ marginBottom: 1 }}>{inlineFormat(line)}</div>)
  }
  return <>{result}</>
}

/* ── Timestamp formatting ──────────────────────────────── */

export function formatTimestamp(ts: number): string {
  const now = new Date()
  const date = new Date(ts)
  const isToday = now.toDateString() === date.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = yesterday.toDateString() === date.toDateString()
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  if (isToday) return `Today ${time}`
  if (isYesterday) return `Yesterday ${time}`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${time}`
}

/** Minimal shape needed to compute timestamp/avatar grouping. */
interface MessageLike {
  role: string
  timestamp: number
}

export function shouldShowTimestamp(messages: MessageLike[], index: number): boolean {
  if (messages[index].role === 'system') return false
  // Find previous non-system message for gap comparison
  let prev = index - 1
  while (prev >= 0 && messages[prev].role === 'system') prev--
  if (prev < 0) return true
  const gap = messages[index].timestamp - messages[prev].timestamp
  return gap > 5 * 60 * 1000 // 5 minutes
}

export function shouldShowAvatar(messages: MessageLike[], index: number): boolean {
  if (messages[index].role === 'system') return false
  // Find previous non-system message for role comparison
  let prev = index - 1
  while (prev >= 0 && messages[prev].role === 'system') prev--
  if (prev < 0) return true
  return messages[prev].role !== messages[index].role
}

/* ── Render media helpers ─────────────────────────────── */

export function renderMedia(media: MediaAttachment[], isUser: boolean) {
  const images = media.filter(m => m.type === 'image')
  const files = media.filter(m => m.type === 'file')

  return (
    <>
      {images.map((m, mi) => (
        <div key={`img-${mi}`} style={{
          marginTop: 'var(--space-2)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          maxWidth: 280,
        }}>
          <img
            src={m.url}
            alt={m.name || 'Image'}
            style={{ width: '100%', display: 'block', borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}
            onClick={() => window.open(m.url, '_blank')}
          />
        </div>
      ))}
      {files.map((m, mi) => (
        <div key={`file-${mi}`} style={{ marginTop: 'var(--space-2)' }}>
          <FileAttachment
            name={m.name || 'File'}
            size={m.size}
            mimeType={m.mimeType}
            url={m.url}
            isUser={isUser}
          />
        </div>
      ))}
    </>
  )
}
