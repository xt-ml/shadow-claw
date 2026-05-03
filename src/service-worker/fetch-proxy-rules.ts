const BYPASS_HOSTS = [
  "cdnjs.cloudflare.com",
  "esm.sh",
  "unpkg.com",
  "cdn.jsdelivr.net",
  "esm.run",
  "huggingface.co",
  "hf.co",
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

  const isShareTargetPath = requestUrl.pathname.endsWith(
    "/share/share-target.html",
  );

  const isProxyPath =
    requestUrl.pathname === "/proxy" ||
    requestUrl.pathname.startsWith("/git-proxy/") ||
    isShareTargetPath;

  return isLoopback && isProxyPath;
}
