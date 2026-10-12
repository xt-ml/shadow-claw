/**
 * Llamafile Manager Service
 *
 * Encapsulates the execution, streaming, and cancellation logic for Llamafile
 * models. Replaces module-level globals with a factory pattern.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { constants as fsConstants } from "node:fs";
import { access, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isIP } from "node:net";

import type { Request, Response as ExpressResponse } from "express";

import { getFirstHeaderValue } from "../utils/proxy-helpers.js";

import {
  writeOpenAiDeltaChunk,
  writeOpenAiToolCallChunk,
  writeOpenAiDoneChunk,
} from "../utils/openai-sse.js";
import {
  parseLocalModelToolCalls,
  createToolCallStreamFilter,
  convertToolSchemasToOpenAI,
} from "../../subsystems/providers/utils/parseLocalModelToolCall.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
export const LLAMAFILE_EXTENSION = ".llamafile";

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

export type LocalBinaryKind = "llamafile" | "agentfile";

export interface LocalBinaryDriver {
  kind: LocalBinaryKind;
  extension: string;
  defaultSubdir: string;
  builtInTools: any[];
  buildArgs?: (options: {
    prompt: string;
    nPredict?: number;
    ctxSize?: number;
    tools?: any[];
    offline?: boolean;
    modelPath?: string;
    runtimeOptions?: Record<string, any>;
  }) => string[];
  buildCliArgs?: (options: {
    modelPath?: string;
    prompt: string;
    nPredict?: number;
    ctxSize?: number;
    offline?: boolean;
    tools?: any[];
    runtimeOptions?: Record<string, any>;
  }) => string[];
  supportsOfflineFlag?: (
    absolutePath: string,
    verbose?: boolean,
  ) => Promise<boolean>;
}

export const LLAMAFILE_BUILTIN_TOOLS = [
  {
    type: "function",
    name: "read_file",
    description: "Read all or part of a file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "The path to the file to read." },
        offset: {
          type: "integer",
          description: "Byte offset to start reading from.",
        },
        length: { type: "integer", description: "Number of bytes to read." },
      },
      required: ["path"],
    },
  },
  {
    type: "function",
    name: "file_glob_search",
    description: "Find files whose paths match a glob.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern to search for.",
        },
        directory: {
          type: "string",
          description: "Directory to search within.",
        },
      },
      required: ["pattern"],
    },
  },
  {
    type: "function",
    name: "grep_search",
    description: "Search files for matching text.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Regular expression or text pattern.",
        },
        directory: {
          type: "string",
          description: "Directory to search within.",
        },
      },
      required: ["pattern"],
    },
  },
  {
    type: "function",
    name: "exec_shell_command",
    description: "Run a host shell command.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command line to execute.",
        },
      },
      required: ["command"],
    },
  },
  {
    type: "function",
    name: "write_file",
    description: "Create or replace a file.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path to the file to write.",
        },
        content: {
          type: "string",
          description: "The content to write to the file.",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    type: "function",
    name: "edit_file",
    description: "Replace selected text in an existing file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "The path to the file to edit." },
        target: { type: "string", description: "Existing text to replace." },
        replacement: { type: "string", description: "Replacement text." },
      },
      required: ["path", "target", "replacement"],
    },
  },
  {
    type: "function",
    name: "get_datetime",
    description: "Get the server's current date and time.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    type: "function",
    name: "get_info",
    description: "Get the runtime operating system and working directory.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

export const AGENTFILE_BUILTIN_TOOLS = [
  ...LLAMAFILE_BUILTIN_TOOLS,
  {
    type: "function",
    name: "http_fetch",
    description: "GET a URL (http/https).",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch." },
      },
      required: ["url"],
    },
  },
  {
    type: "function",
    name: "web_search",
    description: "Search the web via SearXNG.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
      },
      required: ["query"],
    },
  },
];

const binaryDrivers = new Map<string, LocalBinaryDriver>();

export function registerBinaryDriver(driver: LocalBinaryDriver): void {
  binaryDrivers.set(driver.kind, driver);
  binaryDrivers.set(driver.extension.toLowerCase(), driver);
}

export function getBinaryDriver(
  kindOrExtension: string,
): LocalBinaryDriver | undefined {
  const normalized = kindOrExtension.trim().toLowerCase();
  return binaryDrivers.get(normalized);
}

export function resolveBinaryDriver(
  modelOrPath: string,
): LocalBinaryDriver | undefined {
  const normalized = modelOrPath.trim().toLowerCase();
  for (const driver of binaryDrivers.values()) {
    if (
      normalized.endsWith(driver.extension.toLowerCase()) ||
      normalized.includes(driver.kind)
    ) {
      return driver;
    }
  }
  return binaryDrivers.get("llamafile");
}

export function getBuiltinTools(kind: LocalBinaryKind = "llamafile"): any[] {
  const driver = getBinaryDriver(kind);
  return driver ? driver.builtInTools : LLAMAFILE_BUILTIN_TOOLS;
}

export function buildLlamafileArgs(options: {
  prompt: string;
  nPredict?: number;
  ctxSize?: number;
  offline?: boolean;
}): string[] {
  const nPredict = options.nPredict ?? 512;
  const ctxSize = options.ctxSize ?? DEFAULT_LLAMAFILE_CTX_SIZE;
  const args = [
    "--n-predict",
    String(nPredict),
    "--ctx-size",
    String(ctxSize),
    "--cli",
    "-p",
    options.prompt,
  ];
  if (options.offline) {
    args.unshift("--offline");
  }
  return args;
}

export function buildAgentfileArgs(options: {
  prompt: string;
  nPredict?: number;
  ctxSize?: number;
  tools?: any[];
  offline?: boolean;
  modelPath?: string;
  runtimeOptions?: Record<string, any>;
}): string[] {
  const {
    prompt,
    ctxSize = 65536,
    tools,
    modelPath,
    runtimeOptions = {},
  } = options;

  const args: string[] = [];

  if (modelPath) {
    args.push("-m", modelPath);
  }

  const systemPrompt =
    runtimeOptions.systemPrompt ||
    runtimeOptions.system_prompt ||
    runtimeOptions.systemPromptFile;
  if (systemPrompt) {
    args.push("-s", systemPrompt);
  }

  args.push("-p", prompt);
  args.push("-c", String(ctxSize));

  if (tools !== undefined) {
    if (Array.isArray(tools)) {
      if (tools.length === 0) {
        args.push("--tools", "none");
      } else {
        const toolNames = tools
          .map((t) => (typeof t === "string" ? t : t.name || t.function?.name))
          .filter(Boolean)
          .join(",");
        args.push("--tools", toolNames || "all");
      }
    } else if (typeof tools === "string") {
      args.push("--tools", tools);
    }
  } else if (runtimeOptions.tools) {
    args.push("--tools", String(runtimeOptions.tools));
  } else {
    args.push("--tools", "all");
  }

  const confirm =
    runtimeOptions.confirm === true || runtimeOptions.yes === false;
  if (confirm) {
    args.push("--confirm");
  } else {
    args.push("--yes");
  }

  const toolsRuntime =
    runtimeOptions.toolsRuntime || runtimeOptions.tools_runtime;
  if (toolsRuntime) {
    args.push("--tools-runtime", String(toolsRuntime));
  }

  const searxngUrl =
    runtimeOptions.searxngUrl ||
    runtimeOptions.searxng_url ||
    process.env.SEARXNG_URL;
  if (searxngUrl) {
    args.push("--searxng-url", String(searxngUrl));
  }

  const sessionFile =
    runtimeOptions.sessionFile ||
    runtimeOptions.session_file ||
    runtimeOptions.session;
  if (sessionFile) {
    args.push("--session", String(sessionFile));
  }

  const traceFile =
    runtimeOptions.traceFile ||
    runtimeOptions.trace_file ||
    runtimeOptions.trace;
  if (traceFile) {
    args.push("--trace", String(traceFile));
  }

  const maxIterations =
    runtimeOptions.maxIterations ?? runtimeOptions.max_iterations;
  if (maxIterations !== undefined && maxIterations !== null) {
    args.push("--max-iterations", String(maxIterations));
  }

  if (runtimeOptions.think === true) {
    args.push("--think");
  }

  return args;
}

registerBinaryDriver({
  kind: "llamafile",
  extension: ".llamafile",
  defaultSubdir: "llamafile",
  builtInTools: LLAMAFILE_BUILTIN_TOOLS,
  buildArgs: (options) =>
    buildLlamafileArgs({
      prompt: options.prompt,
      nPredict: options.nPredict,
      ctxSize: options.ctxSize,
      offline: options.offline,
    }),
  buildCliArgs: (options) =>
    buildLlamafileArgs({
      prompt: options.prompt,
      nPredict: options.nPredict,
      ctxSize: options.ctxSize,
      offline: options.offline,
    }),
});

registerBinaryDriver({
  kind: "agentfile",
  extension: ".agentfile",
  defaultSubdir: "agentfile",
  builtInTools: AGENTFILE_BUILTIN_TOOLS,
  buildArgs: (options) => buildAgentfileArgs(options),
  buildCliArgs: (options) => buildAgentfileArgs(options),
});

export interface TrackedLlamafileProcess {
  child: ReturnType<typeof spawn>;
  runDetached: boolean;
  killSync: () => void;
}

const allActiveLlamafileProcesses = new Set<TrackedLlamafileProcess>();

export function killChildProcessSync(
  child: ReturnType<typeof spawn>,
  runDetached: boolean,
): void {
  if (child.exitCode !== null || child.signalCode !== null || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    if (typeof child.pid === "number") {
      try {
        const cp = require("node:child_process");
        if (typeof cp.execFileSync === "function") {
          cp.execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
            stdio: "ignore",
            windowsHide: true,
          });
        }
      } catch {}
    }
    return;
  }

  try {
    if (typeof child.pid === "number") {
      if (runDetached) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
      }
      try {
        process.kill(child.pid, "SIGKILL");
      } catch {}
    }
  } catch {}
}

export function cleanupAllLlamafileProcesses(): void {
  for (const item of allActiveLlamafileProcesses) {
    try {
      item.killSync();
    } catch {}
  }
  allActiveLlamafileProcesses.clear();
}

let processListenersInstalled = false;

export function ensureLlamafileProcessExitHandlers(): void {
  if (processListenersInstalled) {
    return;
  }
  processListenersInstalled = true;

  process.on("exit", () => {
    cleanupAllLlamafileProcesses();
  });
  process.on("SIGINT", () => {
    cleanupAllLlamafileProcesses();
  });
  process.on("SIGTERM", () => {
    cleanupAllLlamafileProcesses();
  });
  if (process.platform !== "win32") {
    process.on("SIGHUP", () => {
      cleanupAllLlamafileProcesses();
    });
  }
}

// Automatically ensure exit handlers are installed upon module import
ensureLlamafileProcessExitHandlers();

export interface LlamafileManagerService {
  listBinaries(
    filterKind?: LocalBinaryKind,
  ): Promise<
    Array<{ fileName: string; id: string; absolutePath: string; kind?: string }>
  >;
  resolveBinary(model: string): Promise<{
    fileName: string;
    id: string;
    absolutePath: string;
    kind?: string;
  }>;
  listTools(options?: {
    mode?: LlamafileMode;
    host?: string;
    port?: number;
  }): Promise<any[]>;
  executeTool(
    name: string,
    args: Record<string, any>,
    options?: {
      mode?: LlamafileMode;
      host?: string;
      port?: number;
    },
  ): Promise<any>;
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
  terminateAll(): void;

  // Test helpers
  __getOfflineSupportCache(): Map<string, boolean>;
  __getActiveRequests(): Map<string, () => void>;
  __getActiveProcesses(): Set<TrackedLlamafileProcess>;
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

export function buildCliPrompt(body: Record<string, any>): string {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return "";
  }

  const lines: string[] = [];

  const rawTools = Array.isArray(body.tools) ? body.tools : [];
  if (rawTools.length > 0) {
    const openAITools = convertToolSchemasToOpenAI(rawTools);
    const toolDescriptions = openAITools
      .map((t) => {
        const fn = t.function || t;
        const name = fn.name || t.name;
        const desc = fn.description || t.description || "";
        const paramsStr = fn.parameters ? JSON.stringify(fn.parameters) : "{}";
        return `- ${name}: ${desc}\n  Parameters: ${paramsStr}`;
      })
      .join("\n\n");

    const toolsPrompt = [
      "# Tools",
      "",
      "You have access to the following tools:",
      "",
      toolDescriptions,
      "",
      "To use a tool, respond with:",
      "call:<tool_name>{<param>:<value>}",
      "or",
      "<tool_call>",
      '{"name": "<tool_name>", "arguments": { ... }}',
      "</tool_call>",
    ].join("\n");

    lines.push(`SYSTEM: ${toolsPrompt}`);
  }

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

export function createLlamafileManagerService(): LlamafileManagerService {
  const activeRequests = new Map<string, () => void>();
  const offlineSupportCache = new Map<string, boolean>();

  function registerTrackedProcess(
    child: ReturnType<typeof spawn>,
    runDetached: boolean,
  ): () => void {
    const item: TrackedLlamafileProcess = {
      child,
      runDetached,
      killSync: () => killChildProcessSync(child, runDetached),
    };
    allActiveLlamafileProcesses.add(item);
    const unregister = () => {
      allActiveLlamafileProcesses.delete(item);
    };
    child.once("close", unregister);
    child.once("error", unregister);
    child.once("exit", unregister);

    return unregister;
  }

  async function listBinaries(
    filterKind?: LocalBinaryKind,
  ): Promise<
    Array<{ fileName: string; id: string; absolutePath: string; kind?: string }>
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
      .filter((entry) => {
        if (!entry.isFile()) return false;
        return (
          entry.name.endsWith(LLAMAFILE_EXTENSION) ||
          entry.name.endsWith(".agentfile")
        );
      })
      .map((entry) => {
        const fileName = entry.name;
        const driver = resolveBinaryDriver(fileName);
        const ext = driver?.extension ?? LLAMAFILE_EXTENSION;
        const id = fileName.endsWith(ext)
          ? fileName.slice(0, -ext.length)
          : fileName;

        return {
          fileName,
          id,
          kind: driver?.kind ?? "llamafile",
          absolutePath: path.resolve(resolvedDir, fileName),
        };
      })
      .filter((entry) => {
        if (filterKind && entry.kind !== filterKind) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.fileName.localeCompare(b.fileName));
  }

  async function resolveBinary(model: string): Promise<{
    fileName: string;
    id: string;
    absolutePath: string;
    kind?: string;
  }> {
    const binaries = await listBinaries();
    const normalizedModel = model.trim();

    const directMatch = binaries.find(
      (entry) =>
        entry.id === normalizedModel ||
        entry.fileName === normalizedModel ||
        entry.absolutePath === normalizedModel,
    );

    if (directMatch) {
      return directMatch;
    }

    const baseName = path.basename(normalizedModel);
    const driver = resolveBinaryDriver(baseName);
    const ext = driver?.extension ?? LLAMAFILE_EXTENSION;
    const idWithoutExt = baseName.endsWith(ext)
      ? baseName.slice(0, -ext.length)
      : baseName;

    const match = binaries.find(
      (item) =>
        item.id === normalizedModel ||
        item.fileName === normalizedModel ||
        item.fileName === baseName ||
        item.id === idWithoutExt ||
        item.fileName === `${idWithoutExt}${ext}`,
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

    if (typeof body?.requestId === "string" && body.requestId.trim()) {
      return body.requestId.trim();
    }

    const bodyRequestId =
      body?.llamafile && typeof body.llamafile === "object"
        ? String(body.llamafile.requestId || "").trim()
        : "";
    if (bodyRequestId) {
      return bodyRequestId;
    }

    return (
      getFirstHeaderValue(req.headers["x-request-id"]).trim() ||
      `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    );
  }

  function registerCancellation(
    requestId: string,
    cancel: () => void,
  ): () => void {
    activeRequests.set(requestId, cancel);

    return () => {
      if (activeRequests.get(requestId) === cancel) {
        activeRequests.delete(requestId);
      }
    };
  }

  function cancelRequest(requestId: string): boolean {
    const cancel = activeRequests.get(requestId);
    if (!cancel) {
      return false;
    }

    activeRequests.delete(requestId);
    cancel();

    return true;
  }

  function getLlamafileRuntimeOptions(req: Request): {
    mode: LlamafileMode;
    host: string;
    port: number;
    offline: boolean;
  } {
    const headerMode = req.headers["x-llamafile-mode"];
    const headerHost = req.headers["x-llamafile-host"];
    const headerPort = req.headers["x-llamafile-port"];
    const headerOffline = req.headers["x-llamafile-offline"];

    const bodyLlamafile =
      req.body &&
      typeof req.body === "object" &&
      req.body.llamafile &&
      typeof req.body.llamafile === "object"
        ? req.body.llamafile
        : {};

    const mode = parseLlamafileMode(bodyLlamafile.mode ?? headerMode);
    const host = normalizeLlamafileHost(bodyLlamafile.host ?? headerHost);
    const port = normalizeLlamafilePort(bodyLlamafile.port ?? headerPort);
    const offline = normalizeLlamafileOffline(
      bodyLlamafile.offline ?? headerOffline,
    );

    return { mode, host, port, offline };
  }

  function isEnoexecError(error: unknown): boolean {
    const code =
      error && typeof error === "object"
        ? String((error as any).code ?? "")
        : "";
    const message =
      error && typeof error === "object"
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
            `[Proxy] Shell script mode: /bin/sh ${absolutePath} [${args.length} args]`,
          );
        }

        // Run the APE llamafile as a shell script. A plain exec (even via
        // `sh -c exec`) can be intercepted by binfmt_misc/run-detectors,
        // which fails with "unable to find an interpreter".
        return spawn("/bin/sh", [absolutePath, ...args], {
          cwd: opts.cwd,
          env: opts.env,
          stdio: ["ignore", "pipe", "pipe"],
          detached: opts.detached,
        });
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

    // On POSIX, always launch via sh script mode (see above).
    if (process.platform !== "win32") {
      child = spawnForLlamafile(true);
      await waitForSpawnOrError(child);

      return child;
    }

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
      const runDetached = process.platform !== "win32";
      const child = await spawnProcess(
        absolutePath,
        ["--help"],
        {
          cwd: path.dirname(absolutePath),
          env: { ...process.env },
          detached: runDetached,
        },
        false,
      );
      registerTrackedProcess(child, runDetached);
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
    cancelRequest,
    getLlamafileRuntimeOptions,

    async invokeCli(
      req: Request,
      res: ExpressResponse,
      body: Record<string, any>,
      opts: { model: string; offline: boolean },
      verbose: boolean,
    ) {
      if (
        (req as any).destroyed ||
        (req as any).aborted ||
        req.socket?.destroyed
      ) {
        throw new Error("Request already closed or aborted");
      }

      const binary = await resolveBinary(opts.model);
      const absolutePath = binary.absolutePath;
      const driver = resolveBinaryDriver(binary.fileName);
      const isAgentfile =
        binary.kind === "agentfile" || driver?.kind === "agentfile";
      const requestId = getLlamafileRequestId(req, body);

      try {
        await access(absolutePath, fsConstants.X_OK);
      } catch (err) {
        const details = err instanceof Error ? err.message : String(err);
        const fullMessage = `Binary not executable or not found: ${absolutePath} (${details})`;

        throw new Error(fullMessage);
      }

      if (
        (req as any).destroyed ||
        (req as any).aborted ||
        req.socket?.destroyed
      ) {
        throw new Error("Request already closed or aborted");
      }

      const wantsStreaming = body.stream === true;
      const requestPayload = sanitizeCliPayload(body);
      const prompt = buildCliPrompt(requestPayload);
      if (!prompt) {
        throw new Error(
          "Llamafile CLI requires at least one text message in request payload.",
        );
      }

      let args: string[];
      if (isAgentfile) {
        const ctxSizeRaw =
          typeof body.ctx_size === "number" && Number.isFinite(body.ctx_size)
            ? Math.floor(body.ctx_size)
            : typeof body.max_tokens === "number" &&
                Number.isFinite(body.max_tokens)
              ? Math.floor(body.max_tokens)
              : 65536;
        args = buildAgentfileArgs({
          prompt,
          ctxSize: ctxSizeRaw,
          tools: body.tools,
          modelPath: body.model_path || body.modelPath,
          runtimeOptions: {
            ...body,
            ...opts,
          },
        });
      } else {
        const maxTokensRaw =
          typeof body.max_tokens === "number" &&
          Number.isFinite(body.max_tokens)
            ? Math.floor(body.max_tokens)
            : 512;
        const nPredict = Math.max(1, maxTokensRaw);

        args = [
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

      registerTrackedProcess(child, runDetached);

      if (
        (req as any).destroyed ||
        (req as any).aborted ||
        req.socket?.destroyed
      ) {
        killChildProcessSync(child, runDetached);
        throw new Error("Request already closed or aborted");
      }

      if (!child.stdout || !child.stderr) {
        killChildProcessSync(child, runDetached);
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

      const killChild = (signal: NodeJS.Signals = "SIGTERM") => {
        if (
          child.exitCode !== null ||
          child.signalCode !== null ||
          child.killed
        ) {
          return;
        }

        if (signal === "SIGKILL") {
          killChildProcessSync(child, runDetached);

          return;
        }

        if (process.platform === "win32") {
          if (typeof child.pid !== "number") {
            return;
          }

          try {
            const cp = require("node:child_process");
            if (typeof cp.execFileSync === "function") {
              cp.execFileSync(
                "taskkill",
                ["/PID", String(child.pid), "/T", "/F"],
                {
                  stdio: "ignore",
                  windowsHide: true,
                },
              );
              return;
            }
          } catch {}

          try {
            const killer = spawn(
              "taskkill",
              ["/PID", String(child.pid), "/T", "/F"],
              { stdio: "ignore", windowsHide: true },
            );
            killer.unref();
          } catch {}

          return;
        }

        try {
          if (runDetached && typeof child.pid === "number") {
            try {
              process.kill(-child.pid, signal);
            } catch {}
          }
          if (typeof child.pid === "number") {
            try {
              process.kill(child.pid, signal);
            } catch {}
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
        }, 500);
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

          const streamFilter = createToolCallStreamFilter((filteredChunk) => {
            if (!requestClosed && !res.writableEnded) {
              writeOpenAiDeltaChunk(res, opts.model, filteredChunk);
            }
          });

          child.stdout!.on("data", (chunk: Buffer) => {
            if (requestClosed || res.writableEnded) {
              return;
            }

            const text = chunk.toString("utf8");
            fullStdout += text;
            if (isAgentfile) {
              writeOpenAiDeltaChunk(res, opts.model, text);
            } else {
              const filteredText = promptEchoFilter.push(text);
              if (filteredText) {
                streamFilter.onToken(filteredText);
              }

              filteredStdout += filteredText;
            }
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

            if (code !== 0 && (!isAgentfile || code !== 4)) {
              const message =
                stderr.trim() ||
                `${isAgentfile ? "agentfile" : "llamafile"} exited with status ${code}`;
              res.write(
                `data: ${JSON.stringify({ error: { type: "server_error", message } })}\n\n`,
              );
              res.write("data: [DONE]\n\n");
              res.end();
              resolve();

              return;
            }

            if (isAgentfile) {
              writeOpenAiDoneChunk(
                res,
                opts.model,
                code === 4 ? "length" : "stop",
              );
              res.end();
              resolve();

              return;
            }

            const trailingText = promptEchoFilter.flush();
            filteredStdout += trailingText;
            if (trailingText) {
              streamFilter.onToken(trailingText);
            }

            const toolCalls = parseLocalModelToolCalls(filteredStdout.trim());
            streamFilter.finalize(toolCalls.length > 0);

            if (toolCalls.length > 0) {
              toolCalls.forEach((toolCall, idx) => {
                writeOpenAiToolCallChunk(res, opts.model, toolCall, idx);
              });
              writeOpenAiDoneChunk(res, opts.model, "tool_calls");
              res.end();
              resolve();

              return;
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
              res.status(500).json({
                error: `Failed to execute ${isAgentfile ? "agentfile" : "llamafile"}: ${fullMessage}`,
              });
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

          if (code !== 0 && (!isAgentfile || code !== 4)) {
            const message =
              stderr.trim() ||
              `${isAgentfile ? "agentfile" : "llamafile"} exited with status ${code}`;
            res.status(500).json({ error: message });
            resolve();

            return;
          }

          if (isAgentfile) {
            res.json({
              id: `chatcmpl-agentfile-${Date.now()}`,
              object: "chat.completion",
              created: Math.floor(Date.now() / 1000),
              model: opts.model,
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content: fullStdout.trim() || "(no response)",
                  },
                  finish_reason: code === 4 ? "length" : "stop",
                },
              ],
            });
            resolve();

            return;
          }

          filteredStdout += promptEchoFilter.flush();
          const text = filteredStdout.trim();
          const toolCalls = parseLocalModelToolCalls(text);

          res.json({
            id: `chatcmpl-llamafile-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: opts.model,
            choices: [
              {
                index: 0,
                message:
                  toolCalls.length > 0
                    ? {
                        role: "assistant",
                        content: null,
                        tool_calls: toolCalls.map((toolCall, idx) => ({
                          id: `call_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
                          type: "function",
                          function: {
                            name: toolCall.name,
                            arguments: JSON.stringify(toolCall.input || {}),
                          },
                        })),
                      }
                    : { role: "assistant", content: text || "(no response)" },
                finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
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

    async listTools(options?: {
      mode?: LlamafileMode;
      host?: string;
      port?: number;
    }): Promise<any[]> {
      const mode = options?.mode || "cli";
      const host = options?.host || DEFAULT_LLAMAFILE_HOST;
      const port = options?.port || DEFAULT_LLAMAFILE_PORT;

      if (mode === "server") {
        try {
          const upstreamUrl = `http://${host}:${port}/tools`;
          const res = await fetch(upstreamUrl, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "User-Agent":
                process.env.SHADOWCLAW_USER_AGENT || "ShadowClaw/1.0",
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
            if (data && Array.isArray((data as any).tools))
              return (data as any).tools;
            if (data && Array.isArray((data as any).data))
              return (data as any).data;
          }
        } catch {
          // Fall back to built-in tools
        }
      }

      return LLAMAFILE_BUILTIN_TOOLS;
    },

    async executeTool(
      name: string,
      args: Record<string, any>,
      options?: {
        mode?: LlamafileMode;
        host?: string;
        port?: number;
      },
    ): Promise<any> {
      const mode = options?.mode || "cli";
      const host = options?.host || DEFAULT_LLAMAFILE_HOST;
      const port = options?.port || DEFAULT_LLAMAFILE_PORT;

      if (mode === "server") {
        const upstreamUrl = `http://${host}:${port}/tools`;
        const upstreamBody = { name, arguments: args };
        const res = await fetch(upstreamUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": process.env.SHADOWCLAW_USER_AGENT || "ShadowClaw/1.0",
          },
          body: JSON.stringify(upstreamBody),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(
            `Upstream /tools returned HTTP ${res.status}: ${errText}`,
          );
        }
        return res.json();
      }

      if (name === "get_datetime") {
        return { datetime: new Date().toISOString() };
      }
      if (name === "get_info") {
        return { platform: process.platform, cwd: process.cwd() };
      }
      throw new Error(
        `Tool execution for '${name}' requires server mode or is not supported locally.`,
      );
    },

    terminateAll() {
      for (const cancel of activeRequests.values()) {
        try {
          cancel();
        } catch {}
      }
      cleanupAllLlamafileProcesses();
    },

    __getOfflineSupportCache() {
      return offlineSupportCache;
    },
    __getActiveRequests() {
      return activeRequests;
    },
    __getActiveProcesses() {
      return allActiveLlamafileProcesses;
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
