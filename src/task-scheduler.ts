import { getEnabledTasks } from "./db/getEnabledTasks.js";
import { updateTaskLastRun } from "./db/updateTaskLastRun.js";
import { matchesCron } from "./cron.js";

import { SCHEDULER_INTERVAL } from "./config.js";
import type { Task } from "./types.js";

// Re-export matchesCron for existing consumers (tests, etc.)
export { matchesCron };

export interface TaskRunner {
  (task: Task): Promise<void>;
}

/**
 * ShadowClaw — Task Scheduler
 *
 * Evaluates cron expressions and fires tasks on schedule.
 *
 * Runs on the main thread via setInterval.
 */
export class TaskScheduler {
  runner: TaskRunner;
  interval: ReturnType<typeof setInterval> | null = null;

  constructor(runner: TaskRunner) {
    this.runner = runner;
  }

  /**
   * Start the scheduler. Checks for due tasks every 60 seconds.
   */
  start() {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => this.tick(), SCHEDULER_INTERVAL);

    // Immediate first check
    this.tick();
  }

  /**
   * Stop the scheduler.
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);

      this.interval = null;
    }
  }

  /**
   * Check for due tasks and run them.
   */
  async tick() {
    try {
      const tasks = await getEnabledTasks();
      const now = new Date();

      for (const task of tasks) {
        if (matchesCron(task.schedule, now) && !this.ranThisMinute(task, now)) {
          // Mark as run immediately to prevent double-firing
          await updateTaskLastRun(task.id, now.getTime());

          // Fire task (non-blocking)
          this.runner(task).catch((err) => {
            console.error(`Task ${task.id} failed:`, err);
          });
        }
      }
    } catch (err) {
      console.error("Scheduler tick error:", err);
    }
  }

  /**
   * Check if a task already ran in this minute (prevent double-execution).
   */
  ranThisMinute(task: Task, now: Date): boolean {
    if (!task.lastRun) {
      return false;
    }

    const last = new Date(task.lastRun);

    return (
      last.getFullYear() === now.getFullYear() &&
      last.getMonth() === now.getMonth() &&
      last.getDate() === now.getDate() &&
      last.getHours() === now.getHours() &&
      last.getMinutes() === now.getMinutes()
    );
  }
}
