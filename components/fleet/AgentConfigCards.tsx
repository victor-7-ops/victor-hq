'use client';

import { cn } from '@/lib/utils';
import { Bot, Layers, FolderOpen } from 'lucide-react';

interface AgentConfig {
  id: string;
  name: string;
  model: string;
  status: string;
  role: string;
  fallbacks?: string[];
}

interface Props {
  agents: AgentConfig[];
}

function statusDotColor(status: string): string {
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

function roleBadge(role: string) {
  const isOrch = role === 'orchestrator';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        isOrch
          ? 'bg-accent/15 text-accent'
          : 'bg-surface-hover text-text-secondary',
      )}
    >
      {isOrch ? (
        <Layers className="h-2.5 w-2.5" />
      ) : (
        <FolderOpen className="h-2.5 w-2.5" />
      )}
      {isOrch ? 'orch' : 'sub'}
    </span>
  );
}

export default function AgentConfigCards({ agents }: Props) {
  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-text-muted">
        No agents configured
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="min-w-[200px] rounded-lg border border-border bg-surface p-3"
        >
          {/* Header: name + status */}
          <div className="mb-2 flex items-center gap-2">
            <Bot className="h-4 w-4 shrink-0 text-text-muted" />
            <span className="flex-1 truncate text-sm font-medium text-text-primary">
              {agent.name}
            </span>
            <span className="relative flex">
              <span
                className={cn('h-2 w-2 rounded-full', statusDotColor(agent.status))}
              />
              {agent.status === 'online' && (
                <span className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-status-green opacity-75" />
              )}
            </span>
          </div>

          {/* ID */}
          <p className="mb-1.5 truncate text-[11px] text-text-muted">{agent.id}</p>

          {/* Model */}
          <div className="mb-2 rounded border border-border bg-[#0d1017] px-2 py-1 text-xs font-mono text-text-secondary">
            {agent.model}
          </div>

          {/* Fallback models */}
          {agent.fallbacks && agent.fallbacks.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {agent.fallbacks.map((fb, i) => (
                <span
                  key={i}
                  className="inline-block rounded border border-border bg-surface-hover px-1.5 py-0.5 text-[10px] font-mono text-text-muted"
                >
                  {fb}
                </span>
              ))}
            </div>
          )}

          {/* Role badge + status label */}
          <div className="flex items-center justify-between">
            {roleBadge(agent.role)}
            <span className="text-[11px] capitalize text-text-muted">
              {agent.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
