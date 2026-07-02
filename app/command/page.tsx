'use client';

import { useMemo, useState, useCallback } from 'react';
import { useTasks, useSprints } from '@/hooks/useTasks';
import { useDashboardStore } from '@/store/dashboard';
import { cn, getPriorityColor } from '@/lib/utils';
import type { DevTask, DesignStatus } from '@/types';

import SprintSwitcher from '@/components/command/SprintSwitcher';
import KanbanBoard from '@/components/command/KanbanBoard';
import BacklogView from '@/components/command/BacklogView';
import TaskModal from '@/components/command/TaskModal';
import TaskCard from '@/components/command/TaskCard';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';

import {
  Kanban,
  List,
  CalendarDays,
  Target,
  Palette,
  Filter,
  Compass,
  Eye as EyeIcon,
  Rocket,
} from 'lucide-react';

const BACKLOG_ID = '__backlog__';

type TypeFilter = 'all' | 'design' | 'feature' | 'bug' | 'research' | 'ops';

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'design', label: 'Design' },
  { id: 'feature', label: 'Feature' },
  { id: 'bug', label: 'Bug' },
  { id: 'research', label: 'Research' },
  { id: 'ops', label: 'Ops' },
];

const DESIGN_STATUS_GROUPS: {
  id: DesignStatus;
  label: string;
  icon: React.ReactNode;
  accentColor: string;
}[] = [
  { id: 'exploration', label: 'Exploration', icon: <Compass className="h-3.5 w-3.5" />, accentColor: 'bg-status-blue' },
  { id: 'in-review', label: 'In Review', icon: <EyeIcon className="h-3.5 w-3.5" />, accentColor: 'bg-status-amber' },
  { id: 'shipped', label: 'Shipped', icon: <Rocket className="h-3.5 w-3.5" />, accentColor: 'bg-status-green' },
];

