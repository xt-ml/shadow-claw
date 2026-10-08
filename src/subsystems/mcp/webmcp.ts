import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";

import { DEFAULT_GROUP_ID } from "../../config/config.js";
import { TOOL_DEFINITIONS, type ToolDefinition } from "../tools/tools.js";

export type WebMcpMode = "polyfill" | "native";

const registeredToolControllers: Map<string, AbortController> = new Map();
const registeredToolNames: Set<string> = new Set();

let currentMode: WebMcpMode = "polyfill";

/**
 * Set the WebMCP mode (polyfill vs native).
 *
 * - `"polyfill"` (default): Uses `@mcp-b/webmcp-polyfill` for a pure-JS
 *   `document.modelContext` that works in all browsers.
 * - `"native"`: Uses Chrome's native `document.modelContext` from
 *   `chrome://flags/#enable-webmcp-testing`.  Requires the flag to be
 *   enabled.  May crash in early Canary builds.
 *
 * Detection follows Chrome's recommended compat pattern:
 *   `document.modelContext || navigator.modelContext`
 * `navigator.modelContext` was deprecated in Chrome 150 and removed in
 * Chrome 152.0.7943.0, but the fallback keeps older clients working.
 */
export function setWebMcpMode(mode: WebMcpMode): void {
  currentMode = mode;
}

export function getWebMcpMode(): WebMcpMode {
  return currentMode;
}

/**
 * Install the `@mcp-b/webmcp-polyfill` onto `document.modelContext`.
 *
 * The polyfill itself bails out when Chrome's native `document.modelContext`
 * is already present — it does NOT override the native API. We call it
 * unconditionally; if the polyfill is already installed it will detect the
 * existing install via its own `installState` guard and return quickly.
 */
function ensurePolyfill(): void {
  try {
    initializeWebMCPPolyfill();
  } catch (err) {
    console.warn("WebMCP polyfill initialization failed:", err);
  }
}

/**
 * Returns true when the `@mcp-b/webmcp-polyfill` v5.1.0+ security gate will
 * allow `registerTool()` to proceed.
 *
 * The polyfill's `validateOriginAgentCluster()` throws `DOMException("",
 * "SecurityError")` when `globalThis.originAgentCluster === false` (and the
 * protocol is not `file:`). Chrome automatically origin-isolates HTTPS pages so
 * this is never an issue there. Firefox ≥ 138 exposes `originAgentCluster` but
 * returns `false` unless the server sends `Origin-Agent-Cluster: ?1` — a
 * header that GitHub Pages does not set. This check lets us detect Firefox
 * (and any other browser with the same behaviour) early and skip registration
 * with a single descriptive warning instead of N per-tool `DOMException`s.
 *
 * Native mode bypasses the polyfill entirely and is unaffected.
 */
function isOriginAgentClusterCompatible(): boolean {
  // If the property is absent the browser is old enough not to enforce the
  // check — allow registration to proceed.
  if (typeof globalThis.originAgentCluster === "undefined") {
    return true;
  }

  // file: protocol is explicitly exempt in the polyfill guard.
  const protocol = globalThis.location?.protocol;
  if (protocol === "file:") {
    return true;
  }

  return globalThis.originAgentCluster !== false;
}

/**
 * Access the WebMCP ModelContext API.
 *
 * In polyfill mode: installs the `@mcp-b/webmcp-polyfill` which surfaces
 * `document.modelContext`.
 * In native mode: follows Chrome's recommended feature-detection pattern:
 *   `document.modelContext || navigator.modelContext`
 * `navigator.modelContext` was deprecated in Chrome 150 and removed in
 * Chrome 152.0.7943.0, but the fallback preserves compatibility with
 * earlier builds that may still be in the wild.
 */
