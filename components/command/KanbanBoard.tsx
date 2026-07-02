'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { DevTask, DevTaskStatus } from '@/types';
import TaskCard from './TaskCard';

interface KanbanBoardProps {
  tasks: DevTask[];
  onTaskClick: (task: DevTask) => void;
}

interface Column {
  id: DevTaskStatus;
  label: string;
  accentColor: string;
}

const COLUMNS: Column[] = [
  { id: 'todo', label: 'Todo', accentColor: 'bg-text-muted' },
  { id: 'in-progress', label: 'In Progress', accentColor: 'bg-status-amber' },
  { id: 'done', label: 'Done', accentColor: 'bg-status-green' },
  { id: 'blocked', label: 'Blocked', accentColor: 'bg-status-red' },
];

export default function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  const tasksByStatus = useMemo(() => {
    const grouped: Record<DevTaskStatus, DevTask[]> = {
      'todo': [],
      'in-progress': [],
      'done': [],
      'blocked': [],
    };
    for (const task of tasks) {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    }
    return grouped;
  }, [tasks]);

  return (
    <div className="grid h-full grid-cols-4 gap-4 overflow-hidden">
      {COLUMNS.map((col) => {
        const columnTasks = tasksByStatus[col.id];

        return (
          <div
            key={col.id}
            className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface/50"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <span
                className={cn('h-2 w-2 rounded-full', col.accentColor)}
              />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {col.label}
              </h3>
              <span className="ml-auto rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-text-muted">
                {columnTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {columnTasks.length === 0 ? (
                <p className="py-8 text-center text-xs text-text-muted">
                  No tasks
                </p>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
