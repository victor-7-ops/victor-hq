'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Radio, Wifi, WifiOff } from 'lucide-react';

interface ChannelBinding {
  channel: string;
  connected: boolean;
  agentId: string | null;
  group: string | null;
}

interface ChannelsPanelData {
  channels: ChannelBinding[];
}

function parseChannelsFromAgents(data: any): ChannelBinding[] {
  const channels: ChannelBinding[] = [];

  if (!data?.agents || !Array.isArray(data.agents)) return channels;

  // Detect channels from agent session keys and names
  const channelTypes = new Set<string>();
  for (const agent of data.agents) {
    const key = (agent.sessionKey || agent.id || '').toLowerCase();
    const name = (agent.name || '').toLowerCase();

    if (key.includes('telegram') || name.includes('telegram')) {
      channelTypes.add('telegram');
    }
    if (key.includes('slack') || name.includes('slack')) {
      channelTypes.add('slack');
    }
    if (key.includes('discord') || name.includes('discord')) {
      channelTypes.add('discord');
    }
    if (key.includes('web') || name.includes('web')) {
      channelTypes.add('web');
    }
  }

  // If no channels detected from agents, add telegram as a known channel from OpenClaw config
  if (channelTypes.size === 0) {
    channelTypes.add('telegram');
  }

  for (const channel of channelTypes) {
    // Find the agent bound to this channel
    const boundAgent = data.agents.find((a: any) => {
      const key = (a.sessionKey || a.id || '').toLowerCase();
      const name = (a.name || '').toLowerCase();
      return key.includes(channel) || name.includes(channel);
    });

    // Detect group bindings
    const groupAgent = data.agents.find((a: any) => {
      const key = (a.sessionKey || '').toLowerCase();
      return key.includes(channel) && key.includes('group');
    });

    channels.push({
      channel,
      connected: !!boundAgent || data.agents.some((a: any) => a.status === 'online'),
      agentId: boundAgent?.id || data.agents.find((a: any) => a.role === 'orchestrator')?.id || null,
      group: groupAgent ? (groupAgent.sessionKey || null) : null,
    });
  }

  return channels;
}

function channelIcon(channel: string) {
  switch (channel) {
    case 'telegram':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
        </svg>
      );
    case 'slack':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" />
        </svg>
      );
    case 'discord':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
        </svg>
      );
    default:
      return <Radio className="h-4 w-4" />;
  }
}

export default function ChannelsPanel() {
  const { data, isLoading } = useQuery<{ agents: any[] }>({
    queryKey: ['agents'],
    queryFn: () => fetch('/api/agents').then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const channels = data ? parseChannelsFromAgents(data) : [];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4 text-text-muted" />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Channels
          </span>
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded bg-surface-hover"
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
        <Radio className="h-4 w-4 text-text-muted" />
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Channels
        </span>
        <span className="ml-auto text-[11px] text-text-muted">
          {channels.filter((c) => c.connected).length}/{channels.length} connected
        </span>
      </div>

      {/* Channel rows */}
      {channels.length === 0 ? (
        <p className="text-sm text-text-muted">No channels detected</p>
      ) : (
        <div className="space-y-1.5">
          {channels.map((ch) => (
            <div
              key={ch.channel}
              className="flex items-center gap-2.5 rounded-md border border-border/50 bg-[#0d1017] px-2.5 py-1.5"
            >
              {/* Channel icon */}
              <span className="shrink-0 text-text-muted">
                {channelIcon(ch.channel)}
              </span>

              {/* Channel name */}
              <span className="flex-1 text-sm capitalize text-text-primary">
                {ch.channel}
              </span>

              {/* Bound agent */}
              {ch.agentId && (
                <span className="truncate rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                  {ch.agentId}
                </span>
              )}

              {/* Status pill */}
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  ch.connected
                    ? 'bg-status-green/10 text-status-green'
                    : 'bg-text-muted/10 text-text-muted',
                )}
              >
                {ch.connected ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                {ch.connected ? 'on' : 'off'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Group bindings */}
      {channels.some((ch) => ch.group) && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Group Bindings
          </p>
          {channels
            .filter((ch) => ch.group)
            .map((ch) => (
              <div
                key={`${ch.channel}-group`}
                className="flex items-center gap-2 text-[11px] text-text-muted"
              >
                <span className="capitalize">{ch.channel}</span>
                <span className="text-text-muted/50">-&gt;</span>
                <span className="font-mono">{ch.group}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
