/**
 * Llamafile Manager Service
 *
 * Encapsulates the execution, streaming, and cancellation logic for Llamafile
 * models. Replaces module-level globals with a factory pattern.
 */

import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isIP } from "node:net";

import type { Request, Response as ExpressResponse } from "express";

import {
  getFirstHeaderValue,
  parseLooseToolCallInput,
  parseLooseFunctionCallArgs,
} from "../utils/proxy-helpers.js";

import {
  writeOpenAiDeltaChunk,
  writeOpenAiToolCallChunk,
  writeOpenAiDoneChunk,
} from "../utils/openai-sse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LLAMAFILE_EXTENSION = ".llamafile";

export const DEFAULT_LLAMAFILE_HOST = "127.0.0.1";
export const DEFAULT_LLAMAFILE_PORT = 8080;
export const DEFAULT_LLAMAFILE_CTX_SIZE = parseInt(
  process.env.LLAMAFILE_CTX_SIZE || "8192",
  10,
);

export const LLAMAFILE_REQUEST_ID_HEADER = "x-shadowclaw-request-id";

const LLAMAFILE_ALLOWED_LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

export type LlamafileMode = "server" | "cli";

export interface LlamafileManagerService {
  listBinaries(): Promise<
    Array<{ fileName: string; id: string; absolutePath: string }>
  >;
  resolveBinary(
    model: string,
  ): Promise<{ fileName: string; id: string; absolutePath: string }>;
  cancelRequest(requestId: string): boolean;
  getLlamafileRequestId(req: Request, body?: Record<string, any>): string;
  getLlamafileRuntimeOptions(req: Request): {
    mode: LlamafileMode;
    host: string;
    port: number;
    offline: boolean;
  };
  invokeCli(
    req: Request,
    res: ExpressResponse,
    body: Record<string, any>,
    opts: { model: string; offline: boolean },
    verbose: boolean,
  ): Promise<void>;

  // Test helpers
  __getOfflineSupportCache(): Map<string, boolean>;
  __getActiveRequests(): Map<string, () => void>;
}

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
  const allowNonLoopback = process.env.LLAMAFILE_ALLOW_NON_LOOPBACK === "true";

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

function sanitizeRequestBody(body: Record<string, any>): Record<string, any> {
  const next = { ...body };
  delete next.llamafile;

  return next;
}

function sanitizeCliPayload(body: Record<string, any>): Record<string, any> {
  const next = sanitizeRequestBody(body);
  delete next.stream;
  delete next.stream_options;

  return next;
}

function flattenMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const parts: string[] = [];
  for (const block of content) {
    if (typeof block === "string") {
      parts.push(block);

      continue;
    }

    if (!block || typeof block !== "object") {
      continue;
    }

    const typedBlock = block as Record<string, any>;
    if (typedBlock.type === "text" && typeof typedBlock.text === "string") {
      parts.push(typedBlock.text);

      continue;
    }

    if (
      typedBlock.type === "tool_result" &&
      typeof typedBlock.content === "string"
    ) {
      parts.push(typedBlock.content);

      continue;
    }

    if (typedBlock.type === "tool_use" && typedBlock.name) {
      const name = String(typedBlock.name);
      const input =
        typedBlock.input && typeof typedBlock.input === "object"
          ? JSON.stringify(typedBlock.input)
          : "{}";
      parts.push(`[tool_use:${name}] ${input}`);
    }
  }

  return parts.join("\n");
}

function buildCliPrompt(body: Record<string, any>): string {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return "";
  }

  const lines: string[] = [];
  for (const rawMessage of messages) {
    if (!rawMessage || typeof rawMessage !== "object") {
      continue;
    }

    const message = rawMessage as Record<string, any>;
    const role =
      typeof message.role === "string" && message.role.trim()
        ? message.role.trim().toUpperCase()
        : "USER";
    const text = flattenMessageContent(message.content).trim();
    if (!text) {
      continue;
    }

    lines.push(`${role}: ${text}`);
  }

  if (lines.length === 0) {
    return "";
  }

  lines.push("ASSISTANT:");

  return lines.join("\n\n");
}

