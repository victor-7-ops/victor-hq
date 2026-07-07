import { getDb } from './schema';
import type {
  DashboardConfig, MemoryEntry, DevTask, Sprint,
  SecurityAlert, CompactionEntry, CostAnomaly,
  DSRunReport, DSSummary,
} from '@/types';
import crypto from 'crypto';
import { getOpenclawHome, getProjectRepoPath } from '@/lib/utils';

// --- Config ---

export function getConfig(): DashboardConfig {
  const db = getDb();
  const row = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
  const openclawDataDir = process.env.OPENCLAW_HOME || (row ? row.openclaw_path : getOpenclawHome());
  if (!openclawDataDir) {
    throw new Error('CRITICAL: OPENCLAW_HOME is not set and no path is configured in the database.');
  }

  if (!row) {
    return {
      id: 'default',
      openclawDataDir,
      projectRepoPath: getProjectRepoPath(),
      githubRepo: null,
      dailySpendLimit: 15,
      keyRotationDays: 30,
      accentColor: '#3b82f6',
      setupComplete: false,
      createdAt: '',
      updatedAt: '',
    };
  }
  return {
    id: String(row.id),
    openclawDataDir,
    projectRepoPath: process.env.PROJECT_REPO_PATH || row.project_repo_path,
    githubRepo: row.github_repo,
    dailySpendLimit: row.daily_spend_threshold,
    keyRotationDays: row.key_rotation_reminder_days,
    accentColor: row.accent_color,
    setupComplete: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function updateConfig(updates: Partial<DashboardConfig>) {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  const fieldMap: Record<string, string> = {
    openclawDataDir: 'openclaw_path',
    projectRepoPath: 'project_repo_path',
    githubRepo: 'github_repo',
    dailySpendLimit: 'daily_spend_threshold',
    keyRotationDays: 'key_rotation_reminder_days',
    accentColor: 'accent_color',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      fields.push(`${col} = ?`);
      values.push((updates as any)[key]);
    }
  }

  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  values.push(1);

  db.prepare(`UPDATE config SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// --- Memory Entries ---

export function getMemoryEntries(opts?: {
  type?: string; search?: string; limit?: number; offset?: number;
}): MemoryEntry[] {
  const db = getDb();
  const limit = opts?.limit || 50;
  const offset = opts?.offset || 0;

  if (opts?.search) {
    const rows = db.prepare(`
      SELECT m.* FROM memory_entries m
      JOIN memory_entries_fts f ON m.id = f.id
      WHERE memory_entries_fts MATCH ?
      ORDER BY m.created_at DESC LIMIT ? OFFSET ?
    `).all(opts.search, limit, offset) as any[];
    return rows.map(rowToMemoryEntry);
  }

  let sql = 'SELECT * FROM memory_entries';
  const params: any[] = [];
  if (opts?.type) {
    sql += ' WHERE type = ?';
    params.push(opts.type);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return (db.prepare(sql).all(...params) as any[]).map(rowToMemoryEntry);
}

export function createMemoryEntry(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): MemoryEntry {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO memory_entries (id, type, title, content, agent, tags_json, pending_review)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, entry.type, entry.title, entry.content, entry.agentId,
    JSON.stringify(entry.tags), entry.isRead ? 0 : 1);

  const row = db.prepare('SELECT * FROM memory_entries WHERE id = ?').get(id) as any;
  return rowToMemoryEntry(row);
}

export function markMemoryRead(id: string) {
  getDb().prepare('UPDATE memory_entries SET pending_review = 0 WHERE id = ?').run(id);
}

export function getUnreadCount(): number {
  return (getDb().prepare('SELECT COUNT(*) as count FROM memory_entries WHERE pending_review = 1').get() as any).count;
}

function rowToMemoryEntry(row: any): MemoryEntry {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    agentId: row.agent,
    tags: JSON.parse(row.tags_json || '[]'),
    isRead: !row.pending_review,
    metadata: {},
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

// --- Security Alerts ---

export function getAlerts(acknowledged?: boolean): SecurityAlert[] {
  const db = getDb();
  let sql = 'SELECT * FROM alerts';
  const params: any[] = [];
  if (acknowledged !== undefined) {
    sql += ' WHERE acknowledged = ?';
    params.push(acknowledged ? 1 : 0);
  }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  return (db.prepare(sql).all(...params) as any[]).map((r) => ({
    id: r.id,
    type: r.category,
    severity: r.severity,
    title: r.title,
    description: r.message,
    rawLog: r.details,
    acknowledged: !!r.acknowledged,
    createdAt: r.created_at,
  }));
}

export function createAlert(alert: Omit<SecurityAlert, 'id' | 'createdAt' | 'acknowledged'>) {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO alerts (id, category, severity, title, message, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, alert.type, alert.severity, alert.title, alert.description, alert.rawLog);
  return id;
}

export function acknowledgeAlert(id: string) {
  getDb().prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(id);
}

export function getUnacknowledgedAlertCount(): number {
  return (getDb().prepare('SELECT COUNT(*) as count FROM alerts WHERE acknowledged = 0').get() as any).count;
}

// --- Cost ---

export function upsertDailyCost(date: string, data: {
  totalCost: number; totalTokens: number;
  costByProvider: Record<string, number>; costByAgent: Record<string, number>;
  cacheWriteCost: number; computeCost: number;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO daily_metrics (date, cost_usd, tokens_in, tokens_out, cache_write_cost, compute_cost, providers_json, agents_json)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      cost_usd = excluded.cost_usd,
      tokens_in = excluded.tokens_in,
      cache_write_cost = excluded.cache_write_cost,
      compute_cost = excluded.compute_cost,
      providers_json = excluded.providers_json,
      agents_json = excluded.agents_json
  `).run(date, data.totalCost, data.totalTokens,
    data.cacheWriteCost, data.computeCost,
    JSON.stringify(data.costByProvider), JSON.stringify(data.costByAgent));
}

export function getDailyCosts(days: number = 30) {
  return getDb().prepare(`
    SELECT * FROM daily_metrics ORDER BY date DESC LIMIT ?
  `).all(days) as any[];
}

// --- Compaction Log ---

export function getCompactionLog(): CompactionEntry[] {
  return (getDb().prepare('SELECT * FROM compaction_events ORDER BY occurred_at DESC LIMIT 50').all() as any[]).map((r) => ({
    id: r.id,
    agentId: r.agent_id,
    agentName: r.agent_id,
    tokensBefore: r.tokens_before || 0,
    tokensAfter: r.tokens_after || 0,
    reductionPercent: r.reduction_percent || 0,
    timestamp: r.occurred_at,
  }));
}

export function addCompactionEntry(entry: Omit<CompactionEntry, 'id'>) {
  const id = crypto.randomUUID();
  getDb().prepare(`
    INSERT INTO compaction_events (id, agent_id, occurred_at, tokens_before, tokens_after, reduction_percent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, entry.agentId, entry.timestamp, entry.tokensBefore, entry.tokensAfter, entry.reductionPercent);
}

// --- Agent Performance Metrics ---

export function getAgentMetricsSummary(): Array<{
  agentId: string;
  totalTokensIn: number;
  totalTokensOut: number;
  avgLatencyMs: number;
  totalRequests: number;
  errorCount: number;
  lastModel: string | null;
  lastActive: string | null;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      agent_id,
      COALESCE(SUM(tokens_in), 0) as total_tokens_in,
      COALESCE(SUM(tokens_out), 0) as total_tokens_out,
      COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
      COUNT(*) as total_requests,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count,
      MAX(timestamp) as last_active
    FROM agent_performance_metrics
    GROUP BY agent_id
  `).all() as any[];

  return rows.map((r) => {
    const lastRow = db.prepare(
      'SELECT model FROM agent_performance_metrics WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 1'
    ).get(r.agent_id) as any;
    return {
      agentId: r.agent_id,
      totalTokensIn: r.total_tokens_in,
      totalTokensOut: r.total_tokens_out,
      avgLatencyMs: Math.round(r.avg_latency_ms),
      totalRequests: r.total_requests,
      errorCount: r.error_count,
      lastModel: lastRow?.model || null,
      lastActive: r.last_active,
    };
  });
}

// --- Tech Updates ---

export function getTechUpdates(opts?: { limit?: number; category?: string; projectId?: string }): any[] {
  const db = getDb();
  const limit = opts?.limit || 500;
  const pid = opts?.projectId || null;
  let sql = 'SELECT * FROM tech_updates WHERE deleted = 0';
  const params: any[] = [];
  if (pid) {
    sql += ' AND project_id = ?';
    params.push(pid);
  }
  if (opts?.category) {
    sql += ' AND category_id = ?';
    params.push(opts.category);
  }
  sql += ' ORDER BY date_iso DESC, ingested_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params) as any[];
}

export function getTechUpdateCategories(opts?: { projectId?: string }): Array<{ id: string; label: string; icon: string; count: number }> {
  const db = getDb();
  const pid = opts?.projectId || null;
  let sql = `SELECT category_id as id, category_label as label, category_icon as icon, COUNT(*) as count
    FROM tech_updates WHERE deleted = 0`;
  const params: any[] = [];
  if (pid) {
    sql += ' AND project_id = ?';
    params.push(pid);
  }
  sql += ' GROUP BY category_id ORDER BY count DESC';
  return db.prepare(sql).all(...params) as any[];
}

// --- Todos ---

export function getTodos(opts?: { status?: string }): any[] {
  const db = getDb();
  let sql = 'SELECT * FROM todos';
  const params: any[] = [];
  if (opts?.status) {
    sql += ' WHERE status = ?';
    params.push(opts.status);
  }
  sql += " ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'done' THEN 1 ELSE 2 END, CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, deadline ASC, created_at DESC";
  return db.prepare(sql).all(...params) as any[];
}

export function createTodo(todo: {
  title: string;
  description?: string;
  priority?: string;
  deadline?: string;
  tags?: string[];
  assignee?: string;
}): any {
  const db = getDb();
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  db.prepare(`
    INSERT INTO todos (id, title, description, priority, deadline, tags, assignee)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, todo.title, todo.description || null, todo.priority || 'medium',
    todo.deadline || null, JSON.stringify(todo.tags || []), todo.assignee || null);
  return db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
}

export function updateTodo(id: string, updates: {
  title?: string;
  description?: string | null;
  priority?: string;
  deadline?: string | null;
  tags?: string[];
  assignee?: string | null;
  status?: string;
}): void {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }
  if (updates.deadline !== undefined) { fields.push('deadline = ?'); values.push(updates.deadline); }
  if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
  if (updates.assignee !== undefined) { fields.push('assignee = ?'); values.push(updates.assignee); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }

  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function updateTodoStatus(id: string, status: string): void {
  getDb().prepare("UPDATE todos SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

export function deleteTodo(id: string): void {
  getDb().prepare('DELETE FROM todos WHERE id = ?').run(id);
}

export function insertTechUpdate(update: {
  url: string;
  category_id: string;
  category_label: string;
  category_icon?: string;
  title: string;
  summary?: string;
  source?: string;
  date?: string;
  source_ref?: string;
  date_iso?: string;
  projectId?: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO tech_updates (url, category_id, category_label, category_icon, title, summary, source, date, source_ref, date_iso, project_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    update.url, update.category_id, update.category_label,
    update.category_icon || '', update.title, update.summary || '',
    update.source || '', update.date || null, update.source_ref || null,
    update.date_iso || new Date().toISOString().slice(0, 10),
    update.projectId || 'default',
  );
}

// --- Market Signals ---

export function insertMarketSignal(signal: {
  url: string;
  type: string;
  source?: string;
  competitor?: string;
  source_ref?: string;
  title: string;
  context?: string;
  analysis?: string;
  tags_json?: string;
  date?: string;
  date_iso?: string;
  projectId?: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO market_signals (url, type, source, competitor, source_ref, title, context, analysis, tags_json, date, date_iso, project_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    signal.url, signal.type, signal.source || '', signal.competitor || null,
    signal.source_ref || null, signal.title, signal.context || '',
    signal.analysis || '', signal.tags_json || '[]', signal.date || null,
    signal.date_iso || new Date().toISOString().slice(0, 10),
    signal.projectId || 'default',
  );
}

export function getMarketSignals(opts?: { type?: string; limit?: number; projectId?: string }): any[] {
  const db = getDb();
  const limit = opts?.limit || 100;
  const pid = opts?.projectId || null;
  let sql = 'SELECT * FROM market_signals WHERE deleted = 0';
  const params: any[] = [];
  if (pid) {
    sql += ' AND project_id = ?';
    params.push(pid);
  }
  if (opts?.type) {
    sql += ' AND type = ?';
    params.push(opts.type);
  }
  sql += ' ORDER BY date_iso DESC, ingested_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params) as any[];
}

export function getMarketSignalTypes(opts?: { projectId?: string }): Array<{ type: string; count: number }> {
  const db = getDb();
  const pid = opts?.projectId || null;
  let sql = `SELECT type, COUNT(*) as count
    FROM market_signals WHERE deleted = 0`;
  const params: any[] = [];
  if (pid) {
    sql += ' AND project_id = ?';
    params.push(pid);
  }
  sql += ' GROUP BY type ORDER BY count DESC';
  return db.prepare(sql).all(...params) as any[];
}

// --- Practitioner Signals ---

export function insertPractitionerSignal(signal: {
  url: string;
  type: string;
  platform?: string;
  author?: string;
  source_ref?: string;
  title: string;
  verbatim?: string;
  context?: string;
  relevance?: number;
  tags_json?: string;
  date?: string;
  date_iso?: string;
  projectId?: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO practitioner_signals (url, type, platform, author, source_ref, title, verbatim, context, relevance, tags_json, date, date_iso, project_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    signal.url, signal.type, signal.platform || '', signal.author || null,
    signal.source_ref || null, signal.title, signal.verbatim || '',
    signal.context || '', signal.relevance || 0, signal.tags_json || '[]',
    signal.date || null, signal.date_iso || new Date().toISOString().slice(0, 10),
    signal.projectId || 'default',
  );
}

export function getPractitionerSignals(opts?: { type?: string; limit?: number; projectId?: string }): any[] {
  const db = getDb();
  const limit = opts?.limit || 100;
  const pid = opts?.projectId || null;
  let sql = 'SELECT * FROM practitioner_signals WHERE deleted = 0';
  const params: any[] = [];
  if (pid) {
    sql += ' AND project_id = ?';
    params.push(pid);
  }
  if (opts?.type) {
    sql += ' AND type = ?';
    params.push(opts.type);
  }
  sql += ' ORDER BY date_iso DESC, ingested_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params) as any[];
}

export function getPractitionerSignalTypes(opts?: { projectId?: string }): Array<{ type: string; count: number }> {
  const db = getDb();
  const pid = opts?.projectId || null;
  let sql = `SELECT type, COUNT(*) as count
    FROM practitioner_signals WHERE deleted = 0`;
  const params: any[] = [];
  if (pid) {
    sql += ' AND project_id = ?';
    params.push(pid);
  }
  sql += ' GROUP BY type ORDER BY count DESC';
  return db.prepare(sql).all(...params) as any[];
}

// --- Feed Counts (lightweight) ---

export function getFeedCounts(opts?: { projectId?: string }): { marketIntel: number; techUpdates: number; practitionerSignals: number } {
  const db = getDb();
  const pid = opts?.projectId || null;
  const suffix = pid ? ' AND project_id = ?' : '';
  const miParams = pid ? [pid] : [];
  const mi = db.prepare('SELECT COUNT(*) as c FROM market_signals WHERE deleted = 0' + suffix).get(...miParams) as any;
  const tu = db.prepare('SELECT COUNT(*) as c FROM tech_updates WHERE deleted = 0' + suffix).get(...miParams) as any;
  const ps = db.prepare('SELECT COUNT(*) as c FROM practitioner_signals WHERE deleted = 0' + suffix).get(...miParams) as any;
  return {
    marketIntel: mi?.c ?? 0,
    techUpdates: tu?.c ?? 0,
    practitionerSignals: ps?.c ?? 0,
  };
}

// --- DS Run Reports ---

export function insertDSRunReport(report: DSRunReport): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO ds_run_reports (run_id, phase, component, batch, status,
      fidelity, token_reuse, variant_coverage, raw_values, qa_pass,
      iterations, cost_usd, latency_ms, alerts, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.run_id, report.phase, report.component, report.batch, report.status,
    report.metrics.fidelity, report.metrics.tokenReuse, report.metrics.variantCoverage,
    report.metrics.rawValues, report.metrics.qaPass ? 1 : 0,
    report.metrics.iterations, report.metrics.costUSD, report.metrics.latencyMs,
    JSON.stringify(report.alerts), report.timestamp,
  );
}

export function getDSRunReports(opts?: {
  component?: string; batch?: string; status?: string; phase?: string;
  from?: string; to?: string; limit?: number; runId?: string;
}): DSRunReport[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: any[] = [];

  if (opts?.component) { conditions.push('component = ?'); params.push(opts.component); }
  if (opts?.batch) { conditions.push('batch = ?'); params.push(opts.batch); }
  if (opts?.status) { conditions.push('status = ?'); params.push(opts.status); }
  if (opts?.phase) { conditions.push('phase = ?'); params.push(opts.phase); }
  if (opts?.from) { conditions.push('timestamp >= ?'); params.push(opts.from); }
  if (opts?.to) { conditions.push('timestamp <= ?'); params.push(opts.to); }
  if (opts?.runId) { conditions.push('run_id = ?'); params.push(opts.runId); }

  let sql = 'SELECT * FROM ds_run_reports';
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY timestamp DESC';
  sql += ` LIMIT ${opts?.limit || 200}`;

  return (db.prepare(sql).all(...params) as any[]).map(rowToDSRunReport);
}

export function getDSLatestPerComponent(): DSRunReport[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT r.* FROM ds_run_reports r
    INNER JOIN (
      SELECT component, MAX(timestamp) as max_ts
      FROM ds_run_reports
      WHERE component IS NOT NULL
      GROUP BY component
    ) latest ON r.component = latest.component AND r.timestamp = latest.max_ts
    ORDER BY r.component
  `).all() as any[];
  return rows.map(rowToDSRunReport);
}

export function getDSSummary(): DSSummary {
  const db = getDb();

  // Latest foundations report
  const foundationsRow = db.prepare(`
    SELECT * FROM ds_run_reports WHERE phase = 'foundations'
    ORDER BY timestamp DESC LIMIT 1
  `).get() as any | undefined;

  const foundationsHealth = foundationsRow ? {
    tokenCoverage: foundationsRow.token_reuse,
    rawValues: foundationsRow.raw_values,
    driftStatus: foundationsRow.status as 'green' | 'yellow' | 'red',
    lastUpdated: foundationsRow.timestamp,
  } : null;

  // Latest per component
  const components = getDSLatestPerComponent().map((r) => ({
    component: r.component!,
    status: r.status,
    fidelity: r.metrics.fidelity,
    variantCoverage: r.metrics.variantCoverage,
    tokenReuse: r.metrics.tokenReuse,
    rawValues: r.metrics.rawValues,
    iterations: r.metrics.iterations,
    costUSD: r.metrics.costUSD,
    lastUpdated: r.timestamp,
  }));

  // Aggregates
  const agg = db.prepare(`
    SELECT
      COALESCE(SUM(cost_usd), 0) as total_cost,
      COUNT(DISTINCT component) as component_count,
      COUNT(*) as total_reports,
      COALESCE(AVG(latency_ms), 0) as avg_latency,
      COALESCE(SUM(raw_values), 0) as total_raw_values,
      COALESCE(SUM(CASE WHEN status = 'red' THEN 1 ELSE 0 END), 0) as red_count
    FROM ds_run_reports
  `).get() as any;

  return {
    foundationsHealth,
    components,
    aggregates: {
      totalCost: agg.total_cost,
      avgCostPerComponent: agg.component_count > 0 ? agg.total_cost / agg.component_count : 0,
      rejectionRate: agg.total_reports > 0 ? agg.red_count / agg.total_reports : 0,
      totalRawValues: agg.total_raw_values,
      avgLatency: agg.avg_latency,
      totalReports: agg.total_reports,
    },
  };
}

export function getDSDistinctComponents(): string[] {
  const db = getDb();
  return (db.prepare('SELECT DISTINCT component FROM ds_run_reports WHERE component IS NOT NULL ORDER BY component').all() as any[])
    .map((r) => r.component);
}

export function getDSDistinctBatches(): string[] {
  const db = getDb();
  return (db.prepare('SELECT DISTINCT batch FROM ds_run_reports WHERE batch IS NOT NULL ORDER BY batch').all() as any[])
    .map((r) => r.batch);
}

// --- Reference Files ---

export function getReferenceFiles(opts?: { tag?: string; search?: string; limit?: number; projectId?: string }): any[] {
  const db = getDb();
  const limit = opts?.limit || 100;
  const pid = opts?.projectId || null;
  let sql = 'SELECT * FROM reference_files WHERE deleted = 0';
  const params: any[] = [];
  if (pid) {
    sql += ' AND project_id = ?';
    params.push(pid);
  }
  if (opts?.tag) {
    sql += " AND tags_json LIKE ?";
    params.push(`%"${opts.tag}"%`);
  }
  if (opts?.search) {
    sql += ' AND (title LIKE ? OR content LIKE ?)';
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  sql += ' ORDER BY updated_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params) as any[];
}

export function getReferenceFile(id: string): any | undefined {
  return getDb().prepare('SELECT * FROM reference_files WHERE id = ? AND deleted = 0').get(id);
}

export function insertReferenceFile(file: { title: string; content: string; tags?: string[]; projectId?: string }): string {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO reference_files (id, title, content, tags_json, project_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, file.title, file.content, JSON.stringify(file.tags || []), file.projectId || 'default');
  return id;
}

export function updateReferenceFile(id: string, updates: { title?: string; content?: string; tags?: string[] }): void {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
  if (updates.tags !== undefined) { fields.push('tags_json = ?'); values.push(JSON.stringify(updates.tags)); }
  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE reference_files SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteReferenceFile(id: string): void {
  getDb().prepare("UPDATE reference_files SET deleted = 1, updated_at = datetime('now') WHERE id = ?").run(id);
}

export function getReferenceFileTags(opts?: { projectId?: string }): string[] {
  const db = getDb();
  const pid = opts?.projectId || null;
  let sql = 'SELECT tags_json FROM reference_files WHERE deleted = 0';
  const params: any[] = [];
  if (pid) {
    sql += ' AND project_id = ?';
    params.push(pid);
  }
  const rows = db.prepare(sql).all(...params) as any[];
  const tagSet = new Set<string>();
  for (const row of rows) {
    try {
      const tags: string[] = JSON.parse(row.tags_json || '[]');
      tags.forEach(t => tagSet.add(t));
    } catch { /* skip */ }
  }
  return [...tagSet].sort();
}

// --- Competitors ---

export function getCompetitors(opts?: { limit?: number; projectId?: string }): any[] {
  const db = getDb();
  const limit = opts?.limit || 100;
  const pid = opts?.projectId || null;
  let sql = 'SELECT * FROM competitors WHERE deleted = 0';
  const params: any[] = [];
  if (pid) {
    sql += ' AND project_id = ?';
    params.push(pid);
  }
  sql += ' ORDER BY name ASC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params) as any[];
}

export function getCompetitor(id: string): any | undefined {
  return getDb().prepare('SELECT * FROM competitors WHERE id = ? AND deleted = 0').get(id);
}

export function insertCompetitor(comp: { name: string; url?: string; description?: string; category?: string; projectId?: string }): string {
  const db = getDb();
  const id = comp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  db.prepare(`
    INSERT OR REPLACE INTO competitors (id, name, url, description, category, project_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, comp.name, comp.url || '', comp.description || '', comp.category || 'Uncategorized', comp.projectId || 'default');
  return id;
}

export function updateCompetitor(id: string, updates: {
  name?: string; url?: string; description?: string; category?: string;
  swot_json?: string; updates_json?: string; feedback_json?: string; last_updated?: string;
  watched?: number;
}): void {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) { fields.push(`${key} = ?`); values.push(val); }
  }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE competitors SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteCompetitor(id: string): void {
  getDb().prepare('UPDATE competitors SET deleted = 1 WHERE id = ?').run(id);
}

/** No-op — competitors are user-added, not seeded. */
export function seedDefaultCompetitors(): void {
  // Competitors start empty. Users add their own via the UI.
}

function rowToDSRunReport(row: any): DSRunReport {
  return {
    run_id: row.run_id,
    phase: row.phase,
    component: row.component,
    batch: row.batch,
    status: row.status,
    metrics: {
      fidelity: row.fidelity,
      tokenReuse: row.token_reuse,
      variantCoverage: row.variant_coverage,
      rawValues: row.raw_values,
      qaPass: !!row.qa_pass,
      iterations: row.iterations,
      costUSD: row.cost_usd,
      latencyMs: row.latency_ms,
    },
    alerts: JSON.parse(row.alerts || '[]'),
    timestamp: row.timestamp,
  };
}

// --- Agent Orchestrator ownership ---

export interface AOProjectOwner {
  projectId: string;
  agentId: string;
  assignedAt: string;
}

export function getProjectOwner(projectId: string): string | null {
  const row = getDb().prepare('SELECT agent_id FROM ao_project_owners WHERE project_id = ?').get(projectId) as any;
  return row ? row.agent_id : null;
}

export function getOwnedProjectIds(agentId: string): string[] {
  const rows = getDb().prepare('SELECT project_id FROM ao_project_owners WHERE agent_id = ?').all(agentId) as any[];
  return rows.map(r => r.project_id);
}

export function setProjectOwner(projectId: string, agentId: string, assignedBy?: string): void {
  getDb().prepare(`
    INSERT INTO ao_project_owners (project_id, agent_id, assigned_by)
    VALUES (?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET agent_id = excluded.agent_id, assigned_at = datetime('now'), assigned_by = excluded.assigned_by
  `).run(projectId, agentId, assignedBy || null);
}

export function clearProjectOwner(projectId: string): void {
  getDb().prepare('DELETE FROM ao_project_owners WHERE project_id = ?').run(projectId);
}

export function getAllProjectOwners(): AOProjectOwner[] {
  const rows = getDb().prepare('SELECT project_id, agent_id, assigned_at FROM ao_project_owners').all() as any[];
  return rows.map(r => ({ projectId: r.project_id, agentId: r.agent_id, assignedAt: r.assigned_at }));
}

// --- Agent Orchestrator offline cache ---

export function getAOCache<T>(key: string): { data: T; cachedAt: string } | null {
  const row = getDb().prepare('SELECT data_json, cached_at FROM ao_cache WHERE key = ?').get(key) as any;
  if (!row) return null;
  try {
    return { data: JSON.parse(row.data_json) as T, cachedAt: row.cached_at };
  } catch {
    return null;
  }
}

export function setAOCache(key: string, data: unknown): void {
  getDb().prepare(`
    INSERT INTO ao_cache (key, data_json, cached_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET data_json = excluded.data_json, cached_at = excluded.cached_at
  `).run(key, JSON.stringify(data));
}