function getModelContextApi(): any {
  if (typeof document === "undefined" && typeof navigator === "undefined") {
    return null;
  }

  if (currentMode === "polyfill") {
    ensurePolyfill();
  }

  try {
    const modelContext: unknown =
      typeof document !== "undefined" &&
      typeof (document as any).modelContext !== "undefined"
        ? Reflect.get(document, "modelContext")
        : typeof navigator !== "undefined" &&
            typeof (navigator as any).modelContext !== "undefined"
          ? Reflect.get(navigator, "modelContext")
          : undefined;

    if (!modelContext || typeof modelContext !== "object") {
      return null;
    }

    const api = modelContext as {
      registerTool?: unknown;
      unregisterTool?: unknown;
      getTools?: unknown;
      executeTool?: unknown;
    };

    if (typeof api.registerTool !== "function") {
      return null;
    }

    return api;
  } catch (err) {
    console.warn("WebMCP modelContext access failed:", err);

    return null;
  }
}

/**
 * Safely parse or normalize WebMCP input schema.
 *
 * Starting in Chrome 154.0.8014.0 (PR #241), `RegisteredTool#inputSchema` returns
 * a JavaScript object (a deep copy of the schema provided at registration).
 * In Chrome < 154.0.8014.0, `RegisteredTool#inputSchema` returned a stringified JSON schema (DOMString).
 *
 * This function provides backwards-compatible schema parsing:
 * - If inputSchema is a string: attempts JSON.parse.
 * - If inputSchema is an object: returns the object.
 * - Fallbacks gracefully to an empty object schema if null, undefined, or invalid JSON.
 */
export function parseWebMcpInputSchema(
  inputSchema: unknown,
): Record<string, unknown> {
  if (typeof inputSchema === "string") {
    try {
      const parsed = JSON.parse(inputSchema);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fallback on JSON parse error
    }

    return { type: "object", properties: {} };
  }

  if (
    inputSchema &&
    typeof inputSchema === "object" &&
    !Array.isArray(inputSchema)
  ) {
    return inputSchema as Record<string, unknown>;
  }

  return { type: "object", properties: {} };
}

export interface WebMcpExecuteContext {
  signal?: AbortSignal;
}

export interface WebMcpRegisteredTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: Record<string, unknown>;
  execute?: (
    input: Record<string, unknown>,
    context?: WebMcpExecuteContext | AbortSignal,
  ) => Promise<unknown>;
}

export interface NormalizedWebMcpRegisteredTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  execute?: (
    input: Record<string, unknown>,
    context?: WebMcpExecuteContext | AbortSignal,
  ) => Promise<unknown>;
}

/**
 * Safely extract AbortSignal from execute options/context.
 * Supports Chrome 153+ options object `{ signal }` (PR #247), direct AbortSignal instances,
 * or undefined for backward compatibility with Chrome < 153 and legacy callers.
 */
export function extractAbortSignal(
  context?: WebMcpExecuteContext | AbortSignal,
): AbortSignal | undefined {
  if (!context) {
    return undefined;
  }

  if (typeof AbortSignal !== "undefined" && context instanceof AbortSignal) {
    return context;
  }

  if (
    typeof context === "object" &&
    "signal" in context &&
    typeof AbortSignal !== "undefined" &&
    context.signal instanceof AbortSignal
  ) {
    return context.signal;
  }

  return undefined;
}

/**
 * Retrieve tools registered on the WebMCP ModelContext API.
 *
 * Practicing graceful degradation:
 * - Feature-detects `getTools()` on `document.modelContext` / `navigator.modelContext`.
 * - If `getTools()` is absent (older browser builds or polyfills without getTools),
 *   returns an empty array `[]` without throwing.
 * - Normalizes `RegisteredTool#inputSchema` so caller receives a JavaScript object
 *   whether running on Chrome 154+ (native object) or Chrome < 154 (DOMString JSON).
 */
export async function getWebMcpTools(): Promise<
  NormalizedWebMcpRegisteredTool[]
