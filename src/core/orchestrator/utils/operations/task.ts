import { orchestratorStore } from "../../../../stores/orchestrator.js";
import { showToast } from "../../../../ui/toast.js";

import type { Task } from "../../../../db/types.js";
import type { OrchestratorState } from "../../orchestrator-state.js";

export async function syncTaskToServer(
  state: Pick<OrchestratorState, "taskServerUrl">,
  task: Task,
  subscriberId?: string,
): Promise<boolean> {
  try {
    const base = state.taskServerUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/tasks`, {
      body: JSON.stringify(
        subscriberId
          ? {
              ...task,
              subscriberId,
            }
          : task,
      ),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!res.ok) {
      console.error("Server rejected task sync:", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to sync task to server:", err);
    return false;
  } finally {
    warnIfNoPushSubscription(state as any);
  }
}

export async function deleteTaskFromServer(
  state: Pick<OrchestratorState, "taskServerUrl">,
  id: string,
  subscriberId?: string,
): Promise<boolean> {
  try {
    const base = state.taskServerUrl.replace(/\/$/, "");
    const suffix = subscriberId
      ? `?subscriberId=${encodeURIComponent(subscriberId)}`
      : "";
    const res = await fetch(
      `${base}/tasks/${encodeURIComponent(id)}${suffix}`,
      {
        method: "DELETE",
      },
    );
    if (!res.ok) {
      console.error("Server rejected task deletion:", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to delete task from server:", err);
    return false;
  }
}

export async function runTaskAsScheduled(
  state: Pick<OrchestratorState, "schedulerTriggeredGroups">,
  task: Task,
): Promise<void> {
  if (!task.groupId) {
    console.error(
      "Scheduled task has no groupId — refusing to execute to prevent context pollution.",
    );
    return;
  }

  state.schedulerTriggeredGroups.add(task.groupId);

  try {
    await orchestratorStore.runTask(task);
  } finally {
    state.schedulerTriggeredGroups.delete(task.groupId);
  }
}

export async function shouldStartLocalScheduler(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return true;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !sub;
  } catch {
    return true;
  }
}

export async function warnIfNoPushSubscription(
  state: Pick<OrchestratorState, "pushSubscriptionWarned">,
): Promise<void> {
  if (state.pushSubscriptionWarned) {
    return;
  }
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      state.pushSubscriptionWarned = true;
      showToast(
        "Push notifications are not enabled. Scheduled tasks will only run while the app is open. Enable push in Settings for background execution.",
        { type: "warning" },
      );
    }
  } catch {
    // Service worker or Push API not available — ignore
  }
}
