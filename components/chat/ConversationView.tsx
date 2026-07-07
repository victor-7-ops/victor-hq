'use client'
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Agent } from '@/lib/types'
import type { Conversation, ConversationStore, Message, MediaAttachment } from '@/lib/conversations'
import { parseMedia, addMessage, updateLastMessage, deleteOnServer } from '@/lib/conversations'
import { buildApiContent } from '@/lib/multimodal'
import { generateId } from '@/lib/id'
import { useSettings } from '@/app/settings-provider'
import { isSlashInput, matchCommands, parseSlashCommand, executeCommand } from '@/lib/slash-commands'
import type { SlashCommand } from '@/lib/slash-commands'
import { FileAttachment } from './FileAttachment'
import { MediaPreview } from './MediaPreview'
import { AgentAvatar } from '@/components/AgentAvatar'
import { MessageBubble } from './MessageBubble'
import { SlashCommandMenu } from './SlashCommandMenu'

interface ConversationViewProps {
  agent: Agent
  conversation: Conversation
  onUpdate: (agentId: string, updater: (prev: ConversationStore) => ConversationStore) => void
  onBack?: () => void
}

/* ── Helper: convert File to base64 MediaAttachment ────── */

async function fileToAttachment(file: File): Promise<MediaAttachment> {
  const isImage = file.type.startsWith('image/')
  const isAudio = file.type.startsWith('audio/')

  let dataUrl: string
  if (isImage) {
    // Resize images to max 1200px — reduces base64 size for API transport
    dataUrl = await resizeImage(file, 1200)
  } else {
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  return {
    type: isImage ? 'image' : isAudio ? 'audio' : 'file',
    url: dataUrl,
    name: file.name,
    mimeType: file.type,
    size: dataUrl.length,
  }
}

/** Resize an image file to fit within maxPx on the longest side. Returns a data URL. */
function resizeImage(file: File, maxPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        const scale = maxPx / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no canvas context')); return }
      ctx.drawImage(img, 0, 0, width, height)
      // Use JPEG for photos (smaller), PNG for small images
      const mimeType = file.size > 50000 ? 'image/jpeg' : 'image/png'
      const quality = mimeType === 'image/jpeg' ? 0.85 : undefined
      resolve(canvas.toDataURL(mimeType, quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
}

/* ── Render media helpers ─────────────────────────────── */

function renderMedia(media: MediaAttachment[], isUser: boolean) {
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

/* ── Component ──────────────────────────────────────────── */

export function ConversationView({ agent, conversation, onUpdate, onBack }: ConversationViewProps) {
  const router = useRouter()
  const { settings } = useSettings()
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<MediaAttachment[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [slashMatches, setSlashMatches] = useState<SlashCommand[]>([])
  const [slashIndex, setSlashIndex] = useState(0)
  const slashMenuOpen = slashMatches.length > 0
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)

  const messages = conversation?.messages || []
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (mediaOverride?: MediaAttachment[], contentOverride?: string) => {
    const mediaToSend = mediaOverride || [...pendingAttachments]
    const hasText = input.trim().length > 0 || !!contentOverride
    const hasMedia = mediaToSend.length > 0

    if ((!hasText && !hasMedia) || isStreaming) return

    const text = contentOverride || input.trim()
    setInput('')
    setPendingAttachments([])

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Build content label for media-only messages
    let content = text
    if (!content && hasMedia) {
      const labels = mediaToSend.map(m => `[${m.name || m.type}]`)
      content = labels.join(' ')
    }

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      media: hasMedia ? mediaToSend : undefined,
    }

    const assistantMsgId = generateId()
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }

    onUpdate(agent.id, prev => {
      let next = addMessage(prev, agent.id, userMsg)
      next = addMessage(next, agent.id, assistantMsg)
      return next
    })

    setIsStreaming(true)

    // Use ref to read latest messages (avoids stale closure)
    const apiMessages = [...messagesRef.current, userMsg]
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: buildApiContent(m),
      }))

    try {
      const res = await fetch(`/api/chat/${agent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, operatorName: settings.operatorName }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const chunk = JSON.parse(line.slice(6))
              if (chunk.content) {
                fullContent += chunk.content
                const capturedContent = fullContent
                onUpdate(agent.id, prev => updateLastMessage(prev, agent.id, assistantMsgId, capturedContent, true))
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }

      const finalContent = fullContent
      onUpdate(agent.id, prev => updateLastMessage(prev, agent.id, assistantMsgId, finalContent, false))
    } catch {
      onUpdate(agent.id, prev => updateLastMessage(prev, agent.id, assistantMsgId, 'Error getting response. Check API connection.', false))
    } finally {
      setIsStreaming(false)
      textareaRef.current?.focus()
    }
  }, [input, pendingAttachments, isStreaming, agent.id, onUpdate])

  function runSlashCommand(command: string) {
    const result = executeCommand(command, agent)
    if (result.action === 'clear') {
      clearChat()
    } else {
      const sysMsg: Message = {
        id: generateId(),
        role: 'system',
        content: result.content,
        timestamp: Date.now(),
      }
      onUpdate(agent.id, prev => addMessage(prev, agent.id, sysMsg))
    }
    setInput('')
    setSlashMatches([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleSlashSelect(cmd: SlashCommand) {
    runSlashCommand(cmd.name)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashIndex(i => (i + 1) % slashMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashIndex(i => (i - 1 + slashMatches.length) % slashMatches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleSlashSelect(slashMatches[slashIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSlashMatches([])
        return
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      textareaRef.current?.blur()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const parsed = parseSlashCommand(input)
      if (parsed) {
        runSlashCommand(parsed.command)
        return
      }
      sendMessage()
    }
  }

  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newAttachments: MediaAttachment[] = []
    for (let i = 0; i < files.length; i++) {
      newAttachments.push(await fileToAttachment(files[i]))
    }
    setPendingAttachments(prev => [...prev, ...newAttachments])
    e.target.value = ''
  }

  function removePendingAttachment(index: number) {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index))
  }

  /* ── Clipboard paste handler ──────────────────────────── */

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (file) {
          const att = await fileToAttachment(file)
          setPendingAttachments(prev => [...prev, att])
        }
        return
      }
    }
  }

  /* ── Drag and drop handlers ────────────────────────────── */

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    // Only leave if we're actually leaving the container
    const rect = messagesAreaRef.current?.getBoundingClientRect()
    if (rect) {
      const { clientX, clientY } = e
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        setIsDragOver(false)
      }
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    const newAttachments: MediaAttachment[] = []
    for (let i = 0; i < files.length; i++) {
      newAttachments.push(await fileToAttachment(files[i]))
    }
    setPendingAttachments(prev => [...prev, ...newAttachments])
  }

  /* ── TTS playback ─────────────────────────────────────── */

  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null)
  const [ttsPlayingId, setTtsPlayingId] = useState<string | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsObjectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      ttsAudioRef.current?.pause()
      if (ttsObjectUrlRef.current) URL.revokeObjectURL(ttsObjectUrlRef.current)
    }
  }, [])

  const stopTts = useCallback(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current.currentTime = 0
      ttsAudioRef.current = null
    }
    if (ttsObjectUrlRef.current) {
      URL.revokeObjectURL(ttsObjectUrlRef.current)
      ttsObjectUrlRef.current = null
    }
    setTtsPlayingId(null)
    setTtsLoadingId(null)
  }, [])

  const playTts = useCallback(async (msgId: string, text: string) => {
    if (ttsPlayingId === msgId) { stopTts(); return }
    stopTts()
    setTtsLoadingId(msgId)

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('TTS request failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      ttsObjectUrlRef.current = url

      const audio = new Audio(url)
      ttsAudioRef.current = audio

      audio.onended = () => {
        setTtsPlayingId(null)
        ttsAudioRef.current = null
        if (ttsObjectUrlRef.current) {
          URL.revokeObjectURL(ttsObjectUrlRef.current)
          ttsObjectUrlRef.current = null
        }
      }
      audio.onerror = () => stopTts()

      await audio.play()
      setTtsLoadingId(null)
      setTtsPlayingId(msgId)
    } catch {
      stopTts()
    }
  }, [ttsPlayingId, stopTts])

  const speakerPlayIcon = useMemo(() => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ), [])

  const speakerStopIcon = useMemo(() => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ), [])

  function clearChat() {
    deleteOnServer(agent.id)
    onUpdate(agent.id, prev => ({
      ...prev,
      [agent.id]: {
        agentId: agent.id,
        messages: [{
          id: generateId(),
          role: 'assistant' as const,
          content: `I'm ${agent.name}. ${agent.description} What do you need?`,
          timestamp: Date.now(),
        }],
        unread: 0,
        lastActivity: Date.now(),
      }
    }))
  }

  const hasContent = input.trim().length > 0 || pendingAttachments.length > 0

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
    }}>
      {/* ── Header ─────────────────────────────────── */}
      <div style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-4)',
        borderBottom: '1px solid var(--separator)',
        background: 'var(--material-thick)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}>
        {/* Mobile back button */}
        {onBack && (
          <button
            className="md:hidden btn-ghost focus-ring"
            onClick={onBack}
            aria-label="Back to agents"
            style={{
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              marginRight: 'var(--space-2)',
              fontSize: 'var(--text-subheadline)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
        )}

        {/* Agent info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flex: 1,
          minWidth: 0,
        }}>
          <AgentAvatar agent={agent} size={32} borderRadius={16} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 'var(--text-subheadline)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.2px',
              lineHeight: 1.2,
            }}>
              {agent.name}
            </div>
            <div style={{
              fontSize: 'var(--text-caption2)',
              color: 'var(--text-tertiary)',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {agent.title}{agent.model && ` · ${agent.model.split('/').pop()}`}{messages.length > 1 && ' · Synced'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <button
            className="btn-ghost focus-ring"
            aria-label="View agent profile"
            onClick={() => router.push(`/agents/${agent.id}`)}
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
          <button
            className="btn-ghost focus-ring"
            aria-label="Clear conversation"
            onClick={clearChat}
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages ──────────────────────────────── */}
      <div
        ref={messagesAreaRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--bg)',
          padding: 'var(--space-5) 0 var(--space-16) 0',
          position: 'relative',
        }}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--accent-fill)',
            border: '2px dashed var(--accent)',
            borderRadius: 'var(--radius-md)',
            margin: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            pointerEvents: 'none',
          }}>
            <div style={{
              fontSize: 'var(--text-subheadline)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--accent)',
            }}>
              Drop files to attach
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id || i}
            msg={msg}
            index={i}
            messages={messages}
            agent={agent}
            isStreaming={isStreaming}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Input Area ────────────────────────────── */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        borderTop: '1px solid var(--separator)',
        background: 'var(--material-regular)',
        flexShrink: 0,
      }}>
        {/* Slash command autocomplete dropdown */}
        {slashMenuOpen && (
          <SlashCommandMenu
            matches={slashMatches}
            activeIndex={slashIndex}
            onHover={setSlashIndex}
            onSelect={handleSlashSelect}
          />
        )}

        {/* Pending attachments preview */}
        {pendingAttachments.length > 0 && (
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <MediaPreview
              attachments={pendingAttachments}
              onRemove={removePendingAttachment}
            />
          </div>
        )}

        <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 'var(--space-2)',
            background: 'var(--fill-secondary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-2) var(--space-3)',
            border: '1px solid var(--separator)',
          }}>
            {/* Attach button */}
            <button
              className="btn-ghost focus-ring"
              aria-label="Attach file"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: 'var(--space-1)',
                flexShrink: 0,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.json,.zip"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileAttach}
            />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                const val = e.target.value
                setInput(val)
                if (isSlashInput(val) && !val.includes(' ')) {
                  const matches = matchCommands(val)
                  setSlashMatches(matches)
                  setSlashIndex(0)
                } else {
                  setSlashMatches([])
                }
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={`Message ${agent.name}...`}
              rows={1}
              disabled={isStreaming}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-subheadline)',
                lineHeight: 'var(--leading-normal)',
                maxHeight: 120,
                minHeight: 24,
                padding: '2px 0',
                opacity: isStreaming ? 0.5 : 1,
              }}
              onInput={e => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />

            {/* Send button */}
            <button
              className="focus-ring"
              onClick={() => sendMessage()}
              disabled={!hasContent || isStreaming}
              aria-label="Send message"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: hasContent ? 'var(--accent)' : 'var(--fill-tertiary)',
                color: hasContent ? '#000' : 'var(--text-quaternary)',
                border: 'none',
                cursor: hasContent ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 'var(--weight-bold)',
                transition: 'all 150ms var(--ease-smooth)',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>

        {/* Hint */}
        <div style={{
          fontSize: 'var(--text-caption2)',
          color: 'var(--text-quaternary)',
          textAlign: 'center',
          marginTop: 'var(--space-1)',
        }}>
          Enter to send &middot; Shift+Enter for newline &middot; / for commands
        </div>
      </div>
    </div>
  )
}
