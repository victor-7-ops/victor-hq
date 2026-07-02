"use client";

import React, { memo, useMemo } from "react";
import type { AgentData } from "@/types";
import { OfficeBackground } from "./OfficeBackground";
import { AgentCharacter } from "./AgentCharacter";
import { NAABAdvisors } from "./NAABAdvisors";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OfficeFloorProps {
  agents: AgentData[];
  onAgentClick: (agentId: string) => void;
}

interface AgentPod {
  orchestrator: AgentData | null;
  subAgents: AgentData[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildPods(agents: AgentData[]): AgentPod[] {
  const orchestrators = agents.filter((a) => a.role === "orchestrator");
  const subAgents = agents.filter((a) => a.role === "sub-agent");

  const podMap = new Map<string, AgentPod>();

  for (const orch of orchestrators) {
    podMap.set(orch.id, { orchestrator: orch, subAgents: [] });
  }

  const orphans: AgentData[] = [];

  for (const sub of subAgents) {
    if (sub.parentId && podMap.has(sub.parentId)) {
      podMap.get(sub.parentId)!.subAgents.push(sub);
    } else {
      orphans.push(sub);
    }
  }

  const pods = Array.from(podMap.values());

  if (orphans.length > 0) {
    pods.push({ orchestrator: null, subAgents: orphans });
  }

  return pods;
}

const STATUS_DOT: Record<string, string> = {
  online: "#10b981",
  idle: "#eab308",
  error: "#ef4444",
  offline: "#475569",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const OfficeFloor = memo(function OfficeFloor({
  agents,
  onAgentClick,
}: OfficeFloorProps) {
  const pods = useMemo(() => buildPods(agents), [agents]);

  return (
    <div className="relative min-h-[calc(100vh-180px)] w-full overflow-auto rounded-2xl border border-slate-800/60 bg-slate-950/80">
      {/* Atmospheric background layer */}
      <OfficeBackground />

      {/* Floor content */}
      <div className="relative z-10 p-5 sm:p-8 lg:p-10">
        {/* Divider label */}
        <FloorDivider label="HQ Office · Floor 1" />

        {/* Pods */}
        <div className="mt-6 space-y-10">
          {pods.map((pod, idx) => {
            const key = pod.orchestrator?.id ?? `orphan-${idx}`;
            const dotColor =
              pod.orchestrator ? STATUS_DOT[pod.orchestrator.status] : "#475569";

            return (
              <section key={key}>
                {/* Pod header */}
                <div className="mb-4 flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor }}
                  />
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                    {pod.orchestrator
                      ? `${pod.orchestrator.name} Team`
                      : "Unassigned Agents"}
                  </p>
                  <span className="h-px flex-1 bg-slate-800/50" />
                  <span className="text-[10px] tabular-nums text-slate-600">
                    {(pod.orchestrator ? 1 : 0) + pod.subAgents.length} agent
                    {(pod.orchestrator ? 1 : 0) + pod.subAgents.length !== 1
                      ? "s"
                      : ""}
                  </span>
                </div>

                {/* Desk grid */}
                <div className="flex flex-wrap items-start justify-center gap-4 lg:gap-5">
                  {pod.orchestrator && (
                    <AgentCharacter
                      agent={pod.orchestrator}
                      onClick={() => onAgentClick(pod.orchestrator!.id)}
                    />
                  )}
                  {pod.subAgents.map((sub) => (
                    <AgentCharacter
                      key={sub.id}
                      agent={sub}
                      onClick={() => onAgentClick(sub.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Empty state */}
        {agents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <svg
              className="mb-4 h-16 w-16 opacity-25"
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="8" y="24" width="48" height="24" rx="3" />
              <rect x="24" y="8" width="16" height="18" rx="2" />
            </svg>
            <p className="text-sm">No agents in the office yet</p>
            <p className="mt-1 text-xs text-slate-600">
              Agents will appear here once they come online
            </p>
          </div>
        )}

        {/* Bottom rule */}
        <div className="mt-10">
          <FloorDivider />
        </div>

        {/* NAAB Advisors Section */}
        <NAABAdvisors />
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Tiny sub-components                                                */
/* ------------------------------------------------------------------ */

function FloorDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700/40 to-transparent" />
      {label && (
        <>
          <p className="select-none text-[10px] uppercase tracking-[0.2em] text-slate-600">
            {label}
          </p>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700/40 to-transparent" />
        </>
      )}
    </div>
  );
}
