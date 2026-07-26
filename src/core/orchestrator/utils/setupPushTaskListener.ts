import { orchestratorStore } from "../../../stores/orchestrator.js";
import { submitMessage } from "./operations/channel.js";
import { syncProxyConfigToServiceWorker } from "./syncProxyConfigToServiceWorker.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

export function setupPushTaskListener(
  orchestrator: Orchestrator,
  _db: ShadowClawDatabase,
): void {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return;
  }

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "request-proxy-config") {
      // The service worker just restarted and lost its in-memory proxy config.
      // Re-sync so fetch interception resumes immediately.
      syncProxyConfigToServiceWorker(orchestrator);

      return;
    }

    if (event.data?.type !== "scheduled-task-trigger") {
      return;
    }

    const { taskId, groupId, prompt, taskType, tools } = event.data;
    if (!groupId) {
      return;
    }

    // Mark this group as scheduler-triggered for recursion prevention
    orchestrator.schedulerTriggeredGroups.add(groupId);

    // Execute the task via the same path as client-side scheduler
    const runTaskHandler = async () => {
      const fullTask = orchestratorStore.tasks.find((t) => t.id === taskId);
      if (fullTask) {
        orchestratorStore.runTask(fullTask);

        return;
      }

      if (taskType === "tools" && Array.isArray(tools) && tools.length > 0) {
        orchestratorStore.runTask({
          id: taskId || `push-task-${Date.now()}`,
          groupId,
          createdAt: Date.now(),
          enabled: true,
          prompt: prompt || "",
          type: "tools",
          tools,
          lastRun: null,
        });

        return;
      }

      if (prompt) {
        // Fallback if not found in local store
        submitMessage(orchestrator, prompt, groupId);
      }
    };

    runTaskHandler()
      .catch((err) =>
        console.error(`Push-triggered task ${taskId} failed:`, err),
      )
      .finally(() => {
        orchestrator.schedulerTriggeredGroups.delete(groupId);
      });
  });
}
