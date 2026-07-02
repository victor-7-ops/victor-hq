'use client';

import { cn } from '@/lib/utils';
import type { DSStatus } from '@/types';

const statusConfig: Record<DSStatus, { bg: string; text: string; label: string }> = {
  green: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Green' },
  yellow: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Yellow' },
  red: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Red' },
};

export default function StatusBadge({
  status,
  size = 'md',
}: {
  status: DSStatus;
  size?: 'sm' | 'md';
}) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bg,
        config.text,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
      )}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <span
        className={cn(
          'rounded-full',
          status === 'green' && 'bg-emerald-400',
          status === 'yellow' && 'bg-amber-400',
          status === 'red' && 'bg-red-400',
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
        )}
      />
      {config.label}
    </span>
  );
}
