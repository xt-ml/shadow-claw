/**
 * Shared utility functions used across proxy route modules.
 *
 * Pure/stateless helpers extracted from the former monolithic proxy.ts
 * so that route modules and the server entry point can share them
 * without pulling in unrelated concerns.
 */

import { withRetry, isRetryableHttpError } from "../../worker/withRetry.js";

import type { Request, Response as ExpressResponse } from "express";

const DEFAULT_USER_AGENT =
  process.env.SHADOWCLAW_USER_AGENT || "ShadowClaw/1.0";

// ---------------------------------------------------------------------------
// Header helpers
// ---------------------------------------------------------------------------

export function getFirstHeaderValue(
  headerValue: string | string[] | undefined,
): string {
  if (Array.isArray(headerValue)) {
    return headerValue[0] || "";
  }

  return typeof headerValue === "string" ? headerValue : "";
}

export function extractBearerToken(authorizationHeader: string): string {
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : "";
}

// ---------------------------------------------------------------------------
// Number parsing
// ---------------------------------------------------------------------------

export function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function parseNonNegativeInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function isTelegramProxyPath(pathname: string): boolean {
  return /^\/telegram\/(?:bot|file\/bot)[^/]+\//.test(pathname);
}

export function redactSensitiveUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (
      parsed.hostname === "api.telegram.org" &&
      isTelegramProxyPath(parsed.pathname)
    ) {
      parsed.pathname = parsed.pathname.replace(
        /^\/telegram\/(?:bot|file\/bot)[^/]+\//,
        (segment) =>
          segment.includes("/file/")
            ? "/telegram/file/bot[REDACTED]/"
            : "/telegram/bot[REDACTED]/",
      );
    }

    return parsed.toString();
  } catch {
    return rawUrl
      .replace(/\/file\/bot[^/]+\//, "/file/bot[REDACTED]/")
      .replace(/\/bot[^/]+\//, "/bot[REDACTED]/");
  }
}

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------

export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs?: number,
) {
  if (!timeoutMs || timeoutMs <= 0) {
    return fetch(input, init);
  }

  const timeoutController = new AbortController();
  const callerSignal = init.signal;
  const combinedSignal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutController.signal])
    : timeoutController.signal;
  const timeoutHandle = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: combinedSignal,
    });
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw new Error(`Upstream request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ---------------------------------------------------------------------------
// Ollama tool helpers
// ---------------------------------------------------------------------------

export function requestHasTools(body: Record<string, any>): boolean {
  return Array.isArray(body.tools) && body.tools.length > 0;
}

export function stripToolsFromRequest(
  body: Record<string, any>,
): Record<string, any> {
  const next = { ...body };
  delete next.tools;
  delete next.tool_choice;

  return next;
}

export function ollamaDoesNotSupportTools(message: string): boolean {
  return /does not support tools/i.test(message || "");
}

// ---------------------------------------------------------------------------
// Generic proxy handlers
// ---------------------------------------------------------------------------

/**
 * Forward a request to an upstream URL and pipe the response back.
 */
export async function handleProxyRequest(
  _req: Request,
  res: ExpressResponse,
  opts: {
    targetUrl: string;
    method: string;
    headers: Record<string, any>;
    body?: string | Buffer;
    verbose?: boolean;
    maxRetries?: number;
    requestTimeoutMs?: number;
    forwardAuth?: boolean;
  },
): Promise<void> {
  const {
    targetUrl,
    method,
    headers,
    body,
    verbose,
    maxRetries,
    requestTimeoutMs,
    forwardAuth,
  } = opts;

  if (verbose) {
    console.log(
      `[Proxy] Forwarding ${method} request to: ${redactSensitiveUrl(targetUrl)}`,
    );
  }

  try {
    let target: any;
    try {
      target = new URL(targetUrl);
    } catch {
      res.status(400).json({ error: "Invalid URL" });

      return;
    }

    const safeHeaders = { ...headers };
    safeHeaders["User-Agent"] = DEFAULT_USER_AGENT;

    delete safeHeaders.host;
    delete safeHeaders.origin;
    delete safeHeaders.referer;
    if (!forwardAuth) {
      delete safeHeaders["Authorization"];
      delete safeHeaders["authorization"];
    }

    delete safeHeaders["accept-encoding"];
    delete safeHeaders["content-length"];
    delete safeHeaders.connection;

    const upstream = await withRetry(
      () =>
        fetchWithTimeout(
          target.toString(),
          {
            method,
            headers: safeHeaders,
            body:
              method === "GET" || method === "HEAD"
                ? undefined
                : body instanceof Buffer
                  ? (body as unknown as BodyInit)
                  : body?.toString(),
          },
          requestTimeoutMs,
        ),
      {
        maxRetries: maxRetries ?? 3,
        shouldRetry: isRetryableHttpError,
        onRetry: (attempt, max, delay, error) => {
          if (verbose) {
            console.log(
              `[Proxy] Retry ${attempt}/${max} after ${delay}ms due to: ${error.message || error}`,
            );
          }
        },
      },
    );

    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        lower === "content-encoding" ||
        lower === "transfer-encoding" ||
        lower === "content-length" ||
        lower === "connection"
      ) {
        return;
      }

      res.setHeader(key, value);
    });

    res.setHeader("Access-Control-Allow-Origin", "*");

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy request failed" });
  }
}

/**
 * Forward a streaming request to an upstream URL, piping the SSE stream back
 * to the client in real time.
 */
export async function handleStreamingProxyRequest(
  _req: Request,
  res: ExpressResponse,
  opts: {
    targetUrl: string;
    headers: Record<string, any>;
    body?: string;
    verbose?: boolean;
    maxRetries?: number;
    requestTimeoutMs?: number;
  },
): Promise<void> {
  const { targetUrl, headers, body, verbose, maxRetries, requestTimeoutMs } =
    opts;

  if (verbose) {
    console.log(
      `[Proxy] Streaming POST request to: ${redactSensitiveUrl(targetUrl)}`,
    );
  }

  try {
    let target: any;
    try {
      target = new URL(targetUrl);
    } catch {
      res.status(400).json({ error: "Invalid URL" });

      return;
    }

    const safeHeaders = { ...headers };
    delete safeHeaders.host;
    delete safeHeaders.origin;
    delete safeHeaders.referer;
    delete safeHeaders["accept-encoding"];
    delete safeHeaders["content-length"];
    delete safeHeaders.connection;

    const upstream = await withRetry(
      () =>
        fetchWithTimeout(
          target.toString(),
          {
            method: "POST",
            headers: {
              ...safeHeaders,
              "User-Agent": DEFAULT_USER_AGENT,
            },
            body,
          },
          requestTimeoutMs,
        ),
      {
        maxRetries: maxRetries ?? 3,
        shouldRetry: isRetryableHttpError,
        onRetry: (attempt, max, delay, error) => {
          if (verbose) {
            console.log(
              `[Proxy] Streaming Retry ${attempt}/${max} after ${delay}ms due to: ${error.message || error}`,
            );
          }
        },
      },
    );

    if (!upstream.ok) {
      const errBody = await upstream.text();
      res.status(upstream.status);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json({ error: errBody });

      return;
    }

    // Set SSE headers
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    if (!upstream.body) {
      res.end();

      return;
    }

    // Pipe the upstream SSE stream to the client
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    res.end();
  } catch (err) {
    console.error("Streaming proxy error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Streaming proxy request failed" });
    } else {
      res.end();
    }
  }
}

export function parseLooseToolCallInput(raw: string): Record<string, any> {
  const body = raw.trim();
  if (!body) {
    return {};
  }

  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if ((ch === '"' || ch === "'") && body[i - 1] !== "\\") {
      if (quote === ch) {
        quote = null;
      } else if (!quote) {
        quote = ch;
      }

      current += ch;

      continue;
    }

    if (ch === "," && !quote) {
      if (current.trim()) {
        parts.push(current.trim());
      }

      current = "";

      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  const result: Record<string, any> = {};
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    const eqIdx = part.indexOf("=");
    const idx = colonIdx > 0 ? colonIdx : eqIdx;

    if (idx <= 0) {
      continue;
    }

    const key = part
      .slice(0, idx)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    let valueRaw = part.slice(idx + 1).trim();

    if (!key) {
      continue;
    }

    if (
      (valueRaw.startsWith('"') && valueRaw.endsWith('"')) ||
      (valueRaw.startsWith("'") && valueRaw.endsWith("'"))
    ) {
      valueRaw = valueRaw.slice(1, -1);
      result[key] = valueRaw.replace(/\\(["'\\])/g, "$1");

      continue;
    }

    if (valueRaw === "true") {
      result[key] = true;

      continue;
    }

    if (valueRaw === "false") {
      result[key] = false;

      continue;
    }

    if (valueRaw === "null") {
      result[key] = null;

      continue;
    }

    if (/^-?\d+(\.\d+)?$/.test(valueRaw)) {
      result[key] = Number(valueRaw);

      continue;
    }

    result[key] = valueRaw;
  }

  return result;
}

export function parseLooseFunctionCallArgs(raw: string): Record<string, any> {
  const body = raw.trim();
  if (!body) {
    return {};
  }

  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let depth = 0;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if ((ch === '"' || ch === "'") && body[i - 1] !== "\\") {
      if (quote === ch) {
        quote = null;
      } else if (!quote) {
        quote = ch;
      }

      current += ch;

      continue;
    }

    if (!quote) {
      if (ch === "(" || ch === "{" || ch === "[") {
        depth += 1;
      } else if ((ch === ")" || ch === "}" || ch === "]") && depth > 0) {
        depth -= 1;
      } else if (ch === "," && depth === 0) {
        if (current.trim()) {
          parts.push(current.trim());
        }

        current = "";

        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  const result: Record<string, any> = {};
  for (let part of parts) {
    part = part.trim();
    if (!part) {
      continue;
    }

    const eqIdx = part.indexOf("=");
    const colonIdx = part.indexOf(":");
    const splitIdx = eqIdx > 0 ? eqIdx : colonIdx;

    if (splitIdx <= 0) {
      continue;
    }

    const key = part
      .slice(0, splitIdx)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    let valueRaw = part.slice(splitIdx + 1).trim();

    if (!key) {
      continue;
    }

    if (
      (valueRaw.startsWith('"') && valueRaw.endsWith('"')) ||
      (valueRaw.startsWith("'") && valueRaw.endsWith("'"))
    ) {
      valueRaw = valueRaw.slice(1, -1);
      result[key] = valueRaw.replace(/\\(["'\\])/g, "$1");

      continue;
    }

    if (valueRaw === "true") {
      result[key] = true;

      continue;
    }

    if (valueRaw === "false") {
      result[key] = false;

      continue;
    }

    if (valueRaw === "null") {
      result[key] = null;

      continue;
    }

    const num = Number(valueRaw);
    if (!Number.isNaN(num) && valueRaw !== "") {
      result[key] = num;

      continue;
    }

    result[key] = valueRaw;
  }

  return result;
}
