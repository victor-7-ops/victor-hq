'use client';

import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'circle';
}

export default function LoadingSkeleton({
  className,
  variant = 'text',
}: LoadingSkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-surface-hover',
        variant === 'text' && 'h-4 w-full rounded',
        variant === 'card' && 'h-24 w-full rounded-lg',
        variant === 'circle' && 'h-10 w-10 rounded-full',
        className,
      )}
    />
  );
}
