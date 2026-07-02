'use client';

import { useState, useMemo } from 'react';
import { cn, formatCost, formatTokens, formatUptime, formatRelativeTime } from '@/lib/utils';
import type { AgentData, GatewayStatus } from '@/types';
import StatusPill from '@/components/shared/StatusPill';
import MetricCard from '@/components/shared/MetricCard';
import ContextHealthBar from '@/components/fleet/ContextHealthBar';
import DriftIndicator from '@/components/fleet/DriftIndicator';
import ExecutionTrace from '@/components/fleet/ExecutionTrace';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  DollarSign,
  Gauge,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface AgentDetailProps {
  agent: AgentData;
  gateway: GatewayStatus | undefined;
}

export default function AgentDetail({ agent, gateway }: AgentDetailProps) {
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  // Collect recent errors from tasks
  const recentErrors = useMemo(() => {
    return agent.recentTasks
      .filter((t) => t.errorMessage !== null)
      .slice(-5)
      .reverse()
      .map((t) => ({
        timestamp: t.completedAt ?? t.startedAt,
        message: t.errorMessage!,
      }));
  }, [agent.recentTasks]);

  // If the agent itself has a lastError, include it
  const allErrors = useMemo(() => {
    const errors = [...recentErrors];
    if (
      agent.lastError &&
      !errors.some((e) => e.message === agent.lastError)
    ) {
      errors.unshift({
        timestamp: agent.lastActiveAt,
        message: agent.lastError,
      });
    }
    return errors.slice(0, 5);
  }, [recentErrors, agent.lastError, agent.lastActiveAt]);

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-text-primary">
          {agent.name}
        </h1>

        {/* Role badge */}
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium capitalize',
            agent.role === 'orchestrator'
              ? 'bg-accent/20 text-accent'
              : 'bg-surface-hover text-text-secondary',
          )}
        >
          {agent.role}
        </span>

        {/* Model */}
        <span className="text-sm text-text-secondary">{agent.model}</span>

        {/* Provider badge */}
        <span className="rounded bg-surface-hover px-2 py-0.5 text-xs font-medium capitalize text-text-secondary">
          {agent.provider}
        </span>

        {/* Status pill */}
        <StatusPill status={agent.status} label={agent.status} size="sm" />

        {/* Last active */}
        <span className="ml-auto text-xs text-text-muted">
          Last active: {formatRelativeTime(agent.lastActiveAt)}
        </span>
      </div>

      {/* Context health bar */}
      <ContextHealthBar
        percent={agent.contextWindowUsedPercent}
        agentName={agent.name}
      />

      {/* Metrics grid: 2 rows x 4 columns */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="Tokens In"
          value={formatTokens(agent.tokensIn)}
          icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="Tokens Out"
          value={formatTokens(agent.tokensOut)}
          icon={<ArrowUpFromLine className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="Cost USD"
          value={formatCost(agent.costUSD)}
          icon={<DollarSign className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="Latency"
          value={agent.latencyMs}
          unit="ms"
          icon={<Gauge className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="Uptime"
          value={formatUptime(agent.uptime)}
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="Tasks Completed"
          value={agent.taskCompletedCount}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="Tasks Failed"
          value={agent.taskFailedCount}
          icon={<XCircle className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="Error Count"
          value={agent.errorCount}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Drift indicator */}
      <DriftIndicator driftScore={agent.driftScore} />

      {/* Execution trace */}
      <ExecutionTrace tasks={agent.recentTasks} />

      {/* Recent Errors (collapsible) */}
      {allErrors.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <button
            onClick={() => setErrorsExpanded(!errorsExpanded)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
          >
            {errorsExpanded ? (
              <ChevronDown className="h-4 w-4 text-text-muted" />
            ) : (
              <ChevronRight className="h-4 w-4 text-text-muted" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Recent Errors
            </span>
            <span className="rounded-full bg-status-red/20 px-2 py-0.5 text-[10px] font-medium text-status-red">
              {allErrors.length}
            </span>
          </button>

          {errorsExpanded && (
            <div className="border-t border-border px-4 py-3">
              <div className="flex flex-col gap-2">
                {allErrors.map((err, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-0.5 rounded border border-red-900/30 bg-red-900/10 px-3 py-2"
                  >
                    <span className="text-[10px] text-text-muted">
                      {formatRelativeTime(err.timestamp)}
                    </span>
                    <span className="font-mono text-xs text-status-red">
                      {err.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
