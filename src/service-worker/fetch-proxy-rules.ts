const BYPASS_HOSTS = [
  "cdnjs.cloudflare.com",
  "esm.sh",
  "unpkg.com",
  "cdn.jsdelivr.net",
  "esm.run",
];

const BYPASS_PROVIDERS = [
  "openrouter.ai",
  "router.huggingface.co",
  "api-inference.huggingface.co",
  "api.telegram.org",
];

export function shouldBypassFetchProxy(
  requestUrl: URL,
  locationOrigin: string,
): boolean {
  if (requestUrl.origin === locationOrigin) {
    return true;
  }

  if (BYPASS_HOSTS.includes(requestUrl.hostname)) {
    return true;
  }

  if (BYPASS_PROVIDERS.includes(requestUrl.hostname)) {
    return true;
  }

  const isLoopback =
    requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1";

  const isProxyPath =
    requestUrl.pathname === "/proxy" ||
    requestUrl.pathname.startsWith("/git-proxy/");

  return isLoopback && isProxyPath;
}
