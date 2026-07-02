'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';
import {
  CheckSquare,
  Square,
  XSquare,
  Plus,
  Calendar,
  User,
  Tag,
  X,
  ListTodo,
  Trash2,
  PanelRightOpen,
  Copy,
  ArrowUpDown,
  ChevronDown,
  Check,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Heading2,
  Eye,
  Pencil,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface Todo {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  deadline: string | null;
  tags: string;
  assignee: string | null;
  status: 'open' | 'done' | 'cancelled';
  created_at: string;
  updated_at: string;
}

type FilterStatus = 'all' | 'open' | 'done' | 'cancelled';
type SortField = 'priority' | 'deadline' | 'created';
type Priority = 'critical' | 'high' | 'medium' | 'low';

const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];

const PRIORITY_META: Record<Priority, { label: string; color: string; dot: string }> = {
  critical: { label: 'Critical', color: 'text-status-red', dot: 'bg-status-red' },
  high: { label: 'High', color: 'text-orange-400', dot: 'bg-orange-400' },
  medium: { label: 'Medium', color: 'text-status-blue', dot: 'bg-status-blue' },
  low: { label: 'Low', color: 'text-text-muted', dot: 'bg-text-muted' },
};

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'done', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
];

const ASSIGNEE_OPTIONS = ['Agent 1', 'Agent 2', 'Agent 3', 'Agent 4'];

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: Todo['status'] }) {
  switch (status) {
    case 'open':
      return <Square className="h-4 w-4 text-status-blue" />;
    case 'done':
      return <CheckSquare className="h-4 w-4 text-status-green" />;
    case 'cancelled':
      return <XSquare className="h-4 w-4 text-text-muted" />;
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority as Priority] ?? PRIORITY_META.medium;
  return (
    <span className={cn('flex items-center gap-1 text-[11px] font-medium', meta.color)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

function Dropdown({
  trigger,
  open,
  onToggle,
  children,
  align = 'left',
}: {
  trigger: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <div className="relative">
      <button onClick={onToggle} className="flex items-center">
        {trigger}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={onToggle} />
          <div
            className={cn(
              'absolute top-full z-40 mt-1 min-w-[180px] rounded-md border border-border bg-surface py-1 shadow-lg',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown description editor
// ---------------------------------------------------------------------------

function renderMarkdownPreview(md: string): string {
  if (!md) return '<span class="text-text-muted">No description</span>';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // headings
  html = html.replace(/^## (.+)$/gm, '<h3 class="text-sm font-semibold text-text-primary mt-2 mb-1">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 class="text-base font-semibold text-text-primary mt-2 mb-1">$1</h2>');
  // bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-text-primary">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // inline code
  html = html.replace(/`(.+?)`/g, '<code class="rounded bg-surface-active px-1 py-0.5 font-mono text-[11px] text-accent">$1</code>');
  // unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  // ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
  // line breaks
  html = html.replace(/\n/g, '<br/>');
  return html;
}

function DescriptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const wrapSelection = useCallback((before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const replacement = `${before}${selected || 'text'}${after}`;
    const next = value.slice(0, start) + replacement + value.slice(end);
    onChange(next);
    // restore cursor after React renders
    requestAnimationFrame(() => {
      ta.focus();
      const cursorPos = start + before.length + (selected || 'text').length;
      ta.setSelectionRange(
        start + before.length,
        start + before.length + (selected || 'text').length,
      );
    });
  }, [value, onChange]);

  const insertLinePrefix = useCallback((prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    // find the start of the current line
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }, [value, onChange]);

  const tools: { icon: typeof Bold; label: string; action: () => void }[] = [
    { icon: Bold, label: 'Bold', action: () => wrapSelection('**', '**') },
    { icon: Italic, label: 'Italic', action: () => wrapSelection('*', '*') },
    { icon: Code, label: 'Code', action: () => wrapSelection('`', '`') },
    { icon: Heading2, label: 'Heading', action: () => insertLinePrefix('## ') },
    { icon: List, label: 'Bullet list', action: () => insertLinePrefix('- ') },
    { icon: ListOrdered, label: 'Numbered list', action: () => insertLinePrefix('1. ') },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-text-secondary">Description</label>
        <button
          type="button"
          onClick={() => setPreview(!preview)}
          className="flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-secondary"
        >
          {preview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {!preview && (
        <div className="flex gap-0.5 mb-1.5">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.label}
                type="button"
                onClick={t.action}
                title={t.label}
                className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      )}

      {preview ? (
        <div
          className="min-h-[120px] rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-secondary prose-invert"
          dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(value) }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Supports **bold**, *italic*, `code`, ## headings, - lists..."
          rows={5}
          className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive tag picker
// ---------------------------------------------------------------------------

function TagPicker({
  tags,
  onChange,
  allKnownTags,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  allKnownTags: string[];
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const lower = input.toLowerCase();
    return allKnownTags.filter(
      (t) => !tags.includes(t) && (lower === '' || t.toLowerCase().includes(lower)),
    );
  }, [input, tags, allKnownTags]);

  const addTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleaned && !tags.includes(cleaned)) {
      onChange([...tags, cleaned]);
    }
    setInput('');
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-secondary">Tags</label>
      {/* Selected tags */}
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-text-secondary"
            >
              <Tag className="h-2.5 w-2.5 text-text-muted" />
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 rounded-full hover:text-status-red"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && input.trim()) {
            e.preventDefault();
            addTag(input);
          }
          if (e.key === 'Backspace' && input === '' && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
          }
        }}
        placeholder={tags.length > 0 ? 'Add another...' : 'Type and press Enter...'}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {suggestions.slice(0, 12).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="flex items-center gap-1 rounded-full border border-border-subtle bg-background px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:border-accent/40 hover:text-accent"
            >
              <Plus className="h-2.5 w-2.5" />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assignee picker
// ---------------------------------------------------------------------------

function AssigneePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-secondary">Assignee</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm transition-colors',
            value ? 'text-text-primary' : 'text-text-muted',
            'hover:border-accent/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
          )}
        >
          <span className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-text-muted" />
            {value || 'Unassigned'}
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 text-text-muted transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-md border border-border bg-surface py-1 shadow-lg">
              {/* Unassigned */}
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-surface-hover',
                  !value ? 'text-accent' : 'text-text-secondary',
                )}
              >
                <User className="h-3 w-3 text-text-muted" />
                Unassigned
                {!value && <Check className="ml-auto h-3 w-3" />}
              </button>
              <div className="my-1 h-px bg-border" />
              {ASSIGNEE_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => { onChange(a); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-surface-hover',
                    value === a ? 'text-accent' : 'text-text-secondary',
                  )}
                >
                  <User className="h-3 w-3 text-text-muted" />
                  {a}
                  {value === a && <Check className="ml-auto h-3 w-3" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TaskManagerPage() {
  const queryClient = useQueryClient();

  // -- Data fetching
  const { data, isLoading } = useQuery<{ todos: Todo[] }>({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then((r) => r.json()),
    refetchInterval: 15000,
  });
  const todos = data?.todos ?? [];

  // -- UI state
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortAsc, setSortAsc] = useState(true);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'closed' | 'add' | 'edit'>('closed');
  // For slide animation: keep panel mounted during close transition
  const [panelVisible, setPanelVisible] = useState(false);
  const [panelMounted, setPanelMounted] = useState(false);
  // Panel width: default 50% of viewport, resizable via drag handle
  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.5) : 700,
  );
  const isDragging = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  // dropdown open states
  const [sortOpen, setSortOpen] = useState(false);
  const [tagDropOpen, setTagDropOpen] = useState(false);
  const [assigneeDropOpen, setAssigneeDropOpen] = useState(false);

  // -- Derived data
  const allTags = useMemo(() => {
    const s = new Set<string>();
    todos.forEach((t) => {
      try { JSON.parse(t.tags || '[]').forEach((tag: string) => s.add(tag)); } catch {}
    });
    return Array.from(s).sort();
  }, [todos]);

  const allAssignees = useMemo(() => {
    const s = new Set<string>();
    todos.forEach((t) => { if (t.assignee) s.add(t.assignee); });
    return Array.from(s).sort();
  }, [todos]);

  const filtered = useMemo(() => {
    let list = todos;
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter);
    if (tagFilter) list = list.filter((t) => {
      try { return (JSON.parse(t.tags || '[]') as string[]).includes(tagFilter); } catch { return false; }
    });
    if (assigneeFilter) list = list.filter((t) => t.assignee === assigneeFilter);

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'priority':
          cmp = (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4);
          break;
        case 'deadline':
          cmp = (a.deadline || '9999') < (b.deadline || '9999') ? -1 : (a.deadline || '9999') > (b.deadline || '9999') ? 1 : 0;
          break;
        case 'created':
          cmp = a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [todos, statusFilter, tagFilter, assigneeFilter, sortField, sortAsc]);

  const selectedTodo = selectedId ? todos.find((t) => t.id === selectedId) ?? null : null;

  const openCount = todos.filter((t) => t.status === 'open').length;
  const doneCount = todos.filter((t) => t.status === 'done').length;

  // -- Panel animation helpers
  const openPanel = useCallback((mode: 'add' | 'edit', id: string | null) => {
    setSelectedId(id);
    setPanelMode(mode);
    setPanelMounted(true);
    // trigger animation on next frame so the element is in the DOM
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelVisible(true));
    });
  }, []);

  const closePanel = useCallback(() => {
    setPanelVisible(false);
    // wait for slide-out to finish, then unmount
    setTimeout(() => {
      setPanelMode('closed');
      setPanelMounted(false);
      setSelectedId(null);
    }, 300);
  }, []);

  // -- Mutations
  const toggleMutation = useMutation({
    mutationFn: (todo: Todo) =>
      fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateStatus',
          id: todo.id,
          status: todo.status === 'open' ? 'done' : 'open',
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const addMutation = useMutation({
    mutationFn: (payload: Record<string, any>) =>
      fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      closePanel();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, any>) =>
      fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', ...payload }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      if (panelMode === 'edit') closePanel();
    },
  });

  const copyReference = useCallback((todo: Todo) => {
    let tags: string[] = [];
    try { tags = JSON.parse(todo.tags || '[]'); } catch {}
    const parts = [
      `[${todo.id}]`,
      todo.title,
      `(${todo.priority}/${todo.status})`,
    ];
    if (todo.deadline) parts.push(`due:${todo.deadline}`);
    if (todo.assignee) parts.push(`@${todo.assignee}`);
    if (tags.length > 0) parts.push(tags.map((t) => `#${t}`).join(' '));
    navigator.clipboard.writeText(parts.join(' '));
  }, []);

  // -- Loading
  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <LoadingSkeleton variant="text" className="h-8 w-48" />
        </div>
        <div className="flex-1 p-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingSkeleton key={i} variant="card" className="h-14 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasActiveFilters = tagFilter !== null || assigneeFilter !== null;

  return (
    <div className="flex h-full flex-col">
      {/* ---- Header ---- */}
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-accent/10 p-2">
            <ListTodo className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-text-primary">Task Manager</h1>
            <p className="text-xs text-text-muted">
              {openCount} open, {doneCount} done
            </p>
          </div>
        </div>
        <button
          onClick={() => openPanel('add', null)}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Task
        </button>
      </header>

      {/* ---- Filter / sort bar ---- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                statusFilter === f.key
                  ? 'bg-accent text-white'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="mx-1 h-4 w-px bg-border" />

        {/* Tag filter */}
        <Dropdown
          open={tagDropOpen}
          onToggle={() => setTagDropOpen(!tagDropOpen)}
          trigger={
            <span className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              tagFilter ? 'bg-accent/20 text-accent' : 'bg-surface text-text-secondary hover:bg-surface-hover',
            )}>
              <Tag className="h-3 w-3" />
              {tagFilter ?? 'Tag'}
              <ChevronDown className="h-3 w-3" />
            </span>
          }
        >
          <button
            onClick={() => { setTagFilter(null); setTagDropOpen(false); }}
            className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover', !tagFilter && 'text-accent')}
          >
            All tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => { setTagFilter(tag); setTagDropOpen(false); }}
              className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover', tagFilter === tag && 'text-accent')}
            >
              <Tag className="h-3 w-3" /> {tag}
            </button>
          ))}
          {allTags.length === 0 && (
            <span className="block px-3 py-1.5 text-xs text-text-muted">No tags yet</span>
          )}
        </Dropdown>

        {/* Assignee filter */}
        <Dropdown
          open={assigneeDropOpen}
          onToggle={() => setAssigneeDropOpen(!assigneeDropOpen)}
          trigger={
            <span className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              assigneeFilter ? 'bg-accent/20 text-accent' : 'bg-surface text-text-secondary hover:bg-surface-hover',
            )}>
              <User className="h-3 w-3" />
              {assigneeFilter ?? 'Assignee'}
              <ChevronDown className="h-3 w-3" />
            </span>
          }
        >
          <button
            onClick={() => { setAssigneeFilter(null); setAssigneeDropOpen(false); }}
            className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover', !assigneeFilter && 'text-accent')}
          >
            All assignees
          </button>
          {allAssignees.map((a) => (
            <button
              key={a}
              onClick={() => { setAssigneeFilter(a); setAssigneeDropOpen(false); }}
              className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover', assigneeFilter === a && 'text-accent')}
            >
              <User className="h-3 w-3" /> {a}
            </button>
          ))}
          {allAssignees.length === 0 && (
            <span className="block px-3 py-1.5 text-xs text-text-muted">No assignees yet</span>
          )}
        </Dropdown>

        {hasActiveFilters && (
          <button
            onClick={() => { setTagFilter(null); setAssigneeFilter(null); }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-status-red hover:bg-surface-hover"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}

        <div className="ml-auto">
          <Dropdown
            open={sortOpen}
            onToggle={() => setSortOpen(!sortOpen)}
            align="right"
            trigger={
              <span className="flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-hover">
                <ArrowUpDown className="h-3 w-3" />
                {sortField === 'priority' ? 'Priority' : sortField === 'deadline' ? 'Due date' : 'Created'}
              </span>
            }
          >
            {([['priority', 'Priority'], ['deadline', 'Due date'], ['created', 'Created']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  if (sortField === key) setSortAsc(!sortAsc);
                  else { setSortField(key); setSortAsc(true); }
                  setSortOpen(false);
                }}
                className={cn('flex w-full items-center justify-between px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover', sortField === key && 'text-accent')}
              >
                {label}
                {sortField === key && <span className="text-[10px]">{sortAsc ? 'ASC' : 'DESC'}</span>}
              </button>
            ))}
          </Dropdown>
        </div>
      </div>

      {/* ---- Body: task list ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover">
              <ListTodo className="h-7 w-7 text-text-muted" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">
              {statusFilter === 'all' && !hasActiveFilters ? 'No tasks yet' : 'No matching tasks'}
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              {statusFilter === 'all' && !hasActiveFilters
                ? 'Add a task to get started.'
                : 'Try changing your filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((todo) => {
              let tags: string[] = [];
              try { tags = JSON.parse(todo.tags || '[]'); } catch {}
              return (
                <div
                  key={todo.id}
                  onClick={() => openPanel('edit', todo.id)}
                  className={cn(
                    'group flex cursor-pointer items-start gap-3 px-6 py-3 transition-colors hover:bg-surface-hover',
                    selectedId === todo.id && panelMode === 'edit' && 'bg-surface-hover',
                  )}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(todo); }}
                    className="mt-0.5 flex-shrink-0"
                  >
                    <StatusIcon status={todo.status} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      'text-sm font-medium',
                      todo.status === 'done' ? 'text-text-muted line-through' : 'text-text-primary',
                    )}>
                      {todo.title}
                    </p>
                    {todo.description && (
                      <p className="mt-0.5 text-xs text-text-secondary line-clamp-1">
                        {todo.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <PriorityBadge priority={todo.priority} />
                      {todo.deadline && (
                        <span className="flex items-center gap-1 text-[11px] text-text-muted">
                          <Calendar className="h-3 w-3" />
                          {todo.deadline}
                        </span>
                      )}
                      {todo.assignee && (
                        <span className="flex items-center gap-1 text-[11px] text-text-muted">
                          <User className="h-3 w-3" />
                          {todo.assignee}
                        </span>
                      )}
                      {tags.length > 0 && tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-text-muted"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); openPanel('edit', todo.id); }}
                      title="Open details"
                      className="rounded p-1 text-text-muted hover:bg-surface-active hover:text-text-primary"
                    >
                      <PanelRightOpen className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyReference(todo); }}
                      title="Copy reference"
                      className="rounded p-1 text-text-muted hover:bg-surface-active hover:text-text-primary"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(todo.id); }}
                      title="Delete"
                      className="rounded p-1 text-text-muted hover:bg-status-red/10 hover:text-status-red"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Full-page overlay backdrop (fixed, covers viewport) ---- */}
      {panelMounted && (
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/30 transition-opacity duration-300',
            panelVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          onClick={closePanel}
        />
      )}

      {/* ---- Full-height sliding side panel (fixed, right edge, full viewport height) ---- */}
      {panelMounted && (
        <div
          style={{ width: panelWidth }}
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex border-l border-border bg-surface shadow-2xl',
            !isResizing && 'transition-transform duration-300 ease-out',
            panelVisible ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          {/* Drag handle for resizing */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              isDragging.current = true;
              setIsResizing(true);
              const startX = e.clientX;
              const startW = panelWidth;
              const onMove = (ev: MouseEvent) => {
                if (!isDragging.current) return;
                const delta = startX - ev.clientX;
                const next = Math.max(360, Math.min(startW + delta, window.innerWidth - 260));
                setPanelWidth(next);
              };
              const onUp = () => {
                isDragging.current = false;
                setIsResizing(false);
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
              };
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
            className="group/handle flex w-1.5 shrink-0 cursor-col-resize items-center justify-center hover:bg-accent/20 active:bg-accent/30"
          >
            <div className="h-8 w-0.5 rounded-full bg-border transition-colors group-hover/handle:bg-accent group-active/handle:bg-accent" />
          </div>

          {/* Panel content */}
          <div className="flex min-w-0 flex-1 flex-col">
            <SidePanel
              key={selectedId ?? '__new__'}
              mode={panelMode === 'edit' ? 'edit' : 'add'}
              todo={panelMode === 'edit' ? selectedTodo : null}
              allKnownTags={allTags}
              onClose={closePanel}
              onSave={(payload) => {
                if (panelMode === 'add') {
                  addMutation.mutate(payload);
                } else if (panelMode === 'edit' && selectedId) {
                  updateMutation.mutate({ id: selectedId, ...payload });
                }
              }}
              onDelete={panelMode === 'edit' && selectedId ? () => deleteMutation.mutate(selectedId) : undefined}
              isPending={addMutation.isPending || updateMutation.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side Panel
// ---------------------------------------------------------------------------

function SidePanel({
  mode,
  todo,
  allKnownTags,
  onClose,
  onSave,
  onDelete,
  isPending,
}: {
  mode: 'add' | 'edit';
  todo: Todo | null;
  allKnownTags: string[];
  onClose: () => void;
  onSave: (payload: Record<string, any>) => void;
  onDelete?: () => void;
  isPending: boolean;
}) {
  const existingTags: string[] = useMemo(() => {
    if (!todo) return [];
    try { return JSON.parse(todo.tags || '[]'); } catch { return []; }
  }, [todo]);

  const [title, setTitle] = useState(todo?.title ?? '');
  const [description, setDescription] = useState(todo?.description ?? '');
  const [priority, setPriority] = useState<string>(todo?.priority ?? 'medium');
  const [deadline, setDeadline] = useState(todo?.deadline ?? '');
  const [assignee, setAssignee] = useState(todo?.assignee ?? '');
  const [tags, setTags] = useState<string[]>(existingTags);
  const [status, setStatus] = useState<string>(todo?.status ?? 'open');

  const handleSubmit = () => {
    if (!title.trim()) return;
    const payload: Record<string, any> = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      deadline: deadline || null,
      tags,
      assignee: assignee.trim() || null,
    };
    if (mode === 'edit') payload.status = status;
    onSave(payload);
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="flex h-full flex-col">
      {/* Panel header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          {mode === 'add' ? 'New Task' : 'Edit Task'}
        </h2>
        <button onClick={onClose} className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Panel body — scrollable */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && title.trim()) handleSubmit(); }}
              placeholder="Task title..."
              autoFocus
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Rich description editor */}
          <DescriptionEditor value={description} onChange={setDescription} />

          {/* Priority */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Priority</label>
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => {
                const meta = PRIORITY_META[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                      priority === p
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-surface text-text-secondary hover:bg-surface-hover',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Due Date</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [color-scheme:dark]"
            />
          </div>

          {/* Assignee dropdown */}
          <AssigneePicker value={assignee} onChange={setAssignee} />

          {/* Interactive tags */}
          <TagPicker tags={tags} onChange={setTags} allKnownTags={allKnownTags} />

          {/* Status (edit only) */}
          {mode === 'edit' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Status</label>
              <div className="flex gap-1.5">
                {(['open', 'done', 'cancelled'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors',
                      status === s
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-surface text-text-secondary hover:bg-surface-hover',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LLM-friendly reference (edit only) */}
          {mode === 'edit' && todo && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Quick Reference</label>
              <code className="block break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-text-muted">
                [{todo.id}] {todo.title} ({todo.priority}/{todo.status})
                {todo.deadline ? ` due:${todo.deadline}` : ''}
                {todo.assignee ? ` @${todo.assignee}` : ''}
              </code>
            </div>
          )}
        </div>
      </div>

      {/* Panel footer */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-4">
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || isPending}
          className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {mode === 'add' ? 'Create' : 'Save'}
        </button>
        <button
          onClick={onClose}
          className="rounded-md px-4 py-2 text-xs font-medium text-text-secondary hover:bg-surface-hover"
        >
          Cancel
        </button>
        {mode === 'edit' && onDelete && (
          <button
            onClick={onDelete}
            className="ml-auto flex items-center gap-1 rounded-md px-3 py-2 text-xs font-medium text-status-red hover:bg-status-red/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
