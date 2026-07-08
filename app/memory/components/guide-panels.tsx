"use client";

import type { MemoryConfig } from "@/lib/types";

/* ─── Guide: Decay Visualizer ────────────────────────────────── */

export function DecayVisualizer({ config }: { config: MemoryConfig }) {
  const decay = config.memorySearch?.hybrid?.temporalDecay;
  const halfLife = decay?.halfLifeDays ?? 30;
  const enabled = decay?.enabled ?? false;
  const chartW = 360;
  const chartH = 120;
  const padX = 40;
  const padY = 20;
  const innerW = chartW - padX;
  const innerH = chartH - padY;
  const maxDays = 180;

  // Build curve points
  const points: string[] = [];
  for (let d = 0; d <= maxDays; d += 2) {
    const score = Math.exp((-Math.LN2 / halfLife) * d) * 100;
    const x = padX + (d / maxDays) * innerW;
    const y = padY + innerH - (score / 100) * innerH;
    points.push(`${x},${y}`);
  }
  // Close area
  const areaPoints = [
    ...points,
    `${padX + innerW},${padY + innerH}`,
    `${padX},${padY + innerH}`,
  ].join(" ");
  const linePoints = points.join(" ");

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        position: "relative",
      }}
    >
      <div className="flex items-center" style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <span
          style={{
            fontSize: "var(--text-caption1)",
            color: "var(--text-tertiary)",
            fontWeight: "var(--weight-medium)",
          }}
        >
          Temporal Decay Curve
        </span>
        {!enabled && (
          <span
            style={{
              fontSize: "var(--text-caption2)",
              color: "var(--system-orange)",
              background: "rgba(255,149,0,0.1)",
              padding: "1px 8px",
              borderRadius: 10,
              fontWeight: "var(--weight-medium)",
            }}
          >
            Disabled
          </span>
        )}
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${chartW} ${chartH}`}
        style={{ display: "block", opacity: enabled ? 1 : 0.35 }}
      >
        {/* Y-axis labels */}
        {[0, 50, 100].map((pct) => {
          const y = padY + innerH - (pct / 100) * innerH;
          return (
            <g key={pct}>
              <line
                x1={padX}
                y1={y}
                x2={padX + innerW}
                y2={y}
                stroke="var(--separator)"
                strokeWidth="0.5"
                strokeDasharray={pct === 0 ? "0" : "3,3"}
              />
              <text
                x={padX - 4}
                y={y + 3}
                textAnchor="end"
                fill="var(--text-tertiary)"
                fontSize="8"
              >
                {pct}%
              </text>
            </g>
          );
        })}

        {/* Half-life markers */}
        {[1, 2, 3].map((mult) => {
          const d = halfLife * mult;
          if (d > maxDays) return null;
          const x = padX + (d / maxDays) * innerW;
          return (
            <g key={mult}>
              <line
                x1={x}
                y1={padY}
                x2={x}
                y2={padY + innerH}
                stroke="var(--text-tertiary)"
                strokeWidth="0.5"
                strokeDasharray="4,4"
              />
              <text
                x={x}
                y={chartH - 2}
                textAnchor="middle"
                fill="var(--text-tertiary)"
                fontSize="7"
              >
                {d}d
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <polygon points={areaPoints} fill="var(--accent)" opacity={0.1} />

        {/* Curve line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X-axis labels */}
        <text x={padX} y={chartH - 2} textAnchor="start" fill="var(--text-tertiary)" fontSize="7">
          0d
        </text>
        <text x={padX + innerW} y={chartH - 2} textAnchor="end" fill="var(--text-tertiary)" fontSize="7">
          {maxDays}d
        </text>
      </svg>
    </div>
  );
}

/* ─── Guide: Hybrid Balance Bar ──────────────────────────────── */

export function HybridBalanceBar({ config }: { config: MemoryConfig }) {
  const hybrid = config.memorySearch?.hybrid;
  const vectorWeight = hybrid?.vectorWeight ?? 0.5;
  const textWeight = hybrid?.textWeight ?? 0.5;
  const enabled = hybrid?.enabled ?? false;
  const vPct = vectorWeight * 100;
  const tPct = textWeight * 100;

  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div className="flex items-center" style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <span
          style={{
            fontSize: "var(--text-caption1)",
            color: "var(--text-tertiary)",
            fontWeight: "var(--weight-medium)",
          }}
        >
          Hybrid Search Balance
        </span>
        {!enabled && (
          <span
            style={{
              fontSize: "var(--text-caption2)",
              color: "var(--system-orange)",
              background: "rgba(255,149,0,0.1)",
              padding: "1px 8px",
              borderRadius: 10,
              fontWeight: "var(--weight-medium)",
            }}
          >
            Disabled
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          height: 24,
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          opacity: enabled ? 1 : 0.35,
        }}
      >
        <div
          style={{
            width: `${vPct}%`,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, color: "white" }}>
            Vector {vPct.toFixed(0)}%
          </span>
        </div>
        <div
          style={{
            width: `${tPct}%`,
            background: "var(--system-blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, color: "white" }}>
            Text {tPct.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Guide: Best Practices ──────────────────────────────────── */

const BEST_PRACTICE_SECTIONS = [
  {
    title: "Writing to Memory",
    color: "var(--system-green)",
    tips: [
      { do: true, text: "Keep MEMORY.md concise -- curated facts, not running logs" },
      { do: true, text: "Use daily logs (YYYY-MM-DD.md) for ephemeral session context" },
      { do: false, text: "Don't dump raw conversation transcripts into memory files" },
      { do: true, text: "Structure entries with clear headers so search can find them" },
    ],
  },
  {
    title: "Search & Retrieval",
    color: "var(--system-blue)",
    tips: [
      { do: true, text: "Enable hybrid search -- combines semantic + keyword matching" },
      { do: true, text: "Turn on MMR (Maximal Marginal Relevance) to reduce duplicate results" },
      { do: true, text: "Configure temporal decay so stale daily logs rank lower over time" },
      { do: false, text: "Don't set half-life too short -- important context needs time to be useful" },
    ],
  },
  {
    title: "Maintenance",
    color: "var(--system-orange)",
    tips: [
      { do: true, text: "Review and prune old daily logs periodically" },
      { do: true, text: "Promote recurring patterns from daily logs into evergreen files" },
      { do: true, text: "Enable memory flush to auto-compact context before token limits" },
      { do: false, text: "Don't let MEMORY.md grow past ~200 lines -- split into topic files" },
    ],
  },
];

export function BestPractices() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {BEST_PRACTICE_SECTIONS.map((section) => (
        <div
          key={section.title}
          style={{
            background: "var(--material-regular)",
            border: "1px solid var(--separator)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-4)",
          }}
        >
          <div
            className="flex items-center"
            style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: section.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "var(--text-footnote)",
                color: "var(--text-primary)",
                fontWeight: "var(--weight-semibold)",
              }}
            >
              {section.title}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {section.tips.map((tip, i) => (
              <div key={i} className="flex items-start" style={{ gap: "var(--space-2)" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 3,
                    flexShrink: 0,
                    marginTop: 1,
                    lineHeight: "14px",
                    background: tip.do ? "rgba(48,209,88,0.12)" : "rgba(255,69,58,0.12)",
                    color: tip.do ? "var(--system-green)" : "var(--system-red)",
                  }}
                >
                  {tip.do ? "DO" : "DON'T"}
                </span>
                <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)", lineHeight: "var(--leading-relaxed)" }}>
                  {tip.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Guide: File Reference ──────────────────────────────────── */

const FILE_REFERENCE = [
  { path: "MEMORY.md", purpose: "Long-term curated facts", decay: "Low (evergreen)" },
  { path: "memory/team-memory.md", purpose: "Shared team knowledge", decay: "Low (evergreen)" },
  { path: "memory/team-intel.json", purpose: "Structured team data", decay: "Low (evergreen)" },
  { path: "memory/YYYY-MM-DD.md", purpose: "Daily ephemeral context", decay: "High (temporal)" },
];

export function FileReference() {
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
        File Reference
      </div>
      <div style={{ overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "var(--text-caption1)",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  color: "var(--text-tertiary)",
                  fontWeight: "var(--weight-medium)",
                  padding: "var(--space-1) var(--space-2)",
                  borderBottom: "1px solid var(--separator)",
                }}
              >
                Path
              </th>
              <th
                style={{
                  textAlign: "left",
                  color: "var(--text-tertiary)",
                  fontWeight: "var(--weight-medium)",
                  padding: "var(--space-1) var(--space-2)",
                  borderBottom: "1px solid var(--separator)",
                }}
              >
                Purpose
              </th>
              <th
                style={{
                  textAlign: "left",
                  color: "var(--text-tertiary)",
                  fontWeight: "var(--weight-medium)",
                  padding: "var(--space-1) var(--space-2)",
                  borderBottom: "1px solid var(--separator)",
                }}
              >
                Decay
              </th>
            </tr>
          </thead>
          <tbody>
            {FILE_REFERENCE.map((row) => (
              <tr key={row.path}>
                <td
                  className="font-mono"
                  style={{
                    color: "var(--text-primary)",
                    padding: "var(--space-1) var(--space-2)",
                    fontSize: "var(--text-caption2)",
                  }}
                >
                  {row.path}
                </td>
                <td
                  style={{
                    color: "var(--text-secondary)",
                    padding: "var(--space-1) var(--space-2)",
                  }}
                >
                  {row.purpose}
                </td>
                <td
                  style={{
                    color: "var(--text-tertiary)",
                    padding: "var(--space-1) var(--space-2)",
                  }}
                >
                  {row.decay}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Guide: Flush Section ───────────────────────────────────── */

export function FlushSection({ config }: { config: MemoryConfig }) {
  const mf = config.memoryFlush;
  return (
    <div
      style={{
        background: "var(--material-regular)",
        border: "1px solid var(--separator)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div className="flex items-center" style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <span
          style={{
            fontSize: "var(--text-caption1)",
            color: "var(--text-tertiary)",
            fontWeight: "var(--weight-medium)",
          }}
        >
          Memory Flush
        </span>
        <span
          style={{
            fontSize: "var(--text-caption2)",
            color: mf.enabled ? "var(--system-green)" : "var(--text-tertiary)",
            background: mf.enabled ? "rgba(52,199,89,0.1)" : "var(--fill-secondary)",
            padding: "1px 8px",
            borderRadius: 10,
            fontWeight: "var(--weight-medium)",
          }}
        >
          {mf.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
      <p
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-secondary)",
          lineHeight: "var(--leading-relaxed)",
          margin: 0,
        }}
      >
        When enabled, OpenClaw compacts conversation context by flushing
        important facts to memory files when the context reaches{" "}
        <strong style={{ color: "var(--text-primary)" }}>
          {(mf.softThresholdTokens / 1000).toFixed(0)}k tokens
        </strong>
        . This prevents context window overflow while preserving key information.
      </p>
    </div>
  );
}
