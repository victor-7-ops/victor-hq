'use client'
import type { Agent } from '@/lib/types'
import type { Message } from '@/lib/conversations'
import { parseMedia } from '@/lib/conversations'
import { AgentAvatar } from '@/components/AgentAvatar'
import { formatMessage, formatTimestamp, shouldShowTimestamp, shouldShowAvatar, renderMedia } from './message-format'

interface MessageBubbleProps {
  msg: Message
  index: number
  messages: Message[]
  agent: Agent
  isStreaming: boolean
}

export function MessageBubble({ msg, index: i, messages, agent, isStreaming }: MessageBubbleProps) {
  const isUser = msg.role === 'user'
  const showAvatar = shouldShowAvatar(messages, i)
  const showTimestamp = shouldShowTimestamp(messages, i)
  // System messages render their own block — skip user/assistant layout logic
  const isSystem = msg.role === 'system'
  const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1 && (isStreaming || msg.isStreaming)
  const showTypingDots = isLastAssistant && !msg.content
  const media = isSystem ? [] : (msg.media || parseMedia(msg.content))

  // Strip media URLs from text for display
  let textContent = msg.content
  if (!isSystem && media.length > 0 && !msg.media) {
    media.forEach(m => {
      textContent = textContent.replace(m.url, '')
      textContent = textContent.replace(/!\[[^\]]*\]\([^\)]+\)/g, '')
    })
    textContent = textContent.trim()
  }
  // Hide auto-generated content labels for media-only messages
  if (!isSystem && msg.media && msg.media.length > 0) {
    const isAutoLabel = textContent.startsWith('[') && textContent.endsWith(']')
    if (isAutoLabel) textContent = ''
  }

  return (
    <div className="animate-fade-in">
      {/* Timestamp divider */}
      {showTimestamp && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-3) 0',
          fontSize: 'var(--text-caption2)',
          color: 'var(--text-tertiary)',
        }}>
          {formatTimestamp(msg.timestamp)}
        </div>
      )}

      {/* Spacing between role switches (skip for system messages) */}
      {!showTimestamp && i > 0 && msg.role !== 'system' && (() => {
        let prev = i - 1
        while (prev >= 0 && messages[prev].role === 'system') prev--
        const prevRole = prev >= 0 ? messages[prev].role : msg.role
        return <div style={{ height: prevRole !== msg.role ? 'var(--space-4)' : 'var(--space-1)' }} />
      })()}

      {/* User message */}
      {isUser && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          padding: '0 var(--space-4)',
          marginBottom: 'var(--space-1)',
        }}>
          {textContent && (
            <div className="msg-user" style={{
              maxWidth: '75%',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)',
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              fontSize: 'var(--text-subheadline)',
              lineHeight: 'var(--leading-relaxed)',
              fontWeight: 'var(--weight-medium)',
              boxShadow: 'var(--shadow-subtle)',
            }}>
              {textContent}
            </div>
          )}
          {media.length > 0 && (
            <div style={{ maxWidth: '75%' }}>
              {renderMedia(media, true)}
            </div>
          )}
        </div>
      )}

      {/* System message (slash command result) */}
      {msg.role === 'system' && (
        <div style={{
          padding: '0 var(--space-4)',
          marginBottom: 'var(--space-1)',
        }}>
          <div style={{
            maxWidth: '85%',
            margin: '0 auto',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--fill-tertiary)',
            borderLeft: '3px solid var(--accent)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-footnote)',
            lineHeight: 'var(--leading-relaxed)',
          }}>
            {formatMessage(msg.content)}
          </div>
        </div>
      )}

      {/* Assistant message */}
      {msg.role === 'assistant' && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          padding: '0 var(--space-4)',
          marginBottom: 'var(--space-1)',
        }}>
          {/* Small avatar */}
          <div style={{
            flexShrink: 0,
            width: 28,
            marginRight: 'var(--space-2)',
          }}>
            {showAvatar ? (
              <AgentAvatar agent={agent} size={28} borderRadius={14} />
            ) : <div style={{ width: 28 }} />}
          </div>

          <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column' }}>
            {/* Typing indicator */}
            {showTypingDots && (
              <div className="msg-assistant" style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
                background: 'var(--material-thin)',
                border: '1px solid var(--separator)',
              }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 16 }}>
                  <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                  <span className="typing-dot" style={{ animationDelay: '150ms' }} />
                  <span className="typing-dot" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Text bubble */}
            {textContent && (
              <div className="msg-assistant" style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
                background: 'var(--material-thin)',
                border: '1px solid var(--separator)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-subheadline)',
                lineHeight: 'var(--leading-relaxed)',
              }}>
                {formatMessage(textContent)}
                {/* Streaming cursor */}
                {isLastAssistant && textContent && (
                  <span style={{
                    display: 'inline-block',
                    width: 2,
                    height: '1.1em',
                    background: 'var(--accent)',
                    marginLeft: 2,
                    animation: 'blink-cursor 1s step-end infinite',
                    verticalAlign: 'text-bottom',
                  }} />
                )}
              </div>
            )}

            {/* Media attachments */}
            {media.length > 0 && renderMedia(media, false)}
          </div>
        </div>
      )}
    </div>
  )
}
