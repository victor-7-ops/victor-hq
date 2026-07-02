'use client';

import { cn } from '@/lib/utils';

type StatusPillSize = 'sm' | 'md';

interface StatusPillProps {
  status: string;
  label: string;
  size?: StatusPillSize;
}

function getDotColor(status: string): string {
  switch (status) {
    case 'online':
    case 'healthy':
    case 'done':
      return 'bg-status-green';
    case 'idle':
    case 'degraded':
    case 'in-progress':
      return 'bg-status-amber';
    case 'error':
    case 'down':
    case 'blocked':
      return 'bg-status-red';
    case 'offline':
    default:
      return 'bg-text-muted';
  }
}

export default function StatusPill({ status, label, size = 'md' }: StatusPillProps) {
  const dotColor = getDotColor(status);
  const isOnline = status === 'online';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface font-medium text-text-secondary',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
      )}
    >
      <span className="relative flex">
        <span
          className={cn(
            'rounded-full',
            dotColor,
            size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
          )}
        />
        {isOnline && (
          <span
            className={cn(
              'absolute inset-0 animate-ping rounded-full bg-status-green opacity-75',
              size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
            )}
          />
        )}
      </span>
      {label}
    </span>
  );
}
