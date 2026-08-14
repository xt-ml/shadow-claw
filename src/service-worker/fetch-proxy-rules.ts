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

export function shouldBypassFetchProxy(
  requestUrl: URL,
  locationOrigin: string,
): boolean {
  if (requestUrl.origin === locationOrigin) {
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

  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";

  const isShareTargetPath = requestUrl.pathname.endsWith(
    "/share/share-target.html",
  );

  const isProxyPath =
    requestUrl.pathname === "/proxy" ||
    requestUrl.pathname.startsWith("/git-proxy/") ||
    isShareTargetPath;

  return isLoopback && isProxyPath;
}
