'use client'

import { useCallback } from 'react'
import { Search, Terminal } from 'lucide-react'
import { useSettings } from '@/app/settings-provider'
import { useDashboardStore } from '@/store/dashboard'

export function HeaderBar() {
  const { settings } = useSettings()
  const logsOpen = useDashboardStore(s => s.logsOpen)
  const setLogsOpen = useDashboardStore(s => s.setLogsOpen)

  const openSearch = useCallback(() => {
    window.dispatchEvent(new CustomEvent('clawport:open-search'))
  }, [])

  const portalName = (!settings.portalName || settings.portalName === 'ClawPort')
    ? null
    : settings.portalName

  return (
    <div
      className="hidden md:flex items-center flex-shrink-0"
      style={{
        height: 48,
        padding: '0 16px',
        borderBottom: '1px solid var(--separator)',
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        gap: 16,
      }}
    >
      {/* Logo + Title */}
      <div className="flex items-center" style={{ gap: 10, flexShrink: 0 }}>
        <img
          src={settings.portalIcon || '/ocd-logo-dark.png'}
          alt=""
          style={{
            width: 26,
            height: 26,
            borderRadius: settings.portalIcon ? 6 : 0,
            objectFit: 'contain',
            flexShrink: 0,
          }}
        />
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '-0.3px',
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
        }}>
          {portalName
            ? portalName
            : <>Open<span style={{ color: 'var(--accent)' }}>Claw</span></>}
        </div>
      </div>

      {/* Search — full width */}
      <button
        onClick={openSearch}
        className="focus-ring"
        aria-label="Open search (Cmd+K)"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 32,
          padding: '0 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--separator)',
          background: 'var(--fill-quaternary)',
          color: 'var(--text-tertiary)',
          fontSize: 13,
          cursor: 'pointer',
          transition: 'border-color 100ms var(--ease-smooth)',
        }}
      >
        <Search size={14} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
        <kbd style={{
          fontSize: 10,
          fontWeight: 600,
          padding: '1px 5px',
          borderRadius: 4,
          background: 'var(--fill-tertiary)',
          color: 'var(--text-quaternary)',
          border: '1px solid var(--separator)',
          lineHeight: '16px',
        }}>
          &#8984;K
        </kbd>
      </button>

      {/* Logs toggle */}
      <button
        onClick={() => setLogsOpen(!logsOpen)}
        title={logsOpen ? 'Close live logs' : 'Open live logs'}
        className="focus-ring hover-bg"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background: logsOpen ? 'var(--accent-fill)' : 'transparent',
          color: logsOpen ? 'var(--accent)' : 'var(--text-tertiary)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          flexShrink: 0,
          transition: 'all 150ms var(--ease-smooth)',
        }}
      >
        <Terminal size={14} />
        Logs
      </button>
    </div>
  )
}
