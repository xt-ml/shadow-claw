import { TOOL_DEFINITIONS } from "./tools.mjs";
import { createToolActivityMessage } from "./worker/createToolActivityMessage.mjs";
import { executeTool } from "./worker/executeTool.mjs";
import { setPostHandler } from "./worker/post.mjs";

/**
 * @typedef {import("./db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * @returns {{ availability: Function, create: Function } | null}
 */
function getLanguageModelApi() {
  const candidate = Reflect.get(globalThis, "LanguageModel");
  if (!candidate || typeof candidate !== "function") {
    return null;
  }

  if (
    typeof candidate.availability !== "function" ||
    typeof candidate.create !== "function"
  ) {
    return null;
  }

  return /** @type {{ availability: Function, create: Function }} */ (
    candidate
  );
}

/**
 * Feature detection for the web Prompt API.
 *
 * @returns {boolean}
 */
export function isPromptApiSupported() {
  return !!getLanguageModelApi();
}

/**
 * @returns {boolean}
 */
function supportsPromptConstraintOptions() {
  // Conservative gate: if Prompt API exists, option bag support is still
  // experimental. We guard usage and gracefully retry without constraints.
  return true;
}

const PROMPT_IO_OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

const WARM_SESSION_IDLE_MS = 120_000;

/**
 * @type {{ key: string | null, session: any | null, cleanupTimer: ReturnType<typeof setTimeout> | null }}
 */
const warmSessionState = {
  key: null,
  session: null,
  cleanupTimer: null,
};

/**
 * @returns {void}
 */
function clearWarmSessionTimer() {
  if (warmSessionState.cleanupTimer) {
    clearTimeout(warmSessionState.cleanupTimer);
    warmSessionState.cleanupTimer = null;
  }
}

/**
 * @returns {Promise<void>}
 */
async function destroyWarmSession() {
  clearWarmSessionTimer();

  if (!warmSessionState.session) {
    warmSessionState.key = null;
    return;
  }

  await Promise.resolve(warmSessionState.session.destroy?.()).catch(() => {});
  warmSessionState.session = null;
  warmSessionState.key = null;
}

/**
 * @returns {void}
 */
function scheduleWarmSessionCleanup() {
  clearWarmSessionTimer();
  warmSessionState.cleanupTimer = setTimeout(() => {
    void destroyWarmSession();
  }, WARM_SESSION_IDLE_MS);
}

/**
 * @param {string} systemPrompt
 *
 * @returns {any[]}
 */
function buildInitialPrompts(systemPrompt) {
  const text = String(systemPrompt || "").trim();
  if (!text) {
    return [];
  }

  return [{ role: "system", content: text }];
}

/**
 * @param {(message: any) => Promise<void> | void} emit
 * @param {string} groupId
 * @param {'running'|'done'|'error'} status
 * @param {number | null} progress
 * @param {string} [message]
 *
 * @returns {Promise<void>}
 */
async function emitModelDownloadProgress(
  emit,
  groupId,
  status,
  progress,
  message,
) {
  await emit({
    type: "model-download-progress",
    payload: { groupId, status, progress, ...(message ? { message } : {}) },
  });
}

/**
 * @param {(message: any) => Promise<void> | void} emit
 * @param {string} groupId
 * @param {AbortSignal | undefined} abortSignal
 * @param {any[]} [initialPrompts]
 *
 * @returns {Promise<any>}
 */
