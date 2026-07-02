'use client';

import { useMemo, useCallback, useState } from 'react';
import { useAgents, useGateway } from '@/hooks/useAgentData';
import { useAgentStream } from '@/hooks/useAgentStream';
import { useDashboardStore } from '@/store/dashboard';
import { formatCost, formatTokens } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/ErrorState';
import StatusPill from '@/components/shared/StatusPill';
import MetricCard from '@/components/shared/MetricCard';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';
import OrgChart from '@/components/fleet/OrgChart';
import AgentDetail from '@/components/fleet/AgentDetail';
import { OrganismCanvas } from '@/components/organism/OrganismCanvas';
import { useConstellationGraph } from '@/hooks/useConstellationGraph';
import ChannelsPanel from '@/components/fleet/ChannelsPanel';
import HooksPluginsPanel from '@/components/fleet/HooksPluginsPanel';
import {
  Radio,
  DollarSign,
  Hash,
  Bot,
  ShieldCheck,
  ShieldX,
  LayoutGrid,
  Users,
  Dna,
} from 'lucide-react';

type ViewTab = 'hierarchy' | 'organism';

export default function FleetPage() {
  useAgentStream();

  const { data: agentData, isLoading: agentsLoading, error: agentsError, refetch: refetchAgents } = useAgents();
  const { data: gateway, isLoading: gatewayLoading, error: gatewayError, refetch: refetchGateway } = useGateway();
  const { data: graph } = useConstellationGraph();

  const { selectedAgentId, setSelectedAgent } = useDashboardStore();
  const [activeTab, setActiveTab] = useState<ViewTab>('organism');

  const agents = agentData?.agents ?? [];

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  const fleetStats = useMemo(() => {
    const totalCost = agents.reduce((sum, a) => sum + a.costUSD, 0);
    const totalTokens = agents.reduce(
      (sum, a) => sum + a.tokensIn + a.tokensOut,
      0,
    );
    const activeCount = agents.filter(
      (a) => a.status === 'online' || a.status === 'idle',
    ).length;
    return { totalCost, totalTokens, activeCount };
  }, [agents]);

  const gatewayOnline = gateway?.pid !== null && gateway?.pid !== undefined;

  const fleetError = agentsError || gatewayError;

  if (fleetError) {
    return (
      <ErrorState
        message={fleetError instanceof Error ? fleetError.message : 'Failed to load fleet data.'}
        onRetry={() => { refetchAgents(); refetchGateway(); }}
      />
    );
  }

  if (agentsLoading || gatewayLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex items-center gap-4">
          <LoadingSkeleton variant="text" className="h-8 w-48" />
          <LoadingSkeleton variant="text" className="h-8 w-32" />
          <LoadingSkeleton variant="text" className="h-8 w-32" />
          <LoadingSkeleton variant="text" className="h-8 w-32" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <LoadingSkeleton variant="card" className="h-64 w-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        {/* View tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'hierarchy'
                ? 'bg-surface-hover text-text-primary'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Hierarchy
          </button>
          <button
            onClick={() => setActiveTab('organism')}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'organism'
                ? 'bg-surface-hover text-text-primary'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <Dna className="h-4 w-4" />
            Organism
          </button>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Gateway status */}
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-text-muted" />
          <StatusPill
            status={gatewayOnline ? 'online' : 'offline'}
            label={
              gatewayOnline
                ? `Gateway :${gateway?.port}`
                : 'Gateway Offline'
            }
            size="sm"
          />
          {gateway && (
            <span className="text-xs text-text-muted">
              v{gateway.version}
            </span>
          )}
          {gateway && (
            <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px]">
              {gateway.deviceTokenValid ? (
                <>
                  <ShieldCheck className="h-3 w-3 text-status-green" />
                  <span className="text-status-green">Token Valid</span>
                </>
              ) : (
                <>
                  <ShieldX className="h-3 w-3 text-status-red" />
                  <span className="text-status-red">Token Invalid</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Fleet metrics */}
        <div className="flex items-center gap-3">
          <MetricCard
            label="Fleet Cost Today"
            value={formatCost(fleetStats.totalCost)}
            icon={<DollarSign className="h-3.5 w-3.5" />}
            className="border-0 bg-transparent p-0"
          />
          <div className="h-6 w-px bg-border" />
          <MetricCard
            label="Total Tokens"
            value={formatTokens(fleetStats.totalTokens)}
            icon={<Hash className="h-3.5 w-3.5" />}
            className="border-0 bg-transparent p-0"
          />
          <div className="h-6 w-px bg-border" />
          <MetricCard
            label="Active Agents"
            value={fleetStats.activeCount}
            unit={`/ ${agents.length}`}
            icon={<Bot className="h-3.5 w-3.5" />}
            className="border-0 bg-transparent p-0"
          />
        </div>
      </div>

      {/* Main content: 70% office / 30% side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tab content (office or hierarchy) */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'hierarchy' ? (
            <OrgChart
              agents={agents}
              selectedId={selectedAgentId}
              onSelect={setSelectedAgent}
            />
          ) : (
            <OrganismCanvas
              nodes={graph?.nodes ?? []}
              edges={graph?.edges ?? []}
              isLive={graph?.isLive ?? false}
              onNodeClick={(node) => setSelectedAgent(node.id)}
            />
          )}
        </div>

        {/* Right: Always-open side panel (30% width) */}
        <div className="flex w-[30%] min-w-[320px] max-w-[480px] flex-col border-l border-border bg-[#0f1219]">
          {/* Panel header */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Users className="h-4 w-4 text-text-muted" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Agent Details
            </span>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto">
            {selectedAgent ? (
              <div>
                <div className="space-y-3 border-b border-border p-4">
                  <ChannelsPanel />
                  <HooksPluginsPanel />
                </div>
                <AgentDetail agent={selectedAgent} gateway={gateway} />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface">
                  <Bot className="h-6 w-6 text-text-muted" />
                </div>
                <p className="text-sm text-text-muted">
                  Click on an agent in the office to view their details
                </p>
                {agents.length > 0 && (
                  <div className="mt-4 w-full space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Fleet
                    </p>
                    {agents.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAgent(a.id)}
                        className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface/50 px-3 py-2 text-left transition-colors hover:bg-surface-hover"
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            a.status === 'online'
                              ? 'bg-status-green'
                              : a.status === 'idle'
                                ? 'bg-status-yellow'
                                : 'bg-text-muted',
                          )}
                        />
                        <span className="flex-1 truncate text-sm text-text-primary">
                          {a.name}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          {a.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
