'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { cn, formatCost } from '@/lib/utils';
import type { AgentData } from '@/types';
import AgentTooltip from '@/components/fleet/AgentTooltip';
import {
  Crown,
  Cpu,
  Zap,
} from 'lucide-react';

/* ──────────────────────────────────────────────
 *  Types
 * ────────────────────────────────────────────── */

interface OrgChartProps {
  agents: AgentData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Optional: agentId -> total active Agent Orchestrator sessions, rendered as a badge dot on each node. */
  sessionCounts?: Record<string, number>;
}

interface LayoutNode {
  agent: AgentData;
  x: number; // center x
  y: number; // center y
  children: LayoutNode[];
}

/* ──────────────────────────────────────────────
 *  Constants
 * ────────────────────────────────────────────── */

const NODE_W = 200;
const NODE_H = 88;
const H_GAP = 48;  // horizontal gap between sibling nodes
const V_GAP = 80;  // vertical gap between tiers

/* ──────────────────────────────────────────────
 *  Helpers
 * ────────────────────────────────────────────── */

function statusDotColor(status: AgentData['status']): string {
  switch (status) {
    case 'online':  return 'bg-status-green';
    case 'idle':    return 'bg-status-amber';
    case 'error':   return 'bg-status-red';
    default:        return 'bg-text-muted';
  }
}

function statusBorderColor(status: AgentData['status']): string {
  switch (status) {
    case 'online':  return 'border-emerald-500/40';
    case 'idle':    return 'border-amber-500/30';
    case 'error':   return 'border-red-500/40';
    default:        return 'border-border';
  }
}

function statusGlow(status: AgentData['status']): string {
  switch (status) {
    case 'online':  return 'shadow-emerald-500/10';
    case 'error':   return 'shadow-red-500/10';
    default:        return '';
  }
}

function roleIcon(role: AgentData['role']) {
  if (role === 'orchestrator') {
    return <Crown className="h-3.5 w-3.5 text-amber-400" />;
  }
  return <Cpu className="h-3.5 w-3.5 text-text-muted" />;
}

/* ──────────────────────────────────────────────
 *  Tree Layout Algorithm
 *  Positions orchestrator(s) at top, children
 *  evenly distributed below, centered under parent.
 * ────────────────────────────────────────────── */

function buildTree(agents: AgentData[]): LayoutNode[] {
  const orchs = agents.filter((a) => a.role === 'orchestrator');
  const subs = agents.filter((a) => a.role === 'sub-agent');

  // Map children to parents
  const childMap: Record<string, AgentData[]> = {};
  for (const sub of subs) {
    const pid = sub.parentId ?? '__orphan__';
    if (!childMap[pid]) childMap[pid] = [];
    childMap[pid].push(sub);
  }

  // Sort children alphabetically
  for (const key of Object.keys(childMap)) {
    childMap[key].sort((a, b) => a.name.localeCompare(b.name));
  }

  // If no orchestrators, treat all agents as root
  if (orchs.length === 0) {
    return agents.map((a, i) => ({
      agent: a,
      x: 0,
      y: 0,
      children: [],
    }));
  }

  // Build layout nodes
  const trees: LayoutNode[] = orchs.map((orch) => {
    const children = (childMap[orch.id] ?? []).map((child) => ({
      agent: child,
      x: 0,
      y: 0,
      children: [] as LayoutNode[],
    }));

    return {
      agent: orch,
      x: 0,
      y: 0,
      children,
    };
  });

  // Handle orphan sub-agents (parent not found among orchestrators)
  const orchIds = new Set(orchs.map((o) => o.id));
  const orphans = subs.filter(
    (s) => !s.parentId || !orchIds.has(s.parentId),
  );
  // Attach orphans to first orchestrator if available
  if (orphans.length > 0 && trees.length > 0) {
    for (const orphan of orphans) {
      if (!trees[0].children.find((c) => c.agent.id === orphan.id)) {
        trees[0].children.push({
          agent: orphan,
          x: 0,
          y: 0,
          children: [],
        });
      }
    }
  }

  return trees;
}

