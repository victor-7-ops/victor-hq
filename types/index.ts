// ============================================
// OpenClaw Dashboard — Type Definitions
// ============================================

// --- Agent Fleet Types ---

export type AgentRole = 'orchestrator' | 'sub-agent';
export type AgentStatus = 'online' | 'idle' | 'error' | 'offline';
export type Provider = 'anthropic' | 'openai' | 'google' | 'minimax' | 'groq' | 'openrouter';
export type ProviderHealth = 'healthy' | 'degraded' | 'down';
export type TaskStatus = 'completed' | 'partial' | 'uncertain' | 'failed' | 'running';

export interface AgentTask {
  id: string;
  agentId: string;
  description: string;
  status: TaskStatus;
  startedAt: string;
  completedAt: string | null;
  tokensUsed: number;
  costUSD: number;
  errorMessage: string | null;
  toolCalls?: string[];
  model?: string;
}

export interface AgentData {
  id: string;
  name: string;
  role: AgentRole;
  parentId: string | null;
  status: AgentStatus;
  model: string;
  provider: Provider;
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
  contextWindowUsedPercent: number;
  latencyMs: number;
  errorCount: number;
  lastError: string | null;
  lastActiveAt: string;
  uptime: number;
  taskCompletedCount: number;
  taskFailedCount: number;
  driftScore: number | null;
  recentTasks: AgentTask[];
  sessionKey?: string;
  compactionCount?: number;
  fallbacks?: string[];
}

export interface GatewayStatus {
  port: number;
  pid: number | null;
  uptime: number;
  version: string;
  deviceTokenValid: boolean;
  cacheRetentionMode: 'short' | 'long' | 'unknown';
  tailscaleEndpoint: string | null;
  providerHealth: Record<string, ProviderHealth>;
  // New fields from CLI
  reachable?: boolean;
  connectLatencyMs?: number;
  runtimeState?: string;
}

// --- Sprint / Task Types ---

export type SprintStatus = 'active' | 'upcoming' | 'completed';
export type DevTaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type TaskType = 'feature' | 'bug' | 'design' | 'research' | 'ops';
export type DesignStatus = 'exploration' | 'in-review' | 'shipped';

export interface Sprint {
  id: string;
  number: number;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  tasks: DevTask[];
  owner?: string;
}

export interface DevTask {
  id: string;
  title: string;
  description: string;
  status: DevTaskStatus;
  priority: Priority;
  type: TaskType;
  tags: string[];
  sprintId: string | null;
  assignedAgent: string | null;
  lastCommitRef: string | null;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
  designStatus?: DesignStatus;
  owner?: string;
  phase?: string;
  notes?: string;
  acceptance?: string;
  gates?: string;
}

// --- Memory Log Types ---

export type MemoryEntryType = 'session_summary' | 'decision' | 'note' | 'alert';

export interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  title: string;
  content: string;
  agentId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
}

// --- Security Types ---

export interface SecurityAlert {
  id: string;
  type: 'prompt_injection' | 'cost_spike' | 'key_rotation' | 'gateway_restart' | 'error_spike';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  rawLog: string | null;
  acknowledged: boolean;
  createdAt: string;
}

export interface CostData {
  todaySpend: number;
  dailyLimit: number;
  spendByProvider: Record<string, number>;
  spendByAgent: Record<string, number>;
  cacheWriteCost: number;
  computeCost: number;
  dailyHistory: { date: string; cost: number; tokens: number }[];
  anomalies: CostAnomaly[];
}

export interface CostAnomaly {
  id: string;
  date: string;
  actualSpend: number;
  expectedSpend: number;
  probableCause: string;
  createdAt: string;
}

// --- Detailed Cost History ---

export interface DailyDetailedEntry {
  date: string;
  cost: number;
  tokens: number;
  byModel: Record<string, { cost: number; tokens: number }>;
  byProvider: Record<string, { cost: number; tokens: number }>;
  byAgent: Record<string, { cost: number; tokens: number }>;
}

// --- Enhanced Provider Types ---

export interface ModelInfo {
  id: string;
  name: string;
  reasoning: boolean;
  cost: { input: number; output: number; cacheRead?: number; cacheWrite?: number };
  contextWindow: number;
  lastUsed: string | null;
  active: boolean;
}

