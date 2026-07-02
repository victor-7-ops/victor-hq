'use client';

import { memo } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AgentTooltipProps {
  agent: {
    id: string;
    name: string;
    status: string;
    model: string;
    role: string;
    costUSD: number;
    currentTool?: string | null;
  } | null;
  x: number;
  y: number;
  visible: boolean;
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const STATUS_DOT_COLOR: Record<string, string> = {
  online: 'bg-emerald-400',
  idle: 'bg-amber-400',
  error: 'bg-red-400',
  offline: 'bg-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  error: 'Error',
  offline: 'Offline',
};

const ROLE_LABEL: Record<string, string> = {
  orchestrator: 'Orchestrator',
  'sub-agent': 'Sub-agent',
};

function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AgentTooltip = memo(function AgentTooltip({
  agent,
  x,
  y,
  visible,
}: AgentTooltipProps) {
  const show = visible && agent !== null;

  return (
    <div
      className="pointer-events-none fixed z-50 max-w-[240px] rounded-lg border border-[#2a2d3e] bg-[#1a1d2e] px-3 py-2.5 shadow-xl transition-all duration-150 ease-out"
      style={{
        left: x,
        top: y - 10,
        transform: 'translate(-50%, -100%)',
        opacity: show ? 1 : 0,
        transformOrigin: 'bottom center',
      }}
      aria-hidden={!show}
    >
      {agent && (
        <>
          {/* Name */}
          <p className="truncate text-sm font-semibold text-white">
            {agent.name}
          </p>

          {/* Status pill */}
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                STATUS_DOT_COLOR[agent.status] ?? STATUS_DOT_COLOR.offline
              }`}
            />
            <span className="text-xs text-gray-400">
              {STATUS_LABEL[agent.status] ?? 'Offline'}
            </span>
          </div>

          {/* Details */}
          <div className="mt-1.5 space-y-0.5 text-xs text-gray-400">
            <Row label="Model" value={agent.model} mono />
            <Row
              label="Role"
              value={ROLE_LABEL[agent.role] ?? agent.role}
            />
            {agent.currentTool && (
              <Row label="Tool" value={agent.currentTool} mono />
            )}
            <Row label="Cost today" value={formatCost(agent.costUSD)} mono />
          </div>
        </>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Row helper                                                         */
/* ------------------------------------------------------------------ */

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex-shrink-0 text-gray-500">{label}</span>
      <span
        className={`truncate text-right text-gray-300 ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

export default AgentTooltip;
