import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Cpu, AlertCircle, CheckCircle, XCircle, Zap } from 'lucide-react';
import type { AgentData } from '@/types';
import { useProviders } from '@/hooks/useAgentData';
import { getModelDisplayName } from '@/lib/parsers/openclaw-cli';

interface AgentCardProps {
  agent: AgentData;
}

const STATUS_CONFIG: Record<AgentData['status'], { label: string; icon: React.ReactNode; color: string }> = {
  online: { label: 'Online', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-500' },
  idle: { label: 'Idle', icon: <Clock className="w-3 h-3" />, color: 'bg-yellow-500' },
  offline: { label: 'Offline', icon: <XCircle className="w-3 h-3" />, color: 'bg-gray-500' },
  error: { label: 'Error', icon: <AlertCircle className="w-3 h-3" />, color: 'bg-red-500' },
};

const PROVIDER_CONFIG: Record<AgentData['provider'], { label: string; color: string }> = {
  anthropic: { label: 'Anthropic', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  openai: { label: 'OpenAI', color: 'bg-green-100 text-green-800 border-green-300' },
  google: { label: 'Google', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  minimax: { label: 'MiniMax', color: 'bg-pink-100 text-pink-800 border-pink-300' },
  groq: { label: 'Groq', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  openrouter: { label: 'OpenRouter', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
};

export function AgentCard({ agent }: AgentCardProps) {
  const statusConfig = STATUS_CONFIG[agent.status];
  const providerConfig = PROVIDER_CONFIG[agent.provider];

  const { data: providersData } = useProviders();

  const getProviderHealthColor = (provider: string) => {
    if (!providersData?.providers?.[provider]) return 'bg-gray-400';
    const status = providersData.providers[provider].status;
    if (status === 'ok') return 'bg-green-500';
    if (status === 'auth') return 'bg-orange-500';
    return 'bg-red-500';
  };

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) return '< $0.01';
    return `$${cost.toFixed(2)}`;
  };

  return (
    <Card className="overflow-hidden border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              {agent.name}
              <Badge
                variant="outline"
                className={`text-xs font-medium ${statusConfig.color} border ${statusConfig.color.replace('bg-', 'border-')} text-white`}
              >
                <span className="flex items-center gap-1">
                  {statusConfig.icon}
                  {statusConfig.label}
                </span>
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={`text-xs ${providerConfig.color}`}>
                  {providerConfig.label}
                </Badge>
                <span 
                  className={`w-2 h-2 rounded-full ${getProviderHealthColor(agent.provider)}`} 
                  title={`Provider: ${providersData?.providers?.[agent.provider]?.status || 'unknown'}`}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{getModelDisplayName(agent.model)}</span>
            </div>
            {agent.role === 'orchestrator' && (
              <div className="text-xs text-gray-400 mt-1">
                Fallbacks: {agent.fallbacks?.map(getModelDisplayName).join(', ') || 'None'}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatNumber(agent.tokensIn + agent.tokensOut)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">total tokens</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <Zap className="w-3 h-3" />
              <span>In:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 ml-auto">
                {formatNumber(agent.tokensIn)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mt-1">
              <Zap className="w-3 h-3" />
              <span>Out:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 ml-auto">
                {formatNumber(agent.tokensOut)}
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <Cpu className="w-3 h-3" />
              <span>Cost:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 ml-auto">
                {formatCost(agent.costUSD)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mt-1">
              <Clock className="w-3 h-3" />
              <span>Latency:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 ml-auto">
                {agent.latencyMs > 0 ? `${agent.latencyMs}ms` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Context Usage</span>
            <span className="font-medium">{agent.contextWindowUsedPercent}%</span>
          </div>
          <Progress value={agent.contextWindowUsedPercent} className="h-1.5" />

          <div className="flex justify-between text-xs mt-3">
            <span className="text-gray-600 dark:text-gray-400">Tasks</span>
            <div className="flex gap-2">
              <span className="text-green-600 dark:text-green-400">
                {agent.taskCompletedCount} ✓
              </span>
              {agent.taskFailedCount > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {agent.taskFailedCount} ✗
                </span>
              )}
            </div>
          </div>
        </div>

        {agent.lastError && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
            <div className="flex items-start gap-1">
              <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-red-700 dark:text-red-300 font-medium">Last Error:</span>
            </div>
            <p className="text-red-600 dark:text-red-400 mt-1 truncate">{agent.lastError}</p>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Last active: {new Date(agent.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
