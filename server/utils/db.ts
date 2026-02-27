import Database from 'better-sqlite3'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const DATA_DIR = join(process.cwd(), '.data')
const DB_PATH = join(DATA_DIR, 'claude-stats.db')

const CURRENT_SCHEMA_VERSION = 2

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  mkdirSync(DATA_DIR, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')

  ensureSchema(db)

  return db
}

function ensureSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    )
  `)

  const row = database.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined
  const currentVersion = row?.version ?? 0

  if (currentVersion < 1) {
    database.exec(`
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS file_daily_costs;
    `)

    database.exec(`
      CREATE TABLE sessions (
        file_path TEXT PRIMARY KEY,
        project_dir TEXT NOT NULL,
        session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        project_path TEXT NOT NULL,
        start_time TEXT,
        message_count INTEGER NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_write_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost REAL NOT NULL DEFAULT 0,
        model TEXT NOT NULL DEFAULT '',
        duration INTEGER NOT NULL DEFAULT 0,
        file_mtime INTEGER NOT NULL DEFAULT 0
      )
    `)

    database.exec(`
      CREATE TABLE file_daily_costs (
        file_path TEXT NOT NULL,
        date TEXT NOT NULL,
        model TEXT NOT NULL,
        cost REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (file_path, date, model)
      )
    `)

    database.exec(`
      CREATE INDEX idx_sessions_session_id ON sessions(session_id);
      CREATE INDEX idx_sessions_start_time ON sessions(start_time);
      CREATE INDEX idx_file_daily_costs_date ON file_daily_costs(date);
    `)
  }

  if (currentVersion < 2) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS api_daily_costs (
        date TEXT NOT NULL,
        model TEXT NOT NULL,
        cost REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (date, model)
      )
    `)

    database.exec(`
      CREATE TABLE IF NOT EXISTS api_sync_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
  }

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    database.exec('DELETE FROM schema_version')
    database.prepare('INSERT INTO schema_version (version) VALUES (?)').run(CURRENT_SCHEMA_VERSION)
  }
}
