'use client';

import { useEffect, useState } from 'react';
import { cn, formatCost } from '@/lib/utils';
import { useAgents } from '@/hooks/useAgentData';
import { useCostData } from '@/hooks/useCostData';

function formatClock(date: Date): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const dayName = dayNames[date.getDay()];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minuteStr = minutes.toString().padStart(2, '0');

  return `${dayName}, ${month} ${day} \u00B7 ${hours}:${minuteStr} ${ampm}`;
}

export default function TopBar() {
  const [clock, setClock] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  const { data: agentData } = useAgents();
  const { data: costData } = useCostData();

  const agentCount = (agentData?.agents ?? []).filter(
    (a) => a.status === 'online' || a.status === 'idle',
  ).length;
  const todayCost = costData?.todaySpend ?? 0;

  useEffect(() => {
    setMounted(true);
    setClock(formatClock(new Date()));

    const interval = setInterval(() => {
      setClock(formatClock(new Date()));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center border-b border-border bg-surface px-5">
      {/* Left: Title */}
      <div className="flex-shrink-0">
        <span className="text-sm font-semibold text-text-primary">
          OpenClaw Dashboard
        </span>
      </div>

      {/* Center: Clock */}
      <div className="flex flex-1 items-center justify-center">
        <span
          className={cn(
            'text-xs font-medium text-text-secondary transition-opacity',
            mounted ? 'opacity-100' : 'opacity-0'
          )}
        >
          {clock}
        </span>
      </div>

      {/* Right: Status pills */}
      <div className="flex flex-shrink-0 items-center gap-3">
        {/* Fleet health pill */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-text-secondary">
          <span className={cn('h-1.5 w-1.5 rounded-full', agentCount > 0 ? 'bg-status-green' : 'bg-text-muted')} />
          {agentCount} agent{agentCount !== 1 ? 's' : ''} online
        </span>

        {/* Today's cost */}
        <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-text-secondary">
          Today: {formatCost(todayCost)}
        </span>
      </div>
    </header>
  );
}
