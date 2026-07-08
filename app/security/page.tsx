'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCostData } from '@/hooks/useCostData';
import { useGateway, useAgents } from '@/hooks/useAgentData';
import { usePulseStream } from '@/hooks/usePulseStream';
import { useDashboardStore } from '@/store/dashboard';
import { cn, formatCost, formatRelativeTime } from '@/lib/utils';
import StatusPill from '@/components/shared/StatusPill';
import SparklineChart from '@/components/shared/SparklineChart';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';
import type { SecurityAlert } from '@/types';
import TokenUsageTable from '@/components/security/TokenUsageTable';
import SubAgentActivity from '@/components/security/SubAgentActivity';
import CostCharts from '@/components/security/CostCharts';
import CronMonitor from '@/components/security/CronMonitor';
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  Key,
  Lock,
  GitBranch,
  Globe,
  DollarSign,
  TrendingUp,
  Zap,
  Database,
  Activity,
  Radio,
  Cpu,
  Smartphone,
  FileText,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  getSpendColor,
  getRecommendations,
  PieTooltipContent,
  Panel,
  SeeMoreButton,
  SourceBadge,
  LiveIndicator,
  KeyAgeDisplay,
  PIE_COLORS,
  type SecurityData,
  type IdentityData,
  type CostDataWithMeta,
  type ProviderConnectionEnhanced,
  type CostHistoryResponse,
  type ProviderDetailResponse,
} from './components/shared';
import { ProviderConnectionsPanel } from './components/ProviderConnectionsPanel';
import { AlertAndSpendModals } from './components/AlertAndSpendModals';
import { HistoryModals } from './components/HistoryModals';

// ============================================
//  Main Page — System Pulse
// ============================================

