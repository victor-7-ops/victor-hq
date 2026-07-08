'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Map, MessageSquare, Clock, Activity, Brain, Columns3,
  Settings, DollarSign, TrendingUp, Cpu, Radio, ChevronRight,
  Plus, FileText, Eye, LayoutDashboard, Pencil, X, Check, Trash2,
  GitBranch, Terminal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fetchAgents } from '@/lib/api/agents-client';
import type { CronJob } from '@/lib/types';
import { useSettings } from '@/app/settings-provider';
import { useDashboardStore } from '@/store/dashboard';

function getInitials(name: string | null): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ---------------------------------------------------------------------------
// Nav item definition
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: 'agents' | 'unread' | 'errors' | 'feed-new';
  feedKey?: 'marketIntel' | 'techUpdates' | 'practitionerSignals';
}

const WORKSPACE_ITEMS: NavItem[] = [
  { href: '/', label: 'Map', icon: Map, badge: 'agents' },
  { href: '/kanban', label: 'Kanban', icon: Columns3 },
  { href: '/chat', label: 'Messages', icon: MessageSquare, badge: 'unread' },
  { href: '/crons', label: 'Crons', icon: Clock, badge: 'errors' },
  { href: '/agent-orchestrator', label: 'Agent Orchestrator', icon: GitBranch },
  { href: '/claude-code', label: 'Claude Code', icon: Terminal },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/costs', label: 'Costs', icon: DollarSign },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// Default pages every new project gets
const DEFAULT_PROJECT_ITEMS: NavItem[] = [
  { href: '/market-intel', label: 'Market Intel', icon: TrendingUp, badge: 'feed-new', feedKey: 'marketIntel' },
  { href: '/tech-updates', label: 'Tech Updates', icon: Cpu, badge: 'feed-new', feedKey: 'techUpdates' },
  { href: '/practitioner-signals', label: 'Practitioner', icon: Radio, badge: 'feed-new', feedKey: 'practitionerSignals' },
  { href: '/reference-files', label: 'Reference Files', icon: FileText },
  { href: '/competitors', label: 'Competitors', icon: Eye },
];

// ---------------------------------------------------------------------------
// Project persistence (localStorage)
// ---------------------------------------------------------------------------

interface StoredProject {
  id: string;
  label: string;
  description?: string;
  emoji?: string;
  url?: string;
}

const PROJECTS_STORAGE_KEY = 'mc-projects';

function loadStoredProjects(): StoredProject[] {
  try {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as StoredProject[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [{ id: 'default', label: 'Intelligence', emoji: '🔍', description: 'Market intelligence, tech updates, and competitive analysis' }];
}

function saveStoredProjects(projects: StoredProject[]) {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

// ---------------------------------------------------------------------------
// Project Detail Modal
// ---------------------------------------------------------------------------

function ProjectDetailModal({
  project,
  onSave,
  onClose,
}: {
  project: StoredProject;
  onSave: (updated: StoredProject) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(project.label === 'New Project' ? '' : project.label);
  const [emoji, setEmoji] = useState(project.emoji || '📁');
  const [description, setDescription] = useState(project.description || '');
  const [url, setUrl] = useState(project.url || '');

  const isNew = !project.label || project.label === 'New Project';

  const EMOJI_OPTIONS = ['📁', '🔍', '🚀', '🎯', '💡', '🔬', '📊', '🛡️', '⚡', '🌐', '🎨', '📱', '🤖', '🧪', '📈', '🔧'];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: 'var(--text-subheadline)',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--fill-quaternary)',
    border: '1px solid var(--separator)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 150ms var(--ease-smooth)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--text-caption1)',
    color: 'var(--text-tertiary)',
    marginBottom: 'var(--space-1)',
    fontWeight: 500,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 var(--space-4)',
          background: 'var(--material-regular)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--separator)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div style={{
          padding: 'var(--space-5) var(--space-5) 0',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 44,
            lineHeight: 1,
            marginBottom: 'var(--space-3)',
          }}>
            {emoji}
          </div>
          <h2 style={{
            fontSize: 'var(--text-title1)',
            fontWeight: 'var(--weight-bold)',
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-1)',
          }}>
            {isNew ? 'New Project' : 'Edit Project'}
          </h2>
          <p style={{
            fontSize: 'var(--text-subheadline)',
            color: 'var(--text-tertiary)',
            marginBottom: 'var(--space-4)',
          }}>
            {isNew ? 'Set up a new project workspace.' : 'Update your project details.'}
          </p>
        </div>

        {/* Form */}
        <div style={{
          padding: '0 var(--space-5) var(--space-4)',
          overflowY: 'auto',
          flex: 1,
        }}>
          {/* Emoji picker */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={labelStyle}>Icon</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 'var(--space-2)',
              justifyItems: 'center',
            }}>
              {EMOJI_OPTIONS.map(e => {
                const isActive = emoji === e;
                return (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      border: 'none',
                      background: isActive ? 'var(--accent-fill)' : 'var(--fill-quaternary)',
                      cursor: 'pointer',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: isActive ? '2px solid var(--accent)' : 'none',
                      outlineOffset: 2,
                      transition: 'all 100ms var(--ease-smooth)',
                    }}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={labelStyle}>Project Name</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Product Launch, Research Sprint"
              autoFocus
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--separator)'; }}
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this project about? Goals, scope, key focus areas..."
              rows={3}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--separator)'; }}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
            />
          </div>

          {/* URL */}
          <div>
            <label style={labelStyle}>Link <span style={{ color: 'var(--text-quaternary)', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--separator)'; }}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-3) var(--space-5) var(--space-5)',
          gap: 'var(--space-3)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--fill-tertiary)',
              color: 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-subheadline)',
              fontWeight: 'var(--weight-medium)',
              transition: 'all 150ms var(--ease-smooth)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!label.trim()) return;
              onSave({ ...project, label: label.trim(), emoji, description: description.trim(), url: url.trim() });
            }}
            disabled={!label.trim()}
            style={{
              padding: 'var(--space-2) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              background: label.trim() ? 'var(--accent)' : 'var(--fill-tertiary)',
              color: label.trim() ? 'var(--accent-contrast)' : 'var(--text-quaternary)',
              border: 'none',
              cursor: label.trim() ? 'pointer' : 'not-allowed',
              fontSize: 'var(--text-subheadline)',
              fontWeight: 'var(--weight-semibold)',
              transition: 'all 150ms var(--ease-smooth)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isNew ? 'Create Project' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed + badge state
// ---------------------------------------------------------------------------

type FeedCounts = { marketIntel: number; techUpdates: number; practitionerSignals: number };
type FeedNewFlags = Record<string, boolean>;

const FEED_SEEN_KEY = 'mc-feed-seen-counts';
const PROJECT_COLLAPSED_KEY = 'mc-project-collapsed';

function loadSeenCounts(): Partial<FeedCounts> {
  try {
    return JSON.parse(localStorage.getItem(FEED_SEEN_KEY) || '{}');
  } catch { return {}; }
}

function saveSeenCounts(counts: FeedCounts) {
  localStorage.setItem(FEED_SEEN_KEY, JSON.stringify(counts));
}

function loadCollapsedProjects(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PROJECT_COLLAPSED_KEY) || '[]'));
  } catch { return new Set(); }
}