> {
  const modelContext = getModelContextApi() as {
    getTools?: () => Promise<WebMcpRegisteredTool[]>;
  } | null;

  if (!modelContext || typeof modelContext.getTools !== "function") {
    return [];
  }

  try {
    const rawTools = await modelContext.getTools();
    if (!Array.isArray(rawTools)) {
      return [];
    }

    return rawTools.map((tool) => ({
      name: tool.name,
      ...(tool.description ? { description: tool.description } : {}),
      inputSchema: parseWebMcpInputSchema(tool.inputSchema),
      ...(tool.annotations ? { annotations: tool.annotations } : {}),
      ...(tool.execute ? { execute: tool.execute } : {}),
    }));
  } catch (err) {
    console.warn("Failed to retrieve WebMCP tools via getTools():", err);

    return [];
  }
}

/**
 * Gracefully execute a WebMCP tool on a ModelContext instance with backwards compatibility.
 *
 * Starting in Chrome 155.0.8052.0 (PR #246, PR #251), `document.modelContext.executeTool()`
 * accepts an optional JavaScript object directly instead of a JSON DOMString.
 * In Chrome < 155 and earlier polyfills, `executeTool()` required a stringified JSON arguments string.
 *
 * This function practices graceful degradation:
 * 1. Prepares both an `inputObject` (for Chrome 155+) and an `inputStr` (for Chrome < 155 & polyfills).
 * 2. Attempts to execute `executeTool(tool, inputObject, options)` first.
 * 3. Catches errors starting with "Failed to parse input" (or TypeErrors from WebIDL DOMString checks)
 *    and retries transparently with `JSON.stringify(inputObject)`.
 * 4. Re-throws any unrelated execution errors.
 */
export async function executeWebMcpTool(
  modelContext: any,
  tool: any,
  input?: unknown,
  options?: WebMcpExecuteContext | AbortSignal,
): Promise<unknown> {
  if (!modelContext || typeof modelContext.executeTool !== "function") {
    throw new Error("ModelContext executeTool is not available");
  }

  let inputObject: Record<string, unknown>;
  let inputStr: string;

  if (typeof input === "string") {
    inputStr = input;
    try {
      const parsed = JSON.parse(input);
      inputObject =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
    } catch {
      inputObject = {};
    }
  } else if (input && typeof input === "object" && !Array.isArray(input)) {
    inputObject = input as Record<string, unknown>;
    try {
      inputStr = JSON.stringify(input);
    } catch {
      inputStr = "{}";
    }
  } else {
    inputObject = {};
    inputStr = "{}";
  }

  try {
    return await modelContext.executeTool(tool, inputObject, options);
  } catch (err: any) {
    const isParseError =
      typeof err?.message === "string" &&
      err.message.startsWith("Failed to parse input");
    const isTypeError = err instanceof TypeError;

    if (isParseError || isTypeError) {
      return await modelContext.executeTool(tool, inputStr, options);
    }

    throw err;
  }
}

/**
 * Feature detection for the WebMCP imperative API.
 *
 * To test this integration in Google Chrome, use the Model Context Tool
 * Inspector extension:
 * https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd
 */
export function isWebMcpSupported(): boolean {
  return !!getModelContextApi();
}

/**
 * Event fired when a tool execution begins (PR #245 / Chrome 156+).
 * Dispatched on `document.modelContext` in Chrome 156+, or `window` in Chrome < 156.
 */
export interface WebMcpToolActivatedEvent extends Event {
  readonly toolName: string;
}

/**
 * Event fired when a tool execution is cancelled (PR #245 / Chrome 156+).
 * Dispatched on `document.modelContext` in Chrome 156+, or `window` in Chrome < 156.
 */
export interface WebMcpToolCancelEvent extends Event {
  readonly toolName: string;
}

export type WebMcpEventTarget = EventTarget & {
  addEventListener: (type: string, listener: any, options?: any) => void;
  removeEventListener: (type: string, listener: any, options?: any) => void;
};

