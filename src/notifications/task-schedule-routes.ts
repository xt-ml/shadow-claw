/**
 * Express routes for server-side scheduled task management.
 *
 * Clients sync their task schedules here so the server can fire push
 * notifications on schedule even when the browser tab is sleeping.
 *
 * Usage:
 *   import { registerTaskScheduleRoutes } from "./task-schedule-routes.js";
 *   registerTaskScheduleRoutes(app);
 */

import {
  saveScheduledTask,
  deleteScheduledTask,
  getScheduledTask,
  getAllScheduledTasks,
} from "./task-schedule-store.js";
import type { Express, Request, Response } from "express";

/**
 * Register task schedule API routes on an Express app.
 */
export function registerTaskScheduleRoutes(app: Express): void {
  // Upsert a scheduled task (client syncs after create/update)
  app.post("/schedule/tasks", (req, res) => {
    const task = req.body;

    if (!task?.id || !task?.groupId || !task?.schedule) {
      return res.status(400).json({
        error: "Missing required fields: id, groupId, schedule",
      });
    }

    if (task?.type === "tools" && (!task.tools || task.tools.length === 0)) {
      return res.status(400).json({
        error:
          "Missing required fields: tools array cannot be empty for WebMCP Tools task",
      });
    } else if (task?.type !== "tools" && !task?.prompt) {
      return res.status(400).json({
        error: "Missing required fields: prompt is required for Prompt tasks",
      });
    }

    saveScheduledTask(task);
    res.sendStatus(201);
  });

  // List all scheduled tasks (optionally filtered by groupId and/or subscriberId)
  app.get("/schedule/tasks", (req: Request, res: Response) => {
    const groupId = req.query.groupId as string | undefined;
    const subscriberId = req.query.subscriberId as string | undefined;
    const tasks = getAllScheduledTasks(groupId, subscriberId);
    res.json(tasks);
  });

  // Get a single task
  app.get("/schedule/tasks/:id", (req, res) => {
    const task = getScheduledTask(req.params.id);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(task);
  });

  // Delete a scheduled task
  app.delete("/schedule/tasks/:id", (req, res) => {
    deleteScheduledTask(req.params.id);
    res.sendStatus(200);
  });

  // Enable a task
  app.patch("/schedule/tasks/:id/enable", (req, res) => {
    const task = getScheduledTask(req.params.id);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    saveScheduledTask({
      id: task.id,
      groupId: task.group_id,
      schedule: task.schedule,
      type: task.type as any,
      prompt: task.prompt,
      tools: task.tools ? JSON.parse(task.tools) : undefined,
      enabled: true,
      lastRun: task.last_run,
      createdAt: task.created_at,
      channel: task.channel ?? undefined,
      subscriberId: task.subscriber_id ?? undefined,
    });

    res.sendStatus(200);
  });

  // Disable a task
  app.patch("/schedule/tasks/:id/disable", (req, res) => {
    const task = getScheduledTask(req.params.id);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    saveScheduledTask({
      id: task.id,
      groupId: task.group_id,
      schedule: task.schedule,
      type: task.type as any,
      prompt: task.prompt,
      tools: task.tools ? JSON.parse(task.tools) : undefined,
      enabled: false,
      lastRun: task.last_run,
      createdAt: task.created_at,
      channel: task.channel ?? undefined,
      subscriberId: task.subscriber_id ?? undefined,
    });

    res.sendStatus(200);
  });
}