function saveCollapsedProjects(set: Set<string>) {
  localStorage.setItem(PROJECT_COLLAPSED_KEY, JSON.stringify([...set]));
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '11px',
        fontWeight: 500,
        letterSpacing: '0.06em',
        color: 'var(--text-quaternary)',
        textTransform: 'uppercase',
        padding: '12px 8px 4px',
      }}
    >
      <span>{label}</span>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline edit for project rename
// ---------------------------------------------------------------------------

function InlineProjectEdit({
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

  return (
    <input
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && text.trim()) onSave(text.trim());
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => text.trim() ? onSave(text.trim()) : onCancel()}
      style={{
        width: '100%',
        minWidth: 0,
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--text-primary)',
        background: 'var(--fill-quaternary)',
        border: '1px solid var(--accent)',
        borderRadius: '4px',
        padding: '2px 8px',
        outline: 'none',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// NavLinks component
// ---------------------------------------------------------------------------

export function NavLinks({ bottomSlot, collapsed }: { bottomSlot?: React.ReactNode; collapsed?: boolean } = {}) {
  const pathname = usePathname();
  const { settings } = useSettings();
  const activeProjectId = useDashboardStore(s => s.activeProjectId);
  const setActiveProjectId = useDashboardStore(s => s.setActiveProjectId);
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [cronCount, setCronCount] = useState<number | null>(null);
  const [cronErrorCount, setCronErrorCount] = useState<number | null>(null);
  const [feedNew, setFeedNew] = useState<FeedNewFlags>({});
  const [feedCounts, setFeedCounts] = useState<FeedCounts | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  // Project management state
  const [projects, setProjects] = useState<StoredProject[]>([{ id: 'default', label: 'Intelligence', emoji: '🔍', description: 'Market intelligence, tech updates, and competitive analysis' }]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [detailProject, setDetailProject] = useState<StoredProject | null>(null);

  // Load projects from localStorage
  useEffect(() => {
    setProjects(loadStoredProjects());
  }, []);

  // Load collapsed state from localStorage
  useEffect(() => {
    setCollapsedProjects(loadCollapsedProjects());
  }, []);

  const toggleProject = useCallback((projectId: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      saveCollapsedProjects(next);
      return next;
    });
  }, []);

  // Auto-expand project if user navigates to an item within it
  useEffect(() => {
    for (const project of projects) {
      if (DEFAULT_PROJECT_ITEMS.some(item => pathname.startsWith(item.href))) {
        setCollapsedProjects(prev => {
          if (prev.has(project.id)) {
            const next = new Set(prev);
            next.delete(project.id);
            saveCollapsedProjects(next);
            return next;
          }
          return prev;
        });
      }
    }
  }, [pathname, projects]);

  // Project CRUD operations
  const addProject = useCallback(() => {
    const id = `proj-${Date.now()}`;
    const newProject: StoredProject = { id, label: 'New Project', emoji: '📁', description: '' };
    setDetailProject(newProject);
  }, []);

  const saveProject = useCallback((proj: StoredProject) => {
    const exists = projects.some(p => p.id === proj.id);
    const updated = exists
      ? projects.map(p => p.id === proj.id ? proj : p)
      : [...projects, proj];
    setProjects(updated);
    saveStoredProjects(updated);
    setDetailProject(null);
    setEditingProjectId(null);
    // Auto-expand the new/edited project
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      next.delete(proj.id);
      saveCollapsedProjects(next);
      return next;
    });
  }, [projects]);

  const deleteProject = useCallback((id: string) => {
    if (id === 'default') return;
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    saveStoredProjects(updated);
    setConfirmDeleteId(null);
  }, [projects]);

  // Fetch agent count
  useEffect(() => {
    fetchAgents()
      .then((list) => setAgentCount(list.length))
      .catch(() => setAgentCount(null));
  }, []);

  // Fetch cron error count
  useEffect(() => {
    fetch('/api/crons')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        const crons: CronJob[] = Array.isArray(data)
          ? data
          : (data as { crons?: CronJob[] })?.crons ?? [];
        setCronCount(crons.length);
        setCronErrorCount(crons.filter((c) => c.status === 'error').length);
      })
      .catch(() => setCronErrorCount(null));
  }, []);

  // Fetch feed counts and compare to last-seen
  useEffect(() => {
    function fetchCounts() {
      fetch(`/api/feed-counts?projectId=${activeProjectId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data: FeedCounts | null) => {
          if (!data) return;
          setFeedCounts(data);
          const seen = loadSeenCounts();
          setFeedNew({
            marketIntel: (seen.marketIntel ?? 0) < data.marketIntel,
            techUpdates: (seen.techUpdates ?? 0) < data.techUpdates,
            practitionerSignals: (seen.practitionerSignals ?? 0) < data.practitionerSignals,
          });
        })
        .catch(() => {});
    }
    fetchCounts();
    const interval = setInterval(fetchCounts, 60_000);
    return () => clearInterval(interval);
  }, [activeProjectId]);

  // Mark feed as seen when user navigates to the page
  useEffect(() => {
    if (!feedCounts) return;
    const feedMap: Record<string, keyof FeedCounts> = {
      '/market-intel': 'marketIntel',
      '/tech-updates': 'techUpdates',
      '/practitioner-signals': 'practitionerSignals',
    };
    const key = feedMap[pathname];
    if (key && feedNew[key]) {
      const updated = { ...loadSeenCounts(), [key]: feedCounts[key] } as FeedCounts;
      saveSeenCounts(updated);
      setFeedNew((prev) => ({ ...prev, [key]: false }));
    }
  }, [pathname, feedCounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve badge content per nav item
  function getBadge(item: NavItem): React.ReactNode {
    if (item.badge === 'agents' && agentCount !== null) {
      return (
        <span
          className="nav-badge"
          style={{
            marginLeft: 'auto',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            padding: '1px 6px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--fill-quaternary)',
            color: 'var(--text-tertiary)',
            lineHeight: '16px',
          }}
        >
          {agentCount}
        </span>
      );
    }
    if (item.badge === 'errors' && cronCount !== null) {
      const hasErrors = cronErrorCount !== null && cronErrorCount > 0;
      return (
        <span
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            className="nav-badge"
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
              background: hasErrors ? 'rgba(255,69,58,0.1)' : 'var(--fill-quaternary)',
              color: hasErrors ? 'var(--system-red)' : 'var(--text-tertiary)',
              lineHeight: '16px',
              fontWeight: hasErrors ? 600 : undefined,
            }}
          >
            {hasErrors ? `${cronErrorCount} err` : cronCount}
          </span>
          {hasErrors && (
            <span
              aria-label={`${cronErrorCount} cron error${cronErrorCount > 1 ? 's' : ''}`}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--system-red)',
                flexShrink: 0,
                animation: 'pulse-red 1.5s ease-in-out infinite',
              }}
            />
          )}
        </span>
      );
    }
    if (item.badge === 'feed-new' && item.feedKey && feedNew[item.feedKey]) {
      return (
        <span
          aria-label="New data available"
          style={{
            marginLeft: 'auto',
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: 'var(--accent-secondary)',
            flexShrink: 0,
            boxShadow: '0 0 6px var(--accent-secondary)',
          }}
        />
      );
    }
    return null;
  }

  // Render a single nav link
  function renderNavLink(item: NavItem, indent: number = 0, isActiveProject: boolean = true, onClickProject?: () => void) {
    const isActive = isActiveProject && (
      item.href === '/'
        ? pathname === '/'
        : pathname.startsWith(item.href)
    );

    const isUnread = item.feedKey && feedNew[item.feedKey];
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClickProject}
        className={`nav-item focus-ring ${isActive ? 'nav-item-active' : ''}`}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : undefined,
          gap: collapsed ? '0' : '10px',
          minHeight: '32px',
          padding: collapsed ? '0 4px' : `0 10px 0 ${12 + indent}px`,
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: isActive ? 600 : 500,
          color: isActive
            ? 'var(--accent)'
            : isUnread
              ? 'var(--text-primary)'
              : 'var(--text-secondary)',
          background: isActive ? 'var(--accent-fill)' : 'transparent',
          textDecoration: 'none',
          transition: 'all 150ms ease-out',
          borderLeft: collapsed
            ? 'none'
            : isUnread && !isActive
              ? '2px solid var(--accent)'
              : isActive
                ? '2px solid var(--accent)'
                : '2px solid transparent',
          opacity: isUnread || isActive ? 1 : undefined,
        }}
      >
        <Icon
          size={collapsed ? 18 : 15}
          style={{
            flexShrink: 0,
            color: isActive
              ? 'var(--accent)'
              : isUnread
                ? 'var(--text-secondary)'
                : 'var(--text-tertiary)',
            transition: 'color 150ms ease-out',
          }}
        />
        {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
        {!collapsed && getBadge(item)}
      </Link>
    );
  }

  // Check if any project item has unread data
  function projectHasUnread(): boolean {
    return DEFAULT_PROJECT_ITEMS.some(item => item.feedKey && feedNew[item.feedKey]);
  }

  return (
    <>
    <nav className="flex-1 flex flex-col" style={{ minHeight: 0 }} aria-label="Main navigation">
      {/* Scrollable nav items */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: collapsed ? '4px 6px 8px' : '4px 12px 8px' }}>

        {/* ── WORKSPACE ─────────────────────── */}
        {!collapsed && <SectionHeader label="Workspace" />}
        {collapsed && <div style={{ height: '8px' }} />}

        <div className="flex flex-col gap-0.5">
          {WORKSPACE_ITEMS.map((item) => renderNavLink(item))}
        </div>

        {/* ── PROJECTS ──────────────────────── */}
        {!collapsed && (
          <SectionHeader
            label="Projects"
            action={
              <button
                onClick={addProject}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontSize: '11px',
                  color: 'var(--text-quaternary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  transition: 'color 150ms ease-out',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-quaternary)')}
                title="New Project"
              >
                <Plus size={12} />
              </button>
            }
          />
        )}
        {collapsed && (
          <div
            style={{
              margin: '8px 0 4px',
              borderTop: '1px solid var(--separator)',
            }}
          />
        )}

        <div className="flex flex-col gap-0.5">
          {projects.map((project) => {
            const isProjectCollapsed = collapsedProjects.has(project.id);
            const hasUnread = projectHasUnread();
            const isProjectActive = project.id === activeProjectId && DEFAULT_PROJECT_ITEMS.some(
              item => item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            );
            const isConfirmingDelete = confirmDeleteId === project.id;

            return (
              <div key={project.id}>
                {/* Project header (collapsible) — hidden when sidebar collapsed */}
                {!collapsed && (
                  <div className="group" style={{ position: 'relative' }}>
                    <div className="flex items-center">
                        <button
                          onClick={() => { toggleProject(project.id); setActiveProjectId(project.id); }}
                          className="hover-bg flex-1 flex items-center gap-2 rounded-md text-left"
                          style={{
                            minHeight: '32px',
                            padding: '0 4px 0 12px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: isProjectActive ? 'var(--accent)' : 'var(--text-secondary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 150ms ease-out',
                          }}
                        >
                          <ChevronRight
                            size={12}
                            style={{
                              flexShrink: 0,
                              color: 'var(--text-quaternary)',
                              transition: 'transform 200ms ease-out',
                              transform: isProjectCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                            }}
                          />
                          <span style={{ fontSize: '14px', lineHeight: 1 }}>{project.emoji || '📁'}</span>
                          <span className="flex-1 truncate">{project.label}</span>
                          {hasUnread && isProjectCollapsed && (
                            <span
                              style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: 'var(--accent-secondary)', flexShrink: 0,
                                boxShadow: '0 0 4px var(--accent-secondary)',
                              }}
                            />
                          )}
                        </button>
                        {/* Hover actions: edit + delete — use hidden/group-hover with Tailwind only */}
                        <div className="hidden group-hover:flex items-center gap-0.5 mr-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailProject(project); }}
                            title="Edit project"
                            className="flex items-center justify-center w-[22px] h-[22px] rounded text-[--text-quaternary] hover:text-[--text-secondary] hover:bg-[--fill-quaternary] border-none bg-transparent cursor-pointer"
                          >
                            <Pencil size={11} />
                          </button>
                          {project.id !== 'default' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                              title="Delete project"
                              className="flex items-center justify-center w-[22px] h-[22px] rounded text-[--text-quaternary] hover:text-[--system-red] hover:bg-[rgba(255,69,58,0.1)] border-none bg-transparent cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                    {/* Delete confirmation */}
                    {isConfirmingDelete && (
                      <div
                        style={{
                          margin: '4px 10px 4px 12px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: 'rgba(255,69,58,0.06)',
                          border: '1px solid rgba(255,69,58,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span style={{ flex: 1, fontSize: '11px', color: 'var(--system-red)' }}>
                          Delete &ldquo;{project.label}&rdquo;?
                        </span>
                        <button
                          onClick={() => deleteProject(project.id)}
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            color: '#fff',
                            background: 'var(--system-red)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            color: 'var(--text-tertiary)',
                            background: 'var(--fill-quaternary)',
                            border: '1px solid var(--separator)',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Project items — always show when sidebar collapsed (no project toggle) */}
                {(collapsed || !isProjectCollapsed) && (
                  <div
                    className="flex flex-col gap-0.5"
                    style={{
                      marginTop: '1px',
                    }}
                  >
                    {DEFAULT_PROJECT_ITEMS.map((item) =>
                      renderNavLink(item, collapsed ? 0 : 14, project.id === activeProjectId, () => setActiveProjectId(project.id))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Pinned bottom: usage widget + user footer */}
      <div style={{ flexShrink: 0 }}>
        {bottomSlot}

        {/* User footer */}
        <div
          style={{
            borderTop: '1px solid var(--separator)',
            padding: collapsed ? '8px 0' : '8px 16px',
            display: 'flex',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <div className="flex items-center" style={{ gap: collapsed ? '0' : '10px' }}>
            {settings.operatorProfileImage ? (
              <img
                src={settings.operatorProfileImage}
                alt="Operator"
                title={collapsed ? (settings.operatorName ?? 'Operator') : undefined}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                title={collapsed ? (settings.operatorName ?? 'Operator') : undefined}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: 'var(--accent-fill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--accent)',
                  flexShrink: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {getInitials(settings.operatorName)}
              </div>
            )}
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {settings.operatorName ?? 'Operator'}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  Owner
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>

    {/* Project detail modal — portaled to body so sidebar overflow doesn't clip it */}
    {detailProject && typeof document !== 'undefined' && createPortal(
      <ProjectDetailModal
        project={detailProject}
        onSave={saveProject}
        onClose={() => setDetailProject(null)}
      />,
      document.body,
    )}
    </>
  );
}
