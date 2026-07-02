'use client';

import { DollarSign, Timer, RotateCcw, Gauge } from 'lucide-react';
import { formatCost } from '@/lib/utils';
import type { DSSummary, DSRunReport } from '@/types';

interface Props {
  aggregates: DSSummary['aggregates'];
  reports: DSRunReport[];
}

const RETRY_CAP = 5;

export default function CostLoopGuard({ aggregates, reports }: Props) {
  const retryCapHits = reports.filter((r) => r.metrics.iterations >= RETRY_CAP).length;

  const items = [
    {
      label: 'Total Cost',
      value: formatCost(aggregates.totalCost),
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      label: 'Avg / Component',
      value: formatCost(aggregates.avgCostPerComponent),
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      label: 'Retry Cap Hits',
      value: String(retryCapHits),
      icon: <RotateCcw className="h-4 w-4" />,
      warn: retryCapHits > 0,
    },
    {
      label: 'Avg Latency',
      value: aggregates.avgLatency > 0 ? `${(aggregates.avgLatency / 1000).toFixed(1)}s` : '—',
      icon: <Timer className="h-4 w-4" />,
    },
  ];

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Gauge className="h-4 w-4 text-text-muted" />
        Cost &amp; Loop Guard
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {items.map(({ label, value, icon, warn }) => (
          <div key={label} className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-surface-hover p-1.5 text-text-muted">{icon}</div>
            <div>
              <span className="text-[11px] font-medium text-text-muted">{label}</span>
              <div className={`text-lg font-semibold tracking-tight ${warn ? 'text-status-amber' : 'text-text-primary'}`}>
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-text-muted">
        <span>{aggregates.totalReports} total reports</span>
        <span className="text-border">|</span>
        <span>Rejection rate: {(aggregates.rejectionRate * 100).toFixed(1)}%</span>
        <span className="text-border">|</span>
        <span>Raw values: {Math.round(aggregates.totalRawValues)}</span>
      </div>
    </section>
  );
}
