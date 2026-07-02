'use client';

import { ArrowLeft, GitCommit, Tag } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ReleaseEntry {
  version: string;
  date: string;
  tag: 'major' | 'minor' | 'patch';
  changes: { type: 'feat' | 'fix' | 'refactor' | 'perf'; text: string }[];
}

const RELEASES: ReleaseEntry[] = [
  {
    version: '2.0.0',
    date: '2026-03-19',
    tag: 'major',
    changes: [
      { type: 'feat', text: 'Multi-view home dashboard with 4 switchable views: Org Map, Grid, Feed, Constellation' },
      { type: 'feat', text: 'Interactive agent chat with real-time SSE streaming and multimodal support' },
      { type: 'feat', text: 'Advanced cost analytics with optimization scoring and anomaly detection' },
      { type: 'feat', text: 'Kanban board with ticket chat, agent assignment, and automation' },
      { type: 'feat', text: 'Cron pipeline builder with visual DAG editor and execution history' },
      { type: 'feat', text: 'Memory health monitor with AI-driven analysis and reindex controls' },
      { type: 'feat', text: 'Rich text editor with markdown, tables, code blocks, and image support' },
      { type: 'feat', text: 'Reference file management with tag-based organization' },
      { type: 'feat', text: 'Competitor intelligence with discovery and profiling' },
      { type: 'feat', text: 'Global search across all data types' },
      { type: 'feat', text: 'Live stream widget for real-time activity monitoring' },
      { type: 'feat', text: '10-step onboarding wizard with auto-detection and feature selection' },
      { type: 'feat', text: 'Full settings page with branding, avatars, and operator profile' },
      { type: 'perf', text: 'Upgraded to Next.js 16, React 19, Tailwind CSS 4' },
      { type: 'refactor', text: 'Apple-inspired glass design system with full accent color customization' },
      { type: 'refactor', text: 'Expanded from 25 to 52 API endpoints' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-03-09',
    tag: 'minor',
    changes: [
      { type: 'feat', text: 'Constellation graph visualization with force-directed layout' },
      { type: 'feat', text: 'Release logs page with full version history' },
      { type: 'feat', text: 'Multi-project support in sidebar navigation' },
      { type: 'feat', text: 'Memory log with episodic and factual memory types' },
      { type: 'perf', text: 'Reduced polling intervals across all hooks (30-60s)' },
      { type: 'perf', text: 'SSE invalidation debouncing (200ms batch)' },
      { type: 'refactor', text: 'Rebranded UI with configurable project names' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-03-01',
    tag: 'major',
    changes: [
      { type: 'feat', text: 'Initial dashboard with Agent Fleet, System Pulse, and Memory Log' },
      { type: 'feat', text: 'Real-time SSE pulse stream from OpenClaw gateway' },
      { type: 'feat', text: 'Cost tracking with 24h/7d/30d breakdowns and per-agent attribution' },
      { type: 'feat', text: 'Task manager with sprint tracking and agent assignment' },
      { type: 'feat', text: 'Design system QA reporting with component-level results' },
      { type: 'feat', text: 'Identity and security monitoring dashboard' },
      { type: 'feat', text: 'Dark theme UI with sidebar navigation' },
      { type: 'feat', text: 'Setup wizard for OpenClaw configuration' },
    ],
  },
];

const TYPE_COLORS: Record<string, string> = {
  feat: 'text-status-green',
  fix: 'text-status-amber',
  refactor: 'text-status-blue',
  perf: 'text-purple-400',
};

const TYPE_LABELS: Record<string, string> = {
  feat: 'FEAT',
  fix: 'FIX',
  refactor: 'REFAC',
  perf: 'PERF',
};

const TAG_STYLES: Record<string, string> = {
  major: 'bg-status-red/10 text-status-red border-status-red/20',
  minor: 'bg-status-green/10 text-status-green border-status-green/20',
  patch: 'bg-status-blue/10 text-status-blue border-status-blue/20',
};

export default function ReleasesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/fleet"
          className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Release Log</h1>
          <p className="text-xs text-text-muted">
            OpenClaw Dashboard version history
          </p>
        </div>
      </div>

      {RELEASES.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GitCommit className="h-10 w-10 text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">No releases yet.</p>
          <p className="text-xs text-text-muted mt-1">Release history will appear here as versions are published.</p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-8 bottom-0 w-px bg-border" />

          {RELEASES.map((release, idx) => (
            <div key={release.version} className="relative pb-8">
              {/* Timeline dot */}
              <div className={cn(
                'absolute left-[12px] top-1.5 z-10 flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 border-border',
                idx === 0 ? 'bg-accent' : 'bg-surface',
              )}>
                {idx === 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </div>

              <div className="ml-12">
                {/* Version header */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-text-muted" />
                    <span className="font-mono text-sm font-semibold text-text-primary">
                      v{release.version}
                    </span>
                  </div>
                  <span className={cn(
                    'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                    TAG_STYLES[release.tag],
                  )}>
                    {release.tag}
                  </span>
                  <span className="text-xs text-text-muted">{release.date}</span>
                </div>

                {/* Change list */}
                <ul className="mt-3 space-y-1.5">
                  {release.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={cn(
                        'mt-0.5 shrink-0 font-mono text-[10px] font-bold',
                        TYPE_COLORS[change.type],
                      )}>
                        {TYPE_LABELS[change.type]}
                      </span>
                      <span className="text-text-secondary">{change.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
