'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

interface CronJob {
  id: string;
  name: string;
  description: string;
  agent: string;
  enabled: boolean;
  schedule: string;
  lastRun: string | null;
  lastStatus: string | null;
  lastDurationMs: number | null;
  nextRun: string | null;
  prompt: string;
}

interface CronResponse {
  jobs: CronJob[];
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '-';
  const totalSecs = Math.floor(ms / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'unknown';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs < 0;

  const secs = Math.floor(absDiff / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (secs < 60) return isFuture ? 'in <1m' : 'just now';
  if (mins < 60) return isFuture ? `in ${mins}m` : `${mins}m ago`;
  if (hours < 24) return isFuture ? `in ${hours}h` : `${hours}h ago`;
  if (days < 7) return isFuture ? `in ${days}d` : `${days}d ago`;
  return date.toLocaleDateString();
}

function getStatusPill(status: string | null) {
  switch (status) {
    case 'ok':
    case 'success':
      return {
        icon: CheckCircle2,
        label: 'OK',
        className: 'bg-status-green/10 text-status-green',
      };
    case 'error':
    case 'failed':
      return {
        icon: XCircle,
        label: status === 'error' ? 'Error' : 'Failed',
        className: 'bg-status-red/10 text-status-red',
      };
    case 'running':
      return {
        icon: Loader2,
        label: 'Running',
        className: 'bg-status-blue/10 text-status-blue',
      };
    default:
      return {
        icon: Clock,
        label: 'None',
        className: 'bg-text-muted/10 text-text-muted',
      };
  }
}

export default function CronMonitor() {
  const [expanded, setExpanded] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<CronResponse>({
    queryKey: ['cron'],
    queryFn: () => fetch('/api/cron').then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const jobs = data?.jobs ?? [];
  const jobCount = jobs.length;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-muted" />
        )}
        <Clock className="h-4 w-4 text-text-secondary" />
        <span className="text-sm font-semibold text-text-primary">
          Cron Jobs
        </span>
        <span className="inline-flex items-center justify-center rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-text-secondary">
          {jobCount}
        </span>
      </button>

      {/* Table */}
      {expanded && (
        <div className="mt-3 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
              <span className="ml-2 text-xs text-text-muted">Loading cron jobs...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-8">
              <XCircle className="h-4 w-4 text-status-red" />
              <span className="ml-2 text-xs text-status-red">Failed to load cron jobs</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              No cron jobs configured
            </div>
          ) : (
            <div className="space-y-0">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_140px_100px_80px_80px_100px] gap-2 border-b border-border pb-2 text-[11px] font-medium text-text-muted">
                <span>Name</span>
                <span>Agent</span>
                <span>Schedule</span>
                <span>Last Run</span>
                <span>Status</span>
                <span>Duration</span>
                <span>Next Run</span>
              </div>

              {/* Job rows */}
              {jobs.map((job) => {
                const pill = getStatusPill(job.lastStatus);
                const StatusIcon = pill.icon;
                const isJobExpanded = expandedJobId === job.id;

                return (
                  <div key={job.id}>
                    {/* Row */}
                    <button
                      type="button"
                      onClick={() => setExpandedJobId(isJobExpanded ? null : job.id)}
                      className={cn(
                        'grid w-full grid-cols-[1fr_100px_140px_100px_80px_80px_100px] gap-2 border-b border-border/50 py-2 text-left text-xs transition-colors hover:bg-surface-hover last:border-0',
                        isJobExpanded && 'bg-surface-hover',
                        !job.enabled && 'opacity-50',
                      )}
                    >
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-text-primary">
                          {job.name}
                        </span>
                        {job.description && (
                          <span className="block truncate text-[11px] text-text-muted">
                            {job.description}
                          </span>
                        )}
                      </div>
                      <span className="self-center text-text-secondary capitalize">
                        {job.agent}
                      </span>
                      <span className="self-center font-mono text-text-secondary">
                        {job.schedule}
                      </span>
                      <span className="self-center text-text-secondary">
                        {formatRelative(job.lastRun)}
                      </span>
                      <span className="self-center">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                            pill.className,
                          )}
                        >
                          <StatusIcon
                            className={cn(
                              'h-3 w-3',
                              job.lastStatus === 'running' && 'animate-spin',
                            )}
                          />
                          {pill.label}
                        </span>
                      </span>
                      <span className="self-center tabular-nums text-text-secondary">
                        {formatDuration(job.lastDurationMs)}
                      </span>
                      <span className="self-center text-text-secondary">
                        {formatRelative(job.nextRun)}
                      </span>
                    </button>

                    {/* Expanded prompt view */}
                    {isJobExpanded && job.prompt && (
                      <div className="border-b border-border/50 bg-background px-4 py-3">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          Prompt
                        </p>
                        <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-text-secondary">
                          {job.prompt}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