export function createLlamafilePromptEchoFilter(prompt: string): {
  push: (chunk: string) => string;
  flush: () => string;
} {
  const normalizedPrompt = String(prompt || "")
    .replace(/\r\n/g, "\n")
    .trim();
  let pending = "";
  let decided = normalizedPrompt.length === 0;
  let strippedAssistantPrefix = false;

  const maybeStripAssistantPrefix = (text: string): string => {
    if (strippedAssistantPrefix || !text) {
      return text;
    }

    const stripped = text.replace(/^\s*ASSISTANT:\s*/i, "");
    if (stripped !== text) {
      strippedAssistantPrefix = true;
    }

    return stripped;
  };

  return {
    push(chunk: string): string {
      const normalizedChunk = String(chunk || "").replace(/\r\n/g, "\n");
      if (decided) {
        return maybeStripAssistantPrefix(normalizedChunk);
      }

      pending += normalizedChunk;
      const pendingTrimmed = pending.trimStart();

      if (
        normalizedPrompt.startsWith(pendingTrimmed) &&
        pendingTrimmed.length < normalizedPrompt.length
      ) {
        return "";
      }

      decided = true;
      let out = pending;
      const pendingLeadTrimmed = pending.trimStart();
      if (pendingLeadTrimmed.startsWith(normalizedPrompt)) {
        out = pendingLeadTrimmed.slice(normalizedPrompt.length);
      }

      pending = "";

      return maybeStripAssistantPrefix(out);
    },
    flush(): string {
      if (decided) {
        return "";
      }

      decided = true;
      const out = maybeStripAssistantPrefix(pending);
      pending = "";

      return out;
    },
  };
}

export function stripLlamafilePromptEcho(text: string, prompt: string): string {
  const filter = createLlamafilePromptEchoFilter(prompt);
  const cleaned = `${filter.push(text)}${filter.flush()}`;

  return cleaned.trim();
}

function parseTransformersToolCallText(
  text: string,
): { name: string; input: Record<string, any> } | null {
  const trimmed = text
    .replace(/<\s*turn\|>\s*|<\|end_of_turn\|>|<\|eot_id\|>/gi, "")
    .trim();
  const legacyMatch = trimmed.match(
    /^call\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\{([\s\S]*)\}\s*$/,
  );

  if (legacyMatch?.[1]) {
    const name = legacyMatch[1];
    const rawArgs = legacyMatch[2]?.trim() || "";
    const input = parseLooseToolCallInput(rawArgs);

    return { name, input };
  }

  const executeToolMatch = trimmed.match(
    /^<\s*execute_tool\s*>\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*<\s*\/\s*execute_tool\s*>\s*$/i,
  );
  if (executeToolMatch?.[1]) {
    const name = executeToolMatch[1];
    const rawArgs = executeToolMatch[2]?.trim() || "";
    const input = parseLooseFunctionCallArgs(rawArgs);

    return { name, input };
  }

  return null;
}

