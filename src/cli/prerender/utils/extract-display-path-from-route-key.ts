import { trimSlashes } from "./trim-slashes.js";

export function extractDisplayPathFromRouteKey(routeKey: string): string {
  const clean = trimSlashes(routeKey);
  if (clean.startsWith("pages/main/")) {
    return clean.slice("pages/main/".length);
  }

  if (clean.startsWith("pages/br:main/")) {
    return clean.slice("pages/br:main/".length);
  }

  if (clean.startsWith("pages/br-main/")) {
    return clean.slice("pages/br-main/".length);
  }

  if (clean.startsWith("main/")) {
    return clean.slice("main/".length);
  }

  if (clean.startsWith("pages/")) {
    const parts = clean.split("/");
    if (parts.length >= 3) {
      return parts.slice(2).join("/");
    }
  }
  return clean;
}
