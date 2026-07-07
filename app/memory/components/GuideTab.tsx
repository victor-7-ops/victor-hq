"use client";

import type { MemoryConfig } from "@/lib/types";
import { DecayVisualizer, HybridBalanceBar, BestPractices, FileReference, FlushSection } from "./guide-panels";

export function GuideTab({ config }: { config: MemoryConfig | null }) {
  return (
    <div
      className="overflow-y-auto h-full"
      style={{ padding: "var(--space-4) var(--space-6) var(--space-6)" }}
    >
      {/* Best practices -- lead section */}
      <BestPractices />

      {/* Config visualizers */}
      {config && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "var(--space-3)",
            marginTop: "var(--space-4)",
          }}
          className="guide-config-grid"
        >
          <DecayVisualizer config={config} />
          <HybridBalanceBar config={config} />
          <FlushSection config={config} />
          <FileReference />
        </div>
      )}
      {!config && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <FileReference />
        </div>
      )}
    </div>
  );
}
