'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCostData } from '@/hooks/useCostData';
import { useGateway, useAgents } from '@/hooks/useAgentData';
import { usePulseStream } from '@/hooks/usePulseStream';
import { useDashboardStore } from '@/store/dashboard';
import {
  cn,
  formatCost,
  formatRelativeTime,
  formatTokens,
} from '@/lib/utils';
import StatusPill from '@/components/shared/StatusPill';
import SparklineChart from '@/components/shared/SparklineChart';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';
import type { SecurityAlert, CostAnomaly, ProviderConnection, CompactionEntry } from '@/types';
import TokenUsageTable from '@/components/security/TokenUsageTable';
import SubAgentActivity from '@/components/security/SubAgentActivity';
import CostCharts from '@/components/security/CostCharts';
import CronMonitor from '@/components/security/CronMonitor';
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Key,
  Lock,
  GitBranch,
  Globe,
  DollarSign,
  TrendingUp,
  Zap,
  Lightbulb,
  Database,
  Activity,
  Radio,
  Cpu,
  X,
  Eye,
  Wifi,
  WifiOff,
  Clock,
  Smartphone,
  FileText,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Legend,
  CartesianGrid,
} from 'recharts';

// ============================================
//  Types
// ============================================

interface ApiMeta {
  source: string;
  computedAt: string;
  dataDir: string;
}

interface PairedDevice {
  id: string;
  name: string;
  type: string;
  lastUsed: string;
  status: string;
}

interface OAuthToken {
  provider: string;
  profileId: string;
  expiresAt: string | null;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  lastUsed: string | null;
  errorCount: number;
}

interface ConfigAuditSummary {
  totalChanges: number;
  lastChange: string | null;
  suspiciousCount: number;
  recentChanges: {
    timestamp: string;
    pid: number;
    hashBefore: string;
    hashAfter: string;
    description: string;
  }[];
}

interface SecurityPosture {
  devices: PairedDevice[];
  deviceTokenAge: { days: number; updatedAt: string } | null;
  oauthTokens: OAuthToken[];
  configAuditSummary: ConfigAuditSummary;
  totalAuthErrors: number;
}

interface SecurityData {
  alerts: SecurityAlert[];
  fileVaultEnabled: boolean;
  gitHooksExist: boolean;
  tailscaleConnected: boolean;
  tailscaleEndpoint: string | null;
  activeSessions?: { id: string; agent: string; startedAt: string }[];
  devices?: unknown[];
  securityPosture?: SecurityPosture;
  _meta?: ApiMeta;
}

interface ModelInfo {
  id: string;
  name: string;
  reasoning: boolean;
  cost: { input: number; output: number; cacheRead?: number; cacheWrite?: number };
  contextWindow: number;
  lastUsed: string | null;
  active: boolean;
}

interface ProviderConnectionEnhanced {
  provider: string;
  status: string;
  models: string[];
  lastSuccessfulCall: string | null;
  keyAgeDays: number | null;
  keyRotationDue: boolean;
  activeModels: string[];
  allModels: ModelInfo[];
  totalSpendToday: number;
  lastUsedModel: string | null;
}

interface IdentityData {
  version: string;
  providers: any[];
  compactionLog: CompactionEntry[];
  rawConfig: string;
  _meta?: ApiMeta;
}

interface CostDataWithMeta {
  todaySpend: number;
  dailyLimit: number;
  spendByProvider: Record<string, number>;
  spendByAgent: Record<string, number>;
  cacheWriteCost: number;
  computeCost: number;
  dailyHistory: { date: string; cost: number; tokens: number; byAgent?: Record<string, { cost: number; tokens: number }> }[];
  anomalies: CostAnomaly[];
  avg7d: number;
  totalTokens: number;
  _meta?: ApiMeta;
}

interface DailyDetailedEntry {
  date: string;
  cost: number;
  tokens: number;
  byModel: Record<string, { cost: number; tokens: number }>;
  byProvider: Record<string, { cost: number; tokens: number }>;
  byAgent: Record<string, { cost: number; tokens: number }>;
}

interface CostHistoryResponse {
  history: DailyDetailedEntry[];
}

interface ProviderDetailResponse {
  provider: string;
  models: ModelInfo[];
  activeModels: string[];
  lastSuccessfulCall: string | null;
  keyAgeDays: number | null;
  totalSpendToday: number;
  _meta?: ApiMeta;
}

// ============================================
//  Constants
// ============================================

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a855f7'];

const AGENT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// ============================================
//  Helpers
// ============================================

function getSeverityIcon(severity: SecurityAlert['severity']) {
  switch (severity) {
    case 'critical':
      return <ShieldAlert className="h-4 w-4 text-status-red" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-status-amber" />;
    case 'info':
      return <Info className="h-4 w-4 text-status-blue" />;
  }
}

