import { NextResponse } from 'next/server';
import { insertDSRunReport } from '@/lib/db/queries';
import type { DSRunReport, DSAlertType, DSPhase, DSStatus } from '@/types';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

const COMPONENTS = ['Button', 'Input', 'Card', 'Modal', 'Badge', 'Avatar', 'Tooltip', 'Dropdown'];
const BATCHES = ['batch-001', 'batch-002', 'batch-003'];
const PHASES: DSPhase[] = ['foundations', 'component', 'qa', 'stress'];
const STATUSES: DSStatus[] = ['green', 'green', 'green', 'yellow', 'red'];
const ALERT_TYPES: DSAlertType[] = ['token_drift', 'raw_value', 'coverage_gap', 'shadow_mismatch', 'visual_diff'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateReport(index: number): DSRunReport {
  const phase = index === 0 ? 'foundations' : randomItem(PHASES.filter((p) => p !== 'foundations'));
  const isFoundations = phase === 'foundations';
  const status = randomItem(STATUSES);
  const alerts = [];

  if (status !== 'green') {
    alerts.push({
      type: randomItem(ALERT_TYPES),
      message: status === 'red' ? 'Fidelity below threshold' : 'Minor token drift detected',
      location: isFoundations ? 'tokens/colors.json' : `components/${randomItem(COMPONENTS)}.tsx`,
    });
  }

  const baseDate = new Date();
  baseDate.setHours(baseDate.getHours() - (20 - index) * 2);

  return {
    run_id: `run-seed-${String(index).padStart(3, '0')}`,
    phase,
    component: isFoundations ? null : randomItem(COMPONENTS),
    batch: randomItem(BATCHES),
    status,
    metrics: {
      fidelity: 85 + Math.random() * 15,
      tokenReuse: 70 + Math.random() * 30,
      variantCoverage: 60 + Math.random() * 40,
      rawValues: Math.floor(Math.random() * 8),
      qaPass: status !== 'red',
      iterations: 1 + Math.floor(Math.random() * 4),
      costUSD: 0.02 + Math.random() * 0.15,
      latencyMs: 800 + Math.random() * 4000,
    },
    alerts,
    timestamp: baseDate.toISOString(),
  };
}

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Seed disabled in production' }, { status: 403 });
  }

  try {
    const reports: DSRunReport[] = [];
    for (let i = 0; i < 20; i++) {
      const report = generateReport(i);
      insertDSRunReport(report);
      reports.push(report);
    }
    return NextResponse.json({ ok: true, count: reports.length });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}
