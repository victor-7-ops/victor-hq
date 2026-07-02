'use client';

import { useCallback } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLinks } from '@/components/NavLinks';
import { MobileSidebar } from '@/components/MobileSidebar';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useDashboardStore } from '@/store/dashboard';

export function Sidebar() {
  const sidebarCollapsed = useDashboardStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useDashboardStore((s) => s.setSidebarCollapsed);

  const openSearch = useCallback(() => {
    window.dispatchEvent(new CustomEvent('clawport:open-search'));
  }, []);

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside
        className="hidden md:flex md:flex-col"
        style={{
          width: sidebarCollapsed ? '56px' : '200px',
          flexShrink: 0,
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderRight: '1px solid var(--separator)',
          transition: 'width 200ms ease-out',
          overflow: 'clip',
        }}
      >
        {/* Collapse toggle */}
        <div
          style={{
            flexShrink: 0,
            padding: sidebarCollapsed ? '8px 0' : '8px 12px',
            display: 'flex',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-end',
          }}
        >
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hover-bg"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'none',
              color: 'var(--text-quaternary)',
              cursor: 'pointer',
            }}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <NavLinks collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile sidebar */}
      <MobileSidebar onOpenSearch={openSearch} />

      {/* Global search modal (Cmd+K) */}
      <GlobalSearch />
    </>
  );
}
