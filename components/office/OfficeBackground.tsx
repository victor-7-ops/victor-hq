"use client";

import React, { memo, useMemo } from "react";

function generateParticles(count: number) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      left: `${(i * 7.3 + 12) % 100}%`,
      top: `${(i * 11.7 + 8) % 100}%`,
      delay: `${(i * 1.3) % 6}s`,
      duration: `${5 + (i % 4)}s`,
      dx: `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 15))}px`,
      dy: `${-25 - (i % 20)}px`,
      opacity: 0.06 + (i % 3) * 0.03,
      size: 1.5 + (i % 3),
    });
  }
  return particles;
}

function getTimeOfDayTint(): string {
  const hour = new Date().getHours();
  if (hour < 6 || hour >= 22) return "rgba(30, 58, 138, 0.08)";
  if (hour < 8 || hour >= 19) return "rgba(120, 53, 15, 0.05)";
  return "transparent";
}

/** Static office atmosphere: grid floor, particles, decorative plants, time-of-day tint. */
export const OfficeBackground = memo(function OfficeBackground() {
  const particles = useMemo(() => generateParticles(16), []);
  const tint = useMemo(getTimeOfDayTint, []);

  return (
    <>
      {/* Floor grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(148,163,184,0.035) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(148,163,184,0.035) 1px, transparent 1px)",
          ].join(","),
          backgroundSize: "48px 48px",
        }}
      />

      {/* Center glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, rgba(59,130,246,0.045) 0%, transparent 55%)",
        }}
      />

      {/* Time-of-day overlay */}
      <div
        className="pointer-events-none absolute inset-0 transition-colors"
        style={{ backgroundColor: tint, transitionDuration: "2000ms" }}
      />

      {/* Ambient particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute rounded-full bg-slate-400"
          style={
            {
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              "--particle-dx": p.dx,
              "--particle-dy": p.dy,
              "--particle-opacity": String(p.opacity),
              animation: `office-particle-float ${p.duration} ${p.delay} ease-in-out infinite`,
              opacity: 0,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Decorative plants — corners */}
      <Plant className="absolute top-5 left-5 opacity-25" leaves={3} />
      <Plant className="absolute top-6 right-6 opacity-20" leaves={2} />
      <Plant className="absolute bottom-5 left-8 opacity-15" leaves={2} />
      <Plant className="absolute bottom-5 right-6 opacity-20" leaves={3} />

      {/* Water cooler */}
      <svg
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 w-5 h-10 opacity-[0.12]"
        viewBox="0 0 20 40"
      >
        <rect x="4" y="14" width="12" height="18" rx="2" fill="#334155" />
        <rect x="2" y="10" width="16" height="5" rx="2.5" fill="#1e40af" opacity="0.35" />
        <rect x="6" y="32" width="8" height="4" rx="1" fill="#475569" />
      </svg>
    </>
  );
});

/** Tiny SVG plant decoration. */
function Plant({ className, leaves }: { className?: string; leaves: number }) {
  return (
    <svg
      className={`pointer-events-none w-7 h-9 ${className ?? ""}`}
      viewBox="0 0 28 36"
    >
      <rect x="9" y="24" width="10" height="10" rx="2" fill="#334155" />
      <ellipse cx="14" cy="19" rx="7" ry="9" fill="#166534" opacity="0.55" />
      {leaves >= 2 && (
        <ellipse cx="10" cy="17" rx="5" ry="6.5" fill="#15803d" opacity="0.45" />
      )}
      {leaves >= 3 && (
        <ellipse cx="18" cy="15" rx="4.5" ry="7" fill="#166534" opacity="0.38" />
      )}
    </svg>
  );
}
