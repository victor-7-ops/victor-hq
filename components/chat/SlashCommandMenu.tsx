'use client'
import type { SlashCommand } from '@/lib/slash-commands'

interface SlashCommandMenuProps {
  matches: SlashCommand[]
  activeIndex: number
  onHover: (index: number) => void
  onSelect: (cmd: SlashCommand) => void
}

export function SlashCommandMenu({ matches, activeIndex, onHover, onSelect }: SlashCommandMenuProps) {
  return (
    <div
      className="animate-slide-down"
      style={{
        marginBottom: 'var(--space-2)',
        background: 'var(--material-thick)',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-overlay)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        overflow: 'hidden',
      }}
    >
      {matches.map((cmd, i) => (
        <button
          key={cmd.name}
          onMouseDown={e => {
            e.preventDefault() // prevent textarea blur
            onSelect(cmd)
          }}
          onMouseEnter={() => onHover(i)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            background: i === activeIndex ? 'var(--fill-secondary)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-subheadline)',
            transition: 'background 100ms',
          }}
        >
          <span style={{
            color: 'var(--accent)',
            fontWeight: 'var(--weight-semibold)',
            fontFamily: '"SF Mono", Menlo, monospace',
            fontSize: 'var(--text-footnote)',
            minWidth: 60,
          }}>
            {cmd.name}
          </span>
          <span style={{
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-caption1)',
          }}>
            {cmd.description}
          </span>
        </button>
      ))}
    </div>
  )
}
