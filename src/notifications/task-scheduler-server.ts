/**
 * Server-side task scheduler.
 *
 * Checks the SQLite task schedule store every 60 seconds. When a task is
 * due, it sends a push notification to all subscribed clients. The client
 * then triggers the actual task execution.
 *
 * This decouples scheduled tasks from the browser tab being awake — the
 * Node.js server process keeps ticking even when no tabs are open.
 */

import { matchesCron } from "../cron.js";
import type { ScheduledTaskRow } from "./task-schedule-store.js";

// Re-export for testing convenience
export { matchesCron };

export interface ServerTaskSchedulerDeps {
  getEnabledTasks: () => ScheduledTaskRow[];
  updateLastRun: (id: string, timestamp: number) => void;
  broadcastTaskTrigger: (task: {
    id: string;
    groupId: string;
    prompt: string;
    isScript: boolean;
  }) => Promise<{ sent: number; failed: number; noSubscribers?: true }>;
}

const SCHEDULER_INTERVAL = 60_000;

export class ServerTaskScheduler {
  private _getEnabledTasks: () => ScheduledTaskRow[];
  private _updateLastRun: (id: string, timestamp: number) => void;
  private _broadcastTaskTrigger: (task: {
    id: string;
    groupId: string;
    prompt: string;
    isScript: boolean;
  }) => Promise<{ sent: number; failed: number; noSubscribers?: true }>;
  private _interval: ReturnType<typeof setInterval> | null;

  constructor({
    getEnabledTasks,
    updateLastRun,
    broadcastTaskTrigger,
  }: ServerTaskSchedulerDeps) {
    this._getEnabledTasks = getEnabledTasks;
    this._updateLastRun = updateLastRun;
    this._broadcastTaskTrigger = broadcastTaskTrigger;

    this._interval = null;
  }

  /** Start the scheduler. Checks for due tasks every 60 seconds. */
  start() {
    if (this._interval) {
      return;
    }

    this._interval = setInterval(() => this.tick(), SCHEDULER_INTERVAL);

    // Immediate first check
    this.tick();
  }

  /** Stop the scheduler. */
  stop(): void {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  /** Check for due tasks and send push notifications. */
  async tick(): Promise<void> {
    try {
      const tasks = this._getEnabledTasks();
      const now = new Date();

      for (const task of tasks) {
        if (
          matchesCron(task.schedule, now) &&
          !this._ranThisMinute(task, now)
        ) {
          // Mark as run immediately to prevent double-firing
          this._updateLastRun(task.id, now.getTime());

          // Send push notification to trigger task on client
          this._broadcastTaskTrigger({
            id: task.id,
            groupId: task.group_id,
            prompt: task.prompt,
            isScript: task.is_script === 1,
          })
            .then((result) => {
              if (result?.noSubscribers) {
                console.warn(
                  `Scheduled task ${task.id} fired but no push subscribers — task will not execute unless a browser tab is open.`,
                );
              }
            })
            .catch((err) => {
              console.error(
                `Failed to broadcast push for task ${task.id}:`,
                err,
              );
            });
        }
      }
    } catch (err) {
      console.error("Server scheduler tick error:", err);
    }
  }

  /**
   * Check if a task already ran in this minute (prevent double-execution).
   */
  private _ranThisMinute(
    task: { last_run: number | null },
    now: Date,
  ): boolean {
    if (!task.last_run) {
      return false;
    }

    const last = new Date(task.last_run);

    return (
      last.getFullYear() === now.getFullYear() &&
      last.getMonth() === now.getMonth() &&
      last.getDate() === now.getDate() &&
      last.getHours() === now.getHours() &&
      last.getMinutes() === now.getMinutes()
    );
  }
}
