'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import type { AgentData, GatewayStatus } from '@/types';
import AgentDetail from '@/components/fleet/AgentDetail';

interface AgentSidePanelProps {
  agent: AgentData | null;
  gateway: GatewayStatus | undefined;
  onClose: () => void;
}

export default function AgentSidePanel({
  agent,
  gateway,
  onClose,
}: AgentSidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (agent) {
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [agent, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/30 transition-opacity duration-200',
          agent ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed right-0 top-0 z-40 flex h-full w-[460px] flex-col border-l border-border bg-[#121620] shadow-2xl shadow-black/50 transition-transform duration-250 ease-out',
          agent ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Close button */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Agent Details
          </span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {agent && <AgentDetail agent={agent} gateway={gateway} />}
        </div>
      </div>
    </>
  );
}
