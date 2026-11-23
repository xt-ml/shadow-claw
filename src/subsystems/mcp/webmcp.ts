import { installWebMCP } from "@w3c/webmcp-polyfill";
import { Validator } from "@cfworker/json-schema";
export type { WebMCP } from "webmcp-types";

import { DEFAULT_GROUP_ID } from "../../config/config.js";
import { TOOL_DEFINITIONS, type ToolDefinition } from "../tools/tools.js";

const registeredToolControllers: Map<string, AbortController> = new Map();
const registeredToolNames: Set<string> = new Set();
const normalizedToRawTool = new WeakMap<object, WebMcpRegisteredTool>();

/**
 * Install the `@w3c/webmcp-polyfill` onto `document.modelContext`.
 *
 * The polyfill bails out when native `document.modelContext` is already present
 * — it does NOT override the native API. We call it unconditionally when
 * accessing the API in a browser context.
 */
function ensurePolyfill(): void {
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof (navigator as any).modelContext !== "undefined"
    ) {
      return;
    }

    // Some test / mock environments or non-HTTPS dev setups may not define isSecureContext.
    // If running in a browser-like environment without isSecureContext set, ensure safe default.
    if (
      typeof globalThis !== "undefined" &&
      typeof globalThis.isSecureContext === "undefined" &&
      typeof location !== "undefined" &&
      (location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1")
    ) {
      try {
        Object.defineProperty(globalThis, "isSecureContext", {
          value: true,
          configurable: true,
        });
      } catch {
        // Ignore if read-only
      }
    }

    if (
      typeof crypto === "undefined" ||
      typeof crypto.randomUUID !== "function"
    ) {
      return;
    }

    if (typeof installWebMCP === "function") {
      installWebMCP();
    }
  } catch (err) {
    console.warn("WebMCP polyfill initialization failed:", err);
  }
}

/**
 * Access the WebMCP ModelContext API.
 *
 * Automatically installs `@w3c/webmcp-polyfill` if native `document.modelContext`
 * does not already exist. If native support exists, the polyfill no-ops.
 * Also preserves backwards compatibility with `navigator.modelContext` for
 * earlier experimental Chrome builds.
 */
function getModelContextApi(): any {
  if (typeof document === "undefined" && typeof navigator === "undefined") {
    return null;
  }

  ensurePolyfill();

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
  title?: string;
  description?: string;
  origin?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  annotations?: Record<string, unknown> | null;
  source?: WindowProxy | null;
  /** @deprecated Chrome < 160 fallback; use `source` instead. */
  window?: Window | null;
  execute?: (
    input: Record<string, unknown>,
    context?: WebMcpExecuteContext | AbortSignal,
  ) => Promise<unknown>;
}

export type WebMcpTool = WebMcpRegisteredTool;

export interface NormalizedWebMcpRegisteredTool {
  name: string;
  title?: string;
  description?: string;
  origin?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: unknown;
  annotations?: Record<string, unknown>;
  execute?: (
    input: Record<string, unknown>,
    context?: WebMcpExecuteContext | AbortSignal,
  ) => Promise<unknown>;
}

export interface SerializableWebMcpTool {
  name: string;
  title: string;
  description: string;
  origin: string;
  inputSchema: Record<string, unknown> | null;
  outputSchema: unknown | null;
  annotations: Record<string, unknown> | null;
}

/**
 * Safely resolve the registering window/source from a WebMCP `Tool` interface
 * (Chrome 160+ / PR #348) or legacy `RegisteredTool` dictionary (Chrome < 160).
 */
export function getWebMcpToolSource(
  tool:
    WebMcpRegisteredTool | NormalizedWebMcpRegisteredTool | null | undefined,
): WindowProxy | null {
  if (!tool || typeof tool !== "object") {
    return null;
  }

  const target: WebMcpRegisteredTool =
    normalizedToRawTool.get(tool) ?? (tool as WebMcpRegisteredTool);
  // TODO: Remove `target.window` fallback when Chrome 160 reaches Stable (January 5, 2027).
  return target.source !== undefined ? target.source : (target.window ?? null);
}

/**
 * Explicitly extract JSON-serializable metadata from a WebMCP `Tool` interface
 * or legacy `RegisteredTool` dictionary.
 *
 * Chrome 160+ (PR #348) returns `Tool` interface instances whose attributes live
 * on the prototype: `JSON.stringify(tool)` produces `"{}"`, `{ ...tool }` drops
 * properties, and `structuredClone(tool)` throws. Missing schemas and
 * annotations are normalized to `null` and non-serializable members (`source`,
 * `window`, `execute`) are omitted.
 */
