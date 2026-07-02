'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Puzzle, GitBranch, CheckCircle2, XCircle } from 'lucide-react';

interface HookEntry {
  name: string;
  enabled: boolean;
}

interface PluginEntry {
  name: string;
  version: string;
}

interface HooksPluginsData {
  hooks: HookEntry[];
  plugins: PluginEntry[];
}

function parseHooksPlugins(gateway: any, agents: any): HooksPluginsData {
  const hooks: HookEntry[] = [];
  const plugins: PluginEntry[] = [];

  // Derive hooks from gateway configuration signals
  // The gateway API exposes providerHealth, cacheRetentionMode, etc.
  // We infer active hooks from these observable features
  if (gateway) {
    if (gateway.deviceTokenValid !== undefined) {
      hooks.push({ name: 'auth-validation', enabled: gateway.deviceTokenValid });
    }
    if (gateway.cacheRetentionMode && gateway.cacheRetentionMode !== 'unknown') {
      hooks.push({ name: 'cache-retention', enabled: true });
    }
    if (gateway.tailscaleEndpoint) {
      hooks.push({ name: 'tailscale-serve', enabled: true });
    }
    if (gateway.providerHealth) {
      hooks.push({
        name: 'provider-health-probe',
        enabled: Object.values(gateway.providerHealth).some(
          (h: any) => h === 'healthy' || h === 'degraded',
        ),
      });
    }
    if (gateway.reachable !== undefined) {
      hooks.push({ name: 'gateway-reachability', enabled: gateway.reachable });
    }
  }

  // Derive plugin info from agents config (modelsConfig, extensions, etc.)
  if (agents?.modelsConfig) {
    const mc = agents.modelsConfig;
    if (mc.fallbacks && mc.fallbacks.length > 0) {
      plugins.push({
        name: 'model-fallback-chain',
        version: `${mc.fallbacks.length} fallbacks`,
      });
    }
  }

  // If agents have sub-agents, the orchestration plugin is active
  if (agents?.agents && Array.isArray(agents.agents)) {
    const subAgents = agents.agents.filter((a: any) => a.role === 'sub-agent');
    if (subAgents.length > 0) {
      plugins.push({
        name: 'multi-agent-orchestration',
        version: `${subAgents.length} sub-agents`,
      });
    }

    // Detect cron plugin from agent names/sessions
    const hasCron = agents.agents.some(
      (a: any) =>
        (a.sessionKey || '').includes('cron') ||
        (a.name || '').toLowerCase().includes('cron'),
    );
    if (hasCron) {
      plugins.push({ name: 'cron-scheduler', version: 'active' });
    }
  }

  return { hooks, plugins };
}

export default function HooksPluginsPanel() {
  const { data: gateway, isLoading: gwLoading } = useQuery({
    queryKey: ['gateway'],
    queryFn: () => fetch('/api/gateway').then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => fetch('/api/agents').then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const isLoading = gwLoading || agentsLoading;
  const { hooks, plugins } = parseHooksPlugins(gateway, agents);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Puzzle className="h-4 w-4 text-text-muted" />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Hooks &amp; Plugins
          </span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-6 animate-pulse rounded bg-surface-hover"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Puzzle className="h-4 w-4 text-text-muted" />
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Hooks &amp; Plugins
        </span>
      </div>

      {/* Hooks section */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Hooks
          </span>
        </div>

        {hooks.length === 0 ? (
          <p className="text-[11px] text-text-muted">No hooks detected</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {hooks.map((hook) => (
              <span
                key={hook.name}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium',
                  hook.enabled
                    ? 'border-status-green/30 bg-status-green/10 text-status-green'
                    : 'border-border bg-surface-hover text-text-muted',
                )}
              >
                {hook.enabled ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {hook.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mb-3 border-t border-border" />

      {/* Plugins section */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <Puzzle className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Plugins
          </span>
        </div>

        {plugins.length === 0 ? (
          <p className="text-[11px] text-text-muted">No plugins detected</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {plugins.map((plugin) => (
              <span
                key={plugin.name}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
              >
                <Puzzle className="h-3 w-3" />
                {plugin.name}
                <span className="rounded bg-accent/20 px-1 py-px text-[9px]">
                  {plugin.version}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
