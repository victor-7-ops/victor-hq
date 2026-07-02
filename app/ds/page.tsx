'use client';

import { useState } from 'react';
import { Layers, Terminal, Beaker } from 'lucide-react';
import { useDSReports, useDSSummary, useDSSeed } from '@/hooks/useDSReports';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import FoundationsHealth from '@/components/ds/FoundationsHealth';
import ComponentPipeline from '@/components/ds/ComponentPipeline';
import QAVetoLog from '@/components/ds/QAVetoLog';
import CostLoopGuard from '@/components/ds/CostLoopGuard';
import RunHistory from '@/components/ds/RunHistory';
import ComponentDetail from '@/components/ds/ComponentDetail';

export default function DSBoardPage() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  const summaryQuery = useDSSummary();
  const reportsQuery = useDSReports(
    activeRunId ? { runId: activeRunId, limit: 200 } : { limit: 200 },
  );
  const componentHistoryQuery = useDSReports(
    selectedComponent ? { component: selectedComponent, limit: 100 } : undefined,
  );
  const seedMutation = useDSSeed();

  const summary = summaryQuery.data;
  const reports = reportsQuery.data?.reports ?? [];
  const isLoading = summaryQuery.isLoading || reportsQuery.isLoading;
  const fetchError = summaryQuery.error || reportsQuery.error;
  const isEmpty = !isLoading && !fetchError && (summary?.aggregates?.totalReports ?? 0) === 0;
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-accent/10 p-2">
            <Layers className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-text-primary">M1 Design System</h1>
            <p className="text-xs text-text-muted">Extraction pipeline control surface</p>
          </div>
        </div>

        {isDev && (
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
          >
            <Beaker className="h-3.5 w-3.5" />
            {seedMutation.isPending ? 'Seeding...' : 'Seed Data'}
          </button>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {fetchError ? (
          <ErrorState
            message={fetchError instanceof Error ? fetchError.message : 'Failed to load design system data'}
            onRetry={() => { summaryQuery.refetch(); reportsQuery.refetch(); }}
          />
        ) : isLoading ? (
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <LoadingSkeleton variant="card" className="h-40" />
              <LoadingSkeleton variant="card" className="h-40" />
            </div>
            <LoadingSkeleton variant="card" className="h-64" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <LoadingSkeleton variant="card" className="h-48" />
              <LoadingSkeleton variant="card" className="h-48" />
            </div>
          </div>
        ) : isEmpty ? (
          <EmptyState isDev={isDev} onSeed={() => seedMutation.mutate()} seeding={seedMutation.isPending} />
        ) : (
          <div className="space-y-4 p-6">
            {/* Row 1: Foundations + Cost */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FoundationsHealth data={summary?.foundationsHealth ?? null} />
              <CostLoopGuard
                aggregates={summary?.aggregates ?? { totalCost: 0, avgCostPerComponent: 0, rejectionRate: 0, totalRawValues: 0, avgLatency: 0, totalReports: 0 }}
                reports={reports}
              />
            </div>

            {/* Row 2: Component Pipeline */}
            <ComponentPipeline
              components={summary?.components ?? []}
              availableBatches={summary?.availableBatches ?? []}
              onSelectComponent={setSelectedComponent}
            />

            {/* Row 3: QA + Run History */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <QAVetoLog reports={reports} />
              <RunHistory
                reports={reports}
                activeRunId={activeRunId}
                onSelectRun={setActiveRunId}
              />
            </div>
          </div>
        )}
      </div>

      {/* Component detail drawer */}
      {selectedComponent && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setSelectedComponent(null)}
          />
          <ComponentDetail
            component={selectedComponent}
            reports={componentHistoryQuery.data?.reports ?? []}
            onClose={() => setSelectedComponent(null)}
          />
        </>
      )}
    </div>
  );
}

function EmptyState({ isDev, onSeed, seeding }: { isDev: boolean; onSeed: () => void; seeding: boolean }) {
  const curlSnippet = `curl -X POST http://localhost:3333/api/ds/run-reports \\
  -H "Content-Type: application/json" \\
  -d '{
    "run_id": "run-001",
    "phase": "foundations",
    "component": null,
    "batch": "batch-001",
    "status": "green",
    "metrics": {
      "fidelity": 95.2,
      "tokenReuse": 88.0,
      "variantCoverage": 100,
      "rawValues": 0,
      "qaPass": true,
      "iterations": 1,
      "costUSD": 0.04,
      "latencyMs": 1200
    },
    "alerts": [],
    "timestamp": "${new Date().toISOString()}"
  }'`;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover">
          <Layers className="h-7 w-7 text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">No DS run reports yet</h2>
        <p className="mt-2 text-sm text-text-muted">
          Waiting for agent to submit extraction run data.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-background p-4 text-left">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <Terminal className="h-3.5 w-3.5" />
            POST /api/ds/run-reports
          </div>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-text-muted">
            {curlSnippet}
          </pre>
        </div>

        {isDev && (
          <button
            onClick={onSeed}
            disabled={seeding}
            className="mt-4 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            <Beaker className="mr-1.5 inline h-3.5 w-3.5" />
            {seeding ? 'Seeding...' : 'Seed sample data'}
          </button>
        )}
      </div>
    </div>
  );
}
