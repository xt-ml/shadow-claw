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

  const isLoopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";

  if (isLoopback) {
    return true;
  }

  const isPrivateIp = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(
    hostname,
  );

  if (isPrivateIp) {
    return true;
  }

  return false;
}
