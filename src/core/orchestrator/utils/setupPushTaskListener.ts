import { getOrCreateSubscriberId } from "../../../db/getOrCreateSubscriberId.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";
import { syncExistingPushSubscription } from "../../../subsystems/notifications/push-client.js";
import { submitMessage } from "./operations/channel.js";
import { syncProxyConfigToServiceWorker } from "./syncProxyConfigToServiceWorker.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

export function setupPushTaskListener(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
): void {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return;
  }

  // Ensure any existing active push subscription is registered with our local subscriberId
  void (async () => {
    try {
      const subscriberId = await getOrCreateSubscriberId(db);
      await syncExistingPushSubscription(subscriberId);
    } catch (_) {}
  })();

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

    const { taskId, groupId, prompt, taskType, tools, subscriberId } =
      event.data;
    if (!groupId) {
      return;
    }

    // Execute the task via the same path as client-side scheduler
    const runTaskHandler = async () => {
      // Validate subscriber ownership if provided
      if (subscriberId) {
        const localSubscriberId = await getOrCreateSubscriberId(db);
        if (localSubscriberId && subscriberId !== localSubscriberId) {
          console.warn(
            `Ignoring push-triggered task ${taskId}: subscriberId mismatch (${subscriberId} !== ${localSubscriberId})`,
          );
          return;
        }
      }

      // Mark this group as scheduler-triggered for recursion prevention
      orchestrator.schedulerTriggeredGroups.add(groupId);

      try {
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
      } finally {
        orchestrator.schedulerTriggeredGroups.delete(groupId);
      }
    };

    runTaskHandler().catch((err) =>
      console.error(`Push-triggered task ${taskId} failed:`, err),
    );
  });
}