export interface WebMcpEventListenerOptions extends AddEventListenerOptions {
  /**
   * If true, also attaches a fallback listener to window when modelContext is selected
   * (or vice versa), deduplicating events by toolName within the same tick if both fire.
   */
  listenBoth?: boolean;
}

/**
 * Resolves the appropriate EventTarget for WebMCP lifecycle events
 * (`toolactivated` and `toolcancel`) with backwards compatibility.
 *
 * Starting in Chrome 156.0.8076.0 (PR #245), `ontoolactivated` and `ontoolcancel`
 * event handler properties and lifecycle events moved from `window` to `document.modelContext`.
 * In Chrome < 156, these events were fired on `window`.
 *
 * This function practices robust feature detection and graceful degradation:
 * 1. Safely checks for existence of `document` and `window` to avoid ReferenceErrors
 *    in non-DOM / headless / Node.js environments.
 * 2. Checks if `on${type}` is present in `document.modelContext` (or `navigator.modelContext`).
 *    If present and it supports `addEventListener`, `modelContext` is returned.
 * 3. Checks if `on${type}` is present in `window`. If present and `window` supports
 *    `addEventListener`, `window` is returned (legacy Chrome < 156 path).
 * 4. Fallback: If neither has `on${type}` (e.g. polyfill, synthetic mock, or uninitialized prototype),
 *    prefers `modelContext` if it supports `addEventListener`, otherwise falls back to `window`.
 * 5. Returns `null` if no valid EventTarget is found.
 */
export function getWebMcpEventTarget(
  type?: "toolactivated" | "toolcancel" | string,
): WebMcpEventTarget | null {
  const doc = typeof document !== "undefined" ? document : undefined;
  const win = typeof window !== "undefined" ? window : undefined;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;

  const modelContext: any =
    (doc as any)?.modelContext ?? (nav as any)?.modelContext;

  const hasModelContextListener =
    modelContext && typeof modelContext.addEventListener === "function";
  const hasWindowListener =
    win && typeof (win as any).addEventListener === "function";

  if (type) {
    const handlerKey = `on${type}`;

    // 1. Chrome 156+ path (PR #245): ontoolactivated / ontoolcancel on document.modelContext
    if (modelContext && handlerKey in modelContext && hasModelContextListener) {
      return modelContext as WebMcpEventTarget;
    }

    // 2. Chrome < 156 legacy path: ontoolactivated / ontoolcancel on window
    if (win && handlerKey in win && hasWindowListener) {
      return win as WebMcpEventTarget;
    }
  }

  // 3. Fallback when neither target explicitly reflects on${type}
  if (hasModelContextListener) {
    return modelContext as WebMcpEventTarget;
  }

  if (hasWindowListener) {
    return win as WebMcpEventTarget;
  }

  return null;
}

/**
 * Safely registers a listener for WebMCP lifecycle events (`toolactivated`, `toolcancel`)
 * with graceful degradation, event payload normalization, and automatic unsubscription.
 *
 * Returns an idempotent unsubscribe cleanup function.
 */
export function addWebMcpEventListener<
  T extends "toolactivated" | "toolcancel" | string =
    "toolactivated" | "toolcancel",
