'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardStore } from '@/store/dashboard';
import {
  UserRound,
  ExternalLink,
  Calendar,
  Tag,
  MessageSquare,
  Search,
  Quote,
} from 'lucide-react';

interface PractitionerSignal {
  url: string;
  type: string;
  platform: string;
  author: string | null;
  title: string;
  verbatim: string;
  context: string;
  relevance: number;
  tags_json: string;
  date: string;
  date_iso: string;
  ingested_at: string;
}

interface SignalType {
  type: string;
  count: number;
}

const TYPE_META: Record<string, { label: string; color: string; icon: typeof MessageSquare }> = {
  'tool-comparison': { label: 'Tool Comparison', color: 'var(--system-purple)', icon: MessageSquare },
  'thesis-validation': { label: 'Thesis Validation', color: 'var(--system-blue)', icon: MessageSquare },
  'pain-point': { label: 'Pain Point', color: 'var(--system-red)', icon: MessageSquare },
  'workflow-gap': { label: 'Workflow Gap', color: 'var(--system-orange)', icon: MessageSquare },
};

export default function PractitionerSignalsPage() {
  const activeProjectId = useDashboardStore(s => s.activeProjectId) || 'default';
  const [activeType, setActiveType] = useState<string | null>(null);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error, refetch } = useQuery<{ signals: PractitionerSignal[]; types: SignalType[] }>({
    queryKey: ['practitioner-signals', activeType, activeProjectId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeType) params.set('type', activeType);
      params.set('projectId', activeProjectId);
      return fetch(`/api/practitioner-signals?${params}`).then((r) => r.json());
    },
    refetchInterval: 60000,
  });

  const signals = data?.signals ?? [];
  const types = data?.types ?? [];

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return signals;
    const q = searchQuery.toLowerCase();
    return signals.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.context.toLowerCase().includes(q) ||
        s.verbatim.toLowerCase().includes(q) ||
        (s.author?.toLowerCase().includes(q) ?? false),
    );
  }, [signals, searchQuery]);

  const grouped = useMemo(() => {
    const dateMap = new Map<string, PractitionerSignal[]>();
    for (const s of filtered) {
      const d = s.date_iso || s.date || 'Unknown';
      if (!dateMap.has(d)) {
        dateMap.set(d, []);
      }
      dateMap.get(d)!.push(s);
    }
    // Sort groups by date descending (newest first) - matches backend ORDER BY date_iso DESC
    const groups = Array.from(dateMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({ date, items }));
    return groups;
  }, [filtered]);

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load practitioner signals.'}
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
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="page-header">
        <div className="flex items-center gap-3" style={{ flex: 1 }}>
          <div className="rounded-md p-2" style={{ background: 'var(--accent-fill)' }}>
            <UserRound className="h-5 w-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1>Practitioner Signals</h1>
            <p>
              {signals.length} signals from practitioners
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: 'var(--text-tertiary)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search signals..."
            className="rounded-md py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1"
            style={{
              border: '1px solid var(--separator)',
              background: 'var(--material-regular)',
              color: 'var(--text-primary)',
              // @ts-expect-error CSS custom property placeholder workaround
              '--tw-ring-color': 'var(--accent)',
            }}
          />
        </div>
      </div>

      {/* Type filters */}
      <div className="page-filters">
        <button
          onClick={() => setActiveType(null)}
          className={`page-filter ${!activeType ? 'page-filter-active' : ''}`}
        >
          All
        </button>
        {types.map((t) => {
          const meta = TYPE_META[t.type] || { label: t.type, color: 'var(--text-tertiary)', icon: MessageSquare };
          const Icon = meta.icon;
          return (
            <button
              key={t.type}
              onClick={() => setActiveType(activeType === t.type ? null : t.type)}
              className={`page-filter flex items-center gap-1.5 ${activeType === t.type ? 'page-filter-active' : ''}`}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
              <span style={{ opacity: 0.6 }}>({t.count})</span>
            </button>
          );
        })}
      </div>

      {/* Signals list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'var(--fill-secondary)' }}
            >
              <UserRound className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {searchQuery ? 'No matching signals' : 'No practitioner signals yet'}
            </h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {searchQuery
                ? 'Try a different search term.'
                : 'Practitioner signals will appear here as they are ingested.'}
            </p>
          </div>
        ) : (
          <div>
            {grouped.map((group, groupIdx) => (
              <div
                key={group.date}
                style={groupIdx > 0 ? { borderTop: '1px solid var(--separator)' } : undefined}
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
                  {group.items.map((signal, itemIdx) => {
                    const meta = TYPE_META[signal.type] || { label: signal.type, color: 'var(--text-tertiary)', icon: MessageSquare };
                    const TypeIcon = meta.icon;
                    let tags: string[] = [];
                    try { tags = JSON.parse(signal.tags_json || '[]'); } catch {}
                    const isExpanded = expandedUrl === signal.url;

                    return (
                      <div
                        key={signal.url}
                        onClick={() => setExpandedUrl(isExpanded ? null : signal.url)}
                        className="cursor-pointer px-6 py-3 hover-bg"
                        style={itemIdx > 0 ? { borderTop: '1px solid color-mix(in srgb, var(--separator) 50%, transparent)' } : undefined}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="mt-0.5 flex-shrink-0 rounded p-1.5"
                            style={{ background: 'var(--material-regular)', color: meta.color }}
                          >
                            <TypeIcon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                                style={{ color: meta.color, background: 'var(--material-regular)' }}
                              >
                                {meta.label}
                              </span>
                              <h3
                                className="truncate text-sm font-medium"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {signal.title}
                              </h3>
                              <a
                                href={signal.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex-shrink-0 transition-colors"
                                style={{ color: 'var(--text-tertiary)' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>

                            {/* Verbatim quote */}
                            {signal.verbatim && (
                              <div
                                className="mt-2 flex items-start gap-2 rounded-md px-3 py-2"
                                style={{
                                  border: '1px solid var(--separator)',
                                  background: 'var(--material-regular)',
                                }}
                              >
                                <Quote
                                  className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                                  style={{ color: 'var(--text-tertiary)' }}
                                />
                                <p
                                  className={`text-xs italic ${!isExpanded ? 'line-clamp-2' : ''}`}
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  &ldquo;{signal.verbatim}&rdquo;
                                </p>
                              </div>
                            )}

                            {signal.context && (
                              <p
                                className={`mt-1 text-xs ${!isExpanded ? 'line-clamp-2' : ''}`}
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {signal.context}
                              </p>
                            )}

                            <div className="mt-1.5 flex flex-wrap items-center gap-3">
                              {signal.platform && (
                                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                  {signal.platform}
                                </span>
                              )}
                              {signal.author && (
                                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                  {signal.author}
                                </span>
                              )}
                              {signal.relevance > 0 && (
                                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                  Relevance: {signal.relevance}/5
                                </span>
                              )}
                              {tags.length > 0 && tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                                  style={{
                                    border: '1px solid var(--separator)',
                                    background: 'var(--material-regular)',
                                    color: 'var(--text-tertiary)',
                                  }}
                                >
                                  <Tag className="h-2.5 w-2.5" />
                                  {tag}
                                </span>
                              ))}
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