function getSeverityBorder(severity: SecurityAlert['severity']): string {
  switch (severity) {
    case 'critical':
      return 'border-l-status-red';
    case 'warning':
      return 'border-l-status-amber';
    case 'info':
      return 'border-l-status-blue';
  }
}

function getSpendColor(spend: number, limit: number): string {
  const pct = limit > 0 ? (spend / limit) * 100 : 0;
  if (pct > 100) return 'text-status-red';
  if (pct > 80) return 'text-status-amber';
  return 'text-status-green';
}

function getKeyAgeColor(days: number | null): string {
  if (days === null) return 'text-text-muted';
  if (days > 60) return 'text-status-red';
  if (days > 30) return 'text-status-amber';
  return 'text-text-secondary';
}

function getRecommendations(
  costData: {
    todaySpend: number;
    dailyLimit: number;
    cacheWriteCost: number;
    computeCost: number;
    anomalies: CostAnomaly[];
  } | null,
  gateway: { cacheRetentionMode: string } | null,
  securityData: SecurityData | null,
): string[] {
  const recs: string[] = [];
  if (gateway?.cacheRetentionMode === 'long') {
    recs.push('Cache retention is set to "long". Switch to "short" to reduce daily spend.');
  }
  if (costData) {
    if (costData.todaySpend > costData.dailyLimit * 0.8) {
      recs.push('Spend is above 80% of your daily limit. Consider pausing non-critical agents.');
    }
    const cacheTotal = costData.cacheWriteCost + costData.computeCost;
    if (cacheTotal > 0 && costData.cacheWriteCost / cacheTotal > 0.3) {
      recs.push('Cache write costs are over 30% of total. Review caching strategy.');
    }
    if (costData.anomalies.length > 0) {
      recs.push(`${costData.anomalies.length} cost anomalies detected recently.`);
    }
  }
  if (securityData) {
    const critCount = securityData.alerts.filter(
      (a) => a.severity === 'critical' && !a.acknowledged,
    ).length;
    if (critCount > 0) {
      recs.push(
        `${critCount} unacknowledged critical alert${critCount > 1 ? 's' : ''}. Review immediately.`,
      );
    }
    if (!securityData.fileVaultEnabled) {
      recs.push('FileVault is disabled. Enable disk encryption for API key security.');
    }
    if (!securityData.gitHooksExist) {
      recs.push('Git hooks are not active. Enable pre-commit hooks to prevent secret leaks.');
    }
  }
  return recs;
}

// ============================================
//  Reusable UI Components
// ============================================

function PieTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-text-muted">{payload[0].name}</p>
      <p className="font-semibold text-text-primary">{formatCost(payload[0].value)}</p>
    </div>
  );
}

function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-text-muted">{label}</p>
      <p className="font-semibold text-text-primary">{formatter(payload[0].value)}</p>
    </div>
  );
}

function MultiSeriesChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg max-w-xs">
      <p className="text-text-muted mb-1">{label}</p>
      {payload
        .filter((entry) => entry.value > 0)
        .map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-text-secondary truncate">{entry.name}</span>
            </div>
            <span className="font-mono text-text-primary">
              {entry.value < 1 ? formatCost(entry.value) : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
  className,
  action,
  lastUpdated,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  lastUpdated?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-text-muted">{icon}</span>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {lastUpdated && (
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <Clock className="h-2.5 w-2.5" />
              {formatRelativeTime(lastUpdated)}
            </span>
          )}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DrillDownModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-[#121620] shadow-2xl md:inset-12 lg:inset-20">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </>
  );
}

function SeeMoreButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
    >
      <Eye className="h-3 w-3" />
      {label ?? 'See more'}
    </button>
  );
}

function SourceBadge({ computedAt, source }: { computedAt?: string; source?: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-text-muted">
      {source && (
        <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">
          {source}
        </span>
      )}
      {computedAt && (
        <span className="flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {formatRelativeTime(computedAt)}
        </span>
      )}
    </div>
  );
}

function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {connected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-green opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-status-green" />
          </span>
          <span className="text-[10px] font-medium text-status-green">LIVE</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-text-muted" />
          <span className="text-[10px] text-text-muted">Offline</span>
        </>
      )}
    </div>
  );
}

