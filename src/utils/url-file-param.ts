/**
 * Universal `#file=` / `?file=` compressed URL parameter utilities.
 * Uses Web Standards (CompressionStream / DecompressionStream + Base64URL)
 * with zero external dependencies.
 */

export const MAX_URL_PAYLOAD_CHARS = 32768;
export const MAX_HASH_URL_LENGTH = 65536;
export const MAX_QUERY_URL_LENGTH = 8192;

export type CompressionFormat = "deflate-raw" | "gzip" | "deflate";
export type DefaultViewerComponentsConfig = string | Record<string, string>;

export interface UrlLengthValidationResult {
  valid: boolean;
  length: number;
  maxLength: number;
  reason: string | null;
}

export interface DecodedFileParam {
  content: string;
  name: string;
  rawParam: string;
}

export interface PendingFileParamPayload extends DecodedFileParam {
  targetComponent: string;
  url: string;
}

const BASE64URL_RE = /^[A-Za-z0-9\-_]*$/;
const PENDING_FILE_PARAM_KEY = "__shadowClawPendingFileParam";

/**
 * Pre-validates a Base64URL string before embedding it in a URL parameter.
 */
export function validateBase64UrlLength(
  b64url: string,
  { maxLength = MAX_URL_PAYLOAD_CHARS }: { maxLength?: number } = {},
): UrlLengthValidationResult {
  if (typeof b64url !== "string" || b64url.length === 0) {
    return {
      valid: false,
      length: 0,
      maxLength,
      reason: "Base64URL payload must be a non-empty string.",
    };
  }
  if (!BASE64URL_RE.test(b64url)) {
    return {
      valid: false,
      length: b64url.length,
      maxLength,
      reason: "Payload contains characters outside the Base64URL alphabet.",
    };
  }
  if (b64url.length > maxLength) {
    return {
      valid: false,
      length: b64url.length,
      maxLength,
      reason: `Base64URL payload length (${b64url.length} chars) exceeds limit of ${maxLength} chars.`,
    };
  }
  return {
    valid: true,
    length: b64url.length,
    maxLength,
    reason: null,
  };
}

/**
 * Validates the total character length of a constructed URL against browser limits.
 */
export function validateCompressedUrl(
  urlString: string,
  { maxUrlLength }: { maxUrlLength?: number } = {},
): UrlLengthValidationResult {
  const str = String(urlString || "");
  const hasHashFile = str.includes("#file=") || str.includes("#");
  const limit =
    typeof maxUrlLength === "number" && maxUrlLength > 0
      ? maxUrlLength
      : hasHashFile
        ? MAX_HASH_URL_LENGTH
        : MAX_QUERY_URL_LENGTH;

  if (str.length > limit) {
    return {
      valid: false,
      length: str.length,
      maxLength: limit,
      reason: `Compressed URL length (${str.length} chars) exceeds safe limit of ${limit} chars.`,
    };
  }
  return {
    valid: true,
    length: str.length,
    maxLength: limit,
    reason: null,
  };
}

/**
 * Encodes a Uint8Array into an unpadded Base64URL string (RFC 4648 §5).
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  const anyBytes = bytes as Uint8Array & {
    toBase64?: (opts: { alphabet: string; omitPadding: boolean }) => string;
  };
  if (typeof anyBytes.toBase64 === "function") {
    return anyBytes.toBase64({ alphabet: "base64url", omitPadding: true });
  }

  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decodes a Base64URL (or standard Base64) string back into a Uint8Array.
 */
export function base64UrlToBytes(b64url: string): Uint8Array {
  const cleaned = b64url.trim();
  const anyUint8 = Uint8Array as typeof Uint8Array & {
    fromBase64?: (input: string, opts: { alphabet: string }) => Uint8Array;
  };
  if (typeof anyUint8.fromBase64 === "function") {
    return anyUint8.fromBase64(cleaned, { alphabet: "base64url" });
  }

  let b64 = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) {
    b64 += "=";
  }

  if (typeof atob === "function") {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function pipeBytesThrough(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const input = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = input
    .pipeThrough(
      transform as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
    )
    .getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLength += value.byteLength;
    }
  }

  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Compresses a UTF-8 string to a URL-safe Base64URL string.
 */
