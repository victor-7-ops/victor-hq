// Shared types for OpenClaw Dashboard

import { z } from 'zod';

// ── OpenClaw Dashboard Core Types ──────────────────────────

export interface Agent {
  id: string               // slug, e.g. "vera"
  name: string             // display name, e.g. "VERA"
  title: string            // role title, e.g. "Chief Strategy Officer"
  reportsTo: string | null // parent agent id (null for root orchestrator)
  directReports: string[]  // child agent ids
  soulPath: string | null  // path to SOUL.md relative to workspace
  soul: string | null      // full SOUL.md content
  voiceId: string | null   // ElevenLabs voice ID
  color: string            // hex color for node
  emoji: string            // emoji identifier
  avatarUrl: string | null // URL to avatar image served from workspace
  model: string | null     // LLM model identifier (e.g. "anthropic/claude-sonnet-4-6")
  tools: string[]          // list of tools this agent has access to
  crons: CronJob[]         // associated cron jobs
  memoryPath: string | null
  description: string      // one-liner description
}

export interface CronDelivery {
  mode: string
  channel: string
  to: string | null
}

export interface CronRun {
  ts: number
  jobId: string
  status: 'ok' | 'error'
  summary: string | null
  error: string | null
  durationMs: number
  deliveryStatus: string | null
  model: string | null
  provider: string | null
  usage: { input_tokens: number; output_tokens: number; total_tokens: number } | null
}

// ── Claude Code Usage Types ───────────────────────────────────

export interface ClaudeCodeUsage {
  fiveHour: { utilization: number; resetsAt: string | null }
  sevenDay: { utilization: number; resetsAt: string | null }
}

// ── Cost Dashboard Types ──────────────────────────────────────

export interface ModelPricing {
  inputPer1M: number
  outputPer1M: number
}

export interface RunCost {
  ts: number
  jobId: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheTokens: number
  minCost: number
}

export interface JobCostSummary {
  jobId: string
  runs: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheTokens: number
  totalCost: number
  medianCost: number
}

export interface DailyCost {
  date: string
  cost: number
  runs: number
}

export interface ModelBreakdown {
  model: string
  tokens: number
  pct: number
  cost: number
}

export interface TokenAnomaly {
  ts: number
  jobId: string
  totalTokens: number
  medianTokens: number
  ratio: number
}

export interface WeekOverWeek {
  thisWeek: number
  lastWeek: number
  changePct: number | null
}

export interface CacheSavings {
  cacheTokens: number
  estimatedSavings: number
}

export interface OptimizationInsight {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  projectedSavings: number | null
  action: string
}

export interface OptimizationScore {
  overall: number
  cacheScore: number
  tieringScore: number
  anomalyScore: number
  efficiencyScore: number
}

export interface CostSummary {
  totalCost: number
  topSpender: { jobId: string; cost: number } | null
  anomalies: TokenAnomaly[]
  jobCosts: JobCostSummary[]
  dailyCosts: DailyCost[]
  modelBreakdown: ModelBreakdown[]
  runCosts: RunCost[]
  weekOverWeek: WeekOverWeek
  cacheSavings: CacheSavings
  optimizationScore: OptimizationScore
  insights: OptimizationInsight[]
}

