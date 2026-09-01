import { orchestratorStore } from "../../../../stores/orchestrator.js";
import { showToast } from "../../../../ui/toast.js";

import type { Task } from "../../../../db/types.js";
import type { OrchestratorState } from "../../orchestrator-state.js";

function getTaskFetchOptions(
  url: string,
  baseOptions: RequestInit = {},
): RequestInit {
  const opts: any = { ...baseOptions };
  try {
    const locOrigin =
      typeof location !== "undefined"
        ? location.origin
        : "http://127.0.0.1:8888";
    const u = new URL(url, locOrigin);
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]"
    ) {
      opts.targetAddressSpace = "loopback";
    } else if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) {
      opts.targetAddressSpace = "private";
    }
  } catch (_) {}
  return opts;
}

export async function syncTaskToServer(
  state: Pick<OrchestratorState, "taskServerUrl" | "taskServerEnabled">,
  task: Task,
  subscriberId?: string,
): Promise<boolean> {
  if (!state.taskServerEnabled) {
    return true; // No server configured — silently succeed.
  }

  // If the task has no schedule, it belongs only in local storage.
  // We issue a delete to ensure it is removed from the server if it was previously scheduled.
  if (!task.schedule) {
    return deleteTaskFromServer(state, task.id, subscriberId);
  }
  try {
    const base = state.taskServerUrl.replace(/\/$/, "");
    const url = `${base}/tasks`;
    const res = await fetch(
      url,
      getTaskFetchOptions(url, {
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
      }),
    );
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
  state: Pick<OrchestratorState, "taskServerUrl" | "taskServerEnabled">,
  id: string,
  subscriberId?: string,
): Promise<boolean> {
  if (!state.taskServerEnabled) {
    return true; // No server configured — silently succeed.
  }
  try {
    const base = state.taskServerUrl.replace(/\/$/, "");
    const suffix = subscriberId
      ? `?subscriberId=${encodeURIComponent(subscriberId)}`
      : "";
    const url = `${base}/tasks/${encodeURIComponent(id)}${suffix}`;
    const res = await fetch(
      url,
      getTaskFetchOptions(url, {
        method: "DELETE",
      }),
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
