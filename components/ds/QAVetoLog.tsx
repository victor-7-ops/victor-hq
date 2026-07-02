'use client';

import { useState } from 'react';
import { ShieldAlert, Copy, Check, MapPin } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import StatusBadge from './StatusBadge';
import type { DSRunReport } from '@/types';

interface Props {
  reports: DSRunReport[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
      aria-label="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-status-green" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export default function QAVetoLog({ reports }: Props) {
  const vetoEvents = reports
    .filter((r) => (r.status === 'red' || r.status === 'yellow') && r.alerts.length > 0)
    .slice(0, 50);

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <ShieldAlert className="h-4 w-4 text-text-muted" />
          QA Veto Log
        </h2>
        <span className="text-xs text-text-muted">{vetoEvents.length} events</span>
      </div>

      {vetoEvents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ShieldAlert className="h-5 w-5 text-text-muted" />
          <p className="text-sm text-text-muted">No QA veto events.</p>
        </div>
      ) : (
        <div className="max-h-[400px] divide-y divide-border-subtle overflow-y-auto">
          {vetoEvents.map((report, idx) =>
            report.alerts.map((alert, aidx) => (
              <div
                key={`${report.run_id}-${idx}-${aidx}`}
                className="px-5 py-3 transition-colors hover:bg-surface-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={report.status} size="sm" />
                      <span className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
                        {alert.type}
                      </span>
                      {report.component && (
                        <span className="text-xs font-medium text-text-secondary">{report.component}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-text-primary">
                      {alert.message}
                      <CopyButton text={alert.message} />
                    </p>
                    {alert.location && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-text-muted">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <code className="font-mono">{alert.location}</code>
                        <CopyButton text={alert.location} />
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-text-muted">
                    {formatRelativeTime(report.timestamp)}
                  </span>
                </div>
              </div>
            )),
          )}
        </div>
      )}
    </section>
  );
}
