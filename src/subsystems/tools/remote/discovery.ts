import { computeSha256 } from "../../../utils/utils.js";
import type { RemoteManifest, ResolvedRemoteManifest } from "./types.js";

const WELL_KNOWN_PATH = ".well-known/agent-skills/index.json";

/**
 * Resolves an arbitrary site or discovery URL into a normalized base URL and manifest URL.
 */
export function resolveDiscoveryUrl(inputUrl: string): {
  baseUrl: string;
  siteUrl: string;
  manifestUrl: string;
} {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    throw new Error("URL cannot be empty");
  }

  let urlString = trimmed;
  if (!urlString.startsWith("http://") && !urlString.startsWith("https://")) {
    urlString = `https://${urlString}`;
  }

  // Remove trailing slashes
  urlString = urlString.replace(/\/+$/, "");

  if (urlString.endsWith(WELL_KNOWN_PATH)) {
    const baseUrl = urlString
      .slice(0, -WELL_KNOWN_PATH.length)
      .replace(/\/+$/, "");
    return {
      baseUrl,
      siteUrl: baseUrl,
      manifestUrl: urlString,
    };
  }

  return {
    baseUrl: urlString,
    siteUrl: urlString,
    manifestUrl: `${urlString}/${WELL_KNOWN_PATH}`,
  };
}

/**
 * Resolves an RFC 3986 relative URL found in an agent-skills manifest against the manifest URL.
 */
export function resolveManifestRelativeUrl(
  relativeUrl: string,
  manifestUrl: string,
): string {
  if (!relativeUrl) {
    return "";
  }
  try {
    return new URL(relativeUrl, manifestUrl).href;
  } catch {
    return relativeUrl;
  }
}

/**
 * Resolves all relative URLs in an agent-skills manifest into fully-qualified absolute URLs.
 */
export function resolveManifestUrls(
  manifest: RemoteManifest,
  manifestUrl: string,
): RemoteManifest {
  const cloned: RemoteManifest = JSON.parse(JSON.stringify(manifest));

  if (Array.isArray(cloned.tools)) {
    cloned.tools = cloned.tools.map((tool) => ({
      ...tool,
      url: resolveManifestRelativeUrl(tool.url, manifestUrl),
    }));
  }

  if (Array.isArray(cloned.scripts)) {
    cloned.scripts = cloned.scripts.map((script) => ({
      ...script,
      url: resolveManifestRelativeUrl(script.url, manifestUrl),
    }));
  }

  if (Array.isArray(cloned.skills)) {
    cloned.skills = cloned.skills.map((skill) => ({
      ...skill,
      url: resolveManifestRelativeUrl(skill.url, manifestUrl),
      tools: Array.isArray(skill.tools)
        ? skill.tools.map((st) => ({
            ...st,
            url: st.url
              ? resolveManifestRelativeUrl(st.url, manifestUrl)
              : undefined,
          }))
        : undefined,
      scripts: Array.isArray(skill.scripts)
        ? skill.scripts.map((ss) => ({
            ...ss,
            url: ss.url
              ? resolveManifestRelativeUrl(ss.url, manifestUrl)
              : undefined,
          }))
        : undefined,
    }));
  }

  return cloned;
}

/**
 * Verifies that the given content matches an expected SHA-256 digest (e.g. "sha256:...").
 */
export async function verifySha256Digest(
  content: string | Uint8Array,
  expectedDigest?: string,
): Promise<boolean> {
  if (!expectedDigest || !expectedDigest.startsWith("sha256:")) {
    return true;
  }

  const expectedHex = expectedDigest.slice(7).trim().toLowerCase();
  if (!expectedHex) {
    return true;
  }

  const rawBytes =
    typeof content === "string" ? new TextEncoder().encode(content) : content;
  const actualHex = (await computeSha256(rawBytes)).toLowerCase();
  return actualHex === expectedHex;
}

/**
 * Fetches and parses a remote site's Agent Skills discovery manifest.
 */
export async function fetchDiscoveryManifest(
  siteUrl: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<ResolvedRemoteManifest> {
  const { baseUrl, manifestUrl } = resolveDiscoveryUrl(siteUrl);

  const response = await customFetch(manifestUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch discovery manifest: HTTP ${response.status} ${response.statusText}`.trim(),
    );
  }

  const rawManifest = (await response.json()) as RemoteManifest;
  if (!rawManifest || typeof rawManifest !== "object") {
    throw new Error("Invalid discovery manifest: expected a JSON object");
  }

  const resolvedManifest = resolveManifestUrls(rawManifest, manifestUrl);

  return {
    manifest: resolvedManifest,
    siteUrl: baseUrl,
    manifestUrl,
  };
}
