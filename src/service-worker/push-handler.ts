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
  taskType?: string;
  tools?: unknown[];
  channel?: string;
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
              taskType: data.taskType,
              tools: data.tools,
              channel: data.channel,
            });
          }

          return self.registration.showNotification(
            `ShadowClaw — Scheduled Task${data.taskType ? ` (${data.taskType})` : ""}`,
            {
              body: data.prompt
                ? `${data.prompt.slice(0, 120)}${data.tools?.length ? ` | Tools: ${data.tools.map((t) => (typeof t === "object" && t !== null && "name" in t ? (t as any).name : String(t))).join(", ")}` : ""}`.slice(
                    0,
                    120,
                  )
                : "A scheduled task has been triggered.",
              icon: "/assets/icons/512.png",
              badge: "/assets/icons/192.png",
              data: {
                type: "scheduled-task",
                taskId: data.taskId,
                groupId: data.groupId,
                prompt: data.prompt,
                taskType: data.taskType,
                tools: data.tools,
                channel: data.channel,
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

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing window if open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            // When the app is already open, just focus it. The push event
            // should have already delivered the trigger to the window.

            return client.focus();
          }
        }

        // Otherwise open a new window at the service worker scope root.
        // This ensures local (http://localhost:8888/) and GitHub Pages
        // subpath deployments (/shadow-claw/) both open the correct app URL.
        const scopeUrl = self.registration?.scope
          ? new URL(".", self.registration.scope).href
          : "/";

        return self.clients.openWindow(scopeUrl);
      }),
  );
});