export default function SystemPulsePage() {
  const queryClient = useQueryClient();
  const { setUnacknowledgedAlerts } = useDashboardStore();

  // --- Data fetching ---
  const { data: securityData, isLoading: securityLoading } = useQuery<SecurityData>({
    queryKey: ['security'],
    queryFn: () => fetch('/api/security').then((r) => r.json()),
    refetchInterval: 10000,
  });

  // --- Snapshot of "now" for freshness bucketing (avoids calling Date.now() during render) ---
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    setNowMs(Date.now());
  }, [securityData]);

  // --- Cost range state ---
  const [costRange, setCostRange] = useState<string>('30d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const effectiveCostRange = customFrom ? undefined : costRange;
  const effectiveCostFrom = customFrom || undefined;
  const effectiveCostTo = customTo || undefined;

  const { data: costData, isLoading: costLoading } = useCostData(effectiveCostRange, effectiveCostFrom, effectiveCostTo);
  const { data: gateway, isLoading: gatewayLoading } = useGateway();
  const { data: agentData } = useAgents();
  const { data: identity, isLoading: identityLoading } = useQuery<IdentityData>({
    queryKey: ['identity'],
    queryFn: () => fetch('/api/identity').then((r) => r.json()),
    refetchInterval: 30000,
  });

  // --- Live SSE stream for real-time updates ---
  const pulse = usePulseStream();

  // Data source timestamps (from API _meta or SSE events)
  const costMeta = (costData as CostDataWithMeta)?._meta;
  const securityMeta = securityData?._meta;
  const identityMeta = identity?._meta;

  // --- Mutations ---
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) =>
      fetch('/api/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge', id: alertId }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security'] });
    },
  });

  // --- Modal state ---
  const [compactionModalOpen, setCompactionModalOpen] = useState(false);
  const [anomalyModalOpen, setAnomalyModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [rawLogModalAlert, setRawLogModalAlert] = useState<SecurityAlert | null>(null);

  // --- New modal states ---
  const [modelSpendModalOpen, setModelSpendModalOpen] = useState(false);
  const [providerSpendModalOpen, setProviderSpendModalOpen] = useState(false);
  const [providerDetailModalProvider, setProviderDetailModalProvider] = useState<string | null>(null);
  const [securityPostureModalOpen, setSecurityPostureModalOpen] = useState(false);

  // --- Modal close handlers ---
  const closeModelSpendModal = useCallback(() => setModelSpendModalOpen(false), []);
  const closeProviderSpendModal = useCallback(() => setProviderSpendModalOpen(false), []);
  const closeProviderDetailModal = useCallback(() => setProviderDetailModalProvider(null), []);
  const closeSecurityPostureModal = useCallback(() => setSecurityPostureModalOpen(false), []);

  // --- Lazy queries (modal-only) ---
  const costHistoryModalOpen = modelSpendModalOpen || providerSpendModalOpen || historyModalOpen;

  const { data: costHistoryData, isLoading: costHistoryLoading } = useQuery<CostHistoryResponse>({
    queryKey: ['cost-history-30d'],
    queryFn: () => fetch('/api/cost/history?days=30').then((r) => r.json()),
    enabled: costHistoryModalOpen,
    staleTime: 60000,
  });

  const { data: providerDetailData, isLoading: providerDetailLoading } = useQuery<ProviderDetailResponse>({
    queryKey: ['provider-detail', providerDetailModalProvider],
    queryFn: () =>
      fetch(`/api/identity/provider-detail?provider=${encodeURIComponent(providerDetailModalProvider!)}`).then((r) =>
        r.json()
      ),
    enabled: !!providerDetailModalProvider,
    staleTime: 60000,
  });

  // --- Derived data ---
  const agents = agentData?.agents ?? [];
  const activeAgents = agents.filter((a) => a.status === 'online' || a.status === 'idle').length;
  const gatewayOnline = gateway?.pid !== null && gateway?.pid !== undefined;
  const alerts = useMemo(() => securityData?.alerts ?? [], [securityData]);
  const anomalies = costData?.anomalies ?? [];
  const providers = useMemo(() => identity?.providers ?? [], [identity]);
  const compactionLog = identity?.compactionLog ?? [];
  const securityPosture = securityData?.securityPosture;

  const unackedCount = useMemo(() => alerts.filter((a) => !a.acknowledged).length, [alerts]);
  useEffect(() => {
    setUnacknowledgedAlerts(unackedCount);
  }, [unackedCount, setUnacknowledgedAlerts]);

  const spendByProvider = costData?.spendByProvider;
  const providerPieData = useMemo(() => {
    if (!spendByProvider) return [];
    return Object.entries(spendByProvider).map(([name, value]) => ({ name, value }));
  }, [spendByProvider]);

  const sparklineData = useMemo(() => {
    const history = (costData as any)?.hourlyHistory ?? costData?.dailyHistory;
    if (!history) return [];
    return history.map((d: any) => d.cost);
  }, [costData]);

  const spendPercent = useMemo(() => {
    if (!costData) return 0;
    return costData.dailyLimit > 0 ? (costData.todaySpend / costData.dailyLimit) * 100 : 0;
  }, [costData]);

  const cacheWritePercent = useMemo(() => {
    if (!costData) return 0;
    const total = costData.cacheWriteCost + costData.computeCost;
    return total > 0 ? (costData.cacheWriteCost / total) * 100 : 0;
  }, [costData]);

  const recommendations = useMemo(
    () => getRecommendations(costData ?? null, gateway ?? null, securityData ?? null),
    [costData, gateway, securityData],
  );

  const lastAnomaly = anomalies.length > 0 ? anomalies[anomalies.length - 1] : null;
  const lastCompaction = compactionLog.length > 0 ? compactionLog[0] : null;
  const chartData = costData?.dailyHistory ?? [];
  const attentionAlerts = useMemo(() => alerts.filter((a) => !a.acknowledged), [alerts]);

  // --- Sort providers by lastSuccessfulCall descending ---
  const sortedProviders = useMemo(() => {
    const provs = providers as ProviderConnectionEnhanced[];
    return [...provs].sort((a, b) => {
      if (!a.lastSuccessfulCall && !b.lastSuccessfulCall) return 0;
      if (!a.lastSuccessfulCall) return 1;
      if (!b.lastSuccessfulCall) return -1;
      return new Date(b.lastSuccessfulCall).getTime() - new Date(a.lastSuccessfulCall).getTime();
    });
  }, [providers]);

  // --- Cost history chart transforms ---
  const modelChartData = useMemo(() => {
    if (!costHistoryData?.history) return [];
    const allModels = new Set<string>();
    costHistoryData.history.forEach((d) => {
      if (d.byModel) Object.keys(d.byModel).forEach((m) => allModels.add(m));
    });
    return costHistoryData.history.map((d) => {
      const entry: Record<string, any> = { date: d.date };
      allModels.forEach((m) => {
        entry[m] = d.byModel?.[m]?.cost ?? 0;
      });
      return entry;
    });
  }, [costHistoryData]);

  const modelNames = useMemo(() => {
    if (!costHistoryData?.history) return [];
    const set = new Set<string>();
    costHistoryData.history.forEach((d) => {
      if (d.byModel) Object.keys(d.byModel).forEach((m) => set.add(m));
    });
    return Array.from(set);
  }, [costHistoryData]);

  const modelTotals = useMemo(() => {
    if (!costHistoryData?.history) return [];
    const totals: Record<string, { cost: number; tokens: number }> = {};
    costHistoryData.history.forEach((d) => {
      if (d.byModel) {
        Object.entries(d.byModel).forEach(([m, v]) => {
          if (!totals[m]) totals[m] = { cost: 0, tokens: 0 };
          totals[m].cost += v.cost;
          totals[m].tokens += v.tokens;
        });
      }
    });
    return Object.entries(totals)
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.cost - a.cost);
  }, [costHistoryData]);

  const providerChartData = useMemo(() => {
    if (!costHistoryData?.history) return [];
    const allProviders = new Set<string>();
    costHistoryData.history.forEach((d) => {
      if (d.byProvider) Object.keys(d.byProvider).forEach((p) => allProviders.add(p));
    });
    return costHistoryData.history.map((d) => {
      const entry: Record<string, any> = { date: d.date };
      allProviders.forEach((p) => {
        entry[p] = d.byProvider?.[p]?.cost ?? 0;
      });
      return entry;
    });
  }, [costHistoryData]);

  const providerHistoryNames = useMemo(() => {
    if (!costHistoryData?.history) return [];
    const set = new Set<string>();
    costHistoryData.history.forEach((d) => {
      if (d.byProvider) Object.keys(d.byProvider).forEach((p) => set.add(p));
    });
    return Array.from(set);
  }, [costHistoryData]);

  const providerHistoryTotals = useMemo(() => {
    if (!costHistoryData?.history) return [];
    const totals: Record<string, { cost: number; tokens: number }> = {};
    costHistoryData.history.forEach((d) => {
      if (d.byProvider) {
        Object.entries(d.byProvider).forEach(([p, v]) => {
          if (!totals[p]) totals[p] = { cost: 0, tokens: 0 };
          totals[p].cost += v.cost;
          totals[p].tokens += v.tokens;
        });
      }
    });
    return Object.entries(totals)
      .map(([provider, v]) => ({ provider, ...v }))
      .sort((a, b) => b.cost - a.cost);
  }, [costHistoryData]);

  // --- Agent chart transforms (compact + modal) ---
  const compactAgentNames = useMemo(() => {
    const set = new Set<string>();
    (costData?.dailyHistory ?? []).forEach((d) => {
      const dTyped = d as { byAgent?: Record<string, { cost: number; tokens: number }> };
      if (dTyped.byAgent) Object.keys(dTyped.byAgent).forEach((a) => set.add(a));
    });
    return Array.from(set);
  }, [costData]);

  const compactAgentChartData = useMemo(() => {
    if (!costData?.dailyHistory) return [];
    return costData.dailyHistory.map((d) => {
      const dTyped = d as { date: string; byAgent?: Record<string, { cost: number; tokens: number }> };
      const entry: Record<string, any> = { date: dTyped.date };
      compactAgentNames.forEach((a) => {
        entry[a] = dTyped.byAgent?.[a]?.cost ?? 0;
      });
      return entry;
    });
  }, [costData, compactAgentNames]);

  const agentModalChartData = useMemo(() => {
    if (!costHistoryData?.history) return { cost: [] as Record<string, any>[], tokens: [] as Record<string, any>[], names: [] as string[] };
    const names = new Set<string>();
    costHistoryData.history.forEach((d) => {
      if (d.byAgent) Object.keys(d.byAgent).forEach((a) => names.add(a));
    });
    const nameList = Array.from(names);
    const cost = costHistoryData.history.map((d) => {
      const entry: Record<string, any> = { date: d.date };
      nameList.forEach((a) => {
        entry[a] = d.byAgent?.[a]?.cost ?? 0;
      });
      return entry;
    });
    const tokens = costHistoryData.history.map((d) => {
      const entry: Record<string, any> = { date: d.date };
      nameList.forEach((a) => {
        entry[a] = d.byAgent?.[a]?.tokens ?? 0;
      });
      return entry;
    });
    return { cost, tokens, names: nameList };
  }, [costHistoryData]);

  const agentModalTotals = useMemo(() => {
    if (!costHistoryData?.history) return [];
    const totals: Record<string, { cost: number; tokens: number }> = {};
    costHistoryData.history.forEach((d) => {
      if (d.byAgent) {
        Object.entries(d.byAgent).forEach(([a, v]) => {
          if (!totals[a]) totals[a] = { cost: 0, tokens: 0 };
          totals[a].cost += v.cost;
          totals[a].tokens += v.tokens;
        });
      }
    });
    return Object.entries(totals)
      .map(([agent, v]) => ({ agent, ...v }))
      .sort((a, b) => b.cost - a.cost);
  }, [costHistoryData]);

  // --- Loading ---
  const isLoading = securityLoading || costLoading || gatewayLoading || identityLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="text" className="h-8 w-40" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LoadingSkeleton variant="card" className="h-64 w-full" />
          <LoadingSkeleton variant="card" className="h-64 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LoadingSkeleton variant="card" className="h-40 w-full" />
          <LoadingSkeleton variant="card" className="h-40 w-full" />
          <LoadingSkeleton variant="card" className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* ============================================ */}
      {/*  TOP STRIP — Live status bar                */}
      {/* ============================================ */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-text-muted" />
          <span className="text-xs text-text-muted">Agents</span>
          <span className="text-xs font-semibold text-text-primary">
            {activeAgents}/{agents.length}
          </span>
        </div>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-text-muted" />
          <StatusPill
            status={gatewayOnline ? 'online' : 'offline'}
            label={gatewayOnline ? `Gateway :${gateway?.port}` : 'Gateway Offline'}
            size="sm"
          />
          {gateway && (
            <span className="text-[11px] text-text-muted">v{gateway.version}</span>
          )}
        </div>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-text-muted" />
          <span className="text-xs text-text-muted">Today</span>
          <span
            className={cn(
              'text-xs font-semibold',
              getSpendColor(costData?.todaySpend ?? 0, costData?.dailyLimit ?? 1),
            )}
          >
            {formatCost(costData?.todaySpend ?? 0)}
          </span>
          <span className="text-[11px] text-text-muted">
            / {formatCost(costData?.dailyLimit ?? 0)}
          </span>
        </div>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-xs text-text-muted">Last anomaly</span>
          <span className="text-xs text-text-secondary">
            {lastAnomaly ? formatRelativeTime(lastAnomaly.date) : 'None'}
          </span>
        </div>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-xs text-text-muted">Last compaction</span>
          <span className="text-xs text-text-secondary">
            {lastCompaction ? formatRelativeTime(lastCompaction.timestamp) : 'Never'}
          </span>
        </div>

        <div className="h-5 w-px bg-border" />

        <LiveIndicator connected={pulse.connected} />

        <div className="ml-auto flex items-center gap-2">
          <SourceBadge
            source={pulse.source}
            computedAt={(costData as any)?._meta?.computedAt}
          />
        </div>
      </div>

      {/* ============================================ */}
      {/*  Page body                                  */}
      {/* ============================================ */}
      <div className="space-y-6 p-6">
        {/* Date Range Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={customFrom ? '__custom__' : costRange}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__custom__') return;
              setCostRange(v);
              setCustomFrom('');
              setCustomTo('');
            }}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="1h">Last hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="12h">Last 12 hours</option>
            <option value="1d">Last day</option>
            <option value="2d">Last 2 days</option>
            <option value="5d">Last 5 days</option>
            <option value="7d">Last week</option>
            <option value="14d">Last 2 weeks</option>
            <option value="30d">Last month</option>
          </select>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">or</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setCostRange('');
              }}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="From"
            />
            <span className="text-xs text-text-muted">&mdash;</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="To"
            />
            {customFrom && (
              <button
                onClick={() => {
                  setCustomFrom('');
                  setCustomTo('');
                  setCostRange('30d');
                }}
                className="rounded border border-border px-2 py-1 text-[11px] text-text-muted hover:bg-surface-hover hover:text-text-primary"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ========================================== */}
        {/*  SECTION E — Token Analytics               */}
        {/* ========================================== */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            <Activity className="h-3.5 w-3.5" />
            Token Analytics
          </h2>
          <CostCharts />
          <div className="mt-4">
            <TokenUsageTable />
          </div>
        </section>

        {/* ========================================== */}
        {/*  SECTION F — Sub-Agent Activity             */}
        {/* ========================================== */}
        <SubAgentActivity />

        {/* ========================================== */}
        {/*  SECTION G — Cron Jobs                     */}
        {/* ========================================== */}
        <CronMonitor />

        {/* ========================================== */}
        {/*  SECTION B — Cost Control                  */}
        {/* ========================================== */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            <DollarSign className="h-3.5 w-3.5" />
            Cost Control
          </h2>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Today's Spend */}
            <Panel
              title={costRange === '1d' || (!costRange && !customFrom) ? "Today's Spend" : "Period Spend"}
              icon={<DollarSign className="h-4 w-4" />}
              lastUpdated={costMeta?.computedAt}
              action={<SeeMoreButton onClick={() => setModelSpendModalOpen(true)} label="By model" />}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className={cn(
                    'text-3xl font-bold',
                    getSpendColor(costData?.todaySpend ?? 0, costData?.dailyLimit ?? 1),
                  )}
                >
                  {formatCost(costData?.todaySpend ?? 0)}
                </span>
                <span className="text-sm text-text-muted">
                  / {formatCost(costData?.dailyLimit ?? 0)}
                </span>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    spendPercent > 100
                      ? 'bg-status-red'
                      : spendPercent > 80
                        ? 'bg-status-amber'
                        : 'bg-status-green',
                  )}
                  style={{ width: `${Math.min(spendPercent, 100)}%` }}
                />
              </div>

              {spendPercent > 100 && (
                <div className="mt-3 flex items-center gap-2 rounded border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Limit exceeded! {spendPercent.toFixed(0)}% of daily limit.</span>
                </div>
              )}
              {spendPercent > 80 && spendPercent <= 100 && (
                <div className="mt-3 flex items-center gap-2 rounded border border-status-amber/30 bg-status-amber/10 px-3 py-2 text-xs text-status-amber">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Approaching limit ({spendPercent.toFixed(0)}% used).</span>
                </div>
              )}

              <div className="mt-4">
                <p className="mb-2 text-xs text-text-muted">
                  {customFrom
                    ? `${customFrom}${customTo ? ` — ${customTo}` : ' — now'}`
                    : costRange === '1h' ? 'Last hour'
                    : costRange === '6h' ? 'Last 6 hours'
                    : costRange === '12h' ? 'Last 12 hours'
                    : costRange === '1d' ? 'Last day'
                    : costRange === '2d' ? 'Last 2 days'
                    : costRange === '5d' ? 'Last 5 days'
                    : costRange === '7d' ? 'Last week'
                    : costRange === '14d' ? 'Last 2 weeks'
                    : 'Last month'}
                </p>
                <SparklineChart data={sparklineData} width={240} height={36} />
              </div>
            </Panel>

            {/* Spend by Provider */}
            <Panel
              title="Spend by Provider"
              icon={<TrendingUp className="h-4 w-4" />}
              lastUpdated={costMeta?.computedAt}
              action={<SeeMoreButton onClick={() => setProviderSpendModalOpen(true)} label="By provider" />}
            >
              {providerPieData.length > 0 ? (
                <div className="flex items-center gap-5">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie
                        data={providerPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={58}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {providerPieData.map((_, index) => (
                          <Cell
                            key={index}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="flex-1 space-y-1.5">
                    {providerPieData.map((entry, index) => (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{
                              backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                            }}
                          />
                          <span className="text-text-secondary">{entry.name}</span>
                        </div>
                        <span className="font-mono text-text-primary">
                          {formatCost(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-text-muted">
                  No provider spend data.
                </p>
              )}
            </Panel>

            {/* Cache vs Compute */}
            <Panel title="Cache vs Compute" icon={<Zap className="h-4 w-4" />} lastUpdated={costMeta?.computedAt}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Cache write %</span>
                <span className="font-mono text-sm font-medium text-text-primary">
                  {cacheWritePercent.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    cacheWritePercent > 30 ? 'bg-status-amber' : 'bg-accent',
                  )}
                  style={{ width: `${Math.min(cacheWritePercent, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                <span>Cache: {formatCost(costData?.cacheWriteCost ?? 0)}</span>
                <span>Compute: {formatCost(costData?.computeCost ?? 0)}</span>
              </div>

              <div className="mt-4 flex items-center justify-between rounded border border-border bg-background px-3 py-2">
                <span className="text-xs text-text-muted">7-day avg</span>
                <span className="font-mono text-xs font-semibold text-text-primary">
                  {formatCost(costData?.avg7d ?? 0)}
                </span>
              </div>
            </Panel>
          </div>
        </section>

        {/* ========================================== */}
        {/*  SECTION C — System Health & Security      */}
        {/* ========================================== */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            <Shield className="h-3.5 w-3.5" />
            System Health &amp; Security Posture
          </h2>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Security Posture */}
            <Panel
              title="Security Posture"
              icon={<Key className="h-4 w-4" />}
              lastUpdated={securityMeta?.computedAt}
              action={<SeeMoreButton onClick={() => setSecurityPostureModalOpen(true)} label="View details" />}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-4 w-4 text-text-muted" />
                    <span className="text-sm text-text-primary">FileVault Encryption</span>
                  </div>
                  <StatusPill
                    status={securityData?.fileVaultEnabled ? 'online' : 'error'}
                    label={securityData?.fileVaultEnabled ? 'Enabled' : 'Disabled'}
                    size="sm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <GitBranch className="h-4 w-4 text-text-muted" />
                    <span className="text-sm text-text-primary">
                      Git Hooks (Secret Scanning)
                    </span>
                  </div>
                  <StatusPill
                    status={securityData?.gitHooksExist ? 'online' : 'error'}
                    label={securityData?.gitHooksExist ? 'Active' : 'Inactive'}
                    size="sm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 text-text-muted" />
                    <span className="text-sm text-text-primary">Tailscale</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill
                      status={securityData?.tailscaleConnected ? 'online' : 'offline'}
                      label={
                        securityData?.tailscaleConnected ? 'Connected' : 'Disconnected'
                      }
                      size="sm"
                    />
                    {securityData?.tailscaleEndpoint && (
                      <span className="font-mono text-[11px] text-text-muted">
                        {securityData.tailscaleEndpoint}
                      </span>
                    )}
                  </div>
                </div>

                {securityData?.activeSessions &&
                  securityData.activeSessions.length > 0 && (
                    <div className="mt-2 border-t border-border pt-3">
                      <p className="mb-2 text-xs font-medium text-text-muted">
                        Active Sessions
                      </p>
                      <div className="space-y-1.5">
                        {securityData.activeSessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center justify-between rounded bg-background px-2.5 py-1.5 text-xs"
                          >
                            <span className="text-text-primary">{session.agent}</span>
                            <span className="text-text-muted">
                              {formatRelativeTime(session.startedAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Enhanced Security Posture rows */}
                {securityPosture && (
                  <div className="mt-2 border-t border-border pt-3 space-y-3">
                    {/* Paired Devices */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="h-4 w-4 text-text-muted" />
                        <span className="text-sm text-text-primary">Paired Devices</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill
                          status={securityPosture.devices.length > 0 ? 'online' : 'offline'}
                          label={`${securityPosture.devices.length} device${securityPosture.devices.length !== 1 ? 's' : ''}`}
                          size="sm"
                        />
                        {securityPosture.devices.length > 0 && (
                          <span className="text-[10px] text-text-muted">
                            last {formatRelativeTime(
                              securityPosture.devices.reduce((latest, d) =>
                                new Date(d.lastUsed) > new Date(latest.lastUsed) ? d : latest
                              ).lastUsed
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Device Token Age */}
                    {securityPosture.deviceTokenAge && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Key className="h-4 w-4 text-text-muted" />
                          <span className="text-sm text-text-primary">Device Token Age</span>
                        </div>
                        <KeyAgeDisplay days={securityPosture.deviceTokenAge.days} />
                      </div>
                    )}

                    {/* OAuth Tokens */}
                    {securityPosture.oauthTokens.length > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Lock className="h-4 w-4 text-text-muted" />
                          <span className="text-sm text-text-primary">OAuth Tokens</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {securityPosture.oauthTokens.map((tok) => {
                            let tokStatus: 'online' | 'error' | 'offline' = 'online';
                            let tokLabel = tok.provider;
                            if (tok.isExpired) {
                              tokStatus = 'error';
                              tokLabel += ' (expired)';
                            } else if (tok.daysUntilExpiry !== null && tok.daysUntilExpiry < 7) {
                              tokStatus = 'error';
                              tokLabel += ` (${tok.daysUntilExpiry}d)`;
                            } else if (tok.daysUntilExpiry !== null) {
                              tokLabel += ` (${tok.daysUntilExpiry}d)`;
                            }
                            return (
                              <StatusPill
                                key={tok.provider + tok.profileId}
                                status={tokStatus}
                                label={tokLabel}
                                size="sm"
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Config Changes */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 text-text-muted" />
                        <span className="text-sm text-text-primary">Config Changes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-text-primary">
                          {securityPosture.configAuditSummary.totalChanges}
                        </span>
                        {securityPosture.configAuditSummary.lastChange && (
                          <span className="text-[10px] text-text-muted">
                            last {formatRelativeTime(securityPosture.configAuditSummary.lastChange)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Auth Errors */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <ShieldAlert className="h-4 w-4 text-text-muted" />
                        <span className="text-sm text-text-primary">Auth Errors</span>
                      </div>
                      <StatusPill
                        status={securityPosture.totalAuthErrors > 0 ? 'error' : 'online'}
                        label={`${securityPosture.totalAuthErrors}`}
                        size="sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            {/* Provider Connections */}
            <ProviderConnectionsPanel
              sortedProviders={sortedProviders}
              lastUpdated={identityMeta?.computedAt}
              nowMs={nowMs}
              setProviderDetailModalProvider={setProviderDetailModalProvider}
            />
          </div>
        </section>

      </div>

      <AlertAndSpendModals
        rawLogModalAlert={rawLogModalAlert}
        setRawLogModalAlert={setRawLogModalAlert}
        anomalyModalOpen={anomalyModalOpen}
        setAnomalyModalOpen={setAnomalyModalOpen}
        anomalies={anomalies}
        compactionModalOpen={compactionModalOpen}
        setCompactionModalOpen={setCompactionModalOpen}
        compactionLog={compactionLog}
        modelSpendModalOpen={modelSpendModalOpen}
        closeModelSpendModal={closeModelSpendModal}
        costHistoryLoading={costHistoryLoading}
        costHistoryData={costHistoryData}
        modelChartData={modelChartData}
        modelNames={modelNames}
        modelTotals={modelTotals}
        providerSpendModalOpen={providerSpendModalOpen}
        closeProviderSpendModal={closeProviderSpendModal}
        providerChartData={providerChartData}
        providerHistoryNames={providerHistoryNames}
        providerHistoryTotals={providerHistoryTotals}
        providerDetailModalProvider={providerDetailModalProvider}
        closeProviderDetailModal={closeProviderDetailModal}
        providerDetailLoading={providerDetailLoading}
        providerDetailData={providerDetailData}
      />
      <HistoryModals
        securityPostureModalOpen={securityPostureModalOpen}
        closeSecurityPostureModal={closeSecurityPostureModal}
        securityPosture={securityPosture}
        historyModalOpen={historyModalOpen}
        setHistoryModalOpen={setHistoryModalOpen}
        costHistoryLoading={costHistoryLoading}
        costHistoryData={costHistoryData}
        agentModalChartData={agentModalChartData}
        agentModalTotals={agentModalTotals}
        chartData={chartData}
      />
    </div>
  );
}
