"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { OfficeState } from '@/lib/office/engine/officeState';
import { EditorState } from '@/lib/office/editor/editorState';
import { OfficeCanvas as OfficeCanvasEngine } from '@/lib/office/components/OfficeCanvas';
import { AgentTooltip } from './AgentTooltip';
import { createKernOfficeLayoutV2 } from '@/lib/office/layout/layoutSerializer';
import { useDashboardStore } from '@/store/dashboard';
import { loadMetroCitySheets } from '@/lib/office/sprites/metrocityLoader';
import { loadDonargTileset } from '@/lib/office/sprites/donargTileset';
import type { AgentData } from '@/types';

/* ================================================================== */
/*  NAAB Council Agents                                                */
/*  The 3 on-call advisory board members placed in the council room.   */
/* ================================================================== */

const COUNCIL_AGENTS: ReadonlyArray<{
  id: string;
  name: string;
  role: string;
  model: string;
  status: 'idle';
  costUSD: number;
}> = [
  {
    id: 'naab-system-architect',
    name: 'System Architect',
    role: 'Technical Feasibility',
    model: 'Gemini 3.1 Pro',
    status: 'idle',
    costUSD: 0,
  },
  {
    id: 'naab-cost-optimizer',
    name: 'Cost Optimizer',
    role: 'Unit Economics',
    model: 'Kimi K2.5',
    status: 'idle',
    costUSD: 0,
  },
  {
    id: 'naab-gtm-strategist',
    name: 'GTM Strategist',
    role: 'Market Strategy',
    model: 'Claude Sonnet 4.5',
    status: 'idle',
    costUSD: 0,
  },
];

/** Council room seat UIDs from createKernOfficeLayoutV2() */
const COUNCIL_SEAT_IDS = [
  'conf-chair-top',
  'conf-chair-bot',
  'conf-chair-left',
];

const COUNCIL_ID_SET = new Set(COUNCIL_AGENTS.map((c) => c.id));

/* ================================================================== */
/*  Agent ID Mapper                                                    */
/*  Converts string agent IDs ↔ numeric IDs for the game engine.      */
/* ================================================================== */

class AgentIdMapper {
  private forward = new Map<string, number>();
  private reverse = new Map<number, string>();
  private next = 1;

  toNumeric(stringId: string): number {
    let n = this.forward.get(stringId);
    if (n === undefined) {
      n = this.next++;
      this.forward.set(stringId, n);
      this.reverse.set(n, stringId);
    }
    return n;
  }

