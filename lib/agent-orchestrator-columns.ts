import type { AOSessionStatus } from './agent-orchestrator'

export type Column = 'working' | 'needs_you' | 'in_review' | 'ready_to_merge'

export const COLUMN_LABELS: Record<Column, string> = {
  working: 'Working',
  needs_you: 'Needs You',
  in_review: 'In Review',
  ready_to_merge: 'Ready to Merge',
}

export const COLUMN_DOT: Record<Column, string> = {
  working: 'var(--accent-energy)',
  needs_you: 'var(--system-yellow, #eab308)',
  in_review: 'var(--text-tertiary)',
  ready_to_merge: 'var(--system-green)',
}

export const STATUS_TO_COLUMN: Record<AOSessionStatus, Column | null> = {
  working: 'working',
  needs_input: 'needs_you',
  changes_requested: 'needs_you',
  ci_failed: 'needs_you',
  pr_open: 'in_review',
  draft: 'in_review',
  review_pending: 'in_review',
  approved: 'ready_to_merge',
  mergeable: 'ready_to_merge',
  merged: 'ready_to_merge',
  idle: null,
  terminated: null,
  no_signal: null,
}

export const COLUMNS: Column[] = ['working', 'needs_you', 'in_review', 'ready_to_merge']
