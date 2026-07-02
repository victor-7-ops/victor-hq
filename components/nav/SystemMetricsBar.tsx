'use client';

import { useSystemMetrics } from '@/hooks/useSystemMetrics';
import { Cpu, HardDrive, Database, Activity, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

type ThresholdLevel = 'normal' | 'warn' | 'critical' | 'error';

const colorClasses: Record<ThresholdLevel, string> = {
  normal: 'bg-status-green/10 text-status-green',
  warn: 'bg-status-amber/10 text-status-amber',
  critical: 'bg-status-red/10 text-status-red',
  error: 'bg-text-muted/10 text-text-muted',
};

function getLevel(
  value: number,
  warnAt: number,
  criticalAt: number,
): ThresholdLevel {
  if (value >= criticalAt) return 'critical';
  if (value >= warnAt) return 'warn';
  return 'normal';
}

function MetricPill({
  icon: Icon,
  label,
  value,
  level,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  level: ThresholdLevel;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium',
        colorClasses[level],
      )}
    >
      <Icon className="h-3 w-3" />
      {label} {value}
    </span>
  );
}

export default function SystemMetricsBar() {
  const { data, isLoading, isError } = useSystemMetrics();

  if (isLoading || isError || !data) {
    return (
      <div className="flex h-7 items-center border-b border-border bg-background px-5">
        <span className="text-[11px] text-text-muted">
          {isLoading ? 'Loading metrics...' : 'Metrics unavailable'}
        </span>
      </div>
    );
  }

  const cpuLevel = getLevel(data.cpu.percent, 70, 90);
  const ramLevel = getLevel(data.ram.percent, 80, 95);
  const swapLevel = getLevel(data.swap.percent, 50, 80);
  const diskLevel = getLevel(data.disk.percent, 80, 95);

  const gatewayOnline = data.versions.gateway.status === 'online';
  const gatewayLevel: ThresholdLevel = gatewayOnline ? 'normal' : 'error';

  return (
    <div className="flex h-7 items-center gap-2 border-b border-border bg-background px-5">
      <MetricPill
        icon={Cpu}
        label="CPU"
        value={`${Math.round(data.cpu.percent)}%`}
        level={cpuLevel}
      />
      <MetricPill
        icon={Database}
        label="RAM"
        value={`${Math.round(data.ram.percent)}%`}
        level={ramLevel}
      />
      <MetricPill
        icon={Activity}
        label="Swap"
        value={`${Math.round(data.swap.percent)}%`}
        level={swapLevel}
      />
      <MetricPill
        icon={HardDrive}
        label="Disk"
        value={`${Math.round(data.disk.percent)}%`}
        level={diskLevel}
      />
      <MetricPill
        icon={Radio}
        label="Gateway"
        value={gatewayOnline ? 'online' : 'offline'}
        level={gatewayLevel}
      />
    </div>
  );
}
