import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";

import { DEFAULT_GROUP_ID } from "./config.js";
import { TOOL_DEFINITIONS, type ToolDefinition } from "./tools.js";

export type WebMcpMode = "polyfill" | "native";

const registeredToolControllers: Map<string, AbortController> = new Map();
const registeredToolNames: Set<string> = new Set();

let currentMode: WebMcpMode = "polyfill";

/**
 * Set the WebMCP mode (polyfill vs native).
 *
 * - `"polyfill"` (default): Uses `@mcp-b/webmcp-polyfill` for a pure-JS
 *   `navigator.modelContext` that works in all browsers.
 * - `"native"`: Uses Chrome's native `document.modelContext` (with
 *   `navigator.modelContext` fallback) from
 *   `chrome://flags/#enable-webmcp-testing`.  Requires the flag to be
 *   enabled.  May crash in early Canary builds.
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
 * Access the WebMCP ModelContext API.
 *
 * In polyfill mode: installs the `@mcp-b/webmcp-polyfill`.
 * In native mode: uses Chrome's native `document.modelContext` with
 * `navigator.modelContext` fallback.
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
      // @ts-ignore
      typeof document.modelContext !== "undefined"
        ? Reflect.get(document, "modelContext")
        : typeof navigator.modelContext !== "undefined"
          ? Reflect.get(navigator, "modelContext")
          : undefined;

    if (!modelContext || typeof modelContext !== "object") {
      return null;
    }

    const api = modelContext as {
      registerTool?: unknown;
      unregisterTool?: unknown;
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
        inputSchema: def.input_schema,
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: true,
        },
        execute: (input: Record<string, unknown>) => {
          if (!agentWorker) {
            throw new Error("Cannot execute tool: agent worker is not ready");
          }

          return new Promise((resolve, reject) => {
            const callId =
              Date.now().toString(36) + Math.random().toString(36).slice(2);

            const timeout = setTimeout(() => {
              agentWorker?.removeEventListener("message", handler);
              reject(new Error("Timeout waiting for tool execution"));
            }, 600000);

            const handler = (event: MessageEvent) => {
              const data = event.data;
              if (
                data &&
                data.type === "execute-tool-result" &&
                data.callId === callId
              ) {
                clearTimeout(timeout);

                agentWorker?.removeEventListener("message", handler);

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

      if (!isDuplicate) {
        console.error(`Failed to register tool ${def.name}:`, err);

        throw err;
      }
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
