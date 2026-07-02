'use client';

import { cn } from '@/lib/utils';
import SparklineChart from '@/components/shared/SparklineChart';

interface DriftIndicatorProps {
  driftScore: number | null;
}

// Placeholder sparkline data representing recent latency trend
const PLACEHOLDER_SPARKLINE = [42, 45, 41, 48, 44, 46, 43, 50, 47, 44, 42, 45];

export default function DriftIndicator({ driftScore }: DriftIndicatorProps) {
  if (driftScore === null) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm italic text-text-muted">
            Building baseline...
          </span>
          <SparklineChart
            data={PLACEHOLDER_SPARKLINE}
            color="var(--text-muted, #64748b)"
            width={80}
            height={24}
          />
        </div>
      </div>
    );
  }

  const absScore = Math.abs(driftScore);

  let label: string;
  let colorClass: string;
  let sparkColor: string;

  if (driftScore > 0) {
    label = `\u2191 ${absScore}% slower than baseline`;
    colorClass = 'text-status-amber';
    sparkColor = 'var(--status-amber, #f59e0b)';
  } else if (driftScore < 0) {
    label = `\u2193 ${absScore}% faster than baseline`;
    colorClass = 'text-status-green';
    sparkColor = 'var(--status-green, #22c55e)';
  } else {
    label = '\u2713 Normal';
    colorClass = 'text-status-green';
    sparkColor = 'var(--status-green, #22c55e)';
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Drift
          </span>
          <span className={cn('text-sm font-medium', colorClass)}>
            {label}
          </span>
        </div>
        <SparklineChart
          data={PLACEHOLDER_SPARKLINE}
          color={sparkColor}
          width={80}
          height={24}
        />
      </div>
    </div>
  );
}
