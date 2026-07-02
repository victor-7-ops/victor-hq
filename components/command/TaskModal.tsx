'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn, getPriorityColor, formatRelativeTime } from '@/lib/utils';
import { useUpdateTask } from '@/hooks/useTasks';
import type { DevTask, DevTaskStatus, Priority } from '@/types';
import { X, Save, Tag, GitCommit } from 'lucide-react';
import StatusPill from '@/components/shared/StatusPill';

interface TaskModalProps {
  task: DevTask | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: DevTaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const PRIORITY_OPTIONS: Priority[] = ['critical', 'high', 'medium', 'low'];

export default function TaskModal({ task, isOpen, onClose }: TaskModalProps) {
  const updateTask = useUpdateTask();

  const [status, setStatus] = useState<DevTaskStatus>('todo');
  const [priority, setPriority] = useState<Priority>('medium');
  const [notes, setNotes] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Sync local state when task changes
  useEffect(() => {
    if (task) {
      setStatus(task.status);
      setPriority(task.priority);
      setNotes(task.notes ?? '');
      setIsDirty(false);
    }
  }, [task]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleSave = useCallback(() => {
    if (!task) return;
    updateTask.mutate(
      { id: task.id, status, priority, notes },
      { onSuccess: () => setIsDirty(false) },
    );
  }, [task, status, priority, notes, updateTask]);

  if (!isOpen || !task) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-full flex-col border-l border-border bg-background shadow-2xl animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div className="mr-4 min-w-0 flex-1">
            <p className="text-xs font-mono text-text-muted">{task.id}</p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary leading-snug">
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Description */}
          {task.description && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Description
              </label>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                {task.description}
              </p>
            </div>
          )}

          {/* Status selector */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Status
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setStatus(opt.value);
                    setIsDirty(true);
                  }}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                    status === opt.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-surface text-text-secondary hover:bg-surface-hover',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority selector */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Priority
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPriority(p);
                    setIsDirty(true);
                  }}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-semibold uppercase transition-opacity',
                    getPriorityColor(p),
                    priority === p ? 'opacity-100 ring-2 ring-white/20' : 'opacity-40 hover:opacity-70',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-4">
            <FieldItem label="Type" value={task.type} />
            <FieldItem label="Sprint" value={task.sprintId ?? 'Backlog'} />
            <FieldItem label="Assigned Agent" value={task.assignedAgent ?? 'Unassigned'} />
            <FieldItem label="Owner" value={task.owner ?? 'None'} />
            <FieldItem label="Phase" value={task.phase ?? 'N/A'} />
            <FieldItem
              label="Last Updated"
              value={formatRelativeTime(task.updatedAt)}
            />
          </div>

          {/* Tags */}
          {task.tags.length > 0 && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Tags
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-text-secondary"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last commit ref */}
          {task.lastCommitRef && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Last Commit
              </label>
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 font-mono text-xs text-text-secondary">
                <GitCommit className="h-3 w-3 text-text-muted" />
                {task.lastCommitRef}
              </p>
            </div>
          )}

          {/* Acceptance criteria */}
          {task.acceptance && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Acceptance Criteria
              </label>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
                {task.acceptance}
              </p>
            </div>
          )}

          {/* Notes (editable) */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Add notes..."
              rows={4}
              className={cn(
                'mt-2 w-full resize-y rounded-md border border-border bg-surface px-3 py-2',
                'text-sm text-text-primary placeholder:text-text-muted',
                'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
              )}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <span className="text-xs text-text-muted">
            Created {formatRelativeTime(task.createdAt)}
          </span>
          <button
            onClick={handleSave}
            disabled={!isDirty || updateTask.isPending}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              isDirty
                ? 'bg-accent text-white hover:bg-accent-hover'
                : 'bg-surface text-text-muted cursor-not-allowed',
            )}
          >
            <Save className="h-4 w-4" />
            {updateTask.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}

// Small helper for metadata fields
function FieldItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 text-sm text-text-secondary truncate">{value}</p>
    </div>
  );
}
