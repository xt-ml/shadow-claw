/**
 * Server-side SQLite store for scheduled tasks.
 *
 * Separate from the client-side IndexedDB task store. This runs on the
 * Express server (or Electron main process) so scheduled tasks can fire
 * even when the browser tab is sleeping / closed.
 *
 * Usage:
 *   import { openTaskScheduleStore, saveScheduledTask } from "./task-schedule-store.js";
 *   openTaskScheduleStore();  // opens/creates DB file
 */

import { DatabaseSync } from "node:sqlite";

let db: DatabaseSync | null = null;

export interface ScheduledTaskRow {
  id: string;
  group_id: string;
  schedule: string;
  type: string | null;
  prompt: string;
  tools: string | null;
  enabled: number;
  last_run: number | null;
  created_at: number;
  channel: string | null;
  subscriber_id: string | null;
  name: string | null;
  task_order: number | null;
}

export interface ScheduledTaskInput {
  id: string;
  groupId: string;
  schedule: string;
  type?: "prompt" | "tools";
  prompt: string;
  tools?: any[];
  enabled?: boolean;
  lastRun?: number | null;
  createdAt: number;
  channel?: string;
  subscriberId?: string;
  name?: string;
  order?: number;
}

function mapRow(row: any): ScheduledTaskRow {
  return {
    id: `${row.id}`,
    group_id: `${row.group_id}`,
    schedule: `${row.schedule}`,
    type: row.type ? `${row.type}` : null,
    prompt: `${row.prompt}`,
    tools: row.tools ? `${row.tools}` : null,
    enabled: Number(row.enabled),
    last_run: row.last_run == null ? null : Number(row.last_run),
    created_at: Number(row.created_at),
    channel: row.channel ? `${row.channel}` : null,
    subscriber_id: row.subscriber_id ? `${row.subscriber_id}` : null,
    name: row.name ? `${row.name}` : null,
    task_order: row.task_order == null ? null : Number(row.task_order),
  };
}

/**
 * Open (or create) the scheduled-tasks SQLite database.
 */
export function openTaskScheduleStore(
  dbPath: string = "database/scheduled-tasks.db",
): DatabaseSync {
  if (db) {
    return db;
  }

  db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      schedule TEXT NOT NULL,
      type TEXT,
      prompt TEXT NOT NULL,
      tools TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run INTEGER,
      created_at INTEGER NOT NULL,
      channel TEXT,
      subscriber_id TEXT,
      name TEXT,
      task_order INTEGER
    )
  `);

  // Add new columns if missing
  try {
    db.exec("ALTER TABLE scheduled_tasks ADD COLUMN type TEXT");
  } catch {
    // column already exists
  }

  try {
    db.exec("ALTER TABLE scheduled_tasks ADD COLUMN tools TEXT");
  } catch {
    // column already exists
  }

  try {
    db.exec("ALTER TABLE scheduled_tasks ADD COLUMN channel TEXT");
  } catch {
    // column already exists
  }

  try {
    db.exec("ALTER TABLE scheduled_tasks ADD COLUMN subscriber_id TEXT");
  } catch {
    // column already exists
  }

  try {
    db.exec("ALTER TABLE scheduled_tasks ADD COLUMN name TEXT");
  } catch {
    // column already exists
  }

  try {
    db.exec("ALTER TABLE scheduled_tasks ADD COLUMN task_order INTEGER");
  } catch {
    // column already exists
  }

  return db;
}

/**
 * Close the task schedule store database.
 */
export function closeTaskScheduleStore(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Save (upsert) a scheduled task.
 */
export function saveScheduledTask(task: ScheduledTaskInput): void {
  if (!db) {
    throw new Error(
      "Task schedule store not opened. Call openTaskScheduleStore() first.",
    );
  }

  db.prepare(
    `INSERT OR REPLACE INTO scheduled_tasks
       (id, group_id, schedule, type, prompt, tools, enabled, last_run, created_at, channel, subscriber_id, name, task_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    task.id,
    task.groupId,
    task.schedule,
    task.type ?? null,
    task.prompt,
    task.tools ? JSON.stringify(task.tools) : null,
    task.enabled !== false ? 1 : 0,
    task.lastRun ?? null,
    task.createdAt,
    task.channel ?? null,
    task.subscriberId ?? null,
    task.name ?? null,
    task.order ?? null,
  );
}

