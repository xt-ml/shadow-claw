const BYPASS_HOSTS = [
  "cdnjs.cloudflare.com",
  "esm.sh",
  "unpkg.com",
  "cdn.jsdelivr.net",
  "esm.run",
  "huggingface.co",
  "hf.co",
  "hf-mirror.com",
];

const BYPASS_PROVIDERS = [
  "openrouter.ai",
  "router.huggingface.co",
  "api-inference.huggingface.co",
  "api.telegram.org",
];

const BACKEND_ROUTE_PREFIXES = [
  "/api/control/",
  "/api/backup/",
  "/api/activity-log/",
  "/api/health",
  "/push/",
  "/schedule/",
  "/mcp",
  "/ws/",
  "/peerjs/",
];

import { isLocalOrPrivateHost } from "../utils/network.js";

export function shouldBypassFetchProxy(
  requestUrl: URL,
  locationOrigin: string,
  proxyUrl?: string,
): boolean {
  if (requestUrl.origin === locationOrigin) {
    return true;
  }

  // Never proxy requests directed to the proxy host itself (avoids self-proxy loops)
  if (proxyUrl) {
    try {
      const proxyOrigin = new URL(proxyUrl, locationOrigin).origin;
      if (requestUrl.origin === proxyOrigin) {
        return true;
      }
    } catch (_) {}
  }

  // Never proxy requests to ShadowClaw built-in backend infrastructure routes
  const pathname = requestUrl.pathname;
  if (
    BACKEND_ROUTE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix),
    )
  ) {
    return true;
  }

  const hostname = requestUrl.hostname.toLowerCase();

  if (
    BYPASS_HOSTS.includes(hostname) ||
    hostname.endsWith(".huggingface.co") ||
    hostname.endsWith(".hf.co") ||
    hostname.endsWith(".hf-mirror.com") ||
    hostname.endsWith(".esm.sh") ||
    hostname.endsWith(".jsdelivr.net")
  ) {
    return true;
  }

  if (
    BYPASS_PROVIDERS.includes(hostname) ||
    hostname.endsWith(".openrouter.ai")
  ) {
    return true;
  }

  if (isLocalOrPrivateHost(hostname)) {
    return true;
  }

  return false;
}
