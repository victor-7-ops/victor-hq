'use client';

import { useMemo } from 'react';
import { cn, formatCost } from '@/lib/utils';
import type { AgentData } from '@/types';

interface AgentTreeProps {
  agents: AgentData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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

interface TreeNodeProps {
  agent: AgentData;
  children: AgentData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}

function TreeNode({ agent, children, selectedId, onSelect, depth }: TreeNodeProps) {
  const isSelected = agent.id === selectedId;

  return (
    <div>
      <button
        onClick={() => onSelect(agent.id)}
        className={cn(
          'flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover',
          isSelected && 'bg-surface-active',
        )}
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        {/* Status dot */}
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className={cn('h-2 w-2 rounded-full', statusDotColor(agent.status))} />
          {agent.status === 'online' && (
            <span className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-status-green opacity-75" />
          )}
        </span>

        {/* Agent info */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-text-primary">
              {agent.name}
            </span>
            <span className="flex-shrink-0 rounded bg-surface-hover px-1.5 py-px text-xs text-text-secondary">
              {agent.model}
            </span>
          </div>
          <span className="text-xs text-text-muted">
            {formatCost(agent.costUSD)} today
          </span>
        </div>
      </button>

      {/* Child agents */}
      {children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              agent={child}
              children={[]}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentTree({ agents, selectedId, onSelect }: AgentTreeProps) {
  const { orchestrators, childrenMap } = useMemo(() => {
    const orch: AgentData[] = [];
    const cMap: Record<string, AgentData[]> = {};

    for (const agent of agents) {
      if (agent.role === 'orchestrator') {
        orch.push(agent);
      } else if (agent.parentId) {
        if (!cMap[agent.parentId]) {
          cMap[agent.parentId] = [];
        }
        cMap[agent.parentId].push(agent);
      }
    }

    // Sort orchestrators by name
    orch.sort((a, b) => a.name.localeCompare(b.name));

    // Sort children within each parent by name
    for (const key of Object.keys(cMap)) {
      cMap[key].sort((a, b) => a.name.localeCompare(b.name));
    }

    return { orchestrators: orch, childrenMap: cMap };
  }, [agents]);

  if (agents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-text-muted">No agents detected</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Agent Fleet
        </h2>
      </div>

      {orchestrators.map((orch) => (
        <TreeNode
          key={orch.id}
          agent={orch}
          children={childrenMap[orch.id] ?? []}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={0}
        />
      ))}

      {/* Orphan sub-agents (no parent found in orchestrators) */}
      {agents
        .filter(
          (a) =>
            a.role === 'sub-agent' &&
            (!a.parentId || !orchestrators.find((o) => o.id === a.parentId)),
        )
        .map((agent) => (
          <TreeNode
            key={agent.id}
            agent={agent}
            children={[]}
            selectedId={selectedId}
            onSelect={onSelect}
            depth={0}
          />
        ))}
    </div>
  );
}
