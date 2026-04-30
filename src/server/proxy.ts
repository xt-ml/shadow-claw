/**
 * Shared proxy route handlers used by both the Express dev server (src/server/server.ts)
 * and the Electron main process (electron/main.ts).
 *
 * Usage:
 *   import { registerProxyRoutes } from "./proxy.js";
 *   registerProxyRoutes(app, { verbose: false });
 */

import { env } from "node:process";
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { readdir, stat, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isIP } from "node:net";
import { withRetry, isRetryableHttpError } from "../worker/withRetry.js";

import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
} from "@aws-sdk/client-bedrock";

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

import { fromSSO } from "@aws-sdk/credential-providers";
import type { Request, Response as ExpressResponse, Express } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LLAMAFILE_EXTENSION = ".llamafile";
const DEFAULT_LLAMAFILE_HOST = "127.0.0.1";
const DEFAULT_LLAMAFILE_PORT = 8080;
const LLAMAFILE_ALLOWED_LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

const DEFAULT_USER_AGENT =
  process.env.SHADOWCLAW_USER_AGENT || "ShadowClaw/1.0";

type LlamafileMode = "server" | "cli";

function parseLlamafileMode(value: unknown): LlamafileMode {
  return value === "server" ? "server" : "cli";
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  if (LLAMAFILE_ALLOWED_LOOPBACK_HOSTS.has(normalized)) {
    return true;
  }

  if (isIP(normalized) === 4) {
    return normalized.startsWith("127.");
  }

  if (isIP(normalized) === 6) {
    return normalized === "::1";
  }

  return false;
}

function normalizeLlamafileHost(value: unknown): string {
  const host = typeof value === "string" ? value.trim() : "";
  const resolvedHost = host || DEFAULT_LLAMAFILE_HOST;
  const allowNonLoopback = env.LLAMAFILE_ALLOW_NON_LOOPBACK === "true";

  if (!allowNonLoopback && !isLoopbackHost(resolvedHost)) {
    throw new Error(
      `Unsafe host '${resolvedHost}'. Only loopback hosts are allowed unless LLAMAFILE_ALLOW_NON_LOOPBACK=true.`,
    );
  }

  return resolvedHost;
}

function normalizeLlamafilePort(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(typeof value === "string" ? value : "", 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_LLAMAFILE_PORT;
  }

  return parsed;
}

function normalizeLlamafileOffline(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value !== "false";
  }

  return true;
}

function getLlamafileRuntimeOptions(req: Request): {
  mode: LlamafileMode;
  host: string;
  port: number;
  offline: boolean;
} {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const optionsFromBody =
    body.llamafile && typeof body.llamafile === "object" ? body.llamafile : {};

  const headerMode = getFirstHeaderValue(req.headers["x-llamafile-mode"]);
  const bodyMode =
    typeof optionsFromBody.mode === "string" ? optionsFromBody.mode.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";

  // Prefer explicit mode from header/body; otherwise infer from payload so CLI remains robust
  // even if a custom header is stripped by intermediate layers.
  let inferredMode: LlamafileMode;
  if (headerMode === "cli" || headerMode === "server") {
    inferredMode = parseLlamafileMode(headerMode);
  } else if (bodyMode === "cli" || bodyMode === "server") {
    inferredMode = parseLlamafileMode(bodyMode);
  } else {
    inferredMode = model ? "cli" : "server";
  }

  const mode = inferredMode;
  const host = normalizeLlamafileHost(
    getFirstHeaderValue(req.headers["x-llamafile-host"]) ||
      optionsFromBody.host,
  );
  const port = normalizeLlamafilePort(
    getFirstHeaderValue(req.headers["x-llamafile-port"]) ||
      optionsFromBody.port,
  );
  const offline = normalizeLlamafileOffline(
    getFirstHeaderValue(req.headers["x-llamafile-offline"]) ||
      optionsFromBody.offline,
  );

  return { mode, host, port, offline };
}

async function listLlamafileBinaries(): Promise<
  Array<{ fileName: string; id: string; absolutePath: string }>
> {
  const candidateDirs = [
    path.resolve(__dirname, "../../assets/llamafile"),
    path.resolve(__dirname, "../../../assets/llamafile"),
    path.resolve(process.cwd(), "assets/llamafile"),
  ];

  let resolvedDir = "";
  for (const dir of candidateDirs) {
    try {
      const info = await stat(dir);
      if (info.isDirectory()) {
        resolvedDir = dir;

        break;
      }
    } catch {
      // Keep probing fallback directories.
    }
  }

  if (!resolvedDir) {
    throw new Error(
      `Could not locate assets/llamafile directory. Tried: ${candidateDirs.join(", ")}`,
    );
  }

  const entries = await readdir(resolvedDir, { withFileTypes: true });

  return entries
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(LLAMAFILE_EXTENSION),
    )
    .map((entry) => {
      const fileName = entry.name;
      const id = fileName.slice(0, -LLAMAFILE_EXTENSION.length);

      return {
        fileName,
        id,
        absolutePath: path.resolve(resolvedDir, fileName),
      };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

async function resolveLlamafileBinary(model: string): Promise<{
  fileName: string;
  id: string;
  absolutePath: string;
}> {
  const binaries = await listLlamafileBinaries();
  const normalizedModel = model.trim();

  const match = binaries.find(
    (item) => item.id === normalizedModel || item.fileName === normalizedModel,
  );

  if (!match) {
    throw new Error(
      `Model '${normalizedModel}' not found under assets/llamafile (*.llamafile).`,
    );
  }

  return match;
}

function writeOpenAiDeltaChunk(
  res: ExpressResponse,
  model: string,
  content: string,
) {
  const chunk = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null,
      },
    ],
  };

  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}