export async function compressToBase64Url(
  text: string,
  format: CompressionFormat = "deflate-raw",
): Promise<string> {
  if (typeof text !== "string") {
    throw new TypeError("Expected a string to compress");
  }

  const encoded = new TextEncoder().encode(text);
  const compressed = await pipeBytesThrough(
    encoded,
    new CompressionStream(format),
  );
  return bytesToBase64Url(compressed);
}

/**
 * Decompresses a URL-safe Base64URL string back to a UTF-8 string.
 */
export async function decompressFromBase64Url(
  b64url: string,
  format: CompressionFormat = "deflate-raw",
): Promise<string> {
  if (!b64url || typeof b64url !== "string") {
    return "";
  }

  const bytes = base64UrlToBytes(b64url);
  const decompressed = await pipeBytesThrough(
    new Uint8Array(bytes),
    new DecompressionStream(format),
  );
  return new TextDecoder().decode(decompressed);
}

/**
 * Resolves the current page's clean base URL (without query parameters or hash),
 * preferring `<base href>` if defined, otherwise falling back to `location.href`.
 */
export function getBaseHref(
  doc: Document | null = typeof globalThis.document !== "undefined"
    ? globalThis.document
    : null,
  loc: Location | null = typeof globalThis.location !== "undefined"
    ? globalThis.location
    : null,
): string {
  const baseEl = doc?.querySelector?.("base[href]") as HTMLBaseElement | null;
  if (baseEl?.getAttribute?.("href") || baseEl?.href) {
    const raw = baseEl.href || baseEl.getAttribute("href") || "";
    const u = new URL(raw, loc?.href || "http://localhost/");
    u.search = "";
    u.hash = "";
    return u.toString();
  }

  if (loc?.href) {
    const u = new URL(loc.href);
    u.search = "";
    u.hash = "";
    return u.toString();
  }

  return "http://localhost/";
}

type ParamSource = string | URL | URLSearchParams | Location | null | undefined;

function readParamValue(paramName: string, source: ParamSource): string | null {
  if (!source) return null;

  if (source instanceof URLSearchParams) {
    return source.get(paramName);
  }

  if (source instanceof URL) {
    const fromSearch = source.searchParams.get(paramName);
    if (fromSearch) return fromSearch;
    if (source.hash?.length > 1) {
      return new URLSearchParams(source.hash.slice(1)).get(paramName);
    }
    return null;
  }

  if (typeof source === "object" && ("search" in source || "hash" in source)) {
    const loc = source as { search?: string; hash?: string };
    if (loc.search) {
      const fromSearch = new URLSearchParams(loc.search).get(paramName);
      if (fromSearch) return fromSearch;
    }
    if (loc.hash && loc.hash.length > 1) {
      return new URLSearchParams(loc.hash.slice(1)).get(paramName);
    }
    return null;
  }

  if (typeof source === "string") {
    try {
      if (/^https?:\/\//i.test(source)) {
        return readParamValue(paramName, new URL(source));
      }
    } catch {
      // Fall through to string parsing
    }

    const hashIdx = source.indexOf("#");
    const queryPart = hashIdx >= 0 ? source.slice(0, hashIdx) : source;
    const hashPart = hashIdx >= 0 ? source.slice(hashIdx + 1) : "";

    if (queryPart.includes("?") || queryPart.includes("=")) {
      const q = queryPart.includes("?")
        ? queryPart.slice(queryPart.indexOf("?"))
        : queryPart;
      const fromSearch = new URLSearchParams(q).get(paramName);
      if (fromSearch) return fromSearch;
    }

    if (hashPart) {
      return new URLSearchParams(hashPart).get(paramName);
    }
  }

  return null;
}

/**
 * Extracts a raw parameter value from a URL, Location, URLSearchParams, or string,
 * checking both query search parameters (`?param=`) and hash fragments (`#param=`).
 */
export function getUrlParam(
  paramName: string,
  source: ParamSource = typeof globalThis.location !== "undefined"
    ? globalThis.location
    : "",
): string | null {
  return readParamValue(paramName, source);
}

/**
 * Extracts and decompresses a parameter from a URL, query string, or hash fragment.
 */
