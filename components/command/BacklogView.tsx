'use client';

import { useMemo, useState } from 'react';
import { cn, getPriorityColor } from '@/lib/utils';
import type { DevTask, Priority } from '@/types';
import { ArrowUpDown } from 'lucide-react';

interface BacklogViewProps {
  tasks: DevTask[];
}

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type SortField = 'priority' | 'title' | 'type';

export default function BacklogView({ tasks }: BacklogViewProps) {
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortAsc, setSortAsc] = useState(true);

  const backlogTasks = useMemo(() => {
    const filtered = tasks.filter((t) => t.sprintId === null);

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'priority':
          cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [tasks, sortField, sortAsc]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(field === 'title'); // ascending for title, descending otherwise
    }
  }

  if (backlogTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <p className="text-sm">No tasks in the backlog.</p>
        <p className="mt-1 text-xs">
          Tasks without a sprint assignment appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface">
            <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-text-muted w-24">
              ID
            </th>
            <SortableHeader
              label="Title"
              field="title"
              currentField={sortField}
              asc={sortAsc}
              onClick={handleSort}
            />
            <SortableHeader
              label="Priority"
              field="priority"
              currentField={sortField}
              asc={sortAsc}
              onClick={handleSort}
              className="w-28"
            />
            <SortableHeader
              label="Type"
              field="type"
              currentField={sortField}
              asc={sortAsc}
              onClick={handleSort}
              className="w-28"
            />
            <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-text-muted w-32">
              Owner
            </th>
          </tr>
        </thead>
        <tbody>
          {backlogTasks.map((task) => (
            <tr
              key={task.id}
              className="border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors"
            >
              <td className="px-4 py-3 font-mono text-xs text-text-muted">
                {task.id}
              </td>
              <td className="px-4 py-3 text-sm text-text-primary">
                {task.title}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none',
                    getPriorityColor(task.priority),
                  )}
                >
                  {task.priority}
                </span>
              </td>
              <td className="px-4 py-3 text-xs capitalize text-text-secondary">
                {task.type}
              </td>
              <td className="px-4 py-3 text-xs text-text-secondary">
                {task.owner ?? 'None'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  label,
  field,
  currentField,
  asc,
  onClick,
  className,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  asc: boolean;
  onClick: (field: SortField) => void;
  className?: string;
}) {
  const isActive = currentField === field;

  return (
    <th
      className={cn(
        'px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-text-muted cursor-pointer select-none hover:text-text-secondary transition-colors',
        className,
      )}
      onClick={() => onClick(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={cn(
            'h-3 w-3 transition-opacity',
            isActive ? 'opacity-100' : 'opacity-30',
          )}
        />
      </span>
    </th>
  );
}
