import { DatabaseSync } from "node:sqlite";
import { wrapSqliteDatabase } from "./types.js";
import type { ShadowClawSqliteDatabase } from "./types.js";

let cachedDb: ShadowClawSqliteDatabase | null = null;

const addColumn = (
  raw: DatabaseSync,
  table: string,
  col: string,
  def: string,
) => {
  try {
    raw.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch {
    /* column already exists */
  }
};

/**
 * Open (or create) the headless agent SQLite database.
 *
 * Schema mirrors the five IndexedDB object stores defined in
 * `src/db/openDatabase.ts`:
 *   - messages  (conversation history)
 *   - sessions  (conversation state snapshots)
 *   - tasks     (scheduled tasks / declarative tool chains)
 *   - config    (key-value settings, same keys as CONFIG_KEYS)
 *   - pendingShares (web share target payloads, rarely used headless)
 */
export function openSqliteDatabase(
  dbPath: string = "database/agent.db",
): ShadowClawSqliteDatabase {
  if (cachedDb) {
    return cachedDb;
  }

  const raw = new DatabaseSync(dbPath);

  raw.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      content TEXT NOT NULL,
      sender TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'chat',
      isFromMe INTEGER NOT NULL DEFAULT 0,
      isTrigger INTEGER NOT NULL DEFAULT 0,
      attachments TEXT,
      a2uiAction TEXT,
      a2uiEnvelopes TEXT,
      freshContext INTEGER,
      subagent INTEGER
    )
  `);

  raw.exec(`
    CREATE INDEX IF NOT EXISTS messages_by_group_time
      ON messages (groupId, timestamp)
  `);

  raw.exec(`
    CREATE INDEX IF NOT EXISTS messages_by_group
      ON messages (groupId)
  `);

  raw.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      groupId TEXT PRIMARY KEY,
      messages TEXT NOT NULL DEFAULT '[]',
      updatedAt INTEGER NOT NULL DEFAULT 0
    )
  `);

  raw.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      schedule TEXT,
      prompt TEXT NOT NULL DEFAULT '',
      tools TEXT,
      lastRun INTEGER,
      createdAt INTEGER NOT NULL,
      type TEXT,
      freshContext INTEGER,
      subagent INTEGER,
      name TEXT,
      task_order INTEGER
    )
  `);

  raw.exec(`
    CREATE INDEX IF NOT EXISTS tasks_by_group
      ON tasks (groupId)
  `);

  raw.exec(`
    CREATE INDEX IF NOT EXISTS tasks_by_enabled
      ON tasks (enabled)
  `);

  raw.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  raw.exec(`
    CREATE TABLE IF NOT EXISTS pendingShares (
      id TEXT PRIMARY KEY,
      createdAt INTEGER NOT NULL,
      data TEXT
    )
  `);

  // Forward-compat: add new columns if the DB was created by an older version
  addColumn(raw, "tasks", "type", "TEXT");
  addColumn(raw, "tasks", "freshContext", "INTEGER");
  addColumn(raw, "tasks", "subagent", "INTEGER");
  addColumn(raw, "tasks", "name", "TEXT");
  addColumn(raw, "tasks", "task_order", "INTEGER");
  addColumn(raw, "messages", "freshContext", "INTEGER");
  addColumn(raw, "messages", "subagent", "INTEGER");

  cachedDb = wrapSqliteDatabase(raw);
  return cachedDb;
}

/**
 * Close and release the cached database connection.
 * After this call, the next `openSqliteDatabase()` will open a new DB.
 */
export function closeSqliteDatabase(): void {
  if (cachedDb) {
    cachedDb.db.close();
    cachedDb = null;
  }
}
