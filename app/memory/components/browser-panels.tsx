"use client";

import type { MemoryFileCategory, HealthSeverity, ReindexStatus, EditingHint } from "@/lib/types";
import { RotateCw } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "./helpers";

/* ─── Browser: Category Badge ────────────────────────────────── */

export function CategoryBadge({ category }: { category: MemoryFileCategory }) {
  return (
    <span
      style={{
        fontSize: "var(--text-caption2)",
        color: CATEGORY_COLORS[category],
        background: `color-mix(in srgb, ${CATEGORY_COLORS[category]} 12%, transparent)`,
        padding: "1px 6px",
        borderRadius: 8,
        fontWeight: "var(--weight-medium)",
        flexShrink: 0,
      }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

/* ─── Browser: Health Badge ─────────────────────────────────── */

const HEALTH_BADGE_COLORS: Record<HealthSeverity, string | null> = {
  critical: "var(--system-red)",
  warning: "var(--system-orange)",
  info: "var(--text-tertiary)",
  ok: null,
};

export function HealthBadge({ severity }: { severity: HealthSeverity }) {
  const color = HEALTH_BADGE_COLORS[severity];
  if (!color) return null;

  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
      title={`Health: ${severity}`}
    />
  );
}

/* ─── Browser: Reindex Button ───────────────────────────────── */

export function ReindexButton({
  status,
  onReindex,
}: {
  status: ReindexStatus;
  onReindex: () => void;
}) {
  if (status === "unavailable") return null;

  const isRunning = status === "running";
  const isSuccess = status === "success";

  return (
    <button
      onClick={onReindex}
      disabled={isRunning}
      className="btn-ghost focus-ring"
      style={{
        padding: "6px 12px",
        borderRadius: "var(--radius-sm)",
        fontSize: "var(--text-caption1)",
        fontWeight: "var(--weight-medium)",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: isSuccess ? "var(--system-green)" : undefined,
        cursor: isRunning ? "not-allowed" : "pointer",
        opacity: isRunning ? 0.6 : 1,
      }}
    >
      <RotateCw
        size={14}
        style={{
          animation: isRunning ? "spin 1s linear infinite" : undefined,
        }}
      />
      {isRunning ? "Reindexing..." : isSuccess ? "Done" : "Reindex"}
    </button>
  );
}

/* ─── Browser: Editing Hints Panel ──────────────────────────── */

const HINT_BORDER_COLORS: Record<EditingHint["severity"], string> = {
  warning: "var(--system-orange)",
  tip: "var(--text-tertiary)",
};

export function EditingHintsPanel({ hints }: { hints: EditingHint[] }) {
  if (hints.length === 0) return null;

  return (
    <div
      style={{
        marginTop: "var(--space-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      {hints.map((hint) => (
        <div
          key={hint.id}
          style={{
            borderLeft: `3px solid ${HINT_BORDER_COLORS[hint.severity]}`,
            paddingLeft: "var(--space-3)",
            paddingTop: "var(--space-1)",
            paddingBottom: "var(--space-1)",
            fontSize: "var(--text-caption1)",
            color: "var(--text-secondary)",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          {hint.text}
        </div>
      ))}
    </div>
  );
}