function layoutTree(roots: LayoutNode[], containerWidth: number): { nodes: LayoutNode[]; width: number; height: number } {
  if (roots.length === 0) return { nodes: [], width: 0, height: 0 };

  // For each root, determine total width needed
  function subtreeWidth(node: LayoutNode): number {
    if (node.children.length === 0) return NODE_W;
    const childrenTotal = node.children.reduce(
      (sum, child) => sum + subtreeWidth(child),
      0,
    );
    return Math.max(NODE_W, childrenTotal + H_GAP * (node.children.length - 1));
  }

  // Position nodes recursively
  function positionNode(node: LayoutNode, centerX: number, topY: number): void {
    node.x = centerX;
    node.y = topY + NODE_H / 2;

    if (node.children.length === 0) return;

    const totalW = node.children.reduce(
      (sum, child) => sum + subtreeWidth(child),
      0,
    ) + H_GAP * (node.children.length - 1);

    let startX = centerX - totalW / 2;

    for (const child of node.children) {
      const childW = subtreeWidth(child);
      const childCenterX = startX + childW / 2;
      positionNode(child, childCenterX, topY + NODE_H + V_GAP);
      startX += childW + H_GAP;
    }
  }

  // Layout all roots side by side
  let totalRootW = 0;
  const rootWidths: number[] = [];
  for (const root of roots) {
    const w = subtreeWidth(root);
    rootWidths.push(w);
    totalRootW += w;
  }
  totalRootW += H_GAP * (roots.length - 1);

  const startX = Math.max(containerWidth / 2, totalRootW / 2);
  let curX = startX - totalRootW / 2;
  const topY = 40;

  for (let i = 0; i < roots.length; i++) {
    const rootCenterX = curX + rootWidths[i] / 2;
    positionNode(roots[i], rootCenterX, topY);
    curX += rootWidths[i] + H_GAP;
  }

  // Collect all nodes flat + compute bounds
  const allNodes: LayoutNode[] = [];
  let maxX = 0;
  let maxY = 0;

  function collect(node: LayoutNode) {
    allNodes.push(node);
    maxX = Math.max(maxX, node.x + NODE_W / 2);
    maxY = Math.max(maxY, node.y + NODE_H / 2);
    for (const child of node.children) collect(child);
  }

  for (const root of roots) collect(root);

  return {
    nodes: allNodes,
    width: maxX + 40,
    height: maxY + 40,
  };
}

/* ──────────────────────────────────────────────
 *  SVG Connector Lines
 * ────────────────────────────────────────────── */

interface ConnectorProps {
  roots: LayoutNode[];
}

