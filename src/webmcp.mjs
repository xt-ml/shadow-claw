import { DEFAULT_GROUP_ID } from "./config.mjs";
import { openDatabase } from "./db/openDatabase.mjs";
import { TOOL_DEFINITIONS } from "./tools.mjs";
import { executeTool } from "./worker/executeTool.mjs";
import { setPostHandler } from "./worker/post.mjs";

/** @type {Set<string>} */
const registeredToolNames = new Set();

/**
 * @returns {any}
 */
function getModelContextApi() {
  if (typeof navigator === "undefined") {
    return null;
  }

  const modelContext = Reflect.get(navigator, "modelContext");
  if (!modelContext || typeof modelContext !== "object") {
    return null;
  }

  if (
    typeof modelContext.registerTool !== "function" ||
    typeof modelContext.unregisterTool !== "function"
  ) {
    return null;
  }

  return modelContext;
}

/**
 * Feature detection for the WebMCP imperative API.
 *
 * @returns {boolean}
 */
export function isWebMcpSupported() {
  return !!getModelContextApi();
}

/**
 * Register ShadowClaw tools with WebMCP when the API is available.
 *
 * @param {(message: any) => Promise<void> | void} emit
 * @param {string} [groupId]
 *
 * @returns {Promise<boolean>} true when registration completed, false when unsupported.
 */
export async function registerWebMcpTools(emit, groupId = DEFAULT_GROUP_ID) {
  const modelContext = getModelContextApi();
  if (!modelContext) {
    return false;
  }

  const db = await openDatabase();

  for (const def of TOOL_DEFINITIONS) {
    if (registeredToolNames.has(def.name)) {
      continue;
    }

    await modelContext.registerTool({
      name: def.name,
      description: def.description,
      inputSchema: def.input_schema,
      execute: async (/** @type {Record<string, any>} */ input) => {
        setPostHandler((msg) => emit(msg));
        try {
          return await executeTool(db, def.name, input || {}, groupId);
        } finally {
          setPostHandler(null);
        }
      },
    });

    registeredToolNames.add(def.name);
  }

  return true;
}

/**
 * Unregister previously registered ShadowClaw WebMCP tools.
 */
export function unregisterWebMcpTools() {
  const modelContext = getModelContextApi();
  if (!modelContext) {
    registeredToolNames.clear();
    return;
  }

  for (const toolName of registeredToolNames) {
    try {
      modelContext.unregisterTool(toolName);
    } catch {
      // Ignore unregister errors in experimental API contexts.
    }
  }

  registeredToolNames.clear();
}