function writeOpenAiDoneChunk(res: ExpressResponse, model: string) {
  const finalChunk = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  };

  res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
  res.write("data: [DONE]\n\n");
}

function sanitizeLlamafileRequestBody(
  body: Record<string, any>,
): Record<string, any> {
  const next = { ...body };
  delete next.llamafile;

  return next;
}

function sanitizeLlamafileCliPayload(
  body: Record<string, any>,
): Record<string, any> {
  const next = sanitizeLlamafileRequestBody(body);
  delete next.stream;
  delete next.stream_options;

  return next;
}

async function invokeLlamafileCli(
  req: Request,
  res: ExpressResponse,
  body: Record<string, any>,
  opts: { model: string; offline: boolean },
  verbose: boolean,
) {
  const { absolutePath } = await resolveLlamafileBinary(opts.model);

  // Pre-flight check: verify binary exists and is executable
  try {
    await access(absolutePath, fsConstants.X_OK);
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    const fullMessage = `Binary not executable or not found: ${absolutePath} (${details})`;
    console.error(`[Proxy] Llamafile check failed:`, fullMessage);

    throw new Error(fullMessage);
  }

  const wantsStreaming = body.stream === true;
  const requestPayload = sanitizeLlamafileCliPayload(body);

  const args = ["--cli", "-p", JSON.stringify(requestPayload)];
  if (opts.offline) {
    args.unshift("--offline");
  }

  if (verbose) {
    console.log(
      `[Proxy] Executing llamafile CLI: ${path.basename(absolutePath)} (${opts.offline ? "offline" : "online"})`,
    );
    console.log(
      `[Proxy] Command: ${path.basename(absolutePath)} ${args.join(" ")}`,
    );
  }

  let child: ReturnType<typeof spawn>;
  const runDetached = process.platform !== "win32";
  try {
    child = spawn(absolutePath, args, {
      cwd: path.dirname(absolutePath),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      detached: runDetached,
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    const fullMessage = `Failed to spawn llamafile: ${details}`;
    console.error(`[Proxy] Spawn failed:`, fullMessage);

    throw new Error(fullMessage);
  }

  // Ensure stdout and stderr are not null (they won't be with stdio: ["ignore", "pipe", "pipe"])
  if (!child.stdout || !child.stderr) {
    throw new Error("Failed to setup child process streams");
  }

  let stderr = "";
  let fullStdout = "";
  let hasError = false;
  let requestClosed = false;
  let forceKillTimer: ReturnType<typeof setTimeout> | null = null;

  const clearForceKillTimer = () => {
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
      forceKillTimer = null;
    }
  };

  const killChild = (signal: NodeJS.Signals) => {
    if (child.exitCode !== null || child.signalCode !== null || child.killed) {
      return;
    }

    if (process.platform === "win32") {
      if (typeof child.pid !== "number") {
        return;
      }

      // Windows does not support POSIX process-group kill. Use taskkill to
      // terminate the full process tree rooted at the spawned binary.
      const taskkillArgs = ["/PID", String(child.pid), "/T", "/F"];
      const killer = spawn("taskkill", taskkillArgs, {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.on("error", (error) => {
        if (verbose) {
          console.warn(
            `[Proxy] taskkill failed for PID ${child.pid}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });
      killer.unref();

      return;
    }

    try {
      if (runDetached && typeof child.pid === "number") {
        // Kill the whole process group so wrapped llamafile subprocesses die too.
        process.kill(-child.pid, signal);
      } else {
        child.kill(signal);
      }
    } catch {
      // Ignore races where the process exits between checks.
    }
  };

  const terminateChild = () => {
    if (child.exitCode !== null || child.signalCode !== null || child.killed) {
      return;
    }

    if (process.platform === "win32") {
      killChild("SIGKILL");

      return;
    }

    killChild("SIGTERM");

    if (forceKillTimer) {
      return;
    }

    // Some llamafile binaries can ignore SIGTERM, so escalate shortly after.
    forceKillTimer = setTimeout(() => {
      if (
        child.exitCode !== null ||
        child.signalCode !== null ||
        child.killed
      ) {
        return;
      }

      killChild("SIGKILL");
    }, 1000);
  };

  const cleanupCancellationListeners = () => {
    req.off("aborted", onClientDisconnected);
    req.off("close", onClientDisconnected);
    res.off("close", onClientDisconnected);
  };

  const onClientDisconnected = () => {
    if (requestClosed) {
      return;
    }

    requestClosed = true;
    terminateChild();
  };

  req.once("aborted", onClientDisconnected);
  req.once("close", onClientDisconnected);
  res.once("close", onClientDisconnected);

  if (wantsStreaming) {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    child.stdout.on("data", (chunk: Buffer) => {
      if (requestClosed || res.writableEnded) {
        return;
      }

      const text = chunk.toString("utf8");
      fullStdout += text;
      writeOpenAiDeltaChunk(res, opts.model, text);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      cleanupCancellationListeners();
      clearForceKillTimer();

      if (requestClosed) {
        return;
      }

      if (hasError) {
        return; // Error already reported via error handler
      }

      if (code !== 0) {
        const message =
          stderr.trim() ||
          `llamafile exited with status ${code === null ? "unknown" : code}`;
        if (verbose) {
          console.error(
            `[Proxy] Llamafile exited with status ${code}:`,
            message,
          );
        }

        res.write(
          `data: ${JSON.stringify({ error: { type: "server_error", message } })}\n\n`,
        );
        res.write("data: [DONE]\n\n");
        res.end();

        return;
      }

      writeOpenAiDoneChunk(res, opts.model);
      res.end();
    });

    child.on("error", (error) => {
      hasError = true;
      cleanupCancellationListeners();
      clearForceKillTimer();

      if (requestClosed) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      const fullMessage = `Child process error: ${message}`;
      console.error(`[Proxy] Llamafile error:`, fullMessage);

      if (!res.headersSent) {
        res.status(500).json({
          error: `Failed to execute llamafile: ${fullMessage}`,
        });

        return;
      }

      res.write(
        `data: ${JSON.stringify({ error: { type: "server_error", message: fullMessage } })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      res.end();
    });

    return;
  }

  child.stdout.on("data", (chunk: Buffer) => {
    fullStdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", (error) => {
      clearForceKillTimer();

      if (requestClosed) {
        resolve(null);

        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      const fullMessage = `Child process error during execution: ${message}`;
      console.error(`[Proxy] Llamafile error:`, fullMessage);
      reject(new Error(fullMessage));
    });
    child.on("close", (code) => {
      clearForceKillTimer();
      resolve(code);
    });
  });

  cleanupCancellationListeners();

  if (requestClosed) {
    return;
  }

  if (exitCode !== 0) {
    const errorMessage =
      stderr.trim() ||
      `llamafile exited with status ${exitCode === null ? "unknown" : exitCode}`;
    if (verbose) {
      console.error(
        `[Proxy] Llamafile exited with status ${exitCode}:`,
        errorMessage,
      );
    }

    res.status(500).json({
      error: errorMessage,
    });

    return;
  }

  res.json({
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: opts.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: fullStdout.trim(),
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  });
}

async function invokeLlamafileServer(
  req: Request,
  res: ExpressResponse,
  body: Record<string, any>,
  opts: { host: string; port: number },
  verbose: boolean,
) {
  const targetUrl = `http://${opts.host}:${opts.port}/v1/chat/completions`;
  const wantsStreaming = body.stream === true;
  const timeoutMs = parsePositiveInteger(
    env.LLAMAFILE_SERVER_REQUEST_TIMEOUT_MS,
    120_000,
  );
  const requestController = new AbortController();

  const abortUpstream = () => {
    requestController.abort();
  };

  req.on("close", abortUpstream);

  if (verbose) {
    console.log(`[Proxy] Forwarding llamafile SERVER request to ${targetUrl}`);
  }

  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(
      targetUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": DEFAULT_USER_AGENT,
        },
        body: JSON.stringify(sanitizeLlamafileRequestBody(body)),
        signal: requestController.signal,
      },
      timeoutMs,
    );
  } catch (error) {
    req.off("close", abortUpstream);

    throw error;
  }

  if (!upstream.ok) {
    req.off("close", abortUpstream);
    const errorBody = await upstream.text();
    res.status(upstream.status).json({ error: errorBody });

    return;
  }

  if (!wantsStreaming) {
    req.off("close", abortUpstream);
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.status(200);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    res.send(payload);

    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  if (!upstream.body) {
    req.off("close", abortUpstream);
    res.end();

    return;
  }

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
    req.off("close", abortUpstream);
    reader.releaseLock();
  }

  res.end();
}

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

function isTelegramProxyPath(pathname: string): boolean {
  return /^\/telegram\/(?:bot|file\/bot)[^/]+\//.test(pathname);
}

function redactSensitiveUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (
      parsed.hostname === "api.telegram.org" &&
      isTelegramProxyPath(parsed.pathname)
    ) {
      parsed.pathname = parsed.pathname.replace(
        /^\/(?:bot|file\/bot)[^/]+\//,
        (segment) =>
          segment.startsWith("/file/")
            ? "/file/bot[REDACTED]/"
            : "/bot[REDACTED]/",
      );
    }

    return parsed.toString();
  } catch {
    return rawUrl
      .replace(/\/file\/bot[^/]+\//, "/file/bot[REDACTED]/")
      .replace(/\/bot[^/]+\//, "/bot[REDACTED]/");
  }
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseNonNegativeInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

async function fetchWithTimeout(
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

function requestHasTools(body: Record<string, any>): boolean {
  return Array.isArray(body.tools) && body.tools.length > 0;
}

function stripToolsFromRequest(body: Record<string, any>): Record<string, any> {
  const next = { ...body };
  delete next.tools;
  delete next.tool_choice;

  return next;
}

function ollamaDoesNotSupportTools(message: string): boolean {
  return /does not support tools/i.test(message || "");
}

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

// ---- Bedrock helpers ----
const BEDROCK_REGION = env.BEDROCK_REGION || "";
const BEDROCK_PROFILE = env.BEDROCK_PROFILE || "";

function getBedrockRuntimeOptions(req: Request): {
  region: string;
  profile: string;
} {
  const region =
    BEDROCK_REGION ||
    getFirstHeaderValue(req.headers["x-bedrock-region"])?.trim() ||
    "";
  const profile =
    BEDROCK_PROFILE ||
    getFirstHeaderValue(req.headers["x-bedrock-profile"])?.trim() ||
    "";

  return { region, profile };
}

function createBedrockCredentials(profile: string) {
  return fromSSO({ profile });
}

function toInferenceProfileId(modelId: string, region: string): string {
  if (/^[a-z]{2}\.anthropic\./.test(modelId)) {
    return modelId;
  }

  const regionPrefix = region.split("-")[0];

  if (!regionPrefix) {
    throw new Error(
      "Bedrock region is not configured. Set BEDROCK_REGION or provide x-bedrock-region header.",
    );
  }

  return `${regionPrefix}.${modelId}`;
}

/**
 * Convert a Bedrock ResponseStream event into one or more SSE `data:` lines
 * in Anthropic Messages API streaming format.
 */
function bedrockEventToSSE(event: any): string | null {
  if (event.chunk?.bytes) {
    const json = new TextDecoder().decode(event.chunk.bytes);

    return `data: ${json}\n\n`;
  }

  return null;
}

// ---- route registration ----

/**
 * Mount all proxy endpoints on the given Express app.
 */
export function registerProxyRoutes(
  app: Express,
  options: { verbose?: boolean } = {},
): void {
  const verbose = options.verbose ?? false;

  // // ---- generic /proxy endpoint ----
  // app.all("/proxy", async (req, res) => {
  //   const urlFromQuery =
  //     typeof req.query.url === "string" ? req.query.url : undefined;
  //   const urlFromBody =
  //     req.body && typeof req.body.url === "string" ? req.body.url : undefined;
  //   const target = urlFromBody || urlFromQuery;

  //   if (!target) {
  //     return res.status(400).json({ error: "Missing 'url' parameter" });
  //   }

  //   const method =
  //     (req.body && typeof req.body.method === "string" && req.body.method) ||
  //     req.method;
  //   const normalizedMethod = method.toUpperCase();

  //   const incomingHeaders =
  //     (req.body && req.body.headers && typeof req.body.headers === "object"
  //       ? req.body.headers
  //       : req.headers) || {};

  //   let body;
  //   if (req.body && typeof req.body.body === "string") {
  //     body = req.body.body;
  //   }

  //   await handleProxyRequest(req, res, {
  //     targetUrl: target,
  //     method: normalizedMethod,
  //     headers: incomingHeaders,
  //     body,
  //     verbose,
  //   });
  // });

  // ---- generic /proxy endpoint (supports https://cors-anywhere.com/)----
  // Supports:
  //   - /proxy?url=<target> (query param)
  //   - /proxy with body { url: "<target>" } (body param)
  //   - /proxy/<target> (path-based, new fallback)
  app.all(/^\/proxy(\/(.*))?$/, async (req: any, res: any): Promise<any> => {
    const urlFromQuery =
      typeof req.query.url === "string" ? req.query.url : undefined;
    const urlFromBody =
      req.body && typeof req.body.url === "string" ? req.body.url : undefined;
    let target = urlFromBody || urlFromQuery;

    // If no target from query/body params, try to extract from path
    if (!target) {
      // Capture group from regex: the part after /proxy/
      const pathTarget = req.params[1];
      if (pathTarget) {
        target = pathTarget;
        // Append any additional query params (excluding 'url' which was already checked)
        const extraQuery = { ...req.query };
        delete extraQuery.url;
        if (Object.keys(extraQuery).length > 0) {
          const separator = target.includes("?") ? "&" : "?";
          target +=
            separator + new URLSearchParams(extraQuery as any).toString();
        }
      }
    }

    if (!target) {
      return res.status(400).json({ error: "Missing 'url' parameter" });
    }

    const method =
      (req.body && typeof req.body.method === "string" && req.body.method) ||
      req.method;
    const normalizedMethod = method.toUpperCase();

    const headersFromBody = !!(
      req.body &&
      req.body.headers &&
      typeof req.body.headers === "object"
    );
    const incomingHeaders =
      (headersFromBody ? req.body.headers : req.headers) || {};

    let body;
    if (req.body && typeof req.body.body === "string") {
      body = req.body.body;
    }

    // When headers come from the request body (e.g. service worker proxy),
    // the caller explicitly set them — preserve Authorization.
    const hasExplicitAuth =
      headersFromBody &&
      !!(incomingHeaders["Authorization"] || incomingHeaders["authorization"]);

    await handleProxyRequest(req, res, {
      targetUrl: target,
      method: normalizedMethod,
      headers: incomingHeaders,
      body,
      verbose,
      forwardAuth: hasExplicitAuth,
    });
  });

  app.all(
    /^\/telegram\/((?:bot.*)|(?:file\/bot.*))$/,
    async (req: any, res: any): Promise<any> => {
      // Telegram polling endpoints (getUpdates) must never be cached.
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      const telegramPath = req.params[0];
      const queryString =
        Object.keys(req.query).length > 0
          ? "?" + new URLSearchParams(req.query as any).toString()
          : "";

      const targetUrl = `https://api.telegram.org/${telegramPath}${queryString}`;

      const method = req.method.toUpperCase();
      const incomingHeaders = req.headers || {};

      let body: Buffer | string | undefined;
      const contentType = incomingHeaders["content-type"] || "";

      if (contentType.includes("multipart/form-data")) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }

        body = Buffer.concat(chunks);
      } else if (req.body && typeof req.body.body === "string") {
        body = req.body.body;
      } else if (
        req.body &&
        typeof req.body === "object" &&
        Object.keys(req.body).length > 0 &&
        !("url" in req.body) &&
        !("method" in req.body) &&
        !("headers" in req.body)
      ) {
        body = JSON.stringify(req.body);
      }

      await handleProxyRequest(req, res, {
        targetUrl,
        method,
        headers: incomingHeaders,
        body,
        verbose,
      });
    },
  );

  // ---- GitHub Models / Azure AI Inference proxy ----
  const handleGitHubModelsChatCompletions = async (req: any, res: any) => {
    const endpoint = (
      env.COPILOT_AZURE_OPENAI_ENDPOINT || "https://models.github.ai/inference"
    ).replace(/\/$/, "");

    const targetUrl = `${endpoint}/chat/completions`;

    const serverApiKey =
      env.COPILOT_AZURE_OPENAI_API_KEY || env.API_KEY || undefined;
    const defaultModel = env.COPILOT_AZURE_OPENAI_MODEL || undefined;

    const requestBody =
      req.body && typeof req.body === "object" ? { ...req.body } : {};
    console.log("REQ", requestBody);
    console.log("RES", res);
    if (!requestBody.model && defaultModel) {
      requestBody.model = defaultModel;
    }

    if (typeof requestBody.model !== "string" || !requestBody.model) {
      return res.status(400).json({
        error: "Missing or invalid 'model' parameter.",
      });
    }

    if (verbose) {
      console.log(
        `[Proxy] Azure OpenAI request for model: ${requestBody.model}`,
      );
    }

    const clientApiKey = getFirstHeaderValue(req.headers["api-key"]);
    const clientAuthorization = getFirstHeaderValue(req.headers.authorization);
    const resolvedApiKey =
      clientApiKey ||
      extractBearerToken(clientAuthorization) ||
      serverApiKey ||
      "";

    const incomingHeaders = { ...req.headers };
    delete incomingHeaders["api-key"];
    delete incomingHeaders.authorization;

    if (resolvedApiKey) {
      incomingHeaders["api-key"] = resolvedApiKey;
      incomingHeaders.authorization = `Bearer ${resolvedApiKey}`;
      incomingHeaders["X-GitHub-Api-Version"] = "2026-03-10";
    }

    // If the client requested streaming, pipe the SSE stream from upstream
    if (requestBody.stream === true) {
      await handleStreamingProxyRequest(req, res, {
        targetUrl,
        headers: incomingHeaders,
        body: JSON.stringify(requestBody),
        verbose,
      });
    } else {
      await handleProxyRequest(req, res, {
        targetUrl,
        method: "POST",
        headers: incomingHeaders,
        body: JSON.stringify(requestBody),
        verbose,
      });
    }
  };

  app.post(
    "/copilot-proxy/azure-openai/chat/completions",
    handleGitHubModelsChatCompletions,
  );
  app.post(
    "/github-models-proxy/inference/chat/completions",
    handleGitHubModelsChatCompletions,
  );

  const handleGitHubModelsCatalog = async (req: any, res: any) => {
    try {
      const clientApiKey = getFirstHeaderValue(req.headers["api-key"]);
      const clientAuthorization = getFirstHeaderValue(
        req.headers.authorization,
      );
      const serverApiKey =
        env.COPILOT_AZURE_OPENAI_API_KEY || env.API_KEY || undefined;

      const resolvedApiKey =
        clientApiKey ||
        extractBearerToken(clientAuthorization) ||
        serverApiKey ||
        "";

      if (!resolvedApiKey) {
        return res.status(401).json({ error: "Missing API key" });
      }

      if (verbose) {
        console.log("[Proxy] Fetching GitHub Models catalog...");
      }

      // Fetch from GitHub Models discovery endpoint
      const resp = await fetch("https://models.github.ai/catalog/models", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${resolvedApiKey}`,
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": DEFAULT_USER_AGENT,
        },
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error(`GitHub Models API error (${resp.status}):`, errBody);

        return res.status(resp.status).json({
          error: `Failed to fetch GitHub Models catalog: ${resp.statusText}`,
        });
      }

      const modelsData = await resp.json();

      // Transform array of model objects to include token limits
      // GitHub Models catalog returns objects with 'id', 'name', 'limits', etc.
      let models: any[] = [];
      if (Array.isArray(modelsData)) {
        models = modelsData.map((m) => ({
          id: m.id || m.name,
          name: m.name || m.friendly_name || m.id,
          context_length: m.limits?.max_input_tokens || 8000,
          max_completion_tokens: m.limits?.max_output_tokens || 4096,
          registry: m.registry,
          supports_tools: true,
        }));
      }

      const defaultModels = [
        {
          id: "openai/gpt-4o",
          name: "GPT-4o (Fallback)",
          context_length: 8000,
          max_completion_tokens: 4096,
          registry: "azure-openai",
          supports_tools: true,
        },
        {
          id: "openai/gpt-4o-mini",
          name: "GPT-4o mini (Fallback)",
          context_length: 8000,
          max_completion_tokens: 4096,
          registry: "azure-openai",
          supports_tools: true,
        },
        {
          id: "openai/o1",
          name: "o1 (Fallback)",
          context_length: 8000,
          max_completion_tokens: 4096,
          registry: "azure-openai",
          supports_tools: true,
        },
        {
          id: "openai/o1-mini",
          name: "o1-mini (Fallback)",
          context_length: 8000,
          max_completion_tokens: 4096,
          registry: "azure-openai",
          supports_tools: true,
        },
      ];

      // Only add fallback models if they were not already fetched from the API
      const fetchedIds = new Set(models.map((m) => m.id));
      const missingDefaults = defaultModels.filter(
        (m) => !fetchedIds.has(m.id),
      );

      models = [...models, ...missingDefaults];

      res.json({ models });
    } catch (err) {
      console.error("Copilot models discovery error:", err);
      // Fallback on error as well
      res.json({
        models: [
          {
            id: "openai/gpt-4o",
            name: "GPT-4o (Fallback)",
            context_length: 8000,
            max_completion_tokens: 4096,
            registry: "azure-openai",
          },
          {
            id: "openai/gpt-4o-mini",
            name: "GPT-4o mini (Fallback)",
            context_length: 8000,
            max_completion_tokens: 4096,
            registry: "azure-openai",
          },
        ],
      });
    }
  };

  // Backward-compatible legacy route + explicit GitHub Models route.
  app.get("/copilot-proxy/azure-openai/models", handleGitHubModelsCatalog);
  app.get("/github-models-proxy/catalog/models", handleGitHubModelsCatalog);

  // ---- Bedrock: list models ----
  app.get("/bedrock-proxy/models", async (req, res) => {
    try {
      const runtime = getBedrockRuntimeOptions(req);
      if (!runtime.region || !runtime.profile) {
        return res.status(400).json({
          error:
            "Bedrock is not configured. Set BEDROCK_REGION and BEDROCK_PROFILE environment variables or provide Bedrock fallback settings in the UI.",
        });
      }

      const client = new BedrockClient({
        region: runtime.region,
        credentials: createBedrockCredentials(runtime.profile),
      });

      // Fetch Foundation Models
      const fmResponse = await client.send(
        new ListFoundationModelsCommand({ byProvider: "Anthropic" }),
      );

      const models = (fmResponse.modelSummaries || [])
        .filter((m) => m.modelLifecycle?.status === "ACTIVE")
        .map((m) => ({ id: m.modelId, name: m.modelName }));

      // Fetch Inference Profiles (to support Cross-Region inference)
      try {
        const ipResponse = await client.send(
          new ListInferenceProfilesCommand({}),
        );
        const profiles = (ipResponse.inferenceProfileSummaries || [])
          .filter((p) => p.status === "ACTIVE")
          // Only show Anthropic-compatible profiles since our proxy format is 'anthropic'
          .filter(
            (p) =>
              p.inferenceProfileId?.includes("anthropic") ||
              p.inferenceProfileName?.toLowerCase().includes("anthropic"),
          )
          .map((p) => ({
            id: p.inferenceProfileId || "",
            name: `${p.inferenceProfileName || "Unnamed Profile"} (Profile)`,
          }));

        models.push(...profiles);
      } catch (ipErr) {
        console.warn(
          "Failed to list Bedrock inference profiles:",
          ipErr instanceof Error ? ipErr.message : String(ipErr),
        );
        // Non-fatal, proceed with just foundation models
      }

      res.json({ models });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Bedrock models discovery error:", message);
      res
        .status(502)
        .json({ error: `Failed to list Bedrock models: ${message}` });
    }
  });

  // ---- Bedrock: invoke model ----
  app.post("/bedrock-proxy/invoke", async (req, res) => {
    try {
      const runtime = getBedrockRuntimeOptions(req);
      if (!runtime.region || !runtime.profile) {
        return res.status(400).json({
          error:
            "Bedrock is not configured. Set BEDROCK_REGION and BEDROCK_PROFILE environment variables or provide Bedrock fallback settings in the UI.",
        });
      }

      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Missing request body" });
      }

      const rawModelId = body.model;
      if (
        typeof rawModelId !== "string" ||
        (!rawModelId.startsWith("anthropic.") &&
          !/^[a-z]{2}\.anthropic\./.test(rawModelId))
      ) {
        return res.status(400).json({
          error: `Invalid model ID: '${String(rawModelId || "")}'. Must be an Anthropic Bedrock model ID.`,
        });
      }

      const modelId = toInferenceProfileId(rawModelId, runtime.region);
      const wantsStreaming = body.stream === true;

      // Strip fields not accepted by Bedrock (model, stream)
      const { model: _model, stream: _stream, ...anthropicBody } = body;
      if (!anthropicBody.anthropic_version) {
        anthropicBody.anthropic_version = "bedrock-2023-05-31";
      }

      const client = new BedrockRuntimeClient({
        region: runtime.region,
        credentials: createBedrockCredentials(runtime.profile),
      });

      if (wantsStreaming) {
        // ---- Streaming path: InvokeModelWithResponseStream ----
        const command = new InvokeModelWithResponseStreamCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(anthropicBody),
        });

        const response = await client.send(command);

        // Set SSE headers
        res.status(200);
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.flushHeaders();

        if (response.body) {
          for await (const event of response.body) {
            const sse = bedrockEventToSSE(event);
            if (sse) {
              res.write(sse);
            }
          }
        }

        res.end();
      } else {
        // ---- Non-streaming path: InvokeModel (original behavior) ----
        const command = new InvokeModelCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(anthropicBody),
        });

        const response = await client.send(command);
        const responseBody = JSON.parse(
          new TextDecoder().decode(response.body),
        );

        res.json(responseBody);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Bedrock invoke error:", message);

      const status =
        message.includes("expired") || message.includes("credentials")
          ? 401
          : 502;

      if (!res.headersSent) {
        res
          .status(status)
          .json({ error: `Bedrock invocation failed: ${message}` });
      } else {
        // If we were already streaming, write an SSE error event and close
        res.write(
          `data: ${JSON.stringify({ type: "error", error: { type: "server_error", message } })}\n\n`,
        );
        res.end();
      }
    }
  });

  // ---- isomorphic-git proxy (stream-based) ----
  app.all(/^\/git-proxy\/(.*)/, async (req, res) => {
    const pathParams = req.params[0];
    const queryString =
      Object.keys(req.query).length > 0
        ? "?" + new URLSearchParams(req.query as any).toString()
        : "";

    const targetUrlString = "https://" + pathParams + queryString;

    const bodyBuffers: Buffer[] = [];
    for await (const chunk of req) {
      bodyBuffers.push(chunk);
    }

    const rawBody = Buffer.concat(bodyBuffers);

    await handleProxyRequest(req, res, {
      targetUrl: targetUrlString,
      method: req.method,
      headers: req.headers,
      body: rawBody.length > 0 ? rawBody : undefined,
      verbose,
      // Git smart-HTTP needs the client's Authorization header to reach the
      // upstream host (e.g. Azure DevOps, GitHub). Without this the upstream
      // returns an anonymous sign-in page and isomorphic-git hangs.
      forwardAuth: true,
    });
  });

  // ---- Ollama: list models ----
  app.get("/ollama-proxy/models", async (_req, res) => {
    try {
      const ollamaHost = env.OLLAMA_HOST || "http://localhost:11434";
      const targetUrl = `${ollamaHost}/api/tags`;
      const ollamaModelsTimeoutMs = parsePositiveInteger(
        env.OLLAMA_MODELS_TIMEOUT_MS,
        10_000,
      );
      const ollamaModelsRetries = parseNonNegativeInteger(
        env.OLLAMA_MODELS_MAX_RETRIES,
        1,
      );

      if (verbose) {
        console.log(`[Proxy] Fetching Ollama models from: ${targetUrl}`);
      }

      const response = await withRetry(
        () =>
          fetchWithTimeout(
            targetUrl,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
                "User-Agent": DEFAULT_USER_AGENT,
              },
            },
            ollamaModelsTimeoutMs,
          ),
        {
          maxRetries: ollamaModelsRetries,
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

      if (!response.ok) {
        throw new Error(
          `Ollama models endpoint returned ${response.status}: ${response.statusText}`,
        );
      }

      const data = await response.json();
      // For each model, call /api/show to get context_length and other metadata
      const models: any[] = [];
      for (const m of data.models || []) {
        const id = m.name || m.model;
        let context_length = 0;
        let max_output = null;
        let supports_tools: boolean | null = null;
        try {
          const showResp = await fetch(`${ollamaHost}/api/show`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": DEFAULT_USER_AGENT,
            },
            body: JSON.stringify({ name: id }),
          });
          if (showResp.ok) {
            const showData = await showResp.json();
            context_length = showData.context_length || 0;
            max_output = showData.max_output || null;
            const capabilities = showData.capabilities;
            if (Array.isArray(capabilities)) {
              supports_tools = capabilities.some((entry: any) =>
                String(entry || "")
                  .toLowerCase()
                  .includes("tool"),
              );
            } else if (typeof showData.supports_tools === "boolean") {
              supports_tools = showData.supports_tools;
            } else if (typeof showData.supportsTools === "boolean") {
              supports_tools = showData.supportsTools;
            }
          }
        } catch (e) {
          // ignore, fallback to 0
        }

        models.push({ id, context_length, max_output, supports_tools });
      }

      res.json({ data: models });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Ollama models discovery error:", message);
      res.status(502).json({
        error: `Failed to list Ollama models: ${message}. Make sure Ollama is running on ${env.OLLAMA_HOST || "http://localhost:11434"}.`,
      });
    }
  });

  // ---- Ollama: chat completions (with streaming support) ----
  app.post("/ollama-proxy/chat/completions", async (req, res) => {
    try {
      const ollamaHost = env.OLLAMA_HOST || "http://localhost:11434";
      const targetUrl = `${ollamaHost}/v1/chat/completions`;
      const ollamaRequestTimeoutMs = parsePositiveInteger(
        env.OLLAMA_REQUEST_TIMEOUT_MS,
        120_000,
      );
      const ollamaChatRetries = parseNonNegativeInteger(
        env.OLLAMA_CHAT_MAX_RETRIES,
        0,
      );

      const body = req.body;
      const hasLlamafileHint =
        !!getFirstHeaderValue(req.headers["x-llamafile-mode"]) ||
        !!getFirstHeaderValue(req.headers["x-llamafile-host"]) ||
        !!getFirstHeaderValue(req.headers["x-llamafile-port"]);

      if (hasLlamafileHint) {
        return res.status(409).json({
          error:
            "Request appears to be for Llamafile but was sent to /ollama-proxy/chat/completions. Verify selected provider and backend route wiring.",
        });
      }

      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Missing request body" });
      }

      if (typeof body.model !== "string" || !body.model) {
        return res.status(400).json({
          error: "Missing or invalid 'model' parameter.",
        });
      }

      if (verbose) {
        console.log(`[Proxy] Ollama request for model: ${body.model}`);
      }

      const wantsStreaming = body.stream === true;
      const invokeOllama = async (requestBody: Record<string, any>) =>
        withRetry(
          () =>
            fetchWithTimeout(
              targetUrl,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "User-Agent": DEFAULT_USER_AGENT,
                },
                body: JSON.stringify(requestBody),
              },
              ollamaRequestTimeoutMs,
            ),
          {
            maxRetries: ollamaChatRetries,
            shouldRetry: isRetryableHttpError,
            onRetry: (attempt, max, delay, error) => {
              if (verbose) {
                console.log(
                  `[Proxy] Ollama retry ${attempt}/${max} after ${delay}ms due to: ${error.message || error}`,
                );
              }
            },
          },
        );

      const tryOnceWithoutTools =
        requestHasTools(body) &&
        typeof body.model === "string" &&
        body.model.length > 0;

      if (wantsStreaming) {
        // ---- Streaming path with optional tools fallback ----
        let upstream = await invokeOllama(body);

        if (!upstream.ok) {
          const errBody = await upstream.text();
          if (tryOnceWithoutTools && ollamaDoesNotSupportTools(errBody)) {
            if (verbose) {
              console.warn(
                `[Proxy] Ollama model ${body.model} rejected tools; retrying without tools`,
              );
            }

            upstream = await invokeOllama(stripToolsFromRequest(body));
          } else {
            res.status(upstream.status);
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.json({ error: errBody });

            return;
          }
        }

        if (!upstream.ok) {
          const retryErr = await upstream.text();
          res.status(upstream.status);
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.json({ error: retryErr });

          return;
        }

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
      } else {
        // ---- Non-streaming path with optional tools fallback ----
        let upstream = await invokeOllama(body);

        if (!upstream.ok) {
          const errBody = await upstream.text();
          if (tryOnceWithoutTools && ollamaDoesNotSupportTools(errBody)) {
            if (verbose) {
              console.warn(
                `[Proxy] Ollama model ${body.model} rejected tools; retrying without tools`,
              );
            }

            upstream = await invokeOllama(stripToolsFromRequest(body));
          } else {
            res.status(upstream.status);
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.json({ error: errBody });

            return;
          }
        }

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
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Ollama invoke error:", message);

      if (!res.headersSent) {
        res.status(502).json({
          error: `Ollama invocation failed: ${message}. Make sure Ollama is running on ${env.OLLAMA_HOST || "http://localhost:11434"}.`,
        });
      } else {
        // If we were already streaming, write an SSE error event and close
        res.write(
          `data: ${JSON.stringify({ type: "error", error: { type: "server_error", message } })}\n\n`,
        );
        res.end();
      }
    }
  });

  // ---- Llamafile: list local binaries ----
  app.get("/llamafile-proxy/models", async (_req, res) => {
    try {
      const binaries = await listLlamafileBinaries();
      const models = binaries.map((entry) => ({
        id: entry.id,
        name: entry.id,
        file_name: entry.fileName,
        supports_tools: true,
      }));

      res.json({ data: models });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Llamafile models discovery error:", message);
      res.status(502).json({
        error: `Failed to list llamafile binaries: ${message}`,
      });
    }
  });

  // ---- Llamafile: chat completions (CLI or SERVER mode) ----
  app.post("/llamafile-proxy/chat/completions", async (req, res) => {
    try {
      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Missing request body" });
      }

      const runtime = getLlamafileRuntimeOptions(req);
      const model = typeof body.model === "string" ? body.model.trim() : "";

      if (verbose) {
        const headerMode = getFirstHeaderValue(req.headers["x-llamafile-mode"]);
        const bodyMode =
          body.llamafile && typeof body.llamafile === "object"
            ? String(body.llamafile.mode || "")
            : "";
        console.log(
          `[Proxy] Llamafile runtime: mode=${runtime.mode} model=${model || "<none>"} headerMode=${headerMode || "<none>"} bodyMode=${bodyMode || "<none>"}`,
        );
      }

      if (runtime.mode === "cli") {
        if (!model) {
          return res.status(400).json({
            error:
              "Missing or invalid 'model' parameter for CLI mode. Select a local *.llamafile model.",
          });
        }

        await invokeLlamafileCli(
          req,
          res,
          body,
          {
            model,
            offline: runtime.offline,
          },
          verbose,
        );

        return;
      }

      await invokeLlamafileServer(
        req,
        res,
        body,
        {
          host: runtime.host,
          port: runtime.port,
        },
        verbose,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : "";
      console.error("Llamafile invocation error:", message);
      if (stack && verbose) {
        console.error("Stack trace:", stack);
      }

      if (!res.headersSent) {
        res.status(502).json({
          error: `Llamafile invocation failed: ${message}`,
        });

        return;
      }

      res.write(
        `data: ${JSON.stringify({ error: { type: "server_error", message } })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });
}