export interface ProviderConnectionEnhanced extends ProviderConnection {
  activeModels: string[];
  allModels: ModelInfo[];
  totalSpendToday: number;
  lastUsedModel: string | null;
}

// --- Security Posture ---

export interface OAuthTokenStatus {
  provider: string;
  profileId: string;
  expiresAt: string | null;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  lastUsed: string | null;
  errorCount: number;
}

export interface SecurityPosture {
  devices: PairedDevice[];
  deviceTokenAge: { days: number; updatedAt: string } | null;
  oauthTokens: OAuthTokenStatus[];
  configAuditSummary: {
    totalChanges: number;
    lastChange: string | null;
    suspiciousCount: number;
    recentChanges: ConfigAuditEntry[];
  };
  totalAuthErrors: number;
}

// --- Config Types ---

export interface DashboardConfig {
  id: string;
  openclawDataDir: string;
  projectRepoPath: string | null;
  githubRepo: string | null;
  dailySpendLimit: number;
  keyRotationDays: number;
  accentColor: string;
  setupComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Provider Connection Types ---

export interface ProviderConnection {
  provider: string;
  status: ProviderHealth;
  models: string[];
  lastSuccessfulCall: string | null;
  keyAgeDays: number | null;
  keyRotationDue: boolean;
}

// --- Compaction Log ---

export interface CompactionEntry {
  id: string;
  agentId: string;
  agentName: string;
  tokensBefore: number;
  tokensAfter: number;
  reductionPercent: number;
  timestamp: string;
}

// --- Config Audit ---

export interface ConfigAuditEntry {
  timestamp: string;
  pid: number;
  hashBefore: string;
  hashAfter: string;
  description: string;
}

// --- Device ---

export interface PairedDevice {
  id: string;
  platform: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  tokenCreated: string;
  lastRotated: string;
  lastUsed: string;
}

// --- Cron Job ---

export interface CronJob {
  id: string;
  name: string;
  agent: string;
  enabled: boolean;
  scheduleMs: number;
  lastRun: string | null;
  lastStatus: string | null;
  lastDurationMs: number | null;
}

// --- Daily Digest ---

export interface DailyDigest {
  date: string;
  fleetStatus: { total: number; online: number; offline: number; error: number };
  costToday: number;
  costAvg7d: number;
  tokensToday: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksStuck: number;
  securityAlerts: number;
  contextWarnings: string[];
  notableEvents: string[];
}

// --- Design System Run Report Types ---

export type DSPhase = 'foundations' | 'component' | 'qa' | 'stress';
export type DSStatus = 'green' | 'yellow' | 'red';
export type DSAlertType =
  | 'token_drift'
  | 'raw_value'
  | 'coverage_gap'
  | 'shadow_mismatch'
  | 'visual_diff'
  | 'schema_invalid';

export interface DSRunMetrics {
  fidelity: number;
  tokenReuse: number;
  variantCoverage: number;
  rawValues: number;
  qaPass: boolean;
  iterations: number;
  costUSD: number;
  latencyMs: number;
}

export interface DSAlert {
  type: DSAlertType;
  message: string;
  location: string | null;
}

export interface DSRunReport {
  run_id: string;
  phase: DSPhase;
  component: string | null;
  batch: string | null;
  status: DSStatus;
  metrics: DSRunMetrics;
  alerts: DSAlert[];
  timestamp: string;
}

export interface DSSummary {
  foundationsHealth: {
    tokenCoverage: number;
    rawValues: number;
    driftStatus: DSStatus;
    lastUpdated: string | null;
  } | null;
  components: Array<{
    component: string;
    status: DSStatus;
    fidelity: number;
    variantCoverage: number;
    tokenReuse: number;
    rawValues: number;
    iterations: number;
    costUSD: number;
    lastUpdated: string;
  }>;
  aggregates: {
    totalCost: number;
    avgCostPerComponent: number;
    rejectionRate: number;
    totalRawValues: number;
    avgLatency: number;
    totalReports: number;
  };
}

// --- Practitioner Signal Types ---

export interface PractitionerSignal {
  id: string;
  date: string;
  date_iso: string;
  type: string;
  title: string;
  verbatim: string;
  context: string;
  relevance: number;
  platform: string;
  url: string;
  author?: string;
  tags: string[];
}

// --- SSE Event Types ---

export type SSEEventType = 'agent_update' | 'gateway_update' | 'log_line' | 'cost_update' | 'alert';

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: string;
}
