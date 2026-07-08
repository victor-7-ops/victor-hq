"use client";

import type {
  MemoryConfig,
  MemoryStatus,
  MemoryStats,
  MemoryHealthSummary,
  MemoryHealthCheck,
  HealthSeverity,
} from "@/lib/types";
import { AlertTriangle, AlertCircle, Info, RotateCw, Zap } from "lucide-react";
import { timeAgo } from "@/lib/cron-utils";
import { formatBytes } from "./helpers";

/* ─── Overview: Stat Cards ───────────────────────────────────── */

export function FilesCard({ stats }: { stats: MemoryStats }) {
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-1)",
        }}
      >
        Files
      </div>
      <div
        style={{
          fontSize: "var(--text-title2)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-primary)",
        }}
      >
        {stats.totalFiles}
      </div>
      <div
        style={{
          fontSize: "var(--text-caption2)",
          color: "var(--text-tertiary)",
          marginTop: 2,
        }}
      >
        {stats.evergreenCount} evergreen {"·"} {stats.dailyLogCount} daily
      </div>
    </div>
  );
}

export function SizeCard({ stats }: { stats: MemoryStats }) {
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-1)",
        }}
      >
        Size
      </div>
      <div
        style={{
          fontSize: "var(--text-title2)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-primary)",
        }}
      >
        {formatBytes(stats.totalSizeBytes)}
      </div>
      {stats.oldestDaily && stats.newestDaily && (
        <div
          style={{
            fontSize: "var(--text-caption2)",
            color: "var(--text-tertiary)",
            marginTop: 2,
          }}
        >
          {stats.oldestDaily} to {stats.newestDaily}
        </div>
      )}
    </div>
  );
}

export function IndexCard({ status }: { status: MemoryStatus }) {
  const dotColor = status.indexed ? "var(--system-green)" : "var(--text-tertiary)";
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-1)",
        }}
      >
        Index
      </div>
      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "var(--text-footnote)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-primary)",
          }}
        >
          {status.indexed ? "Indexed" : "Not indexed"}
        </span>
      </div>
      <div
        style={{
          fontSize: "var(--text-caption2)",
          color: "var(--text-tertiary)",
          marginTop: 2,
        }}
      >
        {status.lastIndexed ? `Last: ${timeAgo(status.lastIndexed)}` : "No index data"}
        {status.embeddingProvider && ` · ${status.embeddingProvider}`}
      </div>
    </div>
  );
}

/* ─── Overview: Memory Timeline ──────────────────────────────── */

