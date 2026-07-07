"use client";

import type { MemoryFileInfo, MemoryFileCategory } from "@/lib/types";

/* ─── Helpers ────────────────────────────────────────────────── */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isJsonFile(file: MemoryFileInfo): boolean {
  return file.path.endsWith(".json");
}

export const CATEGORY_COLORS: Record<MemoryFileCategory, string> = {
  evergreen: "var(--system-green)",
  daily: "var(--system-blue)",
  other: "var(--text-tertiary)",
};

export const CATEGORY_LABELS: Record<MemoryFileCategory, string> = {
  evergreen: "Evergreen",
  daily: "Daily",
  other: "Other",
};

/* ─── Icons ──────────────────────────────────────────────────── */

export function FileIcon({ isJson }: { isJson: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: isJson ? "var(--system-blue)" : "var(--text-tertiary)", flexShrink: 0 }}
    >
      {isJson ? (
        <>
          <rect x="4" y="2" width="8" height="12" rx="1.5" />
          <path d="M6 2V1.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V2" />
          <line x1="6.5" y1="6" x2="9.5" y2="6" />
          <line x1="6.5" y1="8.5" x2="9.5" y2="8.5" />
          <line x1="6.5" y1="11" x2="8" y2="11" />
        </>
      ) : (
        <>
          <path d="M4 1.5h5.5L12 4v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1z" />
          <polyline points="9.5 1.5 9.5 4.5 12 4.5" />
          <line x1="5.5" y1="7.5" x2="10.5" y2="7.5" />
          <line x1="5.5" y1="10" x2="10.5" y2="10" />
        </>
      )}
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--text-tertiary)" }}
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function BackArrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="10 3 5 8 10 13" />
    </svg>
  );
}
