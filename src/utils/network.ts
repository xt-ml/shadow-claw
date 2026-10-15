/**
 * Network host, IP, and Private Network Access (PNA) classification utilities.
 *
 * @module network
 */

const LOCAL_DOMAINS = [".local", ".lan", ".home", ".internal"];

/**
 * Returns true if the hostname is a loopback address (e.g. localhost, 127.x.x.x, ::1).
 */
export function isLoopbackHost(hostname: string): boolean {
  if (!hostname) {
    return false;
  }

  const clean = hostname.trim().toLowerCase();

  return (
    clean === "localhost" ||
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(clean)
  );
}

/**
 * Returns true if the hostname is an RFC-1918 private IPv4 or link-local address.
 */
export function isPrivateIp(hostname: string): boolean {
  if (!hostname) {
    return false;
  }

  const clean = hostname.trim().toLowerCase();

  return (
    /^10\./.test(clean) ||
    /^192\.168\./.test(clean) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(clean) ||
    /^169\.254\./.test(clean)
  );
}

/**
 * Returns true if the hostname resolves to a loopback, link-local, RFC-1918 private address,
 * single-label hostname, or local network domain suffix (.local, .lan, etc.).
 */
export function isLocalOrPrivateHost(hostname: string): boolean {
  if (!hostname) {
    return false;
  }

  const clean = hostname.trim().toLowerCase();

  if (isLoopbackHost(clean) || isPrivateIp(clean)) {
    return true;
  }

  // Single-label hostname (no dots, e.g. "my-workstation")
  if (!clean.includes(".")) {
    return true;
  }

  // Local network domain suffixes
  return LOCAL_DOMAINS.some((domain) => clean.endsWith(domain));
}

/**
 * Determines whether the given hostname (or current location if not specified)
 * is running in a remote / non-local environment.
 */
export function isRemoteEnvironment(
  hostnameOrLocation?: string | Location,
): boolean {
  let hostname = "";

  if (typeof hostnameOrLocation === "string") {
    hostname = hostnameOrLocation;
  } else if (
    hostnameOrLocation &&
    typeof hostnameOrLocation.hostname === "string"
  ) {
    hostname = hostnameOrLocation.hostname;
  } else if (
    typeof location !== "undefined" &&
    typeof location.hostname === "string"
  ) {
    hostname = location.hostname;
  }

  if (!hostname || isLocalOrPrivateHost(hostname)) {
    return false;
  }

  return hostname.includes(".");
}