/**
 * Delete a scheduled task by ID.
 */
export function deleteScheduledTask(id: string): void {
  if (!db) {
    throw new Error("Task schedule store not opened.");
  }

  db.prepare("DELETE FROM scheduled_tasks WHERE id = ?").run(id);
}

/**
 * Delete a scheduled task by subscriber ownership.
 * Legacy rows with NULL subscriber_id are deletable by any subscriber.
 */
export function deleteScheduledTaskForSubscriber(
  id: string,
  subscriberId?: string,
): number {
  if (!db) {
    throw new Error("Task schedule store not opened.");
  }

  if (subscriberId) {
    const result = db
      .prepare(
        "DELETE FROM scheduled_tasks WHERE id = ? AND (subscriber_id = ? OR subscriber_id IS NULL)",
      )
      .run(id, subscriberId);

    return Number((result as any)?.changes ?? 0);
  }

  const result = db.prepare("DELETE FROM scheduled_tasks WHERE id = ?").run(id);

  return Number((result as any)?.changes ?? 0);
}

/**
 * Get a single scheduled task by ID.
 */
export function getScheduledTask(id: string): ScheduledTaskRow | undefined {
  if (!db) {
    throw new Error("Task schedule store not opened.");
  }

  const result = db
    .prepare("SELECT * FROM scheduled_tasks WHERE id = ?")
    .get(id);

  return result ? mapRow(result) : undefined;
}

/**
 * Get all scheduled tasks, optionally filtered by group and/or subscriber.
 */
export function getAllScheduledTasks(
  groupId?: string,
  subscriberId?: string,
): ScheduledTaskRow[] {
  if (!db) {
    throw new Error("Task schedule store not opened.");
  }

  if (groupId && subscriberId) {
    const result = db
      .prepare(
        "SELECT * FROM scheduled_tasks WHERE group_id = ? AND (subscriber_id = ? OR subscriber_id IS NULL) ORDER BY created_at DESC",
      )
      .all(groupId, subscriberId);

    return result
      ? result
          .map((row) => mapRow(row))
          .filter(
            (row) =>
              row.subscriber_id === null || row.subscriber_id === subscriberId,
          )
      : [];
  }

  if (groupId) {
    const result = db
      .prepare(
        "SELECT * FROM scheduled_tasks WHERE group_id = ? ORDER BY created_at DESC",
      )
      .all(groupId);

    return result ? result.map((row) => mapRow(row)) : [];
  }

  if (subscriberId) {
    const result = db
      .prepare(
        "SELECT * FROM scheduled_tasks WHERE subscriber_id = ? ORDER BY created_at DESC",
      )
      .all(subscriberId);

    return result ? result.map((row) => mapRow(row)) : [];
  }

  const result = db
    .prepare("SELECT * FROM scheduled_tasks ORDER BY created_at DESC")
    .all();

  return result ? result.map((row) => mapRow(row)) : [];
}

/**
 * Get only enabled scheduled tasks (used by the server-side scheduler tick).
 */
export function getEnabledScheduledTasks(): ScheduledTaskRow[] {
  if (!db) {
    throw new Error("Task schedule store not opened.");
  }

  const result = db
    .prepare("SELECT * FROM scheduled_tasks WHERE enabled = 1")
    .all();

  return result ? result.map((row) => mapRow(row)) : [];
}

/**
 * Update the last_run timestamp for a task (prevents double-firing).
 */
export function updateScheduledTaskLastRun(
  id: string,
  timestamp: number,
): void {
  if (!db) {
    throw new Error("Task schedule store not opened.");
  }

  db.prepare("UPDATE scheduled_tasks SET last_run = ? WHERE id = ?").run(
    timestamp,
    id,
  );
}
