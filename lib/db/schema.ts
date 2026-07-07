import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.DATA_DIR || path.join(process.env.HOME || '', '.openclaw-dashboard');
const DB_PATH = path.join(DB_DIR, 'data.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) {
    // Light health check: if the connection is broken, reset it
    try {
      _db.prepare('SELECT 1').get();
    } catch {
      console.error('[db] Cached connection unhealthy, reopening');
      try { _db.close(); } catch { /* ignore */ }
      _db = null;
    }
  }

  if (!_db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    // Checkpoint WAL on connect to prevent unbounded WAL growth
    _db.pragma('wal_checkpoint(PASSIVE)');
    runMigrations(_db);
  }

  return _db;
}

/** Force-close and reopen the DB connection on next getDb() call. */
export function resetDb(): void {
  if (_db) {
    try { _db.close(); } catch { /* ignore */ }
    _db = null;
    console.log('[db] Connection reset');
  }
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM migrations').all().map((r: any) => r.name)
  );

  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.name)) {
      try {
        db.exec(migration.sql);
      } catch (err: unknown) {
        // Allow ALTER TABLE migrations to fail gracefully (e.g. column already exists)
        const msg = err instanceof Error ? err.message : ''
        if (!migration.name.includes('_add_') || !msg.includes('duplicate column')) {
          throw err;
        }
      }
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
    }
  }
}

