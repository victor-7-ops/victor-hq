'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Cpu,
  LayoutDashboard,
  BookOpen,
  Shield,
  Layers,
  TrendingUp,
  Archive,
  ChevronRight,
  FolderOpen,
  Newspaper,
  ListTodo,
  Settings,
  Pencil,
  Plus,
  Check,
  X,
  FileText,
  MessageCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/store/dashboard';

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
}

// Reordered per user request
const globalItems: NavItem[] = [
  { label: 'Agent Fleet', icon: Cpu, href: '/fleet' },
  { label: 'System Pulse', icon: Shield, href: '/security' },
  { label: 'Memory Log', icon: BookOpen, href: '/memory' },
  { label: 'Task Manager', icon: ListTodo, href: '/todos' },
  { label: 'Latest Tech Updates', icon: Newspaper, href: '/tech-updates' },
];

const projectPages: NavItem[] = [
  { label: 'Board', icon: LayoutDashboard, href: '/command' },
  { label: 'M1 DS', icon: Layers, href: '/ds' },
  { label: 'Market Intel', icon: TrendingUp, href: '/market-intel' },
  { label: 'Practitioner Signals', icon: MessageCircle, href: '/practitioner-signals' },
];

const archiveItems: NavItem[] = [
  { label: 'Setup', icon: Settings, href: '/setup' },
];

interface Project {
  id: string;
  name: string;
  pages: NavItem[];
}

const STORAGE_KEY = 'openclaw-projects';

function loadProjects(): Project[] {
  if (typeof window === 'undefined') return [{ id: 'default', name: 'Spectra', pages: projectPages }];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { id: string; name: string }[];
      return parsed.map((p) => ({
        ...p,
        pages: p.id === 'default' ? projectPages : [],
      }));
    }
  } catch { /* ignore */ }
  return [{ id: 'default', name: 'Spectra', pages: projectPages }];
}

function saveProjects(projects: Project[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(projects.map((p) => ({ id: p.id, name: p.name }))),
  );
}

function NavLink({ item, isActive, badge, indent }: { item: NavItem; isActive: boolean; badge?: number; indent?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        indent && 'pl-5',
        isActive
          ? 'tab-active bg-surface-hover text-text-primary'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-status-red px-1 text-[10px] font-semibold leading-none text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

function InlineEdit({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && text.trim()) onSave(text.trim());
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => text.trim() ? onSave(text.trim()) : onCancel()}
        className="w-full min-w-0 rounded border border-accent bg-surface px-1.5 py-0.5 text-sm font-medium text-text-primary outline-none"
      />
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const unacknowledgedAlerts = useDashboardStore((s) => s.unacknowledgedAlerts);

  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [openProjectIds, setOpenProjectIds] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const p of loadProjects()) {
      if (p.pages.some((pg) => pathname.startsWith(pg.href))) open.add(p.id);
    }
    return open;
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const updateProjects = useCallback((next: Project[]) => {
    setProjects(next);
    saveProjects(next);
  }, []);

  const toggleProject = (id: string) => {
    setOpenProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renameProject = (id: string, name: string) => {
    updateProjects(projects.map((p) => (p.id === id ? { ...p, name } : p)));
    setEditingId(null);
  };

  const addProject = () => {
    const id = `proj-${Date.now()}`;
    const newProject: Project = { id, name: 'New Project', pages: [] };
    updateProjects([...projects, newProject]);
    setEditingId(id);
    setOpenProjectIds((prev) => new Set(prev).add(id));
  };

  const removeProject = (id: string) => {
    if (id === 'default') return; // Can't remove default
    updateProjects(projects.filter((p) => p.id !== id));
  };

  return (
    <aside className="flex h-screen w-[240px] flex-col border-r border-border bg-surface">
      {/* Logo area */}
      <div className="flex h-12 items-center px-5">
        <span className="text-sm font-semibold tracking-tight text-text-primary">
          OpenClaw
        </span>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {/* Global items */}
        <div className="space-y-0.5">
          {globalItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname.startsWith(item.href)}
              badge={item.href === '/security' ? unacknowledgedAlerts : undefined}
            />
          ))}
        </div>

        {/* Projects section */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Projects
            </span>
            <button
              onClick={addProject}
              className="rounded p-0.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
              title="Add project"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 space-y-0.5">
            {projects.map((project) => {
              const isOpen = openProjectIds.has(project.id);
              const isEditing = editingId === project.id;

              return (
                <div key={project.id}>
                  <div className="group flex w-full items-center">
                    {isEditing ? (
                      <div className="flex-1 px-3 py-1">
                        <InlineEdit
                          value={project.name}
                          onSave={(v) => renameProject(project.id, v)}
                          onCancel={() => setEditingId(null)}
                        />
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleProject(project.id)}
                          className={cn(
                            'flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            isOpen || project.pages.some((p) => pathname.startsWith(p.href))
                              ? 'text-text-primary'
                              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                          )}
                        >
                          <FolderOpen className="h-4 w-4 shrink-0" />
                          <span className="truncate">{project.name}</span>
                          <ChevronRight
                            className={cn(
                              'ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                              isOpen && 'rotate-90',
                            )}
                          />
                        </button>
                        <button
                          onClick={() => setEditingId(project.id)}
                          className="mr-0.5 hidden rounded p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary group-hover:block"
                          title="Rename project"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {project.id !== 'default' && (
                          <button
                            onClick={() => setConfirmDeleteId(project.id)}
                            className="mr-1 hidden rounded p-1 text-text-muted transition-colors hover:bg-status-red/10 hover:text-status-red group-hover:block"
                            title="Delete project"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Delete confirmation */}
                  {confirmDeleteId === project.id && (
                    <div className="mx-3 mb-1 flex items-center gap-2 rounded-md border border-status-red/20 bg-status-red/5 px-3 py-2">
                      <span className="flex-1 text-xs text-status-red">Delete this project?</span>
                      <button
                        onClick={() => { removeProject(project.id); setConfirmDeleteId(null); }}
                        className="rounded bg-status-red px-2 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-status-red/80"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded border border-border px-2 py-0.5 text-[10px] font-medium text-text-secondary transition-colors hover:bg-surface-hover"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {isOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {project.pages.length > 0 ? (
                        project.pages.map((item) => (
                          <NavLink
                            key={item.href}
                            item={item}
                            isActive={pathname.startsWith(item.href)}
                            indent
                          />
                        ))
                      ) : (
                        <div className="px-5 py-2">
                          <span className="text-xs text-text-muted">No pages yet</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Archive — bottom, above footer */}
      <div className="border-t border-border px-3 py-2">
        <button
          onClick={() => setArchiveOpen(!archiveOpen)}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            archiveOpen
              ? 'text-text-primary'
              : 'text-text-muted hover:bg-surface-hover hover:text-text-secondary',
          )}
        >
          <Archive className="h-4 w-4 shrink-0" />
          <span className="truncate">Archive</span>
          <ChevronRight
            className={cn(
              'ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200',
              archiveOpen && 'rotate-90',
            )}
          />
        </button>

        {archiveOpen && (
          <div className="mt-0.5 space-y-0.5">
            {archiveItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname.startsWith(item.href)}
                indent
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-border px-5 py-3">
        <span className="text-[11px] text-text-muted">OpenClaw v2.0</span>
        <Link
          href="/releases"
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
        >
          changelog
        </Link>
      </div>
    </aside>
  );
}