function KeyAgeDisplay({ days }: { days: number | null }) {
  if (days === null) return <span className="text-text-muted">&mdash;</span>;
  return <span className={cn('font-mono text-xs', getKeyAgeColor(days))}>{days}d</span>;
}

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
  const alerts = securityData?.alerts ?? [];
  const anomalies = costData?.anomalies ?? [];
  const providers = identity?.providers ?? [];
  const compactionLog = identity?.compactionLog ?? [];
  const securityPosture = securityData?.securityPosture;

  const unackedCount = useMemo(() => alerts.filter((a) => !a.acknowledged).length, [alerts]);
  useEffect(() => {
    setUnacknowledgedAlerts(unackedCount);
  }, [unackedCount, setUnacknowledgedAlerts]);

  const providerPieData = useMemo(() => {
    if (!costData?.spendByProvider) return [];
    return Object.entries(costData.spendByProvider).map(([name, value]) => ({ name, value }));
  }, [costData?.spendByProvider]);

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
            <Panel title="Provider Connections" icon={<Radio className="h-4 w-4" />} lastUpdated={identityMeta?.computedAt}>
              {sortedProviders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium text-text-muted">
                        <th className="pb-2 pr-3">Provider</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2 pr-3">Models</th>
                        <th className="pb-2 pr-3">Key Age</th>
                        <th className="pb-2 pr-3">Last Used</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {(() => {
                        const now = Date.now();
                        const cutoff = 24 * 60 * 60 * 1000;
                        const active = sortedProviders.filter(
                          (p) => p.lastSuccessfulCall && now - new Date(p.lastSuccessfulCall).getTime() < cutoff,
                        );
                        const inactive = sortedProviders.filter(
                          (p) => !p.lastSuccessfulCall || now - new Date(p.lastSuccessfulCall).getTime() >= cutoff,
                        );
                        const renderRow = (p: ProviderConnectionEnhanced) => (
                          <tr key={p.provider}>
                            <td className="py-2 pr-3 font-medium text-text-primary">
                              {p.provider}
                            </td>
                            <td className="py-2 pr-3">
                              <StatusPill status={p.status} label={p.status} size="sm" />
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-1">
                                {(p.activeModels ?? p.models ?? []).slice(0, 2).map((m: string) => (
                                  <span
                                    key={m}
                                    className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px] text-text-secondary"
                                  >
                                    {m}
                                  </span>
                                ))}
                                {((p.activeModels ?? p.models ?? []).length > 2) && (
                                  <span className="text-[10px] text-text-muted">
                                    +{(p.activeModels ?? p.models ?? []).length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 pr-3">
                              <KeyAgeDisplay days={p.keyAgeDays} />
                            </td>
                            <td className="py-2 pr-3 text-xs text-text-muted">
                              {p.lastSuccessfulCall
                                ? formatRelativeTime(p.lastSuccessfulCall)
                                : '\u2014'}
                            </td>
                            <td className="py-2">
                              <button
                                onClick={() => setProviderDetailModalProvider(p.provider)}
                                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </button>
                            </td>
                          </tr>
                        );
                        return (
                          <>
                            {active.length > 0 && (
                              <>
                                <tr>
                                  <td colSpan={6} className="py-2 text-[10px] font-semibold uppercase tracking-wider text-status-green">
                                    <div className="flex items-center gap-1.5">
                                      <Wifi className="h-3 w-3" />
                                      Active ({active.length})
                                    </div>
                                  </td>
                                </tr>
                                {active.map(renderRow)}
                              </>
                            )}
                            {inactive.length > 0 && (
                              <>
                                <tr>
                                  <td colSpan={6} className="py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                                    <div className="flex items-center gap-1.5">
                                      <WifiOff className="h-3 w-3" />
                                      Inactive ({inactive.length})
                                    </div>
                                  </td>
                                </tr>
                                {inactive.map(renderRow)}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-text-muted">
                  No provider connections found.
                </p>
              )}
            </Panel>
          </div>
        </section>

      </div>

      {/* ============================================ */}
      {/*  MODALS — Drill-down views                  */}
      {/* ============================================ */}

      {/* Raw Log Modal */}
      <DrillDownModal
        open={!!rawLogModalAlert}
        onClose={() => setRawLogModalAlert(null)}
        title={`Alert Log \u2014 ${rawLogModalAlert?.title ?? ''}`}
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

      {/* ============================================ */}
      {/*  NEW MODAL: Model Spend (30-day)            */}
      {/* ============================================ */}
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

      {/* ============================================ */}
      {/*  NEW MODAL: Provider Spend (30-day)         */}
      {/* ============================================ */}
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

      {/* ============================================ */}
      {/*  NEW MODAL: Provider Detail                  */}
      {/* ============================================ */}
      <DrillDownModal
        open={!!providerDetailModalProvider}
        onClose={closeProviderDetailModal}
        title={`Provider Detail \u2014 ${providerDetailModalProvider ?? ''}`}
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
                          {model.lastUsed ? formatRelativeTime(model.lastUsed) : '\u2014'}
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

      {/* ============================================ */}
      {/*  NEW MODAL: Security Posture Details         */}
      {/* ============================================ */}
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
                          {tok.lastUsed ? formatRelativeTime(tok.lastUsed) : '\u2014'}
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

      {/* ============================================ */}
      {/*  UPDATED MODAL: Performance History          */}
      {/* ============================================ */}
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
    </div>
  );
}
