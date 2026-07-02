'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardStore } from '@/store/dashboard';
import {
  Newspaper,
  ExternalLink,
  Calendar,
  Tag,
  MessageSquare,
  Code,
  Cpu,
  Shield,
  Zap,
  BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  MessageSquare,
  Code,
  Cpu,
  Shield,
  Zap,
  BookOpen,
  Newspaper,
};

function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Newspaper;
}

interface TechUpdate {
  url: string;
  category_id: string;
  category_label: string;
  category_icon: string;
  title: string;
  summary: string;
  source: string;
  date: string;
  date_iso: string;
  ingested_at: string;
}

interface Category {
  id: string;
  label: string;
  icon: string;
  count: number;
}

export default function TechUpdatesPage() {
  const activeProjectId = useDashboardStore(s => s.activeProjectId) || 'default';
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ updates: TechUpdate[]; categories: Category[] }>({
    queryKey: ['tech-updates', activeCategory, activeProjectId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeCategory) params.set('category', activeCategory);
      params.set('projectId', activeProjectId);
      return fetch(`/api/tech-updates?${params}`).then((r) => r.json());
    },
    refetchInterval: 60000,
  });

  const updates = data?.updates ?? [];
  const categories = data?.categories ?? [];

  const freshSignals = useMemo(() => {
    const now = new Date();
    const hoursAgo48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    return updates
      .filter(u => new Date(u.ingested_at) >= hoursAgo48)
      .sort((a, b) => (b.date_iso ?? b.date ?? '').localeCompare(a.date_iso ?? a.date ?? ''));
  }, [updates]);

  const grouped = useMemo(() => {
    // Exclude items already shown in the Fresh Signals section
    const freshUrls = new Set(freshSignals.map(u => u.url));
    const remaining = updates.filter(u => !freshUrls.has(u.url));

    const dateMap = new Map<string, TechUpdate[]>();
    for (const u of remaining) {
      const d = u.date_iso || u.date || 'Unknown';
      if (!dateMap.has(d)) {
        dateMap.set(d, []);
      }
      dateMap.get(d)!.push(u);
    }
    // Sort groups by date descending (newest first)
    const groups = Array.from(dateMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({ date, items }));
    return groups;
  }, [updates, freshSignals]);

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load tech updates.'}
        onRetry={() => refetch()}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{ borderBottom: '1px solid var(--separator)' }}
        >
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex-1 p-6">
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="page-header">
        <div className="rounded-md p-2" style={{ background: 'var(--accent-fill)' }}>
          <Newspaper className="h-5 w-5" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1>Latest Tech Updates</h1>
          <p>
            {updates.length} updates across {categories.length} categories
          </p>
        </div>
      </div>

      {/* Category filters */}
      <div className="page-filters">
        <button
          onClick={() => setActiveCategory(null)}
          className={`page-filter ${!activeCategory ? 'page-filter-active' : ''}`}
        >
          All
        </button>
        {categories.map((cat) => {
          const Icon = getIcon(cat.icon);
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`page-filter flex items-center gap-1.5 ${isActive ? 'page-filter-active' : ''}`}
            >
              <Icon className="h-3 w-3" />
              {cat.label}
              <span className="opacity-60">({cat.count})</span>
            </button>
          );
        })}
      </div>

      {/* Updates list */}
      <div className="flex-1 overflow-y-auto">
        {updates.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'var(--fill-secondary)' }}
            >
              <Newspaper className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              No updates yet
            </h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Tech updates will appear here as they are ingested.
            </p>
          </div>
        ) : (
          <div>
            {/* Fresh Signals Section - Last 48 hours */}
            {freshSignals.length > 0 && (
              <div
                style={{
                  borderLeft: '2px solid var(--accent)',
                  background: 'var(--accent-fill)',
                }}
              >
                <div
                  className="sticky top-0 z-10 px-6 py-2"
                  style={{ background: 'var(--bg)' }}
                >
                  <span
                    className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Zap className="h-3 w-3" />
                    Fresh Signals (Last 48h) — {freshSignals.length}
                  </span>
                </div>
                <div>
                  {freshSignals.map((update, idx) => {
                    const Icon = getIcon(update.category_icon);
                    return (
                      <div
                        key={update.url}
                        className="px-6 py-3 transition-colors hover-bg"
                        style={
                          idx > 0
                            ? { borderTop: '1px solid var(--separator)', opacity: 0.9 }
                            : undefined
                        }
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="mt-0.5 flex-shrink-0 rounded p-1.5"
                            style={{ background: 'var(--material-regular)' }}
                          >
                            <Icon
                              className="h-3.5 w-3.5"
                              style={{ color: 'var(--text-tertiary)' }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3
                                className="truncate text-sm font-medium"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {update.title}
                              </h3>
                              <a
                                href={update.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 transition-colors"
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                            {update.summary && (
                              <p
                                className="mt-1 line-clamp-2 text-xs"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {update.summary}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center gap-3">
                              <span
                                className="flex items-center gap-1 text-[11px]"
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                <Tag className="h-3 w-3" />
                                {update.category_label}
                              </span>
                              {update.source && (
                                <span
                                  className="text-[11px]"
                                  style={{ color: 'var(--text-tertiary)' }}
                                >
                                  {update.source}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Date groups */}
            {grouped.map((group, groupIdx) => (
              <div
                key={group.date}
                style={
                  groupIdx > 0 || freshSignals.length > 0
                    ? { borderTop: '1px solid var(--separator)' }
                    : undefined
                }
              >
                <div
                  className="sticky top-0 z-10 px-6 py-2"
                  style={{ background: 'var(--bg)' }}
                >
                  <span
                    className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <Calendar className="h-3 w-3" />
                    {group.date}
                  </span>
                </div>
                <div>
                  {group.items.map((update, idx) => {
                    const Icon = getIcon(update.category_icon);
                    return (
                      <div
                        key={update.url}
                        className="px-6 py-3 transition-colors hover-bg"
                        style={
                          idx > 0
                            ? { borderTop: '1px solid var(--separator)', opacity: 0.9 }
                            : undefined
                        }
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="mt-0.5 flex-shrink-0 rounded p-1.5"
                            style={{ background: 'var(--material-regular)' }}
                          >
                            <Icon
                              className="h-3.5 w-3.5"
                              style={{ color: 'var(--text-tertiary)' }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3
                                className="truncate text-sm font-medium"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {update.title}
                              </h3>
                              <a
                                href={update.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 transition-colors"
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                            {update.summary && (
                              <p
                                className="mt-1 line-clamp-2 text-xs"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {update.summary}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center gap-3">
                              <span
                                className="flex items-center gap-1 text-[11px]"
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                <Tag className="h-3 w-3" />
                                {update.category_label}
                              </span>
                              {update.source && (
                                <span
                                  className="text-[11px]"
                                  style={{ color: 'var(--text-tertiary)' }}
                                >
                                  {update.source}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
