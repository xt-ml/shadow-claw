import type { ToolDefinition } from "./types.js";

export const show_toast: ToolDefinition = {
  name: "show_toast",
  description:
    "Show a toast notification to the user. " +
    "Toasts are non-blocking, auto-dismissing notifications that appear in the bottom-right corner. " +
    "Use for: operation status (success/failure), warnings, informational messages, progress updates. " +
    "Avoid for: critical errors requiring acknowledgment (use clear error messages instead), " +
    "lengthy content (keep messages concise).",
  input_schema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The message to display in the toast (keep concise)",
      },
      type: {
        type: "string",
        description:
          "Type of toast: 'success', 'error', 'warning', or 'info' (default: 'info')",
        enum: ["success", "error", "warning", "info"],
      },
      duration: {
        type: "number",
        description:
          "Auto-dismiss duration in milliseconds (default: 5000 for info/success, 8000 for warning/error). Set to 0 to disable auto-dismiss.",
      },
    },
    required: ["message"],
  },
};

export const send_notification: ToolDefinition = {
  name: "send_notification",
  description:
    "Send an OS-level push notification to the user via Web Push. " +
    "Unlike toasts (in-app only), push notifications appear even when the app is not focused or the tab is in the background. " +
    "Use for: important alerts, long-running task completion, time-sensitive information. " +
    "Requires the user to have enabled push notifications in Settings.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Notification title (default: 'ShadowClaw')",
      },
      body: {
        type: "string",
        description: "The notification body text",
      },
    },
    required: ["body"],
  },
};
