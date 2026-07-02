"use client";

import React, { memo } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface NAABAdvisor {
  id: string;
  name: string;
  role: string;
  model: string;
  focus: string;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const NAAB_ADVISORS: NAABAdvisor[] = [
  {
    id: "naab-system-architect",
    name: "System Architect",
    role: "Technical Feasibility",
    model: "Gemini 3.1 Pro",
    focus: "Scale, security & infrastructure",
  },
  {
    id: "naab-cost-optimizer",
    name: "Cost Optimizer",
    role: "Unit Economics",
    model: "Kimi K2.5",
    focus: "Margins & cost efficiency",
  },
  {
    id: "naab-gtm-strategist",
    name: "GTM Strategist",
    role: "Market Strategy",
    model: "Claude Sonnet 4.5",
    focus: "Positioning & acquisition",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const NAABAdvisors = memo(function NAABAdvisors() {
  return (
    <section className="mt-12">
      {/* Section divider */}
      <FloorDivider label="On-Call Advisory Board" />

      {/* Advisors row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {NAAB_ADVISORS.map((advisor) => (
          <AdvisorCard key={advisor.id} advisor={advisor} />
        ))}
      </div>
    </section>
  );
});

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

interface AdvisorCardProps {
  advisor: NAABAdvisor;
}

function AdvisorCard({ advisor }: AdvisorCardProps) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-slate-900/90 to-purple-950/30 p-4 transition-all duration-300 hover:border-amber-500/40 hover:from-slate-900/95 hover:to-purple-900/40"
      style={{
        boxShadow: "0 0 20px -5px rgba(245, 158, 11, 0.1)",
      }}
    >
      {/* Subtle pulse animation for on-call status */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-purple-500/0 opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />

      {/* Header with on-call indicator */}
      <div className="relative mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {/* Phone/consultation icon */}
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20">
            <svg
              className="h-4 w-4 text-amber-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 1 0 0 1-2.18 1 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 1.81 1.81 1.72 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1-.45 1.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            On-Call
          </span>
        </div>
      </div>

      {/* Advisor name and role */}
      <h3 className="mb-1 text-base font-semibold text-slate-100">
        {advisor.name}
      </h3>
      <p className="mb-3 text-xs font-medium text-purple-300">{advisor.role}</p>

      {/* Model badge */}
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-purple-500/15 px-2 py-1">
        <svg
          className="h-3 w-3 text-purple-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span className="text-xs font-medium text-purple-200">{advisor.model}</span>
      </div>

      {/* Focus area */}
      <p className="text-xs leading-relaxed text-slate-400">{advisor.focus}</p>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/60 via-purple-500/60 to-amber-500/60 opacity-50" />
    </div>
  );
}

function FloorDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-700/30 to-transparent" />
      {label && (
        <>
          <p className="select-none text-[10px] uppercase tracking-[0.2em] text-amber-500/70">
            {label}
          </p>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-700/30 to-transparent" />
        </>
      )}
    </div>
  );
}
