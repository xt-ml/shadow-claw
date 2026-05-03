import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";

import { DEFAULT_GROUP_ID } from "./config.js";
import { TOOL_DEFINITIONS, type ToolDefinition } from "./tools.js";

export type WebMcpMode = "polyfill" | "native";

const registeredToolControllers: Map<string, AbortController> = new Map();
const registeredToolNames: Set<string> = new Set();

let currentMode: WebMcpMode = "polyfill";
let polyfillInstalled = false;

/**
 * Set the WebMCP mode (polyfill vs native).
 *
 * - `"polyfill"` (default): Uses `@mcp-b/webmcp-polyfill` for a pure-JS
 *   `navigator.modelContext` that works in all browsers.
 * - `"native"`: Uses Chrome's native `navigator.modelContext` from
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
 * Install the `@mcp-b/webmcp-polyfill` onto `navigator.modelContext`.
 *
 * Chrome Canary's native implementation can crash the renderer, so the
 * polyfill provides a safe pure-JS alternative.  When switching TO polyfill
 * mode, we override any existing native `modelContext`.
 */
function ensurePolyfill(): void {
  if (polyfillInstalled) {
    return;
  }

  // If Chrome's native (crashy) modelContext exists, remove it so the
  // polyfill can install its own safe JS implementation.
  try {
    if (
      typeof navigator !== "undefined" &&
      "modelContext" in navigator &&
      navigator.modelContext
    ) {
      Object.defineProperty(navigator, "modelContext", {
        value: undefined,
        writable: true,
        configurable: true,
      });
    }
  } catch {
    // Ignore — the polyfill will handle it.
  }

  try {
    initializeWebMCPPolyfill();
    polyfillInstalled = true;
  } catch (err) {
    console.warn("WebMCP polyfill initialization failed:", err);
  }
}

/**
 * Access the WebMCP ModelContext API.
 *
 * In polyfill mode: installs the `@mcp-b/webmcp-polyfill`.
 * In native mode: uses Chrome's native `navigator.modelContext`.
 */
function getModelContextApi(): any {
  if (typeof navigator === "undefined") {
    return null;
  }

  if (currentMode === "polyfill") {
    ensurePolyfill();
  }

  try {
    const modelContext: unknown = Reflect.get(navigator, "modelContext");

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
 * Supports two modes:
 * - `"polyfill"`: Uses `@mcp-b/webmcp-polyfill` (safe, works everywhere).
 *   Unregistration uses `unregisterTool(name)`.
 * - `"native"`: Uses Chrome's native API (requires flag).
 *   Unregistration uses `AbortController` signals.
 */
export async function registerWebMcpTools(
  agentWorker: Worker | null,
  emit: (message: any) => Promise<void> | void,
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

      if (currentMode === "native") {
        // Native Chrome API uses AbortController signals for unregistration.
        modelContext.registerTool(toolDef, { signal: controller.signal });
      } else {
        // Polyfill: simple registerTool, unregister via unregisterTool(name).
        modelContext.registerTool(toolDef);
      }

      // Yield to the event loop between registrations.
      await new Promise((resolve) => setTimeout(resolve, 0));
    } catch (err) {
      registeredToolControllers.delete(def.name);
      registeredToolNames.delete(def.name);

      if (
        !(err instanceof Error && err.message.includes("already registered"))
      ) {
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
 * - Polyfill mode: calls `unregisterTool(name)` for each tool.
 * - Native mode: aborts the `AbortController` signal for each tool.
 */
export function unregisterWebMcpTools() {
  if (currentMode === "polyfill") {
    // Polyfill supports unregisterTool(name).
    try {
      const modelContext = getModelContextApi();
      if (modelContext && typeof modelContext.unregisterTool === "function") {
        for (const name of registeredToolNames) {
          try {
            modelContext.unregisterTool(name);
          } catch {
            // Ignore — tool may already be unregistered.
          }
        }
      }
    } catch {
      // Ignore errors during cleanup.
    }
  } else {
    // Native Chrome API: abort all controllers.
    for (const controller of registeredToolControllers.values()) {
      try {
        controller.abort();
      } catch {
        // Ignore unregister errors in experimental API contexts.
      }
    }
  }

  registeredToolControllers.clear();
  registeredToolNames.clear();
}
