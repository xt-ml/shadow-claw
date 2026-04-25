import { DEFAULT_GROUP_ID } from "./config.js";
import { TOOL_DEFINITIONS, type ToolDefinition } from "./tools.js";

const registeredToolControllers: Map<string, AbortController> = new Map();

function getModelContextApi(): any {
  if (typeof navigator === "undefined") {
    return null;
  }

  const modelContext = Reflect.get(navigator, "modelContext");
  if (!modelContext || typeof modelContext !== "object") {
    return null;
  }

  if (typeof modelContext.registerTool !== "function") {
    return null;
  }

  return modelContext;
}

/**
 * Feature detection for the WebMCP imperative API.
 *
 * To test this integration in Google Chrome, use the WebMCP Model Context Tool extension:
 * https://chromewebstore.google.com/detail/webmcp-model-context-tool/gbpdfapgefenggkahomfgkhfehlcenpd
 */
export function isWebMcpSupported(): boolean {
  return !!getModelContextApi();
}

/**
 * Register ShadowClaw tools with WebMCP when the API is available.
 */
export async function registerWebMcpTools(
  agentWorker: Worker | null,
  emit: (message: any) => Promise<void> | void,
  groupId: string = DEFAULT_GROUP_ID,
  tools?: ToolDefinition[],
): Promise<boolean> {
  const modelContext = getModelContextApi();
  if (!modelContext) {
    return false;
  }

  const activeTools =
    Array.isArray(tools) && tools.length > 0 ? tools : TOOL_DEFINITIONS;

  for (const def of activeTools) {
    if (registeredToolControllers.has(def.name)) {
      continue;
    }

    // Register the controller before awaiting to prevent race conditions from concurrent calls.
    const controller = new AbortController();
    registeredToolControllers.set(def.name, controller);

    try {
      await modelContext.registerTool(
        {
          name: def.name,
          description: def.description,
          inputSchema: def.input_schema,
          // Tool output can include user-supplied content and external data,
          // so mark it as untrusted for WebMCP-aware agents.
          annotations: {
            readOnlyHint: false,
            untrustedContentHint: true,
          },
          execute: (input) => {
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
        },
        { signal: controller.signal },
      );
    } catch (err) {
      registeredToolControllers.delete(def.name);

      if (!(err instanceof Error && err.message.includes("Duplicate"))) {
        console.error(`Failed to register tool ${def.name}:`, err);

        throw err;
      }
    }
  }

  return true;
}

/**
 * Unregister previously registered ShadowClaw WebMCP tools.
 */
export function unregisterWebMcpTools() {
  const modelContext = getModelContextApi();
  if (!modelContext) {
    registeredToolControllers.clear();

    return;
  }

  for (const [toolName, controller] of registeredToolControllers) {
    try {
      modelContext.unregisterTool?.(toolName);

      controller.abort();
    } catch {
      // Ignore unregister errors in experimental API contexts.
    }
  }

  registeredToolControllers.clear();
}
