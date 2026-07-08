'use client';

import {
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  Legend,
  CartesianGrid,
} from 'recharts';
import { formatCost, formatRelativeTime, formatTokens } from '@/lib/utils';
import StatusPill from '@/components/shared/StatusPill';
import {
  DrillDownModal,
  MultiSeriesChartTooltip,
  ChartTooltipContent,
  KeyAgeDisplay,
  AGENT_COLORS,
  type SecurityPosture,
  type CostHistoryResponse,
} from './shared';

type ChartRow = Record<string, string | number>;

interface AgentModalChartData {
  names: string[];
  cost: ChartRow[];
  tokens: ChartRow[];
}

export interface HistoryModalsProps {
  securityPostureModalOpen: boolean;
  closeSecurityPostureModal: () => void;
  securityPosture: SecurityPosture | undefined;

  historyModalOpen: boolean;
  setHistoryModalOpen: (open: boolean) => void;
  costHistoryLoading: boolean;
  costHistoryData: CostHistoryResponse | undefined;
  agentModalChartData: AgentModalChartData;
  agentModalTotals: { agent: string; cost: number; tokens: number }[];
  chartData: { date: string; cost: number; tokens: number }[];
}

/** Security-posture-details and performance-history drill-down modals for the
 *  Security/System Pulse page. Split out of DrillDownModals.tsx for file-size
 *  hygiene (see AlertAndSpendModals.tsx for the other four). Pure
 *  presentational -- everything is threaded in as a prop. */
