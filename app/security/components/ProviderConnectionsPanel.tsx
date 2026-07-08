'use client';

import { Radio, Eye, Wifi, WifiOff } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import StatusPill from '@/components/shared/StatusPill';
import { Panel, KeyAgeDisplay, type ProviderConnectionEnhanced } from './shared';

export interface ProviderConnectionsPanelProps {
  sortedProviders: ProviderConnectionEnhanced[];
  lastUpdated: string | undefined;
  nowMs: number;
  setProviderDetailModalProvider: (provider: string) => void;
}

/** Provider Connections panel (active/inactive grouped table) for the
 *  Security/System Pulse page, extracted for file-size hygiene. */
export function ProviderConnectionsPanel({
  sortedProviders,
  lastUpdated,
  nowMs,
  setProviderDetailModalProvider,
}: ProviderConnectionsPanelProps) {
  return (
    <Panel title="Provider Connections" icon={<Radio className="h-4 w-4" />} lastUpdated={lastUpdated}>
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
                const now = nowMs;
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
                        : '—'}
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
  );
}