export interface CronJob {
  id: string
  name: string
  schedule: string
  scheduleDescription: string
  timezone: string | null
  status: 'ok' | 'error' | 'idle'
  lastRun: string | null
  nextRun: string | null
  lastError: string | null
  agentId: string | null
  description: string | null
  enabled: boolean
  delivery: CronDelivery | null
  lastDurationMs: number | null
  consecutiveErrors: number
  lastDeliveryStatus: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface MemoryFile {
  label: string
  path: string
  content: string
  lastModified: string
}

// ── Memory Dashboard Types ──────────────────────────────────────

export type MemoryFileCategory = 'evergreen' | 'daily' | 'other'

export interface MemoryFileInfo {
  label: string
  path: string
  relativePath: string
  content: string
  lastModified: string
  sizeBytes: number
  category: MemoryFileCategory
}

export interface MemorySearchConfig {
  enabled: boolean
  provider: string | null
  model: string | null
  hybrid: {
    enabled: boolean
    vectorWeight: number
    textWeight: number
    temporalDecay: { enabled: boolean; halfLifeDays: number }
    mmr: { enabled: boolean; lambda: number }
  }
  cache: { enabled: boolean; maxEntries: number }
  extraPaths: string[]
}

export interface MemoryFlushConfig {
  enabled: boolean
  softThresholdTokens: number
}

export interface MemoryConfig {
  memorySearch: MemorySearchConfig
  memoryFlush: MemoryFlushConfig
  configFound: boolean
}

export interface MemoryStatus {
  indexed: boolean
  lastIndexed: string | null
  totalEntries: number | null
  vectorAvailable: boolean | null
  embeddingProvider: string | null
  raw: string
}

export interface MemoryStats {
  totalFiles: number
  totalSizeBytes: number
  dailyLogCount: number
  evergreenCount: number
  oldestDaily: string | null
  newestDaily: string | null
  dailyTimeline: Array<{ date: string; sizeBytes: number } | null>
}

// ── Memory Health Types ──────────────────────────────────────

export type HealthSeverity = 'critical' | 'warning' | 'info' | 'ok'

export interface MemoryHealthCheck {
  id: string
  severity: HealthSeverity
  title: string
  description: string
  affectedFiles: string[] | null
  action: string | null
}

export interface MemoryHealthSummary {
  score: number
  checks: MemoryHealthCheck[]
  staleDailyLogs: StaleDailyLogInfo[]
}

export interface StaleDailyLogInfo {
  relativePath: string
  label: string
  date: string
  ageDays: number
  sizeBytes: number
}

export type ReindexStatus = 'idle' | 'running' | 'success' | 'failed' | 'unavailable'

export interface EditingHint {
  id: string
  text: string
  severity: 'tip' | 'warning'
}

export interface MemoryApiResponse {
  files: MemoryFileInfo[]
  config: MemoryConfig
  status: MemoryStatus
  stats: MemoryStats
  health: MemoryHealthSummary
}

// ── Activity Console Types ─────────────────────────────────────

export interface LogEntry {
  id: string
  ts: number
  source: 'cron' | 'config'
  level: 'info' | 'warn' | 'error'
  category: string
  summary: string
  agentId: string | null
  jobId: string | null
  durationMs: number | null
  details: Record<string, unknown>
}

export interface LogSummary {
  totalEntries: number
  errorCount: number
  sources: { cron: number; config: number }
  timeRange: { oldest: number; newest: number } | null
  recentErrors: LogEntry[]
}

export type LogFilter = 'all' | 'error' | 'config' | 'cron'

export interface LiveLogLine {
  type: 'log' | 'meta'
  time: string
  level: string
  message: string
  raw?: string
}

// ── Preserved: Practitioner Signals (Zod schema) ─────────────

export const practitionerSignalSchema = z.object({
  url: z.string().url('Invalid URL'),
  type: z.string().min(1, 'type is required'),
  title: z.string().min(1, 'title is required'),
  platform: z.string().optional(),
  author: z.string().optional(),
  verbatim: z.string().optional(),
  context: z.string().optional(),
  relevance: z.number().min(0).max(5).optional(),
  tags: z.array(z.string()).optional(),
  date: z.string().optional(),
  date_iso: z.string().optional(),
});

export type PractitionerSignalInput = z.infer<typeof practitionerSignalSchema>;

export interface TechSignal {
  id: string
  date: string
  category: string
  title: string
  summary: string
  relevance: number
  url: string
  source: string
  tags: string[]
}

export interface MarketSignal {
  id: string
  date: string
  type: string
  title: string
  context: string
  relevance: number
  competitor: string
  url: string
  source: string
  tags: string[]
}

export interface PractitionerSignal {
  id: string
  date: string
  date_iso: string
  type: string
  title: string
  verbatim: string
  context: string
  relevance: number
  platform: string
  url: string
  author?: string
  tags: string[]
}
