'use client';

import { useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { formatCost, formatRelativeTime } from '@/lib/utils';
import StatusBadge from './StatusBadge';
import type { DSRunReport } from '@/types';

interface Props {
  component: string;
  reports: DSRunReport[];
  onClose: () => void;
}

export default function ComponentDetail({ component, reports, onClose }: Props) {
  const history = reports
    .filter((r) => r.component === component)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
    {/* Backdrop overlay */}
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border bg-surface shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <button
          onClick={onClose}
          className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          aria-label="Close detail panel"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-text-primary">{component}</h2>
          <p className="text-xs text-text-muted">{history.length} events</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Latest metrics summary */}
      {history.length > 0 && (
        <div className="border-b border-border px-5 py-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Fidelity', value: `${history[0].metrics.fidelity.toFixed(1)}%` },
              { label: 'Variants', value: `${history[0].metrics.variantCoverage.toFixed(1)}%` },
              { label: 'Token Reuse', value: `${history[0].metrics.tokenReuse.toFixed(1)}%` },
              { label: 'Raw Values', value: String(Math.round(history[0].metrics.rawValues)) },
              { label: 'Iterations', value: String(history[0].metrics.iterations) },
              { label: 'Cost', value: formatCost(history[0].metrics.costUSD) },
            ].map(({ label, value }) => (
              <div key={label}>
                <span className="text-[10px] font-medium text-text-muted">{label}</span>
                <div className="text-sm font-semibold text-text-primary">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event timeline */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="py-10 text-center text-sm text-text-muted">No events for this component.</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {history.map((event, idx) => (
              <div key={`${event.run_id}-${idx}`} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={event.status} size="sm" />
                    <span className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                      {event.phase}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted">{formatRelativeTime(event.timestamp)}</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary">
                  <span>Fidelity: {event.metrics.fidelity.toFixed(1)}%</span>
                  <span>QA: {event.metrics.qaPass ? 'Pass' : 'Fail'}</span>
                  <span>Iters: {event.metrics.iterations}</span>
                  <span>{formatCost(event.metrics.costUSD)}</span>
                </div>

                {event.alerts.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {event.alerts.map((alert, aidx) => (
                      <div key={aidx} className="rounded bg-surface-hover px-2 py-1.5 text-[11px]">
                        <span className="font-mono text-status-amber">{alert.type}</span>
                        <span className="mx-1 text-text-muted">—</span>
                        <span className="text-text-secondary">{alert.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-1.5 font-mono text-[10px] text-text-muted">{event.run_id}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