// Migrations match the ACTUAL database schema that queries.ts targets.
// Table/column names here must stay in sync with lib/db/queries.ts.
const MIGRATIONS = [
  {
    name: '001_config',
    sql: `
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        openclaw_path TEXT NOT NULL DEFAULT '~/.openclaw',
        project_repo_path TEXT NOT NULL DEFAULT '',
        github_repo TEXT,
        daily_spend_threshold REAL NOT NULL DEFAULT 15,
        key_rotation_reminder_days INTEGER NOT NULL DEFAULT 30,
        accent_color TEXT NOT NULL DEFAULT '#3b82f6',
        mission_title TEXT NOT NULL DEFAULT 'OpenClaw',
        profile_image TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO config (id) VALUES (1);
    `,
  },
  {
    name: '002_memory_entries',
    sql: `
      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('session_summary', 'decision', 'note', 'alert')),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        agent TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        started_at TEXT,
        completed_at TEXT,
        duration_sec INTEGER,
        tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0,
        pending_review INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        project_id TEXT NOT NULL DEFAULT 'default'
      );
      CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(type);
      CREATE INDEX IF NOT EXISTS idx_memory_created ON memory_entries(created_at);
    `,
  },
  {
    name: '003_memory_fts',
    sql: `
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_entries_fts USING fts5(
        id UNINDEXED,
        title, content, tags,
        tokenize = 'porter unicode61'
      );
    `,
  },
  {
    name: '004_tasks',
    sql: `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'medium',
        type TEXT NOT NULL DEFAULT 'feature',
        tags TEXT NOT NULL DEFAULT '[]',
        sprint_id TEXT,
        assigned_agent TEXT,
        last_commit_ref TEXT,
        design_status TEXT,
        owner TEXT,
        phase TEXT,
        notes TEXT,
        acceptance TEXT,
        gates TEXT,
        due_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON tasks(sprint_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    `,
  },
  {
    name: '005_sprints',
    sql: `
      CREATE TABLE IF NOT EXISTS sprints (
        id TEXT PRIMARY KEY,
        number INTEGER NOT NULL,
        name TEXT NOT NULL,
        goal TEXT NOT NULL DEFAULT '',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'upcoming',
        owner TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    name: '006_security_alerts',
    sql: `
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        title TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        details TEXT,
        acknowledged INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_alerts_ack ON alerts(acknowledged);
    `,
  },
  {
    name: '007_cost_daily',
    sql: `
      CREATE TABLE IF NOT EXISTS daily_metrics (
        date TEXT PRIMARY KEY,
        cost_usd REAL NOT NULL DEFAULT 0,
        tokens_in INTEGER NOT NULL DEFAULT 0,
        tokens_out INTEGER NOT NULL DEFAULT 0,
        cache_write_cost REAL NOT NULL DEFAULT 0,
        compute_cost REAL NOT NULL DEFAULT 0,
        providers_json TEXT NOT NULL DEFAULT '{}',
        agents_json TEXT NOT NULL DEFAULT '{}'
      );
    `,
  },
  {
    name: '008_compaction_log',
    sql: `
      CREATE TABLE IF NOT EXISTS compaction_events (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
        tokens_before INTEGER,
        tokens_after INTEGER,
        reduction_percent REAL
      );
    `,
  },
  {
    name: '009_task_changes',
    sql: `
      CREATE TABLE IF NOT EXISTS task_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );
    `,
  },
  {
    name: '010_ds_run_reports',
    sql: `
      CREATE TABLE IF NOT EXISTS ds_run_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        phase TEXT NOT NULL CHECK(phase IN ('foundations', 'component', 'qa', 'stress')),
        component TEXT,
        batch TEXT,
        status TEXT NOT NULL CHECK(status IN ('green', 'yellow', 'red')),
        fidelity REAL NOT NULL,
        token_reuse REAL NOT NULL,
        variant_coverage REAL NOT NULL,
        raw_values REAL NOT NULL,
        qa_pass INTEGER NOT NULL,
        iterations INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        latency_ms REAL NOT NULL,
        alerts TEXT NOT NULL DEFAULT '[]',
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_ds_run_id ON ds_run_reports(run_id);
      CREATE INDEX IF NOT EXISTS idx_ds_component ON ds_run_reports(component);
      CREATE INDEX IF NOT EXISTS idx_ds_batch ON ds_run_reports(batch);
      CREATE INDEX IF NOT EXISTS idx_ds_status ON ds_run_reports(status);
      CREATE INDEX IF NOT EXISTS idx_ds_phase ON ds_run_reports(phase);
      CREATE INDEX IF NOT EXISTS idx_ds_timestamp ON ds_run_reports(timestamp);
    `,
  },
  {
    name: '011_todos',
    sql: `
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        deadline TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        assignee TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
      CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
      CREATE INDEX IF NOT EXISTS idx_todos_assignee ON todos(assignee);
    `,
  },
  {
    name: '012_todos_add_priority',
    sql: `
      ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium';
    `,
  },
  {
    name: '013_agent_performance_metrics',
    sql: `
      CREATE TABLE IF NOT EXISTS agent_performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        tokens_in INTEGER NOT NULL DEFAULT 0,
        tokens_out INTEGER NOT NULL DEFAULT 0,
        latency_ms REAL NOT NULL DEFAULT 0,
        success INTEGER NOT NULL DEFAULT 1,
        model TEXT,
        task_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_apm_agent ON agent_performance_metrics(agent_id);
      CREATE INDEX IF NOT EXISTS idx_apm_timestamp ON agent_performance_metrics(timestamp);
    `,
  },
  {
    name: '014_tech_updates',
    sql: `
      CREATE TABLE IF NOT EXISTS tech_updates (
        url TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        category_label TEXT NOT NULL,
        category_icon TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '',
        date TEXT,
        source_ref TEXT,
        ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted INTEGER NOT NULL DEFAULT 0,
        date_iso TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tech_updates_category ON tech_updates(category_id);
      CREATE INDEX IF NOT EXISTS idx_tech_updates_date ON tech_updates(date_iso);
    `,
  },
  {
    name: '015_market_signals',
    sql: `
      CREATE TABLE IF NOT EXISTS market_signals (
        url TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT '',
        competitor TEXT,
        source_ref TEXT,
        title TEXT NOT NULL,
        context TEXT NOT NULL DEFAULT '',
        analysis TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        date TEXT,
        ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted INTEGER NOT NULL DEFAULT 0,
        date_iso TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_market_signals_type ON market_signals(type);
      CREATE INDEX IF NOT EXISTS idx_market_signals_date ON market_signals(date_iso);
    `,
  },
  {
    name: '016_ensure_task_overrides',
    sql: `
      CREATE TABLE IF NOT EXISTS task_overrides (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        status TEXT,
        priority TEXT,
        type TEXT,
        tags_json TEXT,
        sprint_id TEXT,
        assigned_agent TEXT,
        last_commit_ref TEXT,
        due_date TEXT,
        design_status TEXT,
        manual_notes TEXT,
        cost_usd REAL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        project_id TEXT NOT NULL DEFAULT 'default'
      );
    `,
  },
  {
    name: '017_ensure_task_history',
    sql: `
      CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        change_json TEXT NOT NULL DEFAULT '{}',
        changed_at TEXT NOT NULL DEFAULT (datetime('now')),
        project_id TEXT NOT NULL DEFAULT 'default'
      );
      CREATE INDEX IF NOT EXISTS idx_task_history_task ON task_history(task_id);
    `,
  },
  {
    name: '018_practitioner_signals',
    sql: `
      CREATE TABLE IF NOT EXISTS practitioner_signals (
        url TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT '',
        author TEXT,
        source_ref TEXT,
        title TEXT NOT NULL,
        verbatim TEXT NOT NULL DEFAULT '',
        context TEXT NOT NULL DEFAULT '',
        relevance REAL NOT NULL DEFAULT 0,
        tags_json TEXT NOT NULL DEFAULT '[]',
        date TEXT,
        ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted INTEGER NOT NULL DEFAULT 0,
        date_iso TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_practitioner_signals_type ON practitioner_signals(type);
      CREATE INDEX IF NOT EXISTS idx_practitioner_signals_date ON practitioner_signals(date_iso);
    `,
  },
  {
    name: '019_reference_files',
    sql: `
      CREATE TABLE IF NOT EXISTS reference_files (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        project_id TEXT NOT NULL DEFAULT 'default',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_ref_files_project ON reference_files(project_id);
    `,
  },
  {
    name: '020_competitors',
    sql: `
      CREATE TABLE IF NOT EXISTS competitors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'Uncategorized',
        project_id TEXT NOT NULL DEFAULT 'default',
        last_updated TEXT,
        swot_json TEXT,
        updates_json TEXT,
        feedback_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_competitors_project ON competitors(project_id);
    `,
  },
  {
    name: '021_add_competitors_watched',
    sql: `ALTER TABLE competitors ADD COLUMN watched INTEGER NOT NULL DEFAULT 0;`,
  },
  {
    name: '022_add_project_id_to_feeds',
    sql: `
      ALTER TABLE market_signals ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default';
      CREATE INDEX IF NOT EXISTS idx_market_signals_project ON market_signals(project_id);

      ALTER TABLE tech_updates ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default';
      CREATE INDEX IF NOT EXISTS idx_tech_updates_project ON tech_updates(project_id);

      ALTER TABLE practitioner_signals ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default';
      CREATE INDEX IF NOT EXISTS idx_practitioner_signals_project ON practitioner_signals(project_id);
    `,
  },
  {
    name: '023_agent_orchestrator_links',
    sql: `
      CREATE TABLE IF NOT EXISTS ao_project_owners (
        project_id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
        assigned_by TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_ao_project_owners_agent ON ao_project_owners(agent_id);
    `,
  },
  {
    name: '024_ao_cache',
    sql: `
      CREATE TABLE IF NOT EXISTS ao_cache (
        key TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        cached_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];
