'use client';
import { useState } from 'react';
import { useTokenUsage } from '@/hooks/useTokenUsage';
import type { SubAgentRun } from '@/lib/parsers/token-usage';
import { cn } from '@/lib/utils';
import { Bot, Zap } from 'lucide-react';

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function fmtCost(n: number): string {
  return '$' + n.toFixed(2);
}

function fmtCostPrecise(n: number): string {
  return '$' + n.toFixed(4);
}

function fmtDuration(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${seconds}s`;
}

const periodMap = { today: 'today', '7d': 'week', '30d': 'month', all: 'all' } as const;
type Period = keyof typeof periodMap;

const periodLabels: Record<Period, string> = {
  today: 'Today',
  '7d': '7 Days',
  '30d': '30 Days',
  all: 'All Time',
};

const subagentBucketMap = {
  today: 'subagentToday',
  '7d': 'subagentWeek',
  '30d': 'subagentMonth',
  all: 'subagentAll',
} as const;

function filterRunsByPeriod(
  runs: SubAgentRun[],
  period: Period,
): SubAgentRun[] {
  if (period === 'all') return runs.slice(0, 20);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let cutoff: Date;
  if (period === 'today') {
    cutoff = now;
  } else if (period === '7d') {
    cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);
  } else {
    cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
  }

  return runs
    .filter((r) => {
      if (!r.date) return false;
      const d = new Date(`${r.date}T00:00:00`);
      return d >= cutoff;
    })
    .slice(0, 20);
}

export default function SubAgentActivity() {
  const [runsPeriod, setRunsPeriod] = useState<Period>('7d');
  const [tokenPeriod, setTokenPeriod] = useState<Period>('7d');
  const { data, isLoading } = useTokenUsage();

  const runs = data ? filterRunsByPeriod(data.subagentRuns, runsPeriod) : [];
  const runsTotalCost = runs.reduce((sum, r) => sum + r.cost, 0);

  const tokenBuckets = data?.[subagentBucketMap[tokenPeriod]] ?? [];
  const tokenTotals = tokenBuckets.reduce(
    (acc, b) => ({
      calls: acc.calls + b.calls,
      input: acc.input + b.input,
      output: acc.output + b.output,
      cacheRead: acc.cacheRead + b.cacheRead,
      totalTokens: acc.totalTokens + b.totalTokens,
      cost: acc.cost + b.cost,
    }),
    { calls: 0, input: 0, output: 0, cacheRead: 0, totalTokens: 0, cost: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Section A: Sub-Agent Runs */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-purple-400">
              <Bot className="h-4 w-4" />
              Sub-Agent Runs
            </h2>
            {runs.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-400">
                {fmtCost(runsTotalCost)}
              </span>
            )}
          </div>

          <div className="flex gap-1">
            {(Object.keys(periodMap) as Period[]).map((key) => (
              <button
                key={key}
                onClick={() => setRunsPeriod(key)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  runsPeriod === key
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
                )}
              >
                {periodLabels[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-text-muted">
              Loading...
            </div>
          ) : runs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-text-muted">
              No usage data
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="px-4 py-2.5 text-left font-medium">Task</th>
                  <th className="px-4 py-2.5 text-left font-medium">Model</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Duration</th>
                  <th className="px-4 py-2.5 text-right font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => (
                  <tr
                    key={`${r.timestamp}-${i}`}
                    className="border-b border-border/30 hover:bg-surface-hover"
                  >
                    <td className="px-4 py-2.5 text-left font-medium text-text-primary max-w-[280px] truncate">
                      {r.task}
                    </td>
                    <td className="px-4 py-2.5 text-left text-text-secondary">
                      {r.model}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-text-primary">
                      {fmtCostPrecise(r.cost)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">
                      {fmtDuration(r.durationSec)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-muted">
                      {r.timestamp
                        ? new Date(r.timestamp).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Section B: Sub-Agent Token Breakdown */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-purple-400">
            <Zap className="h-4 w-4" />
            Sub-Agent Token Breakdown
          </h2>

          <div className="flex gap-1">
            {(Object.keys(periodMap) as Period[]).map((key) => (
              <button
                key={key}
                onClick={() => setTokenPeriod(key)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  tokenPeriod === key
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
                )}
              >
                {periodLabels[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-text-muted">
              Loading...
            </div>
          ) : tokenBuckets.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-text-muted">
              No usage data
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="px-4 py-2.5 text-left font-medium">Model</th>
                  <th className="px-4 py-2.5 text-right font-medium">Calls</th>
                  <th className="px-4 py-2.5 text-right font-medium">Input</th>
                  <th className="px-4 py-2.5 text-right font-medium">Output</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cache Read</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total Tokens</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {tokenBuckets.map((b) => (
                  <tr
                    key={b.model}
                    className="border-b border-border/30 hover:bg-surface-hover"
                  >
                    <td className="px-4 py-2.5 text-left font-medium text-text-primary">
                      {b.model}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">
                      {b.calls.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">
                      {fmtTokens(b.input)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">
                      {fmtTokens(b.output)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">
                      {fmtTokens(b.cacheRead)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">
                      {fmtTokens(b.totalTokens)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-text-primary">
                      {fmtCost(b.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold text-text-primary">
                  <td className="px-4 py-2.5 text-left">Total</td>
                  <td className="px-4 py-2.5 text-right">
                    {tokenTotals.calls.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {fmtTokens(tokenTotals.input)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {fmtTokens(tokenTotals.output)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {fmtTokens(tokenTotals.cacheRead)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {fmtTokens(tokenTotals.totalTokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {fmtCost(tokenTotals.cost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
