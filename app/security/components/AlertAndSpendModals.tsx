'use client';

import { Clock } from 'lucide-react';
import {
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Legend,
  CartesianGrid,
} from 'recharts';
import { cn, formatCost, formatRelativeTime, formatTokens } from '@/lib/utils';
import StatusPill from '@/components/shared/StatusPill';
import type { SecurityAlert, CostAnomaly, CompactionEntry } from '@/types';
import {
  DrillDownModal,
  MultiSeriesChartTooltip,
  KeyAgeDisplay,
  PIE_COLORS,
  type CostHistoryResponse,
  type ProviderDetailResponse,
} from './shared';

type ChartRow = Record<string, string | number>;

export interface AlertAndSpendModalsProps {
  rawLogModalAlert: SecurityAlert | null;
  setRawLogModalAlert: (alert: SecurityAlert | null) => void;

  anomalyModalOpen: boolean;
  setAnomalyModalOpen: (open: boolean) => void;
  anomalies: CostAnomaly[];

  compactionModalOpen: boolean;
  setCompactionModalOpen: (open: boolean) => void;
  compactionLog: CompactionEntry[];

  modelSpendModalOpen: boolean;
  closeModelSpendModal: () => void;
  costHistoryLoading: boolean;
  costHistoryData: CostHistoryResponse | undefined;
  modelChartData: ChartRow[];
  modelNames: string[];
  modelTotals: { model: string; cost: number; tokens: number }[];

  providerSpendModalOpen: boolean;
  closeProviderSpendModal: () => void;
  providerChartData: ChartRow[];
  providerHistoryNames: string[];
  providerHistoryTotals: { provider: string; cost: number; tokens: number }[];

  providerDetailModalProvider: string | null;
  closeProviderDetailModal: () => void;
  providerDetailLoading: boolean;
  providerDetailData: ProviderDetailResponse | undefined;
}

/** Raw log / anomaly / compaction / model-spend / provider-spend / provider-detail
 *  drill-down modals for the Security/System Pulse page. Split out of
 *  DrillDownModals.tsx for file-size hygiene (see HistoryModals.tsx for the
 *  remaining two). Pure presentational -- everything is threaded in as a prop. */
