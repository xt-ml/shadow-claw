import { trimSlashes } from "./trim-slashes.mjs";

export function extractDisplayPathFromRouteKey(routeKey) {
  let clean = trimSlashes(routeKey);
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
