'use client';

import { cn } from '@/lib/utils';
import type { Sprint } from '@/types';

interface SprintSwitcherProps {
  sprints: Sprint[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function SprintSwitcher({
  sprints,
  selectedId,
  onSelect,
}: SprintSwitcherProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-1 pb-0">
      {sprints.map((sprint) => {
        const isActive = selectedId === sprint.id;

        return (
          <button
            key={sprint.id}
            onClick={() => onSelect(sprint.id)}
            className={cn(
              'relative shrink-0 px-3 py-2 text-sm font-medium transition-colors',
              'hover:text-text-primary',
              isActive
                ? 'text-text-primary'
                : 'text-text-muted',
            )}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  sprint.status === 'active' && 'bg-status-green',
                  sprint.status === 'upcoming' && 'bg-status-blue',
                  sprint.status === 'completed' && 'bg-text-muted',
                )}
              />
              S{sprint.number}
              <span className="hidden sm:inline">
                {' '}&middot; {sprint.name}
              </span>
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-accent" />
            )}
          </button>
        );
      })}

      {/* Backlog tab */}
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'relative shrink-0 px-3 py-2 text-sm font-medium transition-colors',
          'hover:text-text-primary',
          selectedId === null
            ? 'text-text-primary'
            : 'text-text-muted',
        )}
      >
        Backlog
        {selectedId === null && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-accent" />
        )}
      </button>
    </div>
  );
}