>(
  type: T,
  listener: (
    event: T extends "toolactivated"
      ? WebMcpToolActivatedEvent
      : T extends "toolcancel"
        ? WebMcpToolCancelEvent
        : Event & { toolName?: string },
  ) => void,
  options?: boolean | WebMcpEventListenerOptions,
): () => void {
  const target = getWebMcpEventTarget(type);
  const opts = typeof options === "object" ? options : undefined;
  const listenBoth = opts?.listenBoth ?? false;

  const win =
    typeof window !== "undefined" &&
    typeof (window as any).addEventListener === "function"
      ? (window as unknown as WebMcpEventTarget)
      : null;
  const doc = typeof document !== "undefined" ? document : null;
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const modelContext: any =
    (doc as any)?.modelContext ?? (nav as any)?.modelContext;
  const hasMc =
    modelContext && typeof modelContext.addEventListener === "function";

  const secondaryTarget: WebMcpEventTarget | null = listenBoth
    ? target === modelContext
      ? win !== target
        ? win
        : null
      : hasMc
        ? (modelContext as WebMcpEventTarget)
        : null
    : null;

  if (!target && !secondaryTarget) {
    return () => {};
  }

  let recentToolNames: Set<string> | null = null;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  const wrapHandler = (evt: Event) => {
    let toolName = (evt as any).toolName;
    if (
      typeof toolName !== "string" &&
      "detail" in evt &&
      typeof (evt as any).detail === "object"
    ) {
      toolName = (evt as any).detail?.toolName;
    }
    if (typeof toolName !== "string") {
      toolName = "";
    }

    if (!("toolName" in evt) || (evt as any).toolName !== toolName) {
      try {
        Object.defineProperty(evt, "toolName", {
          value: toolName,
          configurable: true,
          enumerable: true,
        });
      } catch {
        // Ignore errors if event is sealed
      }
    }

    if (listenBoth && toolName) {
      if (!recentToolNames) {
        recentToolNames = new Set();
      }
      if (recentToolNames.has(toolName)) {
        return;
      }
      recentToolNames.add(toolName);
      if (!clearTimer) {
        clearTimer = setTimeout(() => {
          recentToolNames?.clear();
          clearTimer = null;
        }, 100);
      }
    }

    listener(evt as any);
  };

  if (target) {
    target.addEventListener(type, wrapHandler as EventListener, options);
  }
  if (secondaryTarget) {
    secondaryTarget.addEventListener(
      type,
      wrapHandler as EventListener,
      options,
    );
  }

  let unsubscribed = false;
  const unsubscribe = () => {
    if (unsubscribed) {
      return;
    }
    unsubscribed = true;
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
    if (target) {
      target.removeEventListener(type, wrapHandler as EventListener, options);
    }
    if (secondaryTarget) {
      secondaryTarget.removeEventListener(
        type,
        wrapHandler as EventListener,
        options,
      );
    }
  };

  if (opts?.signal) {
    if (opts.signal.aborted) {
      unsubscribe();
      return () => {};
    }
    opts.signal.addEventListener("abort", () => unsubscribe(), { once: true });
  }

  return unsubscribe;
}

/**
 * Convenience helper to subscribe to tool execution start events (`toolactivated`).
 * Returns an unsubscribe cleanup function.
 */
export function onWebMcpToolActivated(
  listener: (event: WebMcpToolActivatedEvent) => void,
  options?: boolean | WebMcpEventListenerOptions,
): () => void {
  return addWebMcpEventListener("toolactivated", listener, options);
}

/**
 * Convenience helper to subscribe to tool execution cancel events (`toolcancel`).
 * Returns an unsubscribe cleanup function.
 */
export function onWebMcpToolCancel(
  listener: (event: WebMcpToolCancelEvent) => void,
  options?: boolean | WebMcpEventListenerOptions,
): () => void {
  return addWebMcpEventListener("toolcancel", listener, options);
}

/**
 * Consequential tools that perform high-stakes, irreversible, or external real-world actions
 * (such as deleting data, executing arbitrary system commands, or transmitting live communications).
 * Signals consuming agents to require explicit user confirmation prior to execution (Chrome 154.0.8017.0+).
 */
export const CONSEQUENTIAL_TOOL_NAMES: ReadonlySet<string> = new Set([
  "bash",
  "clear_chat",
  "delete_file",
  "delete_task",
  "email_send_message",
  "git_delete_branch",
  "git_delete_repo",
  "git_push",
  "git_reset",
]);

/**
 * Read-only tools that query information without mutating state.
 */
