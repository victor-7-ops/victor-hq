'use client';

import { useState } from 'react';
import { Search, Package, ChevronRight } from 'lucide-react';
import { cn, formatCost, formatRelativeTime } from '@/lib/utils';
import StatusBadge from './StatusBadge';
import type { DSSummary, DSStatus } from '@/types';

interface Props {
  components: DSSummary['components'];
  availableBatches: string[];
  onSelectComponent: (name: string) => void;
}

export default function ComponentPipeline({ components, availableBatches, onSelectComponent }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DSStatus | ''>('');
  const [batchFilter, setBatchFilter] = useState('');

  const filtered = components.filter((c) => {
    if (search && !c.component.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (batchFilter && (c as any).batch !== batchFilter) return false;
    return true;
  });

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Package className="h-4 w-4 text-text-muted" />
          Component Pipeline
        </h2>
        <span className="text-xs text-text-muted">{components.length} components</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-40 rounded-md border border-border bg-background pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DSStatus | '')}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All statuses</option>
            <option value="green">Green</option>
            <option value="yellow">Yellow</option>
            <option value="red">Red</option>
          </select>

          {/* Batch filter */}
          {availableBatches.length > 0 && (
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All batches</option>
              {availableBatches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Package className="h-5 w-5 text-text-muted" />
          <p className="text-sm text-text-muted">
            {components.length === 0 ? 'No components reported yet.' : 'No components match filters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="whitespace-nowrap px-5 py-2.5 font-medium">Component</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium">Status</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">Fidelity</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">Variants</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">Token Reuse</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">Raw</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">Iters</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">Cost</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">Updated</th>
                <th className="w-8 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.component}
                  onClick={() => onSelectComponent(c.component)}
                  className="cursor-pointer border-b border-border-subtle transition-colors hover:bg-surface-hover"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelectComponent(c.component)}
                  role="button"
                  aria-label={`View details for ${c.component}`}
                >
                  <td className="whitespace-nowrap px-5 py-2.5 font-medium text-text-primary">{c.component}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <StatusBadge status={c.status} size="sm" />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-text-secondary">{c.fidelity.toFixed(1)}%</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-text-secondary">{c.variantCoverage.toFixed(1)}%</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-text-secondary">{c.tokenReuse.toFixed(1)}%</td>
                  <td className={cn(
                    'whitespace-nowrap px-3 py-2.5 text-right font-mono',
                    c.rawValues > 0 ? 'text-status-amber' : 'text-text-secondary',
                  )}>{Math.round(c.rawValues)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-text-secondary">{c.iterations}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-text-secondary">{formatCost(c.costUSD)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-text-muted">{formatRelativeTime(c.lastUpdated)}</td>
                  <td className="px-3 py-2.5">
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
