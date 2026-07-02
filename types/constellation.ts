// ============================================
// Constellation Graph — Type Definitions
// ============================================

export type ConstellationRole =
  | 'orchestrator'
  | 'developer'
  | 'qa'
  | 'researcher'
  | 'designer'
  | 'other';

export type ConstellationStatus = 'active' | 'idle' | 'error' | 'offline';

export type EdgeType = 'delegation' | 'tool_call' | 'message' | 'unknown';

export interface ConstellationNode {
  id: string;
  name: string;
  role: ConstellationRole;
  modelPrimary?: string;
  modelFallbacks?: string[];
  status: ConstellationStatus;
  lastSeenAt?: string;
  tokensUsed24h?: number;
  costUSD24h?: number;
  errorCount24h?: number;
  contextPercent?: number;
  provider?: string;
  recentTaskCount?: number;
  lastError?: string | null;
  meta?: Record<string, any>;
}

export interface ConstellationEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  lastEventAt?: string;
  ratePerMin?: number;
  strength?: number; // 0-1 visual weight
}

export interface ConstellationGraph {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  computedAt: string;
  isLive: boolean;
}