export function AlertAndSpendModals({
  rawLogModalAlert,
  setRawLogModalAlert,
  anomalyModalOpen,
  setAnomalyModalOpen,
  anomalies,
  compactionModalOpen,
  setCompactionModalOpen,
  compactionLog,
  modelSpendModalOpen,
  closeModelSpendModal,
  costHistoryLoading,
  costHistoryData,
  modelChartData,
  modelNames,
  modelTotals,
  providerSpendModalOpen,
  closeProviderSpendModal,
  providerChartData,
  providerHistoryNames,
  providerHistoryTotals,
  providerDetailModalProvider,
  closeProviderDetailModal,
  providerDetailLoading,
  providerDetailData,
}: AlertAndSpendModalsProps) {
  return (
    <>
      {/* Raw Log Modal */}
      <DrillDownModal
        open={!!rawLogModalAlert}
        onClose={() => setRawLogModalAlert(null)}
        title={`Alert Log — ${rawLogModalAlert?.title ?? ''}`}
      >
        <pre className="whitespace-pre-wrap rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed text-text-secondary">
          {rawLogModalAlert?.rawLog ?? 'No raw log available.'}
        </pre>
      </DrillDownModal>

      {/* Anomaly Modal */}
      <DrillDownModal
        open={anomalyModalOpen}
        onClose={() => setAnomalyModalOpen(false)}
        title="Cost Anomaly Log"
      >
        <div className="space-y-3">
          {anomalies.map((anomaly) => (
            <div
              key={anomaly.id}
              className="rounded border border-border bg-background px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {new Date(anomaly.date).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-text-secondary">
                    Expected:{' '}
                    <span className="font-mono">{formatCost(anomaly.expectedSpend)}</span>
                  </span>
                  <span className="font-medium text-status-red">
                    Actual:{' '}
                    <span className="font-mono">{formatCost(anomaly.actualSpend)}</span>
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-text-secondary">{anomaly.probableCause}</p>
            </div>
          ))}
          {anomalies.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">No anomalies.</p>
          )}
        </div>
      </DrillDownModal>

      {/* Compaction Modal */}
      <DrillDownModal
        open={compactionModalOpen}
        onClose={() => setCompactionModalOpen(false)}
        title="Compaction Log"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-text-muted">
              <th className="pb-2 pr-4">When</th>
              <th className="pb-2 pr-4">Agent</th>
              <th className="pb-2 pr-4">Before</th>
              <th className="pb-2 pr-4">After</th>
              <th className="pb-2">Reduction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {compactionLog.map((entry) => (
              <tr key={entry.id}>
                <td className="py-2.5 pr-4 text-xs text-text-secondary">
                  {formatRelativeTime(entry.timestamp)}
                </td>
                <td className="py-2.5 pr-4 font-medium text-text-primary">
                  {entry.agentName}
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs text-text-secondary">
                  {formatTokens(entry.tokensBefore)}
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs text-text-secondary">
                  {formatTokens(entry.tokensAfter)}
                </td>
                <td className="py-2.5">
                  <span
                    className={cn(
                      'font-mono text-xs font-medium',
                      entry.reductionPercent >= 50
                        ? 'text-status-green'
                        : entry.reductionPercent >= 25
                          ? 'text-status-amber'
                          : 'text-text-secondary',
                    )}
                  >
                    {entry.reductionPercent.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DrillDownModal>

      {/* NEW MODAL: Model Spend (30-day) */}
      <DrillDownModal
        open={modelSpendModalOpen}
        onClose={closeModelSpendModal}
        title="Spend by Model (30 days)"
      >
        {costHistoryLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-text-muted">Loading...</div>
          </div>
        ) : !costHistoryData?.history?.length ? (
          <p className="py-8 text-center text-sm text-text-muted">No model spend data available.</p>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">Daily Cost by Model</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={modelChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) =>
                      new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    }
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                    width={45}
                  />
                  <Tooltip content={<MultiSeriesChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} iconSize={8} />
                  {modelNames.map((model, i) => (
                    <Bar
                      key={model}
                      dataKey={model}
                      name={model}
                      stackId="a"
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">Model Totals</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-text-muted">
                    <th className="pb-2 pr-4">Model</th>
                    <th className="pb-2 pr-4 text-right">Cost</th>
                    <th className="pb-2 text-right">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {modelTotals.map((m, i) => (
                    <tr key={m.model}>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="text-xs text-text-primary">{m.model}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-xs text-text-secondary">
                        {formatCost(m.cost)}
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-text-secondary">
                        {formatTokens(m.tokens)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DrillDownModal>

      {/* NEW MODAL: Provider Spend (30-day) */}
      <DrillDownModal
        open={providerSpendModalOpen}
        onClose={closeProviderSpendModal}
        title="Spend by Provider (30 days)"
      >
        {costHistoryLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-text-muted">Loading...</div>
          </div>
        ) : !costHistoryData?.history?.length ? (
          <p className="py-8 text-center text-sm text-text-muted">No provider spend data available.</p>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">Daily Cost by Provider</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={providerChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) =>
                      new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    }
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                    width={45}
                  />
                  <Tooltip content={<MultiSeriesChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} iconSize={8} />
                  {providerHistoryNames.map((provider, i) => (
                    <Area
                      key={provider}
                      type="monotone"
                      dataKey={provider}
                      name={provider}
                      stackId="1"
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                      fillOpacity={0.4}
                      stroke={PIE_COLORS[i % PIE_COLORS.length]}
                      strokeWidth={1.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">Provider Totals</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-text-muted">
                    <th className="pb-2 pr-4">Provider</th>
                    <th className="pb-2 pr-4 text-right">Cost</th>
                    <th className="pb-2 text-right">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {providerHistoryTotals.map((p, i) => (
                    <tr key={p.provider}>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="text-xs text-text-primary">{p.provider}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-xs text-text-secondary">
                        {formatCost(p.cost)}
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-text-secondary">
                        {formatTokens(p.tokens)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DrillDownModal>

      {/* NEW MODAL: Provider Detail */}
      <DrillDownModal
        open={!!providerDetailModalProvider}
        onClose={closeProviderDetailModal}
        title={`Provider Detail — ${providerDetailModalProvider ?? ''}`}
      >
        {providerDetailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-text-muted">Loading...</div>
          </div>
        ) : !providerDetailData ? (
          <p className="py-8 text-center text-sm text-text-muted">No provider detail data available.</p>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded border border-border bg-background px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Active Models</p>
                <p className="mt-1 text-xl font-bold text-text-primary">{providerDetailData.activeModels.length}</p>
              </div>
              <div className="rounded border border-border bg-background px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Total Models</p>
                <p className="mt-1 text-xl font-bold text-text-primary">{providerDetailData.models.length}</p>
              </div>
              <div className="rounded border border-border bg-background px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Key Age</p>
                <p className="mt-1 text-xl font-bold">
                  <KeyAgeDisplay days={providerDetailData.keyAgeDays} />
                </p>
              </div>
              <div className="rounded border border-border bg-background px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Today&apos;s Spend</p>
                <p className="mt-1 text-xl font-bold text-text-primary">{formatCost(providerDetailData.totalSpendToday)}</p>
              </div>
            </div>

            {providerDetailData.lastSuccessfulCall && (
              <p className="text-xs text-text-muted">
                Last successful call: {formatRelativeTime(providerDetailData.lastSuccessfulCall)}
              </p>
            )}

            {/* All Models Table */}
            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">All Models</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-text-muted">
                      <th className="pb-2 pr-3">ID</th>
                      <th className="pb-2 pr-3">Name</th>
                      <th className="pb-2 pr-3 text-center">Reasoning</th>
                      <th className="pb-2 pr-3 text-right">Input/1M</th>
                      <th className="pb-2 pr-3 text-right">Output/1M</th>
                      <th className="pb-2 pr-3 text-right">Context</th>
                      <th className="pb-2 pr-3">Last Used</th>
                      <th className="pb-2 text-center">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {providerDetailData.models.map((model) => (
                      <tr key={model.id} className="hover:bg-surface-hover transition-colors">
                        <td className="py-2 pr-3 font-mono text-[10px] text-text-primary">{model.id}</td>
                        <td className="py-2 pr-3 text-xs text-text-secondary">{model.name}</td>
                        <td className="py-2 pr-3 text-center">
                          {model.reasoning ? (
                            <StatusPill status="online" label="Yes" size="sm" />
                          ) : (
                            <span className="text-[10px] text-text-muted">&mdash;</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-xs text-text-secondary">
                          {formatCost(model.cost.input)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-xs text-text-secondary">
                          {formatCost(model.cost.output)}
                        </td>
                        <td className="py-2 pr-3 text-right text-xs text-text-secondary">
                          {(model.contextWindow / 1000).toFixed(0)}k
                        </td>
                        <td className="py-2 pr-3 text-xs text-text-muted">
                          {model.lastUsed ? formatRelativeTime(model.lastUsed) : '—'}
                        </td>
                        <td className="py-2 text-center">
                          <StatusPill
                            status={model.active ? 'online' : 'error'}
                            label={model.active ? 'Active' : 'Inactive'}
                            size="sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {providerDetailData._meta && (
              <div className="flex items-center gap-2 text-[10px] text-text-muted">
                <Clock className="h-2.5 w-2.5" />
                {formatRelativeTime(providerDetailData._meta.computedAt)}
              </div>
            )}
          </div>
        )}
      </DrillDownModal>
    </>
  );
}