export function serializeWebMcpTool(
  tool: WebMcpRegisteredTool | NormalizedWebMcpRegisteredTool,
): SerializableWebMcpTool {
  const target =
    tool && typeof tool === "object"
      ? (normalizedToRawTool.get(tool) ?? tool)
      : tool;

  const name = typeof target?.name === "string" ? target.name : "";
  const title = typeof target?.title === "string" ? target.title : "";
  const description =
    typeof target?.description === "string" ? target.description : "";
  const origin = typeof target?.origin === "string" ? target.origin : "";

  const rawInputSchema = target?.inputSchema;
  const inputSchema =
    rawInputSchema !== undefined && rawInputSchema !== null
      ? parseWebMcpInputSchema(rawInputSchema)
      : null;

  const rawOutputSchema = target?.outputSchema;
  const outputSchema =
    rawOutputSchema !== undefined && rawOutputSchema !== null
      ? parseWebMcpOutputSchema(rawOutputSchema)
      : null;

  const rawAnnotations = target?.annotations;
  const annotations =
    rawAnnotations && typeof rawAnnotations === "object"
      ? { ...rawAnnotations }
      : null;

  return {
    name,
    title,
    description,
    origin,
    inputSchema,
    outputSchema,
    annotations,
  };
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
 * - Supports options dictionary with `fromOrigins` to discover cross-frame/cross-origin tools (Chrome 155+).
 * - Compatible with Chrome 160+ (PR #348) `Tool` interface instances: reads
 *   attributes explicitly (avoiding `{ ...tool }` / `JSON.stringify(tool)` /
 *   `structuredClone(tool)`), omits `null` optional fields (`outputSchema`,
 *   `annotations`), and retains the genuine `Tool` reference in a `WeakMap`
 *   so `executeWebMcpTool()` and `getWebMcpToolSource()` preserve `Tool` identity.
 * - Normalizes `Tool#inputSchema` / `RegisteredTool#inputSchema` so callers
 *   receive a JavaScript object whether running on Chrome 154+ (native object),
 *   Chrome 160+ (`null` when omitted), or Chrome < 154 (DOMString JSON).
 */
export async function getWebMcpTools(options?: {
  fromOrigins?: string[];
}): Promise<NormalizedWebMcpRegisteredTool[]> {
  const modelContext = getModelContextApi() as {
    getTools?: (options?: {
      fromOrigins?: string[];
    }) => Promise<WebMcpRegisteredTool[]>;
  } | null;

  if (!modelContext || typeof modelContext.getTools !== "function") {
    return [];
  }

  try {
    const rawTools = await modelContext.getTools(options);
    if (!Array.isArray(rawTools)) {
      return [];
    }

    return rawTools.map((tool) => {
      const name = tool.name;
      const title = tool.title;
      const description = tool.description;
      const origin = tool.origin;
      const inputSchema = parseWebMcpInputSchema(tool.inputSchema);
      const outputSchema =
        tool.outputSchema !== undefined && tool.outputSchema !== null
          ? parseWebMcpOutputSchema(tool.outputSchema)
          : undefined;
      const annotations =
        tool.annotations && typeof tool.annotations === "object"
          ? { ...tool.annotations }
          : undefined;
      const execute =
        typeof tool.execute === "function" ? tool.execute : undefined;

      const normalized: NormalizedWebMcpRegisteredTool = {
        name,
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(origin ? { origin } : {}),
        inputSchema,
        ...(outputSchema !== undefined ? { outputSchema } : {}),
        ...(annotations !== undefined ? { annotations } : {}),
        ...(execute !== undefined ? { execute } : {}),
      };

      if (tool && typeof tool === "object") {
        normalizedToRawTool.set(normalized, tool);
      }

      return normalized;
    });
  } catch (err) {
    console.warn("Failed to retrieve WebMCP tools via getTools():", err);

    return [];
  }
}

function parseWebMcpOutputSchema(schema: unknown): unknown {
  if (typeof schema !== "string") return schema;
  try {
    return JSON.parse(schema);
  } catch {
    return schema;
  }
}

export class WebMcpOutputSchemaError extends Error {}

export function validateWebMcpOutput(result: unknown, tool: any): void {
  if (
    tool?.outputSchema === undefined ||
    tool.outputSchema === null ||
    tool.outputSchema === ""
  )
    return;
  const schema = parseWebMcpOutputSchema(tool.outputSchema);
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new WebMcpOutputSchemaError(
      `Invalid output schema for tool "${tool.name}"`,
    );
  }

  let instance = result;
  if (typeof result === "string") {
    try {
      instance = JSON.parse(result);
    } catch {}
  }

  let errors;
  try {
    ({ errors } = new Validator(schema, "2020-12").validate(instance));
  } catch (error) {
    throw new WebMcpOutputSchemaError(
      `Invalid output schema for tool "${tool.name}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (errors.length) {
    const details = errors
      .slice(0, 3)
      .map(({ instanceLocation, error }) => `${instanceLocation}: ${error}`)
      .join("; ");
    throw new WebMcpOutputSchemaError(
      `Tool "${tool.name}" result does not match its output schema: ${details}`,
    );
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

  const targetTool =
    tool && typeof tool === "object"
      ? (normalizedToRawTool.get(tool) ?? tool)
      : tool;

  let result: unknown;
  try {
    result = await modelContext.executeTool(targetTool, inputObject, options);
  } catch (err: any) {
    const isParseError =
      typeof err?.message === "string" &&
      err.message.startsWith("Failed to parse input");
    const isToolTypeError =
      err instanceof TypeError &&
      typeof err.message === "string" &&
      /parameter 1|not of type ['"]?(?:Tool|ModelContextTool)['"]?/i.test(
        err.message,
      );
    const isTypeError = err instanceof TypeError && !isToolTypeError;

    if (isParseError || isTypeError) {
      result = await modelContext.executeTool(targetTool, inputStr, options);
    } else {
      throw err;
    }
  }
  validateWebMcpOutput(result, targetTool);
  return result;
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
function readModelContextSafely(): any {
  const doc = typeof document !== "undefined" ? document : undefined;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  try {
    return (doc as any)?.modelContext ?? (nav as any)?.modelContext;
  } catch {
    return undefined;
  }
}

export function getWebMcpEventTarget(
  type?: "toolactivated" | "toolcancel" | string,
): WebMcpEventTarget | null {
  const win = typeof window !== "undefined" ? window : undefined;
  const modelContext: any = readModelContextSafely();

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
  const modelContext: any = readModelContextSafely();
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
 * Convenience helper to subscribe to tool registration change events (`toolchange`).
 * Dispatched on `document.modelContext` when tools are registered or unregistered.
 * Returns an unsubscribe cleanup function.
 */
export function onWebMcpToolChange(
  listener: (event: Event) => void,
  options?: boolean | AddEventListenerOptions,
): () => void {
  const modelContext: any = readModelContextSafely();

  if (!modelContext || typeof modelContext.addEventListener !== "function") {
    return () => {};
  }

  modelContext.addEventListener("toolchange", listener, options);
  return () => {
    try {
      modelContext.removeEventListener("toolchange", listener, options);
    } catch {
      // Ignore cleanup error
    }
  };
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
  debugging?: boolean;
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
    ...(typeof customAnnotations?.debugging === "boolean"
      ? { debugging: customAnnotations.debugging }
      : {}),
    ...(customAnnotations || {}),
  };
}

/**
 * Register ShadowClaw tools with the WebMCP ModelContext API.
 *
 * Both `@w3c/webmcp-polyfill` and Chrome's native API support
 * `registerTool(tool, { signal })`. We always use AbortController signals so
 * that unregistration works identically regardless of which implementation is
 * actually active.
 *
 * Key correctness detail: `ensurePolyfill()` is a no-op when
 * Chrome's native `document.modelContext` already exists — it does NOT
 * override the native API. In that situation we are talking to the native
 * Chrome API. The native Chrome API only supports signal-based unregistration,
 * so using AbortController signals everywhere prevents "Duplicate tool name"
 * errors when tools are re-configured.
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
        title: (def as any).title || def.name,
        description: def.description,
        inputSchema: parseWebMcpInputSchema(def.input_schema),
        ...(def.output_schema !== undefined
          ? { outputSchema: def.output_schema }
          : {}),
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
                  try {
                    validateWebMcpOutput(data.result, {
                      name: def.name,
                      outputSchema: def.output_schema,
                    });
                    let result = data.result;
                    if (
                      def.output_schema !== undefined &&
                      typeof result === "string"
                    ) {
                      try {
                        result = JSON.parse(result);
                      } catch {}
                    }
                    resolve(result);
                  } catch (error) {
                    reject(error);
                  }
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

      // A SecurityError or NotAllowedError DOMException means the browser's
      // origin-agent-cluster or permissions-policy ("tools") gate rejected
      // registration. This is not recoverable for this session — bail out
      // cleanly rather than spamming one error per remaining tool.
      const isPolicyError =
        err instanceof DOMException &&
        (err.name === "SecurityError" || err.name === "NotAllowedError");

      if (isPolicyError) {
        console.warn(
          `WebMCP tool registration aborted: browser security policy (${err.name}) ` +
            "prevented registration. Remaining tools will not be registered " +
            "for this session.",
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
