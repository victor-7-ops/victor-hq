'use client';

import { cn, formatRelativeTime, getPriorityColor } from '@/lib/utils';
import type { DevTask } from '@/types';
import { Bug, Lightbulb, Palette, FlaskConical, Wrench, User } from 'lucide-react';

interface TaskCardProps {
  task: DevTask;
  onClick: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  feature: <Lightbulb className="h-3 w-3" />,
  bug: <Bug className="h-3 w-3" />,
  design: <Palette className="h-3 w-3" />,
  research: <FlaskConical className="h-3 w-3" />,
  ops: <Wrench className="h-3 w-3" />,
};

export default function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border border-border bg-surface p-3 text-left transition-colors',
        'hover:bg-surface-hover hover:border-border focus:outline-none focus:ring-1 focus:ring-accent',
      )}
    >
      {/* Title */}
      <p className="line-clamp-2 text-sm font-medium text-text-primary">
        {task.title}
      </p>

      {/* Priority + Type row */}
      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none',
            getPriorityColor(task.priority),
          )}
        >
          {task.priority}
        </span>

        <span className="inline-flex items-center gap-1 text-xs text-text-muted">
          {typeIcons[task.type]}
          {task.type}
        </span>
      </div>

      {/* Bottom row: agent + relative time */}
      <div className="mt-2 flex items-center justify-between">
        {task.assignedAgent ? (
          <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
            <User className="h-3 w-3 text-text-muted" />
            <span className="max-w-[120px] truncate">{task.assignedAgent}</span>
          </span>
        ) : (
          <span className="text-xs text-text-muted">Unassigned</span>
        )}

        <span className="text-xs text-text-muted">
          {formatRelativeTime(task.updatedAt)}
        </span>
      </div>
    </button>
  );
}