async function createPromptSessionWithProgress(
  emit,
  groupId,
  abortSignal,
  initialPrompts = [],
) {
  const LanguageModelApi = getLanguageModelApi();
  if (!LanguageModelApi) {
    throw new Error(
      "Prompt API is unavailable in this browser. Enable Prompt API flags in a supported browser (for example Edge Dev/Canary or Chrome with the required flags) or switch provider.",
    );
  }

  const availability = await LanguageModelApi.availability(PROMPT_IO_OPTIONS);

  if (availability === "unavailable") {
    throw new Error(
      "Prompt API model is unavailable on this device/browser. Switch provider or enable the feature flags.",
    );
  }

  if (availability === "downloadable" || availability === "downloading") {
    await emitModelDownloadProgress(
      emit,
      groupId,
      "running",
      availability === "downloadable" ? 0 : null,
      "Downloading Prompt API model...",
    );
  }

  let session;
  try {
    session = await LanguageModelApi.create({
      ...PROMPT_IO_OPTIONS,
      ...(initialPrompts.length > 0 ? { initialPrompts } : {}),
      signal: abortSignal,
      monitor(/** @type {any} */ monitorTarget) {
        if (
          !monitorTarget ||
          typeof monitorTarget.addEventListener !== "function"
        ) {
          return;
        }

        monitorTarget.addEventListener(
          "downloadprogress",
          (/** @type {any} */ event) => {
            const loaded = Reflect.get(event, "loaded");
            const total = Reflect.get(event, "total");
            const loadedValue = Number(loaded);
            const totalValue = Number(total);

            if (!Number.isFinite(loadedValue)) {
              return;
            }

            const normalized =
              Number.isFinite(totalValue) && totalValue > 0
                ? Math.max(0, Math.min(1, loadedValue / totalValue))
                : Math.max(0, Math.min(1, loadedValue));
            void emitModelDownloadProgress(
              emit,
              groupId,
              "running",
              normalized,
              `Downloading Prompt API model... ${Math.round(normalized * 100)}%`,
            );
          },
        );
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await emitModelDownloadProgress(emit, groupId, "error", null, message);
    throw err;
  }

  await emitModelDownloadProgress(
    emit,
    groupId,
    "done",
    1,
    "Prompt API model ready.",
  );

  return session;
}

/**
 * @param {(message: any) => Promise<void> | void} emit
 * @param {string} groupId
 * @param {string} systemPrompt
 * @param {AbortSignal | undefined} abortSignal
 *
 * @returns {Promise<any>}
 */
async function getOrCreateWarmSession(
  emit,
  groupId,
  systemPrompt,
  abortSignal,
) {
  const promptKey = String(systemPrompt || "");

  clearWarmSessionTimer();

  if (warmSessionState.session && warmSessionState.key === promptKey) {
    scheduleWarmSessionCleanup();
    return warmSessionState.session;
  }

  await destroyWarmSession();

  const LanguageModelApi = getLanguageModelApi();
  if (!LanguageModelApi) {
    throw new Error(
      "Prompt API is unavailable in this browser. Enable Prompt API flags in a supported browser (for example Edge Dev/Canary or Chrome with the required flags) or switch provider.",
    );
  }

  const initialPrompts = buildInitialPrompts(systemPrompt);
  warmSessionState.session = await createPromptSessionWithProgress(
    emit,
    groupId,
    abortSignal,
    initialPrompts,
  ).catch(async () => {
    // Fallback to plain creation if monitor-path options fail on this build.
    return LanguageModelApi.create({
      ...PROMPT_IO_OPTIONS,
      ...(initialPrompts.length > 0 ? { initialPrompts } : {}),
      signal: abortSignal,
    });
  });

  warmSessionState.key = promptKey;
  scheduleWarmSessionCleanup();

  return warmSessionState.session;
}

/**
 * @param {(message: any) => Promise<void> | void} emit
 * @param {string} groupId
 * @param {string} systemPrompt
 * @param {AbortSignal | undefined} abortSignal
 *
 * @returns {Promise<{ session: any, destroyAfterUse: boolean }>}
 */
async function acquirePromptSession(emit, groupId, systemPrompt, abortSignal) {
  const warmSession = await getOrCreateWarmSession(
    emit,
    groupId,
    systemPrompt,
    abortSignal,
  );

  if (warmSession && typeof warmSession.clone === "function") {
    try {
      const clone = await warmSession.clone();
      scheduleWarmSessionCleanup();
      return { session: clone, destroyAfterUse: true };
    } catch {
      // Clone support is experimental and may fail on some browser builds.
    }
  }

  return { session: warmSession, destroyAfterUse: false };
}

/**
 * @param {string} systemPrompt
 * @param {any[]} messages
 * @param {string[]} [toolResultHints]
 *
 * @returns {string}
 */
function buildPromptTranscript(
  systemPrompt,
  messages,
  toolResultHints = [],
  includeSystemPrompt = true,
) {
  const lines = includeSystemPrompt
    ? ["SYSTEM INSTRUCTIONS:", systemPrompt, "", "CONVERSATION:"]
    : ["CONVERSATION:"];

  for (const msg of messages) {
    const role = msg?.role === "assistant" ? "ASSISTANT" : "USER";

    if (typeof msg?.content === "string") {
      lines.push(`${role}: ${msg.content}`);
      continue;
    }

    if (Array.isArray(msg?.content)) {
      const blocks = msg.content
        .map((/** @type {any} */ block) => {
          if (block?.type === "text") {
            return block.text || "";
          }

          if (block?.type === "tool_use") {
            return `[TOOL_CALL ${block.name}] ${JSON.stringify(block.input || {})}`;
          }

          if (block?.type === "tool_result") {
            return `[TOOL_RESULT ${block.tool_use_id}] ${String(block.content || "")}`;
          }

          return "";
        })
        .filter(Boolean)
        .join("\n");

      lines.push(`${role}: ${blocks}`);
      continue;
    }

    lines.push(`${role}:`);
  }

  if (toolResultHints.length > 0) {
    lines.push("", "TOOL RESULT HINTS:");
    for (const hint of toolResultHints) {
      lines.push(`- ${hint}`);
    }
  }

  return lines.join("\n");
}

/**
 * @param {string} raw
 *
 * @returns {{ type: "response"|"tool_use", response?: string, tool_calls?: Array<{id?: string, name: string, input?: Record<string, any>}> } | null}
 */
function parseStructured(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}

/**
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} systemPrompt
 * @param {any[]} messages
 * @param {number} _maxTokens
 * @param {(message: any) => Promise<void> | void} emit
 * @param {AbortSignal} [abortSignal]
 */
export async function invokeWithPromptApi(
  db,
  groupId,
  systemPrompt,
  messages,
  _maxTokens,
  emit,
  abortSignal,
) {
  const { session, destroyAfterUse } = await acquirePromptSession(
    emit,
    groupId,
    systemPrompt,
    abortSignal,
  );
  try {
    const toolJsonSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["response", "tool_use"],
        },
        response: {
          type: "string",
        },
        tool_calls: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              name: {
                type: "string",
                enum: TOOL_DEFINITIONS.map((t) => t.name),
              },
              input: { type: "object" },
            },
            required: ["name", "input"],
          },
        },
      },
      required: ["type"],
    };

    const toolHints = TOOL_DEFINITIONS.map(
      (t) =>
        `${t.name}: ${t.description} input_schema=${JSON.stringify(t.input_schema)}`,
    );

    let currentMessages = [...messages];
    for (let i = 0; i < 12; i++) {
      const prompt = [
        "Return ONLY JSON.",
        "If tools are needed, set type=tool_use and include tool_calls.",
        "If no tools are needed, set type=response and include response.",
        "Never include markdown fences.",
        "",
        buildPromptTranscript(systemPrompt, currentMessages, toolHints, false),
      ].join("\n");

      /** @type {string} */
      let raw;
      if (supportsPromptConstraintOptions()) {
        try {
          raw = await session.prompt(prompt, {
            signal: abortSignal,
            responseConstraint: toolJsonSchema,
            omitResponseConstraintInput: true,
          });
        } catch {
          raw = await session.prompt(prompt, { signal: abortSignal });
        }
      } else {
        raw = await session.prompt(prompt, { signal: abortSignal });
      }

      const parsed = parseStructured(raw);
      if (!parsed || parsed.type === "response") {
        const text = parsed?.response || String(raw || "").trim();
        await emit({
          type: "response",
          payload: { groupId, text: text || "(no response)" },
        });
        return;
      }

      const calls = Array.isArray(parsed.tool_calls) ? parsed.tool_calls : [];
      if (calls.length === 0) {
        await emit({
          type: "response",
          payload: { groupId, text: parsed.response || "(no response)" },
        });
        return;
      }

      const toolResults = [];
      for (const call of calls) {
        await emit(createToolActivityMessage(groupId, call.name, "running"));

        let toolOutput;
        // Route worker-originated side effects (toast/open-file/task updates)
        // to the orchestrator's normal inbound handler.
        setPostHandler((msg) => emit(msg));
        try {
          toolOutput = await executeTool(
            db,
            call.name,
            call.input || {},
            groupId,
          );
        } finally {
          setPostHandler(null);
        }

        await emit(createToolActivityMessage(groupId, call.name, "done"));

        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id || `${call.name}-${Date.now()}`,
          content:
            typeof toolOutput === "string"
              ? toolOutput
              : JSON.stringify(toolOutput),
        });
      }

      currentMessages.push({
        role: "assistant",
        content: calls.map((call) => ({
          type: "tool_use",
          id: call.id || `${call.name}-${Date.now()}`,
          name: call.name,
          input: call.input || {},
        })),
      });
      currentMessages.push({ role: "user", content: toolResults });
      await emit({ type: "typing", payload: { groupId } });
    }

    await emit({
      type: "response",
      payload: {
        groupId,
        text: "⚠️ Reached maximum Prompt API tool-use iterations (12).",
      },
    });
  } finally {
    if (destroyAfterUse) {
      await Promise.resolve(session.destroy?.()).catch(() => {});
    }
    scheduleWarmSessionCleanup();
  }
}

