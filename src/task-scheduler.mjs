import { getEnabledTasks } from "./db/getEnabledTasks.mjs";
import { updateTaskLastRun } from "./db/updateTaskLastRun.mjs";

import { SCHEDULER_INTERVAL } from "./config.mjs";

/**
 * @typedef {(task: Task) => Promise<void>} TaskRunner
 * @typedef {import("./types.mjs").Task} Task
 */

/**
 * ShadowClaw — Task Scheduler
 *
 * Evaluates cron expressions and fires tasks on schedule.
 *
 * Runs on the main thread via setInterval.
 */
export class TaskScheduler {
  /**
   * @param {TaskRunner} runner
   */
  constructor(runner) {
    /** @type {TaskRunner} */
    this.runner = runner;

    /** @type {ReturnType<typeof setInterval>|null} */
    this.interval = null;
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

   * @param {Task} task
   * @param {Date} now
   *
   * @returns {boolean}
   */
  ranThisMinute(task, now) {
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

// =========================================================================
// Cron expression parser (lightweight, no dependencies)
// =========================================================================
// Format: minute hour day-of-month month day-of-week
// Supports: * (any), N (exact), N-M (range), N,M (list), */N (step)

/**
 * Match a cron expression against a date
 *
 * @param {string} expr
 * @param {Date} date
 *
 * @returns {boolean}
 */
export function matchesCron(expr, date) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }

  const [min, hour, dom, mon, dow] = parts;
  return (
    matchField(min, date.getMinutes()) &&
    matchField(hour, date.getHours()) &&
    matchField(dom, date.getDate()) &&
    matchField(mon, date.getMonth() + 1) &&
    matchField(dow, date.getDay())
  );
}

/**
 * Match a single cron field
 *
 * @param {string} field
 * @param {number} value
 *
 * @returns {boolean}
 */
function matchField(field, value) {
  if (field === "*") {
    return true;
  }

  return field.split(",").some((part) => {
    // Step: */N or N/M
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) {
        return false;
      }

      if (range === "*") {
        return value % step === 0;
      }

      // Range with step: N-M/S
      if (range.includes("-")) {
        const [lo, hi] = range.split("-").map(Number);
        return value >= lo && value <= hi && (value - lo) % step === 0;
      }

      const start = parseInt(range, 10);
      return value >= start && (value - start) % step === 0;
    }

    // Range: N-M
    if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      return value >= lo && value <= hi;
    }

    // Exact match
    return parseInt(part, 10) === value;
  });
}
