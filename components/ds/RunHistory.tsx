'use client';

import { History, ArrowRight } from 'lucide-react';
import { formatCost, formatRelativeTime } from '@/lib/utils';
import StatusBadge from './StatusBadge';
import type { DSRunReport, DSStatus } from '@/types';

interface Props {
  reports: DSRunReport[];
  activeRunId: string | null;
  onSelectRun: (runId: string | null) => void;
}

interface RunGroup {
  runId: string;
  phase: string;
  status: DSStatus;
  componentCount: number;
  totalCost: number;
  timestamp: string;
}

export default function RunHistory({ reports, activeRunId, onSelectRun }: Props) {
  // Group by run_id
  const runMap = new Map<string, DSRunReport[]>();
  for (const r of reports) {
    const list = runMap.get(r.run_id) || [];
    list.push(r);
    runMap.set(r.run_id, list);
  }

  const runs: RunGroup[] = Array.from(runMap.entries())
    .map(([runId, items]) => {
      const worst: DSStatus = items.some((i) => i.status === 'red')
        ? 'red'
        : items.some((i) => i.status === 'yellow')
          ? 'yellow'
          : 'green';
      return {
        runId,
        phase: items[0].phase,
        status: worst,
        componentCount: new Set(items.map((i) => i.component).filter(Boolean)).size,
        totalCost: items.reduce((sum, i) => sum + i.metrics.costUSD, 0),
        timestamp: items[0].timestamp,
      };
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 30);

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <History className="h-4 w-4 text-text-muted" />
          Run History
        </h2>
        {activeRunId && (
          <button
            onClick={() => onSelectRun(null)}
            className="text-xs text-accent hover:text-accent-hover"
          >
            Clear filter
          </button>
        )}
      </div>

      {runs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <History className="h-5 w-5 text-text-muted" />
          <p className="text-sm text-text-muted">No runs yet.</p>
        </div>
      ) : (
        <div className="max-h-[360px] divide-y divide-border-subtle overflow-y-auto">
          {runs.map((run) => (
            <button
              key={run.runId}
              onClick={() => onSelectRun(activeRunId === run.runId ? null : run.runId)}
              className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-surface-hover ${
                activeRunId === run.runId ? 'bg-surface-active' : ''
              }`}
            >
              <StatusBadge status={run.status} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs font-medium text-text-primary">{run.runId}</span>
                  <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-text-muted">{run.phase}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-text-muted">
                  {run.componentCount > 0 && <span>{run.componentCount} components</span>}
                  <span>{formatCost(run.totalCost)}</span>
                  <span>{formatRelativeTime(run.timestamp)}</span>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