export const READ_ONLY_TOOL_NAMES: ReadonlySet<string> = new Set([
  "ask_user",
  "detect_language",
  "diff_files",
  "email_read_messages",
  "fetch_url",
  "get_current_time",
  "git_branches",
  "git_diff",
  "git_list_repos",
  "git_log",
  "git_read_file_at_ref",
  "git_show",
  "git_status",
  "list_components",
  "list_files",
  "list_room_members",
  "list_tasks",
  "list_tool_profiles",
  "proofread_text",
  "read_file",
  "remote_mcp_list_tools",
  "rewrite_text",
  "search_files",
  "summarize_text",
  "translate_text",
  "web_search",
  "write_text",
]);

export interface WebMcpToolAnnotations {
  readOnlyHint?: boolean;
  consequentialHint?: boolean;
  untrustedContentHint?: boolean;
  [key: string]: unknown;
}

/**
 * Resolve annotations for a WebMCP tool registration.
 * Allows custom annotations (from declarative or customized tool definitions)
 * to override defaults.
 */
export function resolveWebMcpToolAnnotations(
  toolName: string,
  customAnnotations?: Record<string, unknown>,
): WebMcpToolAnnotations {
  const isConsequential = CONSEQUENTIAL_TOOL_NAMES.has(toolName);
  const isReadOnly = !isConsequential && READ_ONLY_TOOL_NAMES.has(toolName);

  return {
    readOnlyHint: isReadOnly,
    consequentialHint: isConsequential,
    untrustedContentHint: true,
    ...(customAnnotations || {}),
  };
}

/**
 * Register ShadowClaw tools with the WebMCP ModelContext API.
 *
 * Both the `@mcp-b/webmcp-polyfill` and Chrome's native API support
 * `registerTool(tool, { signal })`. We always use AbortController signals so
 * that unregistration works identically regardless of which implementation is
 * actually active.
 *
 * Key correctness detail: `initializeWebMCPPolyfill()` is a no-op when
 * Chrome's native `document.modelContext` already exists — it does NOT
 * override the native API. In that situation we are talking to the native
 * Chrome API even in "polyfill" mode. The native Chrome API only supports
 * signal-based unregistration, so using AbortController signals everywhere
 * prevents "Duplicate tool name" errors when tools are re-configured.
 */
