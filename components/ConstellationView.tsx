"use client"

import { useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { useConstellationGraph } from "@/hooks/useConstellationGraph"
import NodeTooltip from "@/components/constellation/NodeTooltip"
import NodeDrawer from "@/components/constellation/NodeDrawer"
import type { ConstellationNode } from "@/types/constellation"
import { WifiOff, Cpu, Zap } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

const ConstellationCanvas = dynamic(
  () => import("@/components/constellation/ConstellationCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Skeleton width={200} height={12} />
          <Skeleton width={160} height={12} />
        </div>
      </div>
    ),
  },
)

export function ConstellationView() {
  const { data: graph, isLoading, isError } = useConstellationGraph()

  const [hoveredNode, setHoveredNode] = useState<ConstellationNode | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<ConstellationNode | null>(null)

  const handleNodeHover = useCallback(
    (node: ConstellationNode | null, x: number, y: number) => {
      setHoveredNode(node)
      setHoverPos({ x, y })
    },
    [],
  )

  const handleNodeClick = useCallback((node: ConstellationNode) => {
    setSelectedNode(node)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []
  const isLive = graph?.isLive ?? false

  const activeCount = nodes.filter((n) => n.status === "active").length
  const totalCount = nodes.length
  const totalTokens = nodes.reduce((sum, n) => sum + (n.tokensUsed24h ?? 0), 0)
  const totalCost = nodes.reduce((sum, n) => sum + (n.costUSD24h ?? 0), 0)

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "#0a0c14" }}>
      {/* Stats bar */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid var(--separator)",
          background: "rgba(15, 17, 23, 0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-4" style={{ fontSize: 12 }}>
          <div className="flex items-center gap-1.5">
            <Cpu style={{ width: 14, height: 14, color: "var(--text-tertiary)" }} />
            <span style={{ color: "var(--text-tertiary)" }}>Agents</span>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {activeCount}/{totalCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap style={{ width: 14, height: 14, color: "var(--text-tertiary)" }} />
            <span style={{ color: "var(--text-tertiary)" }}>Tokens</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>
              {formatTokens(totalTokens)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ color: "var(--text-tertiary)" }}>$</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>
              {totalCost.toFixed(4)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isLive && (
            <div
              className="flex items-center gap-1.5"
              style={{
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(255, 159, 10, 0.3)",
                background: "rgba(255, 159, 10, 0.1)",
                padding: "4px 10px",
                fontSize: 10,
                fontWeight: 500,
                color: "var(--system-orange)",
              }}
            >
              <WifiOff style={{ width: 12, height: 12 }} />
              Live data unavailable
            </div>
          )}
          {isLive && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex" style={{ width: 8, height: 8 }}>
                <span
                  className="absolute inset-0 animate-ping rounded-full"
                  style={{ background: "var(--system-green)", opacity: 0.75 }}
                />
                <span
                  className="relative rounded-full"
                  style={{ width: 8, height: 8, background: "var(--system-green)", display: "inline-flex" }}
                />
              </span>
              <span style={{ fontSize: 10, fontWeight: 500, color: "var(--system-green)" }}>LIVE</span>
            </div>
          )}
          {graph?.computedAt && (
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              Updated {formatRelative(graph.computedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div className="relative flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div
                className="mx-auto mb-3 animate-spin rounded-full"
                style={{
                  width: 32,
                  height: 32,
                  border: "2px solid var(--separator)",
                  borderTopColor: "var(--accent)",
                }}
              />
              <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Mapping constellation...</p>
            </div>
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <WifiOff style={{ width: 32, height: 32, color: "var(--text-tertiary)", opacity: 0.4, margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Failed to load agent data</p>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>Using fallback constellation</p>
            </div>
          </div>
        ) : (
          <ConstellationCanvas
            nodes={nodes}
            edges={edges}
            isLive={isLive}
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
          />
        )}

        {/* Hover tooltip */}
        {hoveredNode && !selectedNode && (
          <NodeTooltip node={hoveredNode} x={hoverPos.x} y={hoverPos.y} />
        )}

        {/* Legend */}
        <div
          className="absolute bottom-4 left-4 flex flex-col gap-2"
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--separator)",
            background: "rgba(15, 17, 23, 0.8)",
            backdropFilter: "blur(12px)",
            padding: "12px 14px",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 2 }}>
            Status
          </span>
          <LegendDot color="var(--system-green)" label="Active" />
          <LegendDot color="var(--system-orange)" label="Idle" />
          <LegendDot color="var(--system-red)" label="Error" />
          <LegendDot color="var(--text-tertiary)" label="Offline" />
          <div style={{ height: 1, background: "var(--separator)", margin: "4px 0" }} />
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 2 }}>
            Edges
          </span>
          <div className="flex items-center gap-2">
            <div style={{ height: 2, width: 16, background: "rgba(59, 130, 246, 0.4)", borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Delegation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" style={{ height: 2, width: 16, background: "rgba(59, 130, 246, 0.2)", borderRadius: 1 }}>
              <div style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", width: 4, height: 4, borderRadius: "50%", background: "var(--system-blue)" }} />
            </div>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Pulse = Event</span>
          </div>
        </div>

        {/* Interaction hint */}
        <div
          className="absolute bottom-4 right-4"
          style={{ fontSize: 10, color: "var(--text-tertiary)", opacity: 0.6, fontStyle: "italic" }}
        >
          Hover to inspect &middot; Click to drill down
        </div>
      </div>

      {/* Node Detail Drawer */}
      <NodeDrawer node={selectedNode} onClose={handleCloseDrawer} />
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{label}</span>
    </div>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60000) return "just now"
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return `${Math.floor(ms / 86400000)}d ago`
}
