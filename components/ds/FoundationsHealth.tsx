'use client';

import { Blocks, AlertTriangle } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import StatusBadge from './StatusBadge';
import type { DSSummary } from '@/types';

interface Props {
  data: DSSummary['foundationsHealth'];
}

export default function FoundationsHealth({ data }: Props) {
  if (!data) {
    return (
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Blocks className="h-4 w-4 text-text-muted" />
          Foundations Health
        </h2>
        <div className="mt-6 flex flex-col items-center gap-2 py-4 text-center">
          <div className="rounded-full bg-surface-hover p-3">
            <Blocks className="h-5 w-5 text-text-muted" />
          </div>
          <p className="text-sm text-text-muted">Not reported yet</p>
          <p className="text-xs text-text-muted">
            Waiting for a <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-[11px]">foundations</code> phase run.
          </p>
        </div>
      </section>
    );
  }

  const items = [
    { label: 'Token Coverage', value: `${data.tokenCoverage.toFixed(1)}%` },
    { label: 'Raw Values', value: String(Math.round(data.rawValues)), warn: data.rawValues > 0 },
    {
      label: 'Drift Status',
      value: <StatusBadge status={data.driftStatus} size="sm" />,
    },
    {
      label: 'Last Updated',
      value: data.lastUpdated ? formatRelativeTime(data.lastUpdated) : '—',
    },
  ];

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Blocks className="h-4 w-4 text-text-muted" />
        Foundations Health
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {items.map(({ label, value, warn }) => (
          <div key={label}>
            <span className="text-[11px] font-medium text-text-muted">{label}</span>
            <div className={cn('mt-1 text-sm font-semibold', warn ? 'text-status-amber' : 'text-text-primary')}>
              {typeof value === 'string' ? (
                <span className="flex items-center gap-1">
                  {warn && <AlertTriangle className="h-3 w-3" />}
                  {value}
                </span>
              ) : (
                value
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