export function HistoryModals({
  securityPostureModalOpen,
  closeSecurityPostureModal,
  securityPosture,
  historyModalOpen,
  setHistoryModalOpen,
  costHistoryLoading,
  costHistoryData,
  agentModalChartData,
  agentModalTotals,
  chartData,
}: HistoryModalsProps) {
  return (
    <>
      {/* NEW MODAL: Security Posture Details */}
      <DrillDownModal
        open={securityPostureModalOpen}
        onClose={closeSecurityPostureModal}
        title="Security Posture Details"
      >
        {!securityPosture ? (
          <p className="py-8 text-center text-sm text-text-muted">No security posture data available.</p>
        ) : (
          <div className="space-y-6">
            {/* Paired Devices Table */}
            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">Paired Devices</h3>
              {securityPosture.devices.length === 0 ? (
                <p className="text-xs text-text-muted">No paired devices.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-text-muted">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Last Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {securityPosture.devices.map((device) => (
                      <tr key={device.id}>
                        <td className="py-2 pr-4 text-xs text-text-primary">{device.name}</td>
                        <td className="py-2 pr-4 text-xs text-text-secondary">{device.type}</td>
                        <td className="py-2 pr-4">
                          <StatusPill
                            status={device.status === 'active' ? 'online' : 'offline'}
                            label={device.status}
                            size="sm"
                          />
                        </td>
                        <td className="py-2 text-xs text-text-muted">
                          {formatRelativeTime(device.lastUsed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Device Token Age */}
            {securityPosture.deviceTokenAge && (
              <div>
                <h3 className="mb-3 text-xs font-medium text-text-muted">Device Token</h3>
                <div className="inline-flex items-center gap-3 rounded border border-border bg-background px-3 py-2">
                  <span className="text-xs text-text-muted">Age:</span>
                  <KeyAgeDisplay days={securityPosture.deviceTokenAge.days} />
                  <span className="text-xs text-text-muted">
                    Updated: {formatRelativeTime(securityPosture.deviceTokenAge.updatedAt)}
                  </span>
                </div>
              </div>
            )}

            {/* OAuth Token Details */}
            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">OAuth Tokens</h3>
              {securityPosture.oauthTokens.length === 0 ? (
                <p className="text-xs text-text-muted">No OAuth tokens.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-text-muted">
                      <th className="pb-2 pr-3">Provider</th>
                      <th className="pb-2 pr-3">Profile</th>
                      <th className="pb-2 pr-3">Expires</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Last Used</th>
                      <th className="pb-2 text-right">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {securityPosture.oauthTokens.map((tok) => (
                      <tr key={tok.provider + tok.profileId}>
                        <td className="py-2 pr-3 text-xs text-text-primary">{tok.provider}</td>
                        <td className="py-2 pr-3 font-mono text-[10px] text-text-secondary">{tok.profileId}</td>
                        <td className="py-2 pr-3 text-xs text-text-muted">
                          {tok.expiresAt ? formatRelativeTime(tok.expiresAt) : 'Never'}
                        </td>
                        <td className="py-2 pr-3">
                          {tok.isExpired ? (
                            <StatusPill status="error" label="Expired" size="sm" />
                          ) : tok.daysUntilExpiry !== null && tok.daysUntilExpiry < 7 ? (
                            <StatusPill status="error" label={`${tok.daysUntilExpiry}d left`} size="sm" />
                          ) : (
                            <StatusPill status="online" label="Valid" size="sm" />
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs text-text-muted">
                          {tok.lastUsed ? formatRelativeTime(tok.lastUsed) : '—'}
                        </td>
                        <td className="py-2 text-right">
                          {tok.errorCount > 0 ? (
                            <span className="font-mono text-xs text-status-red">{tok.errorCount}</span>
                          ) : (
                            <span className="font-mono text-xs text-text-muted">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent Audit Log */}
            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">
                Recent Config Changes
                <span className="ml-2 font-normal">
                  ({securityPosture.configAuditSummary.totalChanges} total
                  {securityPosture.configAuditSummary.suspiciousCount > 0 && (
                    <span className="text-status-red">
                      , {securityPosture.configAuditSummary.suspiciousCount} suspicious
                    </span>
                  )}
                  )
                </span>
              </h3>
              {securityPosture.configAuditSummary.recentChanges.length === 0 ? (
                <p className="text-xs text-text-muted">No recent config changes.</p>
              ) : (
                <div className="space-y-2">
                  {securityPosture.configAuditSummary.recentChanges.map((change, i) => (
                    <div
                      key={i}
                      className="rounded border border-border bg-background px-4 py-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-text-primary">{change.description}</span>
                        <span className="text-[10px] text-text-muted">
                          {formatRelativeTime(change.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[10px] text-text-muted">
                        <span>PID: {change.pid}</span>
                        <span>Before: {change.hashBefore.slice(0, 8)}</span>
                        <span>After: {change.hashAfter.slice(0, 8)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Auth Errors Summary */}
            <div className="flex items-center justify-between rounded border border-border bg-background px-4 py-3">
              <span className="text-sm text-text-secondary">Total Auth Errors</span>
              <StatusPill
                status={securityPosture.totalAuthErrors > 0 ? 'error' : 'online'}
                label={`${securityPosture.totalAuthErrors}`}
                size="sm"
              />
            </div>
          </div>
        )}
      </DrillDownModal>

      {/* UPDATED MODAL: Performance History */}
      <DrillDownModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Performance History (30 days)"
      >
        {costHistoryLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-text-muted">Loading...</div>
          </div>
        ) : costHistoryData?.history && costHistoryData.history.length > 0 ? (
          <div className="space-y-8">
            {/* Daily Cost — per agent */}
            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">
                Daily Cost by Agent
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                {agentModalChartData.names.length > 0 ? (
                  <AreaChart data={agentModalChartData.cost}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) =>
                        new Date(v).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${v}`}
                      width={40}
                    />
                    <Tooltip content={<MultiSeriesChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} iconSize={8} />
                    {agentModalChartData.names.map((agent, i) => (
                      <Area
                        key={agent}
                        type="monotone"
                        dataKey={agent}
                        name={agent}
                        stroke={AGENT_COLORS[i % AGENT_COLORS.length]}
                        fill={AGENT_COLORS[i % AGENT_COLORS.length]}
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                    ))}
                  </AreaChart>
                ) : (
                  <LineChart data={costHistoryData.history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) =>
                        new Date(v).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${v}`}
                      width={40}
                    />
                    <Tooltip
                      content={<ChartTooltipContent formatter={(v) => formatCost(v)} />}
                    />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#3b82f6' }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Daily Tokens — per agent */}
            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">
                Daily Tokens by Agent
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                {agentModalChartData.names.length > 0 ? (
                  <AreaChart data={agentModalChartData.tokens}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) =>
                        new Date(v).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => formatTokens(v)}
                      width={45}
                    />
                    <Tooltip content={<MultiSeriesChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} iconSize={8} />
                    {agentModalChartData.names.map((agent, i) => (
                      <Area
                        key={agent}
                        type="monotone"
                        dataKey={agent}
                        name={agent}
                        stroke={AGENT_COLORS[i % AGENT_COLORS.length]}
                        fill={AGENT_COLORS[i % AGENT_COLORS.length]}
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                    ))}
                  </AreaChart>
                ) : (
                  <LineChart data={costHistoryData.history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) =>
                        new Date(v).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => formatTokens(v)}
                      width={45}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent formatter={(v) => formatTokens(v)} />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="tokens"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#22c55e' }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Per-Agent Totals Table */}
            {agentModalTotals.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-medium text-text-muted">Agent Totals (30 days)</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-text-muted">
                      <th className="pb-2 pr-4">Agent</th>
                      <th className="pb-2 pr-4 text-right">Cost</th>
                      <th className="pb-2 text-right">Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {agentModalTotals.map((a, i) => (
                      <tr key={a.agent}>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: AGENT_COLORS[i % AGENT_COLORS.length] }}
                            />
                            <span className="text-xs text-text-primary">{a.agent}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-xs text-text-secondary">
                          {formatCost(a.cost)}
                        </td>
                        <td className="py-2 text-right font-mono text-xs text-text-secondary">
                          {formatTokens(a.tokens)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : chartData.length > 0 ? (
          /* Fallback to existing chartData if costHistoryData not available */
          <div className="space-y-8">
            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">
                Daily Cost (Last 30 Days)
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) =>
                      new Date(v).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                    width={40}
                  />
                  <Tooltip
                    content={<ChartTooltipContent formatter={(v) => formatCost(v)} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#3b82f6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-medium text-text-muted">
                Daily Tokens (Last 30 Days)
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) =>
                      new Date(v).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatTokens(v)}
                    width={45}
                  />
                  <Tooltip
                    content={
                      <ChartTooltipContent formatter={(v) => formatTokens(v)} />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="tokens"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#22c55e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">
            No performance data available.
          </p>
        )}
      </DrillDownModal>
    </>
  );
}