export function createLlamafileManagerService(): LlamafileManagerService {
  const activeRequests = new Map<string, () => void>();
  const offlineSupportCache = new Map<string, boolean>();

  async function listBinaries(): Promise<
    Array<{ fileName: string; id: string; absolutePath: string }>
  > {
    const candidateDirs = [
      path.resolve(__dirname, "../../../assets/cache/llamafile"),
      path.resolve(__dirname, "../../../../assets/cache/llamafile"),
      path.resolve(process.cwd(), "assets/cache/llamafile"),
    ];

    let resolvedDir = "";
    for (const dir of candidateDirs) {
      try {
        const info = await stat(dir);
        if (info.isDirectory()) {
          resolvedDir = dir;

          break;
        }
      } catch {}
    }

    if (!resolvedDir) {
      throw new Error(
        `Could not locate assets/cache/llamafile directory. Tried: ${candidateDirs.join(", ")}`,
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

  async function resolveBinary(
    model: string,
  ): Promise<{ fileName: string; id: string; absolutePath: string }> {
    const binaries = await listBinaries();
    const normalizedModel = model.trim();

    const match = binaries.find(
      (item) =>
        item.id === normalizedModel || item.fileName === normalizedModel,
    );
    if (!match) {
      throw new Error(
        `Model '${normalizedModel}' not found under assets/cache/llamafile (*.llamafile).`,
      );
    }

    return match;
  }

  function getLlamafileRequestId(
    req: Request,
    body?: Record<string, any>,
  ): string {
    const headerValue = getFirstHeaderValue(
      req.headers[LLAMAFILE_REQUEST_ID_HEADER],
    ).trim();
    if (headerValue) {
      return headerValue;
    }

    if (typeof body?.requestId === "string") {
      return body.requestId.trim();
    }

    return "";
  }

  function registerCancellation(
    requestId: string,
    cancel: () => void,
  ): () => void {
    if (!requestId) {
      return () => {};
    }

    activeRequests.set(requestId, cancel);

    return () => {
      if (activeRequests.get(requestId) === cancel) {
        activeRequests.delete(requestId);
      }
    };
  }

  function isEnoexecError(error: unknown): boolean {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as any).code ?? "")
        : "";
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as any).message ?? "")
        : String(error ?? "");

    return code === "ENOEXEC" || message.includes("ENOEXEC");
  }

  async function spawnProcess(
    absolutePath: string,
    args: string[],
    opts: { cwd: string; env: NodeJS.ProcessEnv; detached: boolean },
    verbose: boolean,
  ): Promise<ReturnType<typeof spawn>> {
    const spawnForLlamafile = (useShellFallback: boolean) => {
      if (useShellFallback) {
        if (verbose) {
          console.log(
            `[Proxy] Shell fallback: /bin/sh -c 'exec "\$0" "\$@"' ${absolutePath} [${args.length} args]`,
          );
        }

        return spawn(
          "/bin/sh",
          ["-c", 'exec "$0" "$@"', absolutePath, ...args],
          {
            cwd: opts.cwd,
            env: opts.env,
            stdio: ["ignore", "pipe", "pipe"],
            detached: opts.detached,
          },
        );
      }

      return spawn(absolutePath, args, {
        cwd: opts.cwd,
        env: opts.env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: opts.detached,
      });
    };

    const waitForSpawnOrError = async (
      child: ReturnType<typeof spawn>,
    ): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const onSpawn = () => {
          child.off("error", onError);
          resolve();
        };
        const onError = (error: unknown) => {
          child.off("spawn", onSpawn);
          reject(error);
        };
        child.once("spawn", onSpawn);
        child.once("error", onError);
      });
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawnForLlamafile(false);
      await waitForSpawnOrError(child);

      return child;
    } catch (error) {
      if (process.platform === "win32" || !isEnoexecError(error)) {
        throw error;
      }

      if (verbose) {
        console.warn(
          `[Proxy] Direct exec failed with ENOEXEC for ${path.basename(absolutePath)}. Retrying via /bin/sh.`,
        );
      }

      child = spawnForLlamafile(true);
      await waitForSpawnOrError(child);

      return child;
    }
  }

  async function supportsOfflineFlag(
    absolutePath: string,
    verbose: boolean,
  ): Promise<boolean> {
    const cached = offlineSupportCache.get(absolutePath);
    if (typeof cached === "boolean") {
      return cached;
    }

    try {
      const child = await spawnProcess(
        absolutePath,
        ["--help"],
        {
          cwd: path.dirname(absolutePath),
          env: { ...process.env },
          detached: false,
        },
        false,
      );
      let output = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf8");
      });

      await new Promise<void>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", () => resolve());
      });

      const supports = /(^|\s)--offline(\s|[,.)]|$)/m.test(output);
      if (offlineSupportCache.size >= 100) {
        offlineSupportCache.clear();
      }

      offlineSupportCache.set(absolutePath, supports);

      return supports;
    } catch (error) {
      if (verbose) {
        const details = error instanceof Error ? error.message : String(error);
        console.warn(
          `[Proxy] Could not probe --offline support for ${path.basename(absolutePath)}: ${details}. Continuing without --offline.`,
        );
      }

      if (offlineSupportCache.size >= 100) {
        offlineSupportCache.clear();
      }

      offlineSupportCache.set(absolutePath, false);

      return false;
    }
  }

  return {
    listBinaries,
    resolveBinary,

    getLlamafileRequestId,

    cancelRequest(requestId: string): boolean {
      const cancel = activeRequests.get(requestId);
      if (!cancel) {
        return false;
      }

      cancel();

      return true;
    },

    getLlamafileRuntimeOptions(req: Request) {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const optionsFromBody =
        body.llamafile && typeof body.llamafile === "object"
          ? body.llamafile
          : {};

      const headerMode = getFirstHeaderValue(req.headers["x-llamafile-mode"]);
      const bodyMode =
        typeof optionsFromBody.mode === "string"
          ? optionsFromBody.mode.trim()
          : "";
      const model = typeof body.model === "string" ? body.model.trim() : "";

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
    },

    async invokeCli(
      req: Request,
      res: ExpressResponse,
      body: Record<string, any>,
      opts: { model: string; offline: boolean },
      verbose: boolean,
    ) {
      const { absolutePath } = await resolveBinary(opts.model);
      const requestId = getLlamafileRequestId(req, body);

      try {
        await access(absolutePath, fsConstants.X_OK);
      } catch (err) {
        const details = err instanceof Error ? err.message : String(err);
        const fullMessage = `Binary not executable or not found: ${absolutePath} (${details})`;

        throw new Error(fullMessage);
      }

      const wantsStreaming = body.stream === true;
      const requestPayload = sanitizeCliPayload(body);
      const prompt = buildCliPrompt(requestPayload);
      if (!prompt) {
        throw new Error(
          "Llamafile CLI requires at least one text message in request payload.",
        );
      }

      const maxTokensRaw =
        typeof body.max_tokens === "number" && Number.isFinite(body.max_tokens)
          ? Math.floor(body.max_tokens)
          : 512;
      const nPredict = Math.max(1, maxTokensRaw);

      const args = [
        "--n-predict",
        String(nPredict),
        "--ctx-size",
        String(DEFAULT_LLAMAFILE_CTX_SIZE),
        "--cli",
        "-p",
        prompt,
      ];
      const useOfflineFlag =
        opts.offline && (await supportsOfflineFlag(absolutePath, verbose));
      if (useOfflineFlag) {
        args.unshift("--offline");
      } else if (opts.offline && verbose) {
        console.log(
          `[Proxy] Skipping unsupported --offline flag for ${path.basename(absolutePath)}.`,
        );
      }

      let child: ReturnType<typeof spawn>;
      const runDetached = process.platform !== "win32";
      try {
        child = await spawnProcess(
          absolutePath,
          args,
          {
            cwd: path.dirname(absolutePath),
            env: { ...process.env },
            detached: runDetached,
          },
          verbose,
        );
      } catch (err) {
        throw new Error(
          `Failed to spawn llamafile: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (!child.stdout || !child.stderr) {
        throw new Error("Failed to setup child process streams");
      }

      let stderr = "";
      let fullStdout = "";
      let filteredStdout = "";
      let hasError = false;
      let requestClosed = false;
      let forceKillTimer: ReturnType<typeof setTimeout> | null = null;
      const promptEchoFilter = createLlamafilePromptEchoFilter(prompt);

      const clearForceKillTimer = () => {
        if (forceKillTimer) {
          clearTimeout(forceKillTimer);
          forceKillTimer = null;
        }
      };

      const killChild = (signal: NodeJS.Signals) => {
        if (
          child.exitCode !== null ||
          child.signalCode !== null ||
          child.killed
        ) {
          return;
        }

        if (process.platform === "win32") {
          if (typeof child.pid !== "number") {
            return;
          }

          const killer = spawn(
            "taskkill",
            ["/PID", String(child.pid), "/T", "/F"],
            { stdio: "ignore", windowsHide: true },
          );
          killer.unref();

          return;
        }

        try {
          if (runDetached && typeof child.pid === "number") {
            process.kill(-child.pid, signal);
          } else {
            child.kill(signal);
          }
        } catch {}
      };

      const terminateChild = () => {
        if (
          child.exitCode !== null ||
          child.signalCode !== null ||
          child.killed
        ) {
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
        req.socket.off("close", onClientDisconnected);
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
      req.socket.once("close", onClientDisconnected);
      res.once("close", onClientDisconnected);

      const unregisterCancellation = registerCancellation(
        requestId,
        onClientDisconnected,
      );

      return new Promise<void>((resolve, _reject) => {
        if (wantsStreaming) {
          res.status(200);
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.flushHeaders();

          child.stdout!.on("data", (chunk: Buffer) => {
            if (requestClosed || res.writableEnded) {
              return;
            }

            const text = chunk.toString("utf8");
            fullStdout += text;
            const filteredText = promptEchoFilter.push(text);
            if (filteredText && !requestClosed && !res.writableEnded) {
              writeOpenAiDeltaChunk(res, opts.model, filteredText);
            }

            filteredStdout += filteredText;
          });

          child.stderr!.on("data", (chunk: Buffer) => {
            stderr += chunk.toString("utf8");
          });

          child.on("close", (code) => {
            cleanupCancellationListeners();
            unregisterCancellation();
            clearForceKillTimer();

            if (requestClosed || hasError) {
              resolve();

              return;
            }

            if (code !== 0) {
              const message =
                stderr.trim() || `llamafile exited with status ${code}`;
              res.write(
                `data: ${JSON.stringify({ error: { type: "server_error", message } })}\n\n`,
              );
              res.write("data: [DONE]\n\n");
              res.end();
              resolve();

              return;
            }

            const trailingText = promptEchoFilter.flush();
            filteredStdout += trailingText;
            const toolCall = parseTransformersToolCallText(
              filteredStdout.trim(),
            );
            if (toolCall) {
              writeOpenAiToolCallChunk(res, opts.model, toolCall);
              writeOpenAiDoneChunk(res, opts.model, "tool_calls");
              res.end();
              resolve();

              return;
            }

            if (trailingText && !requestClosed && !res.writableEnded) {
              writeOpenAiDeltaChunk(res, opts.model, trailingText);
            }

            writeOpenAiDoneChunk(res, opts.model);
            res.end();
            resolve();
          });

          child.on("error", (error) => {
            hasError = true;
            cleanupCancellationListeners();
            unregisterCancellation();
            clearForceKillTimer();
            if (requestClosed) {
              resolve();

              return;
            }

            const fullMessage = `Child process error: ${error instanceof Error ? error.message : String(error)}`;
            if (!res.headersSent) {
              res
                .status(500)
                .json({ error: `Failed to execute llamafile: ${fullMessage}` });
              resolve();

              return;
            }

            res.write(
              `data: ${JSON.stringify({ error: { type: "server_error", message: fullMessage } })}\n\n`,
            );
            res.write("data: [DONE]\n\n");
            res.end();
            resolve();
          });

          return;
        }

        // Non-streaming
        child.stdout!.on("data", (chunk: Buffer) => {
          fullStdout += chunk.toString("utf8");
          filteredStdout += promptEchoFilter.push(chunk.toString("utf8"));
        });
        child.stderr!.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });

        child.on("close", (code) => {
          cleanupCancellationListeners();
          unregisterCancellation();
          clearForceKillTimer();

          if (requestClosed) {
            resolve();

            return;
          }

          if (code !== 0) {
            const message =
              stderr.trim() || `llamafile exited with status ${code}`;
            res.status(500).json({ error: message });
            resolve();

            return;
          }

          filteredStdout += promptEchoFilter.flush();
          const text = filteredStdout.trim();
          const toolCall = parseTransformersToolCallText(text);

          res.json({
            id: `chatcmpl-llamafile-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: opts.model,
            choices: [
              {
                index: 0,
                message: toolCall
                  ? {
                      role: "assistant",
                      content: null,
                      tool_calls: [
                        {
                          id: `call_${Date.now()}_${Math.random()}`,
                          type: "function",
                          function: {
                            name: toolCall.name,
                            arguments: JSON.stringify(toolCall.input || {}),
                          },
                        },
                      ],
                    }
                  : { role: "assistant", content: text || "(no response)" },
                finish_reason: toolCall ? "tool_calls" : "stop",
              },
            ],
          });
          resolve();
        });

        child.on("error", (error) => {
          hasError = true;
          cleanupCancellationListeners();
          unregisterCancellation();
          clearForceKillTimer();
          if (requestClosed) {
            resolve();

            return;
          }

          res.status(500).json({
            error: `Child process error: ${error instanceof Error ? error.message : String(error)}`,
          });
          resolve();
        });
      });
    },

    __getOfflineSupportCache() {
      return offlineSupportCache;
    },
    __getActiveRequests() {
      return activeRequests;
    },
  };
}

export async function invokeLlamafileServer(
  _req: Request,
  res: ExpressResponse,
  body: Record<string, any>,
  opts: { host: string; port: number },
  verbose: boolean,
) {
  const upstreamUrl = `http://${opts.host}:${opts.port}/v1/chat/completions`;
  const upstreamBody = sanitizeRequestBody(body);
  delete upstreamBody.model;

  if (verbose) {
    console.log(
      `[Proxy] Forwarding chat completion to llamafile server at ${upstreamUrl}`,
    );
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": process.env.SHADOWCLAW_USER_AGENT || "ShadowClaw/1.0",
      },
      body: JSON.stringify(upstreamBody),
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (
        [
          "content-encoding",
          "transfer-encoding",
          "content-length",
          "connection",
        ].includes(key.toLowerCase())
      ) {
        return;
      }

      res.setHeader(key, value);
    });
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!upstream.ok) {
      const errBody = await upstream.text();
      res.send(errBody);

      return;
    }

    if (body.stream === true && upstream.body) {
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
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({
        error: `Llamafile server invocation failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } else {
      res.write(
        `data: ${JSON.stringify({ error: { type: "server_error", message: String(err) } })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
}
