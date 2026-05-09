/// <reference types="@types/serviceworker" />

/**
 * Service worker push event handler.
 *
 * Imported by workbox-config.cjs via importScripts.
 */

interface PushData {
  title?: string;
  body?: string;
  type?: string;
  taskId?: string;
  groupId?: string;
  prompt?: string;
}

self.addEventListener("push", (event: PushEvent) => {
  let data: PushData = { title: "ShadowClaw", body: "New notification" };

  if (event.data) {
    try {
      data = event.data.json() as PushData;
    } catch {
      data = { title: "ShadowClaw", body: event.data.text() };
    }
  }

  // Scheduled task trigger — relay to any open client windows, then show notification
  if (data.type === "scheduled-task") {
    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            client.postMessage({
              type: "scheduled-task-trigger",
              taskId: data.taskId,
              groupId: data.groupId,
              prompt: data.prompt,
            });
          }

          return self.registration.showNotification(
            "ShadowClaw — Scheduled Task",
            {
              body: data.prompt
                ? data.prompt.slice(0, 120)
                : "A scheduled task has been triggered.",
              icon: "/assets/icons/512.png",
              badge: "/assets/icons/192.png",
              data: {
                type: "scheduled-task",
                taskId: data.taskId,
                groupId: data.groupId,
                prompt: data.prompt,
              },
            },
          );
        }),
    );

    return;
  }

  // Regular notification
  event.waitUntil(
    self.registration.showNotification(data.title || "ShadowClaw", {
      body: data.body || "",
      icon: "/assets/icons/512.png",
      badge: "/assets/icons/192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const notificationData: PushData = event.notification.data;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing window if open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            // If this was a scheduled-task notification, relay trigger data
            // to the focused client in case it wasn't delivered via the push event
            if (notificationData?.type === "scheduled-task") {
              client.postMessage({
                type: "scheduled-task-trigger",
                taskId: notificationData.taskId,
                groupId: notificationData.groupId,
                prompt: notificationData.prompt,
              });
            }

            return client.focus();
          }
        }

        // Otherwise open a new window

        return self.clients.openWindow("/");
      }),
  );
});