export async function registerWebMcpTools(
  agentWorker: Worker | null,
  _emit: (message: any) => Promise<void> | void,
  groupId: string = DEFAULT_GROUP_ID,
  tools?: ToolDefinition[],
): Promise<boolean> {
  const activeTools = Array.isArray(tools) ? tools : TOOL_DEFINITIONS;

  if (activeTools.length === 0) {
    return true;
  }

  // In polyfill mode, the polyfill's validateOriginAgentCluster() guard throws
  // DOMException("", "SecurityError") when originAgentCluster === false.
  // Chrome automatically origin-isolates HTTPS pages so this never occurs
  // there, but Firefox returns false unless the server sends
  // Origin-Agent-Cluster: ?1 (a header GitHub Pages does not set).
  // Pre-checking here avoids N identical per-tool DOMException spam and
  // surfaces a single, actionable warning instead.
  if (currentMode === "polyfill" && !isOriginAgentClusterCompatible()) {
    console.warn(
      "WebMCP polyfill registration skipped: this browser reports " +
        "originAgentCluster = false. The @mcp-b/webmcp-polyfill v5.1.0+ " +
        "requires an origin-keyed agent cluster (Chrome enforces this " +
        "automatically for HTTPS; Firefox requires the server to send " +
        "Origin-Agent-Cluster: ?1). WebMCP tools are unavailable in this " +
        "browser session.",
    );
    return false;
  }

  const modelContext = getModelContextApi();
  if (!modelContext) {
    return false;
  }

  for (const def of activeTools) {
    if (registeredToolNames.has(def.name)) {
      continue;
    }

    const controller = new AbortController();
    registeredToolControllers.set(def.name, controller);
    registeredToolNames.add(def.name);

    try {
      const toolDef: any = {
        name: def.name,
        description: def.description,
        inputSchema: parseWebMcpInputSchema(def.input_schema),
        annotations: resolveWebMcpToolAnnotations(
          def.name,
          (def as any).annotations,
        ),
        execute: (
          input: Record<string, unknown>,
          context?: WebMcpExecuteContext | AbortSignal,
        ) => {
          if (!agentWorker) {
            throw new Error("Cannot execute tool: agent worker is not ready");
          }

          const signal = extractAbortSignal(context);

          if (signal?.aborted) {
            return Promise.reject(new Error("Tool execution aborted"));
          }

          return new Promise((resolve, reject) => {
            const callId =
              Date.now().toString(36) + Math.random().toString(36).slice(2);

            let timeout: ReturnType<typeof setTimeout> | null = null;

            const cleanup = () => {
              if (timeout !== null) {
                clearTimeout(timeout);
                timeout = null;
              }
              agentWorker?.removeEventListener("message", handler);
              if (signal && onAbort) {
                signal.removeEventListener("abort", onAbort);
              }
            };

            const onAbort = () => {
              cleanup();
              reject(new Error("Tool execution aborted"));
            };

            if (signal) {
              signal.addEventListener("abort", onAbort, { once: true });
            }

            timeout = setTimeout(() => {
              cleanup();
              reject(new Error("Timeout waiting for tool execution"));
            }, 600000);

            const handler = (event: MessageEvent) => {
              const data = event.data;
              if (
                data &&
                data.type === "execute-tool-result" &&
                data.callId === callId
              ) {
                cleanup();

                if (data.error) {
                  reject(new Error(data.error));
                } else {
                  resolve(data.result);
                }
              }
            };

            agentWorker.addEventListener("message", handler);

            agentWorker.postMessage({
              type: "execute-tool",
              callId,
              payload: { name: def.name, input: input || {}, groupId },
            });
          });
        },
      };

      // Always use AbortController signals — both the polyfill and the native
      // Chrome API honour { signal } for lifecycle management.
      await modelContext.registerTool(toolDef, { signal: controller.signal });

      // Yield to the event loop between registrations.
      await new Promise((resolve) => setTimeout(resolve, 0));
    } catch (err) {
      registeredToolControllers.delete(def.name);
      registeredToolNames.delete(def.name);

      // Treat duplicate-registration errors as a no-op. The polyfill throws
      // "Tool already registered: <name>" and the native Chrome API throws
      // "Duplicate tool name" — both mean the tool is already present.
      const isDuplicate =
        err instanceof Error &&
        (err.message.includes("already registered") ||
          err.message.includes("Duplicate tool name"));

      if (isDuplicate) {
        continue;
      }

      // A SecurityError DOMException (typically with an empty message) means
      // the polyfill's origin-agent-cluster or permissions-policy gate
      // rejected the registration. This is not recoverable for this session —
      // bail out cleanly rather than spamming one error per remaining tool.
      const isSecurityError =
        err instanceof DOMException && err.name === "SecurityError";

      if (isSecurityError) {
        console.warn(
          "WebMCP tool registration aborted: browser security policy " +
            "(SecurityError) prevented registration. Remaining tools will " +
            "not be registered for this session.",
          err,
        );
        return false;
      }

      console.error(`Failed to register tool ${def.name}:`, err);

      throw err;
    }
  }

  return true;
}

/**
 * Unregister previously registered ShadowClaw WebMCP tools.
 *
 * Aborts every AbortController associated with a registered tool. This works
 * for both the polyfill (which listens for the `abort` event on the signal it
 * was given) and Chrome's native API (which also uses signal-based lifecycle).
 * The deprecated `unregisterTool(name)` is intentionally NOT called here
 * because it is absent from the native Chrome API and causes silent failures
 * that prevent proper cleanup.
 */
export function unregisterWebMcpTools() {
  for (const controller of registeredToolControllers.values()) {
    try {
      controller.abort();
    } catch {
      // Ignore unregister errors in experimental API contexts.
    }
  }

  registeredToolControllers.clear();
  registeredToolNames.clear();
}
