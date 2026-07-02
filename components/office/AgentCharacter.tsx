"use client";

import React, { memo } from "react";
import type { AgentData } from "@/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AgentCharacterProps {
  agent: AgentData;
  onClick?: () => void;
}

const STATUS_TONE: Record<string, string> = {
  online: "#10b981",
  idle: "#eab308",
  error: "#ef4444",
  offline: "#475569",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AgentCharacter = memo(function AgentCharacter({
  agent,
  onClick,
}: AgentCharacterProps) {
  const statusColor = STATUS_TONE[agent.status] || "#475569";
  const isOnline = agent.status === "online";
  const isIdle = agent.status === "idle";
  const isError = agent.status === "error";

  return (
    <div
      className="group relative cursor-pointer"
      onClick={onClick}
      style={{
        animation: isOnline
          ? "office-typing 0.8s ease-in-out infinite"
          : isIdle
          ? "office-idle-sway 3s ease-in-out infinite"
          : isError
          ? "office-error-shake 0.5s ease-in-out"
          : undefined,
      }}
    >
      {/* Desk scene */}
      <div className="relative flex flex-col items-center">
        {/* Status ring */}
        <div
          className="absolute -inset-2 rounded-full opacity-25 transition-opacity group-hover:opacity-40"
          style={{
            background: `radial-gradient(circle, ${statusColor}40 0%, transparent 70%)`,
            animation: isOnline ? "office-glow-pulse 2s ease-in-out infinite" : undefined,
          }}
        />

        {/* Monitor + Character */}
        <svg
          viewBox="0 0 120 100"
          className="h-28 w-32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {/* Desk */}
          <rect x="10" y="70" width="100" height="8" rx="2" fill="#334155" />
          <rect x="15" y="78" width="8" height="12" rx="1" fill="#1e293b" />
          <rect x="97" y="78" width="8" height="12" rx="1" fill="#1e293b" />

          {/* Monitor */}
          <rect x="30" y="30" width="60" height="40" rx="3" fill="#1e293b" stroke="#475569" />
          <rect x="35" y="35" width="50" height="30" rx="2" fill="#0f172a" />
          
          {/* Monitor glow */}
          <rect
            x="35"
            y="35"
            width="50"
            height="30"
            rx="2"
            fill="#3b82f6"
            opacity={isOnline ? 0.15 : 0.05}
            style={{
              animation: isOnline ? "office-monitor-flicker 2s ease-in-out infinite" : undefined,
            }}
          />

          {/* Screen content lines */}
          {isOnline && (
            <>
              <rect x="40" y="42" width="30" height="2" rx="1" fill="#3b82f6" opacity="0.6" />
              <rect x="40" y="48" width="25" height="2" rx="1" fill="#3b82f6" opacity="0.4" />
              <rect x="40" y="54" width="35" height="2" rx="1" fill="#3b82f6" opacity="0.3" />
            </>
          )}

          {/* Idle Zzz */}
          {isIdle && (
            <>
              <text x="85" y="25" fontSize="10" fill="#94a3b8" opacity="0.6">
                z
              </text>
              <text x="90" y="20" fontSize="8" fill="#94a3b8" opacity="0.4">
                z
              </text>
              <text x="94" y="16" fontSize="6" fill="#94a3b8" opacity="0.2">
                z
              </text>
            </>
          )}

          {/* Error indicator */}
          {isError && (
            <circle cx="60" cy="50" r="8" fill="#ef4444" opacity="0.3" />
          )}

          {/* Character head */}
          <circle cx="60" cy="15" r="8" fill="#64748b" />
          <rect x="52" y="22" width="16" height="12" rx="4" fill="#64748b" />

          {/* Keyboard */}
          <rect x="45" y="72" width="30" height="4" rx="1" fill="#475569" />

          {/* Mouse */}
          <rect x="80" y="73" width="6" height="4" rx="2" fill="#475569" />

          {/* Coffee cup (for online/idle) */}
          {(isOnline || isIdle) && (
            <g>
              <rect x="20" y="66" width="8" height="10" rx="2" fill="#78350f" />
              <ellipse cx="24" cy="66" rx="4" ry="2" fill="#92400e" />
              {/* Steam */}
              <path
                d="M22 62 Q24 58 22 54"
                stroke="#94a3b8"
                strokeWidth="1"
                fill="none"
                opacity="0.4"
                style={{
                  animation: "office-steam 3s ease-out infinite",
                }}
              />
            </g>
          )}
        </svg>

        {/* Agent info */}
        <div className="mt-2 text-center">
          <p className="text-sm font-medium text-slate-200">{agent.name}</p>
          <p className="text-xs text-slate-500">{agent.model}</p>
        </div>

        {/* Status indicator */}
        <div
          className="absolute -right-1 top-0 h-3 w-3 rounded-full border-2 border-slate-950"
          style={{ backgroundColor: statusColor }}
        />
      </div>

      {/* Hover tooltip */}
      <div className="pointer-events-none absolute -top-16 left-1/2 z-50 hidden -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-300 opacity-0 shadow-xl transition-opacity group-hover:block group-hover:opacity-100">
        <p className="font-medium text-slate-100">{agent.name}</p>
        <p className="text-slate-400">{agent.role}</p>
        <p className="mt-1 text-slate-500">
          Status: <span style={{ color: statusColor }}>{agent.status}</span>
        </p>
        {agent.tokensIn !== undefined && (
          <p className="text-slate-500">
            Tokens: {agent.tokensIn?.toLocaleString()} in / {agent.tokensOut?.toLocaleString()} out
          </p>
        )}
      </div>
    </div>
  );
});