export default function CommandPage() {
  const { data: taskData, isLoading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks();
  const { data: sprintData, isLoading: sprintsLoading, error: sprintsError, refetch: refetchSprints } = useSprints();

  const selectedSprintId = useDashboardStore((s) => s.selectedSprintId);
  const setSelectedSprint = useDashboardStore((s) => s.setSelectedSprint);
  const commandViewMode = useDashboardStore((s) => s.commandViewMode);
  const setCommandViewMode = useDashboardStore((s) => s.setCommandViewMode);

  const [selectedTask, setSelectedTask] = useState<DevTask | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const sprints = sprintData?.sprints ?? [];
  const allTasks = taskData?.tasks ?? [];

  // Find the active sprint
  const activeSprint = useMemo(
    () => sprints.find((s) => s.status === 'active') ?? null,
    [sprints],
  );

  // Determine effective selection:
  // - null (initial) => auto-select active sprint, or first sprint, or backlog
  // - BACKLOG_ID => show backlog
  // - any sprint id => show that sprint
  const isBacklog = selectedSprintId === BACKLOG_ID;

  const effectiveSprintId = useMemo(() => {
    if (isBacklog) return null;
    if (selectedSprintId && selectedSprintId !== BACKLOG_ID) return selectedSprintId;
    // Auto-select: active sprint > first sprint > null
    return activeSprint?.id ?? sprints[0]?.id ?? null;
  }, [selectedSprintId, isBacklog, activeSprint, sprints]);

  // The currently viewed sprint object
  const currentSprint = useMemo(
    () => (effectiveSprintId ? sprints.find((s) => s.id === effectiveSprintId) ?? null : null),
    [sprints, effectiveSprintId],
  );

  // Filter tasks for the selected sprint (or show backlog), then apply type filter
  const filteredTasks = useMemo(() => {
    let tasks: DevTask[];
    if (isBacklog) {
      tasks = allTasks.filter((t) => t.sprintId === null);
    } else {
      tasks = allTasks.filter((t) => t.sprintId === effectiveSprintId);
    }

    // Apply type filter
    if (typeFilter === 'all') return tasks;
    if (typeFilter === 'design') {
      return tasks.filter((t) => t.type === 'design' || t.tags.includes('design'));
    }
    return tasks.filter((t) => t.type === typeFilter);
  }, [allTasks, effectiveSprintId, isBacklog, typeFilter]);

  // Design pipeline groups (used when pipeline view is active)
  const designPipelineGroups = useMemo(() => {
    const designTasks = filteredTasks.filter(
      (t) => t.type === 'design' || t.tags.includes('design'),
    );
    const groups: Record<DesignStatus, DevTask[]> = {
      exploration: [],
      'in-review': [],
      shipped: [],
    };
    for (const task of designTasks) {
      const ds = task.designStatus ?? 'exploration';
      if (groups[ds]) {
        groups[ds].push(task);
      }
    }
    return groups;
  }, [filteredTasks]);

  // Sprint progress
  const sprintProgress = useMemo(() => {
    if (!currentSprint) return { done: 0, total: 0, percent: 0 };
    const sprintTasks = allTasks.filter((t) => t.sprintId === currentSprint.id);
    const done = sprintTasks.filter((t) => t.status === 'done').length;
    const total = sprintTasks.length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, percent };
  }, [currentSprint, allTasks]);

  // Days remaining for the viewed sprint
  const daysRemaining = useMemo(() => {
    if (!currentSprint) return null;
    const end = new Date(currentSprint.endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [currentSprint]);

  const handleTaskClick = useCallback((task: DevTask) => {
    setSelectedTask(task);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedTask(null);
  }, []);

  // SprintSwitcher passes null for backlog, sprint.id for sprints
  const handleSprintSelect = useCallback(
    (id: string | null) => {
      setSelectedSprint(id === null ? BACKLOG_ID : id);
    },
    [setSelectedSprint],
  );

  // Determine which sprint tab is visually active in the switcher
  const switcherSelectedId = isBacklog ? null : effectiveSprintId;

  const isLoading = tasksLoading || sprintsLoading;

  const fetchError = tasksError || sprintsError;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <LoadingSkeleton variant="card" className="h-20" />
        <LoadingSkeleton variant="text" className="w-1/3" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="card" className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <ErrorState
        message={fetchError instanceof Error ? fetchError.message : 'Failed to load tasks or sprints'}
        onRetry={() => { refetchTasks(); refetchSprints(); }}
      />
    );
  }

  if (sprints.length === 0 && allTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted">
        <Target className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No sprints or tasks yet</p>
        <p className="mt-1 text-xs text-text-muted">Create a sprint or add tasks to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sprint header bar */}
      <div className="border-b border-border px-6 py-4">
        {currentSprint && !isBacklog ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-accent shrink-0" />
                  <h1 className="text-base font-semibold text-text-primary truncate">
                    Sprint {currentSprint.number}: {currentSprint.name}
                  </h1>
                </div>
                <p className="mt-0.5 text-sm text-text-secondary line-clamp-1">
                  {currentSprint.goal}
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDateRange(currentSprint.startDate, currentSprint.endDate)}
                </span>
                {daysRemaining !== null && (
                  <span
                    className={cn(
                      'font-medium',
                      daysRemaining <= 2 ? 'text-status-red' : 'text-text-secondary',
                    )}
                  >
                    {daysRemaining}d left
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-surface-hover overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${sprintProgress.percent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-text-secondary shrink-0">
                {sprintProgress.done}/{sprintProgress.total} done ({sprintProgress.percent}%)
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-text-muted">
            <Target className="h-4 w-4" />
            <span className="text-sm">
              {isBacklog ? 'Backlog' : 'No active sprint'}
            </span>
          </div>
        )}
      </div>

      {/* Sprint switcher + view toggle */}
      <div className="flex items-center justify-between border-b border-border px-6">
        <SprintSwitcher
          sprints={sprints}
          selectedId={switcherSelectedId}
          onSelect={handleSprintSelect}
        />

        {!isBacklog && (
          <div className="flex items-center gap-1 shrink-0 pl-4">
            <ViewToggle
              active={commandViewMode === 'kanban'}
              onClick={() => setCommandViewMode('kanban')}
              label="Kanban"
              icon={<Kanban className="h-3.5 w-3.5" />}
            />
            <ViewToggle
              active={commandViewMode === 'list'}
              onClick={() => setCommandViewMode('list')}
              label="List"
              icon={<List className="h-3.5 w-3.5" />}
            />
            <ViewToggle
              active={commandViewMode === 'pipeline'}
              onClick={() => setCommandViewMode('pipeline')}
              label="Design Pipeline"
              icon={<Palette className="h-3.5 w-3.5" />}
            />
          </div>
        )}
      </div>

      {/* Type filter bar */}
      <div className="flex items-center gap-2 border-b border-border px-6 py-2.5">
        <Filter className="h-3.5 w-3.5 text-text-muted shrink-0" />
        <div className="flex items-center gap-1.5">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setTypeFilter(filter.id)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                typeFilter === filter.id
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                  : 'bg-surface-hover text-text-muted hover:text-text-secondary hover:bg-surface-hover/80',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        {isBacklog ? (
          <BacklogView tasks={allTasks} />
        ) : commandViewMode === 'pipeline' ? (
          <DesignPipelineView
            groups={designPipelineGroups}
            onTaskClick={handleTaskClick}
          />
        ) : commandViewMode === 'kanban' ? (
          <KanbanBoard tasks={filteredTasks} onTaskClick={handleTaskClick} />
        ) : (
          <TaskListView tasks={filteredTasks} onTaskClick={handleTaskClick} />
        )}
      </div>

      {/* Task detail modal */}
      <TaskModal
        task={selectedTask}
        isOpen={modalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}

// ---- Design Pipeline View ----

function DesignPipelineView({
  groups,
  onTaskClick,
}: {
  groups: Record<DesignStatus, DevTask[]>;
  onTaskClick: (task: DevTask) => void;
}) {
  const totalDesignTasks = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);

  if (totalDesignTasks === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <Compass className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm">No design tasks found.</p>
        <p className="mt-1 text-xs">
          Filter to &ldquo;Design&rdquo; type or tag tasks with &ldquo;design&rdquo; to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {DESIGN_STATUS_GROUPS.map((group) => {
        const tasks = groups[group.id];

        return (
          <div
            key={group.id}
            className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface/50"
          >
            {/* Group header */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <span
                className={cn('h-2 w-2 rounded-full', group.accentColor)}
              />
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {group.icon}
                {group.label}
              </span>
              <span className="ml-auto rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-text-muted">
                {tasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {tasks.length === 0 ? (
                <p className="py-6 text-center text-xs text-text-muted">
                  No tasks
                </p>
              ) : (
                tasks.map((task) => (
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

// ---- Inline helper components ----

function ViewToggle({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-surface-hover text-text-primary'
          : 'text-text-muted hover:text-text-secondary hover:bg-surface',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function TaskListView({
  tasks,
  onTaskClick,
}: {
  tasks: DevTask[];
  onTaskClick: (task: DevTask) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface">
            <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-text-muted w-20">
              ID
            </th>
            <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-text-muted">
              Title
            </th>
            <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-text-muted w-24">
              Status
            </th>
            <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-text-muted w-24">
              Priority
            </th>
            <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-text-muted w-24">
              Type
            </th>
            <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-text-muted w-32">
              Agent
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              onClick={() => onTaskClick(task)}
              className="border-b border-border last:border-b-0 cursor-pointer hover:bg-surface-hover transition-colors"
            >
              <td className="px-4 py-3 font-mono text-xs text-text-muted">
                {task.id}
              </td>
              <td className="px-4 py-3 text-sm text-text-primary">
                {task.title}
              </td>
              <td className="px-4 py-3">
                <StatusLabel status={task.status} />
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
              <td className="px-4 py-3 text-xs text-text-secondary truncate max-w-[120px]">
                {task.assignedAgent ?? 'Unassigned'}
              </td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-text-muted">
                No tasks in this sprint.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusLabel({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    'todo': 'bg-text-muted/20 text-text-muted',
    'in-progress': 'bg-status-amber/20 text-status-amber',
    'done': 'bg-status-green/20 text-status-green',
    'blocked': 'bg-status-red/20 text-status-red',
  };

  const labelMap: Record<string, string> = {
    'todo': 'Todo',
    'in-progress': 'In Progress',
    'done': 'Done',
    'blocked': 'Blocked',
  };

  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-none',
        colorMap[status] ?? 'bg-surface text-text-muted',
      )}
    >
      {labelMap[status] ?? status}
    </span>
  );
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`;
}
