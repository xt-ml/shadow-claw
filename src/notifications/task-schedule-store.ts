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
  prompt: string;
  is_script: number;
  enabled: number;
  last_run: number | null;
  created_at: number;
  channel: string | null;
  subscriber_id: string | null;
}

export interface ScheduledTaskInput {
  id: string;
  groupId: string;
  schedule: string;
  prompt: string;
  isScript?: boolean;
  enabled?: boolean;
  lastRun?: number | null;
  createdAt: number;
  channel?: string;
  subscriberId?: string;
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
      prompt TEXT NOT NULL,
      is_script INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run INTEGER,
      created_at INTEGER NOT NULL,
      channel TEXT,
      subscriber_id TEXT
    )
  `);

  // Add new columns if missing
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
       (id, group_id, schedule, prompt, is_script, enabled, last_run, created_at, channel, subscriber_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    task.id,
    task.groupId,
    task.schedule,
    task.prompt,
    task.isScript ? 1 : 0,
    task.enabled !== false ? 1 : 0,
    task.lastRun ?? null,
    task.createdAt,
    task.channel ?? null,
    task.subscriberId ?? null,
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
 * Get a single scheduled task by ID.
 */
export function getScheduledTask(id: string): ScheduledTaskRow | undefined {
  if (!db) {
    throw new Error("Task schedule store not opened.");
  }

  const result = db
    .prepare("SELECT * FROM scheduled_tasks WHERE id = ?")
    .get(id);

  return result
    ? {
        id: `${result.id}`,
        group_id: `${result.group_id}`,
        schedule: `${result.schedule}`,
        prompt: `${result.prompt}`,
        is_script: Number(result.is_script),
        enabled: Number(result.enabled),
        last_run: Number(result.last_run),
        created_at: Number(result.created_at),
        channel: result.channel ? `${result.channel}` : null,
        subscriber_id: result.subscriber_id ? `${result.subscriber_id}` : null,
      }
    : undefined;
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
        "SELECT * FROM scheduled_tasks WHERE group_id = ? AND subscriber_id = ? ORDER BY created_at DESC",
      )
      .all(groupId, subscriberId);

    return result
      ? result.map((row) => ({
          id: `${row.id}`,
          group_id: `${row.group_id}`,
          schedule: `${row.schedule}`,
          prompt: `${row.prompt}`,
          is_script: Number(row.is_script),
          enabled: Number(row.enabled),
          last_run: Number(row.last_run),
          created_at: Number(row.created_at),
          channel: `${row.channel}`,
          subscriber_id: `${row.subscriber_id}`,
        }))
      : [];
  }

  if (groupId) {
    const result = db
      .prepare(
        "SELECT * FROM scheduled_tasks WHERE group_id = ? ORDER BY created_at DESC",
      )
      .all(groupId);

    return result
      ? result.map((row) => ({
          id: `${row.id}`,
          group_id: `${row.group_id}`,
          schedule: `${row.schedule}`,
          prompt: `${row.prompt}`,
          is_script: Number(row.is_script),
          enabled: Number(row.enabled),
          last_run: Number(row.last_run),
          created_at: Number(row.created_at),
          channel: row.channel ? `${row.channel}` : null,
          subscriber_id: row.subscriber_id ? `${row.subscriber_id}` : null,
        }))
      : [];
  }

  if (subscriberId) {
    const result = db
      .prepare(
        "SELECT * FROM scheduled_tasks WHERE subscriber_id = ? ORDER BY created_at DESC",
      )
      .all(subscriberId);

    return result
      ? result.map((row) => ({
          id: `${row.id}`,
          group_id: `${row.group_id}`,
          schedule: `${row.schedule}`,
          prompt: `${row.prompt}`,
          is_script: Number(row.is_script),
          enabled: Number(row.enabled),
          last_run: Number(row.last_run),
          created_at: Number(row.created_at),
          channel: row.channel ? `${row.channel}` : null,
          subscriber_id: row.subscriber_id ? `${row.subscriber_id}` : null,
        }))
      : [];
  }

  const result = db
    .prepare("SELECT * FROM scheduled_tasks ORDER BY created_at DESC")
    .all();

  return result
    ? result.map((row) => ({
        id: `${row.id}`,
        group_id: `${row.group_id}`,
        schedule: `${row.schedule}`,
        prompt: `${row.prompt}`,
        is_script: Number(row.is_script),
        enabled: Number(row.enabled),
        last_run: Number(row.last_run),
        created_at: Number(row.created_at),
        channel: `${row.channel}`,
        subscriber_id: `${row.subscriber_id}`,
      }))
    : [];
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

  return result
    ? result.map((row) => ({
        id: `${row.id}`,
        group_id: `${row.group_id}`,
        schedule: `${row.schedule}`,
        prompt: `${row.prompt}`,
        is_script: Number(row.is_script),
        enabled: Number(row.enabled),
        last_run: Number(row.last_run),
        created_at: Number(row.created_at),
        channel: `${row.channel}`,
        subscriber_id: `${row.subscriber_id}`,
      }))
    : [];
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