/**
 * @param {string} systemPrompt
 * @param {any[]} messages
 * @param {AbortSignal} [abortSignal]
 * @param {(message: any) => Promise<void> | void} [emit]
 * @param {string} [groupId]
 *
 * @returns {Promise<string>}
 */
export async function compactWithPromptApi(
  systemPrompt,
  messages,
  abortSignal,
  emit,
  groupId = "br:main",
) {
  const fallbackEmit = emit || (async () => {});
  const { session, destroyAfterUse } = await acquirePromptSession(
    fallbackEmit,
    groupId,
    systemPrompt,
    abortSignal,
  );
  try {
    const compactPrompt = [
      "Summarize the following chat history concisely.",
      "Keep key facts, decisions, preferences, unresolved tasks, and constraints.",
      "Return plain text only.",
      "",
      buildPromptTranscript(systemPrompt, messages, [], false),
    ].join("\n");

    const summary = await session.prompt(compactPrompt, {
      signal: abortSignal,
    });

    return String(summary || "").trim();
  } finally {
    if (destroyAfterUse) {
      await Promise.resolve(session.destroy?.()).catch(() => {});
    }
    scheduleWarmSessionCleanup();
  }
}

/**
 * Test-only hook: clear cached warm session state.
 *
 * @returns {Promise<void>}
 */
export async function __resetPromptApiSessionCacheForTests() {
  await destroyWarmSession();
}