function Connectors({ roots }: ConnectorProps) {
  const lines: React.ReactNode[] = [];

  function drawLines(parent: LayoutNode) {
    for (const child of parent.children) {
      const x1 = parent.x;
      const y1 = parent.y + NODE_H / 2;
      const x2 = child.x;
      const y2 = child.y - NODE_H / 2;
      const midY = y1 + (y2 - y1) / 2;

      lines.push(
        <path
          key={`${parent.agent.id}-${child.agent.id}`}
          d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
          fill="none"
          stroke="url(#connector-gradient)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />,
      );

      // Animated pulse dot travelling along the line (for online children)
      if (child.agent.status === 'online') {
        lines.push(
          <circle key={`pulse-${child.agent.id}`} r="3" fill="#22c55e" opacity="0.8">
            <animateMotion
              dur="3s"
              repeatCount="indefinite"
              path={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
            />
          </circle>,
        );
      }

      drawLines(child);
    }
  }

  for (const root of roots) drawLines(root);

  return <>{lines}</>;
}

/* ──────────────────────────────────────────────
 *  Node Card Component
 * ────────────────────────────────────────────── */

interface NodeCardProps {
  node: LayoutNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onHover: (agent: AgentData | null, rect: DOMRect | null) => void;
  sessionCount?: number;
}

function NodeCard({ node, isSelected, onSelect, onHover, sessionCount }: NodeCardProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { agent } = node;

  const handleMouseEnter = () => {
    if (ref.current) {
      onHover(agent, ref.current.getBoundingClientRect());
    }
  };

  const handleMouseLeave = () => {
    onHover(null, null);
  };

  return (
    <button
      ref={ref}
      onClick={() => onSelect(agent.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'absolute flex flex-col items-center justify-center rounded-xl border bg-[#161b2e] px-4 py-3 transition-all duration-200',
        'hover:bg-[#1c2240] hover:scale-[1.03]',
        statusBorderColor(agent.status),
        statusGlow(agent.status),
        isSelected
          ? 'ring-2 ring-accent/60 shadow-lg shadow-accent/10 border-accent/40'
          : 'shadow-lg shadow-black/20',
      )}
      style={{
        left: node.x - NODE_W / 2,
        top: node.y - NODE_H / 2,
        width: NODE_W,
        height: NODE_H,
      }}
    >
      {/* Top row: icon + name + status */}
      <div className="flex w-full items-center gap-2">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-surface-hover">
          {roleIcon(agent.role)}
        </span>
        <span className="flex-1 truncate text-left text-sm font-semibold text-text-primary">
          {agent.name}
        </span>
        {!!sessionCount && (
          <span
            className="flex-shrink-0 rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-accent"
            title={`${sessionCount} active orchestrator session${sessionCount === 1 ? '' : 's'}`}
          >
            {sessionCount}
          </span>
        )}
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className={cn('h-2.5 w-2.5 rounded-full', statusDotColor(agent.status))} />
          {agent.status === 'online' && (
            <span className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-status-green opacity-60" />
          )}
        </span>
      </div>

      {/* Bottom row: model + cost */}
      <div className="mt-1.5 flex w-full items-center justify-between gap-2">
        <span className="truncate rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
          {agent.model}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold tabular-nums text-text-muted">
          <Zap className="h-2.5 w-2.5" />
          {formatCost(agent.costUSD)}
        </span>
      </div>
    </button>
  );
}

/* ──────────────────────────────────────────────
 *  OrgChart
 * ────────────────────────────────────────────── */

export default function OrgChart({ agents, selectedId, onSelect, sessionCounts }: OrgChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [tooltip, setTooltip] = useState<{
    agent: AgentData;
    position: { x: number; y: number };
  } | null>(null);

  // Observe container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Build & layout tree
  const { roots, layout } = useMemo(() => {
    const trees = buildTree(agents);
    const l = layoutTree(trees, containerWidth);
    return { roots: trees, layout: l };
  }, [agents, containerWidth]);

  // Tooltip handler
  const handleHover = useCallback(
    (agent: AgentData | null, rect: DOMRect | null) => {
      if (!agent || !rect) {
        setTooltip(null);
        return;
      }
      setTooltip({
        agent,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.bottom,
        },
      });
    },
    [],
  );

  if (agents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Cpu className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">No agents detected</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-auto"
    >
      {/* SVG connectors layer */}
      <svg
        className="pointer-events-none absolute inset-0"
        width={layout.width}
        height={layout.height}
        style={{ minWidth: '100%', minHeight: '100%' }}
      >
        <defs>
          <linearGradient id="connector-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <Connectors roots={roots} />
      </svg>

      {/* Node cards layer */}
      <div
        className="relative"
        style={{
          width: layout.width,
          height: layout.height,
          minWidth: '100%',
          minHeight: '100%',
        }}
      >
        {layout.nodes.map((node) => (
          <NodeCard
            key={node.agent.id}
            node={node}
            isSelected={node.agent.id === selectedId}
            onSelect={onSelect}
            onHover={handleHover}
            sessionCount={sessionCounts?.[node.agent.id]}
          />
        ))}
      </div>

      {/* Tooltip (portal-style, rendered at component level) */}
      {tooltip && (
        <AgentTooltip
          agent={tooltip.agent}
          position={tooltip.position}
          visible={true}
        />
      )}
    </div>
  );
}
