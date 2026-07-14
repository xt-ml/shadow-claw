import type { ShadowClawAppRoute } from "../../../core/app-routes.js";

export function normalizePageRoute(page: string): ShadowClawAppRoute["page"] {
  const normalized = String(page || "chat").toLowerCase();

  if (
    normalized === "chat" ||
    normalized === "files" ||
    normalized === "tasks" ||
    normalized === "pages" ||
    normalized === "settings" ||
    normalized === "tools" ||
    normalized === "channels"
  ) {
    return normalized;
  }

  return "chat";
}