export async function getCompressedParam(
  paramName: string = "file",
  source: ParamSource = typeof globalThis.location !== "undefined"
    ? globalThis.location
    : "",
  format: CompressionFormat = "deflate-raw",
): Promise<string | null> {
  const encoded = readParamValue(paramName, source);
  if (!encoded) {
    return null;
  }

  try {
    return await decompressFromBase64Url(encoded, format);
  } catch (error) {
    console.error(
      `[shadow-claw] Failed to decompress param "${paramName}":`,
      error,
    );
    return null;
  }
}

export interface CreateCompressedUrlOptions {
  paramName?: string;
  fileName?: string;
  useHash?: boolean;
  extraParams?: Record<string, string>;
  format?: CompressionFormat;
  maxUrlLength?: number;
  validateLength?: boolean;
}

/**
 * Constructs a full URL with a compressed `#file=` (or `?file=`) parameter.
 */
export async function createCompressedUrl(
  baseUrl: string,
  value: string,
  {
    paramName = "file",
    fileName,
    useHash = true,
    extraParams = {},
    format = "deflate-raw",
    maxUrlLength = useHash ? MAX_HASH_URL_LENGTH : MAX_QUERY_URL_LENGTH,
    validateLength = true,
  }: CreateCompressedUrlOptions = {},
): Promise<string> {
  const compressed = await compressToBase64Url(value, format);
  if (validateLength) {
    const payloadCheck = validateBase64UrlLength(compressed, {
      maxLength: maxUrlLength,
    });
    if (!payloadCheck.valid) {
      throw new Error(
        `URL length pre-validation failed: ${payloadCheck.reason}`,
      );
    }
  }

  const targetUrl = new URL(baseUrl);
  const mergedExtra: Record<string, string> = { ...extraParams };
  if (fileName && !mergedExtra.name) {
    mergedExtra.name = fileName;
  }

  if (useHash) {
    const hashParams = new URLSearchParams(
      targetUrl.hash ? targetUrl.hash.slice(1) : "",
    );
    hashParams.set(paramName, compressed);
    for (const [key, val] of Object.entries(mergedExtra)) {
      hashParams.set(key, val);
    }
    targetUrl.hash = hashParams.toString();
  } else {
    targetUrl.searchParams.set(paramName, compressed);
    for (const [key, val] of Object.entries(mergedExtra)) {
      targetUrl.searchParams.set(key, val);
    }
  }

  const finalUrl = targetUrl.toString();
  if (validateLength) {
    const urlCheck = validateCompressedUrl(finalUrl, { maxUrlLength });
    if (!urlCheck.valid) {
      throw new Error(urlCheck.reason || "Compressed URL exceeds limit.");
    }
  }

  return finalUrl;
}

/**
 * Removes a parameter from both the URL query string and hash fragment
 * using `history.replaceState`.
 */
export function clearUrlParam(
  paramName: string = "file",
  url: string = typeof globalThis.location !== "undefined"
    ? globalThis.location.href
    : "",
): string {
  if (!url) return "";

  const targetUrl = new URL(url, "http://localhost/");
  targetUrl.searchParams.delete(paramName);

  if (targetUrl.hash?.length > 1) {
    const hashParams = new URLSearchParams(targetUrl.hash.slice(1));
    hashParams.delete(paramName);
    const remainingHash = hashParams.toString();
    targetUrl.hash = remainingHash ? `#${remainingHash}` : "";
  }

  if (typeof globalThis.history?.replaceState === "function") {
    const relative = targetUrl.pathname + targetUrl.search + targetUrl.hash;
    globalThis.history.replaceState(null, "", relative);
  }

  return targetUrl.toString();
}

/**
 * Infers a filename (with extension) for a `#file=` payload when `name` is omitted.
 */
export function inferSharedFileName(
  content: string,
  explicitName?: string | null,
): string {
  const trimmed = typeof explicitName === "string" ? explicitName.trim() : "";
  if (trimmed) {
    return trimmed.split("/").filter(Boolean).pop() || trimmed;
  }

  try {
    JSON.parse(content);
    return "shared-file.json";
  } catch {
    return "shared-file.txt";
  }
}

/**
 * Reads and decodes `#file=` (or `?file=`) and optional `name`/`filename` from a URL.
 */