export function MemoryTimeline({ timeline }: { timeline: MemoryStats["dailyTimeline"] }) {
  const maxSize = Math.max(...timeline.map((d) => d?.sizeBytes ?? 0), 1);
  const barWidth = 10;
  const gap = 3;
  const chartWidth = timeline.length * (barWidth + gap) - gap;
  const chartHeight = 80;
  const padding = 20;

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-3)",
        }}
      >
        Daily Log Timeline (30 days)
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${chartWidth + 2} ${chartHeight + padding}`}
        style={{ display: "block" }}
      >
        {/* Baseline */}
        <line
          x1="0"
          y1={chartHeight}
          x2={chartWidth}
          y2={chartHeight}
          stroke="var(--separator)"
          strokeWidth="1"
        />
        {timeline.map((entry, i) => {
          const x = i * (barWidth + gap);
          if (!entry) {
            return (
              <rect
                key={i}
                x={x}
                y={chartHeight - 2}
                width={barWidth}
                height={2}
                rx={1}
                fill="var(--fill-tertiary)"
              />
            );
          }
          const h = Math.max(4, (entry.sizeBytes / maxSize) * chartHeight);
          return (
            <g key={i}>
              <rect
                x={x}
                y={chartHeight - h}
                width={barWidth}
                height={h}
                rx={2}
                fill="var(--accent)"
                opacity={0.8}
              />
              <title>
                {entry.date}: {formatBytes(entry.sizeBytes)}
              </title>
            </g>
          );
        })}
        {/* Date labels: first, middle, last */}
        {[0, 14, 29].map((idx) => {
          const entry = timeline[idx];
          const x = idx * (barWidth + gap) + barWidth / 2;
          const label = entry?.date?.slice(5) ?? "";
          if (!label) {
            // Compute date from index
            const d = new Date();
            d.setDate(d.getDate() - (29 - idx));
            const fallback = d.toISOString().slice(5, 10);
            return (
              <text
                key={idx}
                x={x}
                y={chartHeight + 14}
                textAnchor="middle"
                fill="var(--text-tertiary)"
                fontSize="8"
              >
                {fallback}
              </text>
            );
          }
          return (
            <text
              key={idx}
              x={x}
              y={chartHeight + 14}
              textAnchor="middle"
              fill="var(--text-tertiary)"
              fontSize="8"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Overview: Config Panel ─────────────────────────────────── */

export function ConfigPanel({ config }: { config: MemoryConfig }) {
  const { memorySearch, memoryFlush, configFound } = config;
  const ms = {
    enabled: memorySearch?.enabled ?? false,
    provider: memorySearch?.provider,
    model: memorySearch?.model,
    hybrid: {
      enabled: memorySearch?.hybrid?.enabled ?? false,
      vectorWeight: memorySearch?.hybrid?.vectorWeight ?? 0.5,
      textWeight: memorySearch?.hybrid?.textWeight ?? 0.5,
      temporalDecay: {
        enabled: memorySearch?.hybrid?.temporalDecay?.enabled ?? false,
        halfLifeDays: memorySearch?.hybrid?.temporalDecay?.halfLifeDays ?? 30,
      },
      mmr: {
        enabled: memorySearch?.hybrid?.mmr?.enabled ?? false,
        lambda: memorySearch?.hybrid?.mmr?.lambda ?? 0.5,
      },
    },
  };
  const mf = {
    enabled: memoryFlush?.enabled ?? false,
    softThresholdTokens: memoryFlush?.softThresholdTokens ?? 0,
  };
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-3)",
        }}
      >
        Configuration
      </div>

      {!configFound && (
        <div
          style={{
            background: "var(--fill-secondary)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--text-caption1)",
            color: "var(--text-tertiary)",
            marginBottom: "var(--space-3)",
          }}
        >
          Using OpenClaw defaults (no explicit memorySearch config)
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "var(--space-1) var(--space-4)",
          fontSize: "var(--text-caption1)",
        }}
      >
        <span style={{ color: "var(--text-tertiary)" }}>Search</span>
        <span style={{ color: ms.enabled ? "var(--system-green)" : "var(--text-secondary)" }}>
          {ms.enabled ? "Enabled" : "Disabled"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>Provider</span>
        <span style={{ color: "var(--text-secondary)" }}>{ms.provider ?? "None"}</span>

        <span style={{ color: "var(--text-tertiary)" }}>Model</span>
        <span className="font-mono" style={{ color: "var(--text-secondary)", fontSize: "var(--text-caption2)" }}>
          {ms.model ?? "None"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>Hybrid</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {ms.hybrid.enabled
            ? `Vector ${ms.hybrid.vectorWeight} / Text ${ms.hybrid.textWeight}`
            : "Disabled"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>Decay</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {ms.hybrid.temporalDecay.enabled
            ? `Half-life: ${ms.hybrid.temporalDecay.halfLifeDays}d`
            : "Disabled"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>MMR</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {ms.hybrid.mmr.enabled ? `λ = ${ms.hybrid.mmr.lambda}` : "Disabled"}
        </span>

        <span style={{ color: "var(--text-tertiary)" }}>Flush</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {mf.enabled ? `Threshold: ${(mf.softThresholdTokens / 1000).toFixed(0)}k tokens` : "Disabled"}
        </span>
      </div>
    </div>
  );
}

/* ─── Overview: Health Score Card ────────────────────────────── */

export function healthScoreColor(score: number): string {
  if (score >= 80) return "var(--system-green)";
  if (score >= 60) return "var(--system-orange)";
  return "var(--system-red)";
}

export function HealthHero({
  health,
  stats,
  status,
}: {
  health: MemoryHealthSummary;
  stats: MemoryStats;
  status: MemoryStatus;
}) {
  const criticals = health.checks.filter((c) => c.severity === "critical").length;
  const warnings = health.checks.filter((c) => c.severity === "warning").length;
  const color = healthScoreColor(health.score);
  const dotColor = status.indexed ? "var(--system-green)" : "var(--text-tertiary)";

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-4)",
        flexWrap: "wrap",
      }}
    >
      {/* Left: Health score + severity */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
        <span
          style={{
            fontSize: 36,
            fontWeight: "var(--weight-bold)",
            color,
            lineHeight: 1,
          }}
        >
          {health.score}
        </span>
        <div>
          <div
            style={{
              fontSize: "var(--text-footnote)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            Health Score
          </div>
          <div
            style={{
              fontSize: "var(--text-caption1)",
              color: "var(--text-tertiary)",
              marginTop: 2,
            }}
          >
            {criticals > 0 && (
              <span style={{ color: "var(--system-red)" }}>
                {criticals} critical
              </span>
            )}
            {criticals > 0 && warnings > 0 && " · "}
            {warnings > 0 && (
              <span style={{ color: "var(--system-orange)" }}>
                {warnings} warning{warnings !== 1 ? "s" : ""}
              </span>
            )}
            {criticals === 0 && warnings === 0 && "All clear"}
          </div>
        </div>
      </div>

      {/* Right: Stat pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          fontSize: "var(--text-caption1)",
          color: "var(--text-secondary)",
          flexWrap: "wrap",
        }}
      >
        <span>{stats.totalFiles} files</span>
        <span style={{ color: "var(--text-tertiary)" }}>{"·"}</span>
        <span>{formatBytes(stats.totalSizeBytes)}</span>
        <span style={{ color: "var(--text-tertiary)" }}>{"·"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: dotColor,
              flexShrink: 0,
            }}
          />
          {status.indexed ? "Indexed" : "Not indexed"}
        </span>
      </div>
    </div>
  );
}

/* ─── Overview: Health Checks List ──────────────────────────── */

const SEVERITY_ICON_MAP: Record<
  Exclude<HealthSeverity, "ok">,
  { Icon: typeof AlertTriangle; color: string }
> = {
  critical: { Icon: AlertCircle, color: "var(--system-red)" },
  warning: { Icon: AlertTriangle, color: "var(--system-orange)" },
  info: { Icon: Info, color: "var(--text-tertiary)" },
};

export function HealthChecksList({
  checks,
  onCheckAction,
  onViewFile,
  onReindex,
}: {
  checks: MemoryHealthCheck[];
  onCheckAction?: (check: MemoryHealthCheck) => void;
  onViewFile?: (relativePath: string) => void;
  onReindex?: () => void;
}) {
  if (checks.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-3)",
        }}
      >
        Health Checks
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {checks.map((check) => {
          const severity = check.severity === "ok" ? "info" : check.severity;
          const { Icon, color } = SEVERITY_ICON_MAP[severity];
          const isIndexCheck = check.id === "unindexed-vector" || check.id === "stale-index";
          return (
            <div key={check.id} className="flex items-start" style={{ gap: "var(--space-2)" }}>
              <Icon size={14} style={{ color, flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: "var(--text-footnote)",
                    fontWeight: "var(--weight-semibold)",
                    color: "var(--text-primary)",
                  }}
                >
                  {check.title}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-caption1)",
                    color: "var(--text-secondary)",
                    lineHeight: "var(--leading-relaxed)",
                    marginTop: 2,
                  }}
                >
                  {check.description}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  {onCheckAction && (
                    <button
                      onClick={() => onCheckAction(check)}
                      className="btn-ghost focus-ring"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background: "var(--fill-secondary)",
                        border: "1px solid var(--separator)",
                        color: "var(--accent)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Zap size={10} />
                      How to fix
                    </button>
                  )}
                  {check.affectedFiles && check.affectedFiles.length > 0 && onViewFile && (
                    <button
                      onClick={() => onViewFile(check.affectedFiles![0])}
                      className="btn-ghost focus-ring"
                      style={{
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 500,
                        background: "var(--fill-secondary)",
                        border: "1px solid var(--separator)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      View
                    </button>
                  )}
                  {isIndexCheck && onReindex && (
                    <button
                      onClick={onReindex}
                      className="btn-ghost focus-ring"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 500,
                        background: "var(--fill-secondary)",
                        border: "1px solid var(--separator)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <RotateCw size={10} />
                      Reindex now
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Overview: Stale Daily Logs Card ───────────────────────── */

export function StaleDailyLogsCard({ health }: { health: MemoryHealthSummary }) {
  const logs = health.staleDailyLogs;
  if (logs.length === 0) return null;

  const totalSize = logs.reduce((s, l) => s + l.sizeBytes, 0);

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-tertiary)",
          fontWeight: "var(--weight-medium)",
          marginBottom: "var(--space-3)",
        }}
      >
        Stale Daily Logs ({logs.length})
      </div>
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-secondary)",
          marginBottom: "var(--space-3)",
          lineHeight: "var(--leading-relaxed)",
        }}
      >
        {logs.length} daily log{logs.length !== 1 ? "s" : ""} older than 30 days ({formatBytes(totalSize)} total).
        Review for patterns worth promoting to evergreen files, then delete the rest.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {logs.slice(0, 10).map((log) => (
          <div
            key={log.relativePath}
            className="flex items-center justify-between"
            style={{
              padding: "var(--space-1) var(--space-2)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-caption2)",
            }}
          >
            <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
              {log.date}
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>
              {log.ageDays}d {"·"} {formatBytes(log.sizeBytes)}
            </span>
          </div>
        ))}
        {logs.length > 10 && (
          <div
            style={{
              fontSize: "var(--text-caption2)",
              color: "var(--text-tertiary)",
              padding: "var(--space-1) var(--space-2)",
            }}
          >
            +{logs.length - 10} more
          </div>
        )}
      </div>
    </div>
  );
}
