'use client';

import { useEffect } from 'react';
import {
  cn,
  formatCost,
  formatRelativeTime,
} from '@/lib/utils';
import type { SecurityAlert, CostAnomaly, CompactionEntry } from '@/types';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Clock,
  X,
  Eye,
  WifiOff,
} from 'lucide-react';

// ============================================
//  Types
// ============================================

export interface ApiMeta {
  source: string;
  computedAt: string;
  dataDir: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  type: string;
  lastUsed: string;
  status: string;
}

export interface OAuthToken {
  provider: string;
  profileId: string;
  expiresAt: string | null;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  lastUsed: string | null;
  errorCount: number;
}

export interface ConfigAuditSummary {
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

export interface SecurityPosture {
  devices: PairedDevice[];
  deviceTokenAge: { days: number; updatedAt: string } | null;
  oauthTokens: OAuthToken[];
  configAuditSummary: ConfigAuditSummary;
  totalAuthErrors: number;
}

export interface SecurityData {
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

export interface ModelInfo {
  id: string;
  name: string;
  reasoning: boolean;
  cost: { input: number; output: number; cacheRead?: number; cacheWrite?: number };
  contextWindow: number;
  lastUsed: string | null;
  active: boolean;
}

export interface ProviderConnectionEnhanced {
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

export interface IdentityData {
  version: string;
  providers: any[];
  compactionLog: CompactionEntry[];
  rawConfig: string;
  _meta?: ApiMeta;
}

export interface CostDataWithMeta {
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

export interface DailyDetailedEntry {
  date: string;
  cost: number;
  tokens: number;
  byModel: Record<string, { cost: number; tokens: number }>;
  byProvider: Record<string, { cost: number; tokens: number }>;
  byAgent: Record<string, { cost: number; tokens: number }>;
}

export interface CostHistoryResponse {
  history: DailyDetailedEntry[];
}

export interface ProviderDetailResponse {
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

export const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a855f7'];

export const AGENT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// ============================================
//  Helpers
// ============================================

export function getSeverityIcon(severity: SecurityAlert['severity']) {
  switch (severity) {
    case 'critical':
      return <ShieldAlert className="h-4 w-4 text-status-red" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-status-amber" />;
    case 'info':
      return <Info className="h-4 w-4 text-status-blue" />;
  }
}

export function getSeverityBorder(severity: SecurityAlert['severity']): string {
  switch (severity) {
    case 'critical':
      return 'border-l-status-red';
    case 'warning':
      return 'border-l-status-amber';
    case 'info':
      return 'border-l-status-blue';
  }
}

export function getSpendColor(spend: number, limit: number): string {
  const pct = limit > 0 ? (spend / limit) * 100 : 0;
  if (pct > 100) return 'text-status-red';
  if (pct > 80) return 'text-status-amber';
  return 'text-status-green';
}

export function getKeyAgeColor(days: number | null): string {
  if (days === null) return 'text-text-muted';
  if (days > 60) return 'text-status-red';
  if (days > 30) return 'text-status-amber';
  return 'text-text-secondary';
}

export function getRecommendations(
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

export function PieTooltipContent({
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

export function ChartTooltipContent({
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

export function MultiSeriesChartTooltip({
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

export function Panel({
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

export function DrillDownModal({
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

export function SeeMoreButton({ onClick, label }: { onClick: () => void; label?: string }) {
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

export function SourceBadge({ computedAt, source }: { computedAt?: string; source?: string }) {
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

export function LiveIndicator({ connected }: { connected: boolean }) {
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

export function KeyAgeDisplay({ days }: { days: number | null }) {
  if (days === null) return <span className="text-text-muted">&mdash;</span>;
  return <span className={cn('font-mono text-xs', getKeyAgeColor(days))}>{days}d</span>;
}