export async function readFileParamFromUrl(
  source: ParamSource = typeof globalThis.location !== "undefined"
    ? globalThis.location
    : "",
  {
    paramName = "file",
    nameParam = "name",
    format = "deflate-raw",
  }: {
    paramName?: string;
    nameParam?: string;
    format?: CompressionFormat;
  } = {},
): Promise<DecodedFileParam | null> {
  const rawParam = readParamValue(paramName, source);
  if (!rawParam) {
    return null;
  }

  const content = await getCompressedParam(paramName, source, format);
  if (content === null) {
    return null;
  }

  const explicitName =
    readParamValue(nameParam, source) || readParamValue("filename", source);

  return {
    content,
    name: inferSharedFileName(content, explicitName),
    rawParam,
  };
}

function normalizeRoutePath(value: string): string {
  let normalized = value.trim();
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized || "/";
}

/**
 * Resolves the configured default viewer custom element tag name for a pathname,
 * supporting either a single tag name string or a path-to-component map.
 */
export function resolveDefaultViewerComponent(
  pathname: string,
  defaultViewerComponents?: DefaultViewerComponentsConfig | null,
  basePath: string = "/",
): string | null {
  if (!defaultViewerComponents) {
    return null;
  }

  if (typeof defaultViewerComponents === "string") {
    const trimmed = defaultViewerComponents.trim();
    return trimmed || null;
  }

  if (typeof defaultViewerComponents !== "object") {
    return null;
  }

  let effectivePath = pathname || "/";
  if (basePath && basePath !== "/") {
    const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
    const baseNoTrail = normalizedBase.slice(0, -1);
    if (effectivePath.startsWith(normalizedBase)) {
      effectivePath = "/" + effectivePath.slice(normalizedBase.length);
    } else if (effectivePath === baseNoTrail) {
      effectivePath = "/";
    }
  }

  const normalizedPathname = normalizeRoutePath(effectivePath);
  const entries = Object.entries(defaultViewerComponents)
    .filter(
      ([pattern, tag]) =>
        typeof pattern === "string" &&
        typeof tag === "string" &&
        tag.trim().length > 0,
    )
    .map(([pattern, tag]) => ({
      pattern: pattern === "*" ? "*" : normalizeRoutePath(pattern),
      tag: tag.trim(),
    }))
    .sort((a, b) => {
      if (a.pattern === "*") return 1;
      if (b.pattern === "*") return -1;
      return b.pattern.length - a.pattern.length;
    });

  for (const entry of entries) {
    if (entry.pattern === "*") {
      return entry.tag;
    }
    if (entry.pattern === "/") {
      if (normalizedPathname === "/") {
        return entry.tag;
      }
      continue;
    }
    if (
      normalizedPathname === entry.pattern ||
      normalizedPathname.startsWith(`${entry.pattern}/`)
    ) {
      return entry.tag;
    }
  }

  const fallbackRoot = entries.find((e) => e.pattern === "/");
  return fallbackRoot ? fallbackRoot.tag : null;
}

/**
 * Reads `settings.defaultViewerComponents` from `#shadow-claw-site-config`.
 */
export function getSiteConfigDefaultViewerComponents(): DefaultViewerComponentsConfig | null {
  if (typeof document === "undefined") {
    return null;
  }

  try {
    const scriptEl = document.getElementById("shadow-claw-site-config");
    if (!scriptEl?.textContent) {
      return null;
    }
    const config = JSON.parse(scriptEl.textContent);
    const val = config?.settings?.defaultViewerComponents;
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return val as Record<string, string>;
    }
  } catch {
    // Ignore invalid JSON
  }

  return null;
}

export function setPendingFileParam(
  payload: PendingFileParamPayload | null,
): void {
  (globalThis as Record<string, unknown>)[PENDING_FILE_PARAM_KEY] = payload;
}

export function getPendingFileParam(): PendingFileParamPayload | null {
  const val = (globalThis as Record<string, unknown>)[PENDING_FILE_PARAM_KEY];
  return (val as PendingFileParamPayload | null) ?? null;
}

/**
 * Consumes a pending `#file=` payload if it targets `componentTagName`.
 */
export function consumePendingFileParam(
  componentTagName: string,
): PendingFileParamPayload | null {
  const pending = getPendingFileParam();
  if (!pending) {
    return null;
  }
  if (
    pending.targetComponent.toLowerCase() !== componentTagName.toLowerCase()
  ) {
    return null;
  }
  setPendingFileParam(null);
  return pending;
}
