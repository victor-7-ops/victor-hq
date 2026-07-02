'use client';

import { cn, formatCost, formatTokens, formatRelativeTime } from '@/lib/utils';
import type { AgentData } from '@/types';

interface AgentTooltipProps {
  agent: AgentData;
  position: { x: number; y: number };
  visible: boolean;
}

function statusDotColor(status: AgentData['status']): string {
  switch (status) {
    case 'online':
      return 'bg-status-green';
    case 'idle':
      return 'bg-status-amber';
    case 'error':
      return 'bg-status-red';
    case 'offline':
    default:
      return 'bg-text-muted';
  }
}

function statusLabel(status: AgentData['status']): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'idle':
      return 'Idle';
    case 'error':
      return 'Error';
    case 'offline':
    default:
      return 'Offline';
  }
}

export default function AgentTooltip({ agent, position, visible }: AgentTooltipProps) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 w-64 rounded-lg border border-border bg-[#151929] p-3 shadow-xl shadow-black/40"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, 12px)',
      }}
    >
      {/* Status row */}
      <div className="mb-2.5 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className={cn('h-2.5 w-2.5 rounded-full', statusDotColor(agent.status))} />
          {agent.status === 'online' && (
            <span className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-status-green opacity-60" />
          )}
        </span>
        <span className="text-xs font-semibold text-text-primary">
          {statusLabel(agent.status)}
        </span>
        <span className="ml-auto text-[10px] text-text-muted">
          {formatRelativeTime(agent.lastActiveAt)}
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            Tokens In
          </span>
          <p className="text-sm font-semibold tabular-nums text-text-primary">
            {formatTokens(agent.tokensIn)}
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            Tokens Out
          </span>
          <p className="text-sm font-semibold tabular-nums text-text-primary">
            {formatTokens(agent.tokensOut)}
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            Cost (24h)
          </span>
          <p className="text-sm font-semibold tabular-nums text-text-primary">
            {formatCost(agent.costUSD)}
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            Model
          </span>
          <p className="truncate text-sm font-medium text-text-secondary">
            {agent.model}
          </p>
        </div>
      </div>

      {/* Provider */}
      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">
          Provider
        </span>
        <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-medium capitalize text-text-secondary">
          {agent.provider}
        </span>
      </div>
    </div>
  );
}