  toString(numericId: number): string | undefined {
    return this.reverse.get(numericId);
  }
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

interface OfficeCanvasProps {
  agents: AgentData[];
}

export function OfficeCanvas({ agents }: OfficeCanvasProps) {
  /* ── Core game state (created once with Kern V2 layout) ──────── */
  const [officeState] = useState(() => new OfficeState(createKernOfficeLayoutV2()));
  const [editorState] = useState(() => new EditorState());
  const idMapperRef = useRef(new AgentIdMapper());

  /* ── Load sprite sheets (MetroCity characters + Donarg tileset) ── */
  useEffect(() => {
    loadMetroCitySheets().catch((err) => {
      console.warn('MetroCity sprites failed to load, falling back to procedural:', err);
    });
    loadDonargTileset().catch((err) => {
      console.warn('Donarg tileset failed to load, falling back to procedural sprites:', err);
    });
  }, []);

  /* ── Camera — auto-fit zoom to fill viewport ────────────────── */
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(3);
  const panRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = el.getBoundingClientRect();
    const canvasW = rect.width * dpr;
    const canvasH = rect.height * dpr;
    const layout = officeState.getLayout();
    const mapW = layout.cols * 16; // TILE_SIZE
    const mapH = layout.rows * 16;
    // Fit map to canvas with 5% padding
    const fitZoom = Math.min(canvasW / mapW, canvasH / mapH) * 0.92;
    // Clamp to integer zoom for crisp pixel art
    const clampedZoom = Math.max(1, Math.min(10, Math.round(fitZoom)));
    setZoom(clampedZoom);
  }, [officeState]);

  /* ── Dashboard store (agent selection → side panel) ──────────── */
  const setSelectedAgent = useDashboardStore((s) => s.setSelectedAgent);

  /* ── Tooltip state ───────────────────────────────────────────── */
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const tooltipPosRef = useRef({ x: 0, y: 0 });

  /* ── Combined agent lookup (API agents + council agents) ─────── */
  const agentLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        status: string;
        model: string;
        role: string;
        costUSD: number;
        currentTool?: string | null;
      }
    >();
    for (const a of agents) {
      map.set(a.id, a);
    }
    for (const c of COUNCIL_AGENTS) {
      map.set(c.id, c);
    }
    return map;
  }, [agents]);

  /* ── Sync agents into game state ────────────────────────────── */
  useEffect(() => {
    const mapper = idMapperRef.current;
    const expectedIds = new Set<number>();

    // 1. Ensure council agents exist in council room seats
    for (let i = 0; i < COUNCIL_AGENTS.length; i++) {
      const ca = COUNCIL_AGENTS[i];
      const numId = mapper.toNumeric(ca.id);
      expectedIds.add(numId);

      if (!officeState.characters.has(numId)) {
        // Place in specific council seat; skip spawn effect (always present)
        officeState.addAgent(numId, undefined, undefined, COUNCIL_SEAT_IDS[i], true);
      }
      // Council agents are on-call but not actively working
      officeState.setAgentActive(numId, false);
    }

    // 2. Sync API agents into main room
    for (const agent of agents) {
      const numId = mapper.toNumeric(agent.id);
      expectedIds.add(numId);

      if (!officeState.characters.has(numId)) {
        // New agent: spawn with matrix effect
        officeState.addAgent(numId);
      }

      // Sync active/inactive state
      const isActive = agent.status === 'online' || agent.status === 'idle';
      officeState.setAgentActive(numId, isActive);
    }

    // 3. Remove departed agents (skip sub-agents with negative IDs)
    for (const [charId] of officeState.characters) {
      if (charId < 0) continue;
      if (!expectedIds.has(charId)) {
        officeState.removeAgent(charId);
      }
    }
  }, [agents, officeState]);

  /* ── Click handler (legacy — fires on character hit) ─────────── */
  const handleClick = useCallback(
    (_numericId: number) => {
      // No-op: selection sync is handled via onSelectionChange
    },
    [],
  );

  /* ── Selection change handler (fires for select + deselect) ── */
  const handleSelectionChange = useCallback(
    (numericId: number | null) => {
      if (numericId === null) {
        // Deselected (clicked empty space or toggled off)
        setSelectedAgent(null);
        return;
      }
      const mapper = idMapperRef.current;
      const stringId = mapper.toString(numericId);
      if (!stringId) return;

      // Council agents get visual selection only (no side panel)
      if (COUNCIL_ID_SET.has(stringId)) return;

      setSelectedAgent(stringId);
    },
    [setSelectedAgent],
  );

  /* ── Hover handler ──────────────────────────────────────────── */
  const handleHover = useCallback(
    (numericId: number | null, screenX: number, screenY: number) => {
      // Store position for next render
      tooltipPosRef.current = { x: screenX, y: screenY };

      // Only trigger re-render when hovered agent changes
      const stringId =
        numericId !== null
          ? idMapperRef.current.toString(numericId) ?? null
          : null;
      setHoveredAgentId((prev) => (prev === stringId ? prev : stringId));
    },
    [],
  );

  /* ── Tooltip agent data ─────────────────────────────────────── */
  const tooltipAgent = hoveredAgentId
    ? agentLookup.get(hoveredAgentId) ?? null
    : null;

  /* ── No-op callbacks for editor mode (not used) ─────────────── */
  const noop = useCallback(() => {}, []);

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div ref={containerRef} className="relative h-full w-full">
      <OfficeCanvasEngine
        officeState={officeState}
        onClick={handleClick}
        onSelectionChange={handleSelectionChange}
        onHover={handleHover}
        isEditMode={false}
        editorState={editorState}
        onEditorTileAction={noop}
        onEditorEraseAction={noop}
        onEditorSelectionChange={noop}
        onDeleteSelected={noop}
        onRotateSelected={noop}
        onDragMove={noop}
        editorTick={0}
        zoom={zoom}
        onZoomChange={setZoom}
        panRef={panRef}
      />

      {/* Hover tooltip */}
      <AgentTooltip
        agent={
          tooltipAgent
            ? {
                id: tooltipAgent.id,
                name: tooltipAgent.name,
                status: tooltipAgent.status,
                model: tooltipAgent.model,
                role: tooltipAgent.role,
                costUSD: tooltipAgent.costUSD,
                currentTool: tooltipAgent.currentTool,
              }
            : null
        }
        x={tooltipPosRef.current.x}
        y={tooltipPosRef.current.y}
        visible={hoveredAgentId !== null}
      />
    </div>
  );
}
