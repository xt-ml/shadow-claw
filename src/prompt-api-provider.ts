import { ShadowClawDatabase } from "./db/db.js";
import { ToolDefinition, ToolProfile } from "./tools.js";
import { TOOL_DEFINITIONS } from "./tools.js";
import { createLogMessage } from "./worker/createLogMessage.js";
import { createToolActivityMessage } from "./worker/createToolActivityMessage.js";
import { executeTool } from "./worker/executeTool.js";
import { setPostHandler } from "./worker/post.js";
import { NANO_BUILTIN_PROFILE } from "./tools/builtin-profiles.js";

/**
 * Core tools exposed to the Prompt API (Gemini Nano).
 * Keeping this small prevents the on-device model from being overwhelmed
 * by too many tool definitions. All other tools remain available to
 * cloud-hosted providers.
 */
export { NANO_BUILTIN_PROFILE };

const PROMPT_API_TOOLS = TOOL_DEFINITIONS.filter((t) =>
  NANO_BUILTIN_PROFILE.enabledToolNames.includes(t.name),
);

export { PROMPT_API_TOOLS };

function getLanguageModelApi(): {
  availability: Function;
  create: Function;
} | null {
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

  return candidate;
}

/**
 * Feature detection for the web Prompt API.
 */
export function isPromptApiSupported(): boolean {
  return !!getLanguageModelApi();
}

function supportsPromptConstraintOptions(): boolean {
  // Conservative gate: if Prompt API exists, option bag support is still
  // experimental. We guard usage and gracefully retry without constraints.

  return true;
}

const PROMPT_IO_OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

// Keep the warm session window short to avoid prolonged CPU/GPU activity
// on constrained machines after a response is finished.
const WARM_SESSION_IDLE_MS = 10_000;

const warmSessionState: {
  key: string | null;
  session: any | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
} = {
  key: null,
  session: null,
  cleanupTimer: null,
};

function clearWarmSessionTimer(): void {
  if (warmSessionState.cleanupTimer) {
    clearTimeout(warmSessionState.cleanupTimer);
    warmSessionState.cleanupTimer = null;
  }
}

async function destroyWarmSession(): Promise<void> {
  clearWarmSessionTimer();

  if (!warmSessionState.session) {
    warmSessionState.key = null;

    return;
  }

  await Promise.resolve(warmSessionState.session.destroy?.()).catch(() => {});

  warmSessionState.session = null;
  warmSessionState.key = null;
}

function scheduleWarmSessionCleanup(): void {
  clearWarmSessionTimer();
  warmSessionState.cleanupTimer = setTimeout(() => {
    void destroyWarmSession();
  }, WARM_SESSION_IDLE_MS);
}

function buildInitialPrompts(systemPrompt: string): any[] {
  const text = String(systemPrompt || "").trim();
  if (!text) {
    return [];
  }

  return [{ role: "system", content: text }];
}

async function emitModelDownloadProgress(
  emit: (message: any) => Promise<void> | void,
  groupId: string,
  status: "running" | "done" | "error",
  progress: number | null,
  message?: string,
): Promise<void> {
  await emit({
    type: "model-download-progress",
    payload: { groupId, status, progress, ...(message ? { message } : {}) },
  });
}

async function createPromptSessionWithProgress(
  emit: (message: any) => Promise<void> | void,
  groupId: string,
  abortSignal: AbortSignal | undefined,
  initialPrompts: any[] = [],
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
      monitor(monitorTarget: any) {
        if (
          !monitorTarget ||
          typeof monitorTarget.addEventListener !== "function"
        ) {
          return;
        }

        monitorTarget.addEventListener("downloadprogress", (event: any) => {
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
        });
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

async function getOrCreateWarmSession(
  emit: (message: any) => Promise<void> | void,
  groupId: string,
  systemPrompt: string,
  abortSignal: AbortSignal | undefined,
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

async function acquirePromptSession(
  emit: (message: any) => Promise<void> | void,
  groupId: string,
  systemPrompt: string,
  abortSignal: AbortSignal | undefined,
) {
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
      // Clone not available — destroy the warm session and create a fresh one
      // so prior conversation history doesn't accumulate across invocations.
    }
  }

  // Clone unavailable: create a fresh session to avoid context bleed from
  // prior invocations polluting the session's multi-turn history.
  await destroyWarmSession();
  const freshSession = await createPromptSessionWithProgress(
    emit,
    groupId,
    abortSignal,
    buildInitialPrompts(systemPrompt),
  );

  return { session: freshSession, destroyAfterUse: true };
}

function buildPromptTranscript(
  systemPrompt: string,
  messages: any[],
  toolResultHints: string[] = [],
  includeSystemPrompt = true,
): string {
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
        .map((block: any) => {
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

function parseStructured(raw: string): {
  type: "response" | "tool_use";
  response?: string;
  tool_calls?: Array<{
    id?: string;
    name: string;
    input?: Record<string, any>;
  }>;
} | null {
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

export async function invokeWithPromptApi(
  db: ShadowClawDatabase,
  groupId: string,
  systemPrompt: string,
  messages: any[],
  _maxTokens: number,
  emit: (message: any) => Promise<void> | void,
  abortSignal: AbortSignal | undefined,
  tools: ToolDefinition[] | undefined,
) {
  const activeTools = tools || PROMPT_API_TOOLS;

  await emit(
    createLogMessage(
      groupId,
      "info",
      "Starting",
      `Provider: Prompt API (Gemini Nano) · ${activeTools.length} tools`,
    ),
  );

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
                enum: activeTools.map((t) => t.name),
              },
              input: { type: "object" },
            },
            required: ["name", "input"],
          },
        },
      },
      required: ["type"],
    };

    // Compact tool hints: name, params, and first sentence of description.
    // Use only the caller-provided subset to keep context small
    // enough for Gemini Nano — the full tool set overwhelms it.
    const toolHints = activeTools
      .map((t) => {
        const params = Object.keys(t.input_schema.properties || {}).join(", ");
        const brief = t.description.split(". ")[0];

        return `${t.name}(${params}): ${brief}`;
      })
      .join("\n");

    const jsonInstructions = [
      "Return ONLY valid JSON (no markdown fences).",
      'To call tools: {"type":"tool_use","tool_calls":[{"name":"<tool>","input":{...}}]}',
      'To respond:    {"type":"response","response":"<your answer>"}',
      "IMPORTANT: When the user asks you to use a specific tool, you MUST call it via tool_use. Do NOT refuse or simulate the tool — actually invoke it.",
    ].join("\n");

    let currentMessages = [...messages];
    for (let i = 0; i < 12; i++) {
      await emit(
        createLogMessage(
          groupId,
          "api-call",
          `Prompt API call #${i + 1}`,
          `${currentMessages.length} messages in context`,
        ),
      );

      // First iteration: send conversation transcript + available tool names.
      // Subsequent iterations: the session already has prior context, so only
      // send the latest tool results to avoid O(n²) context duplication.
      let prompt;
      if (i === 0) {
        prompt = [
          jsonInstructions,
          "",
          "Available tools:",
          toolHints,
          "",
          buildPromptTranscript(systemPrompt, currentMessages, [], false),
          "",
          "REMINDER — respond with ONLY valid JSON:",
          'Tool call: {"type":"tool_use","tool_calls":[{"name":"<tool>","input":{...}}]}',
          'Text reply: {"type":"response","response":"<your answer>"}',
        ].join("\n");
      } else {
        const lastEntry = currentMessages[currentMessages.length - 1];
        const resultLines = Array.isArray(lastEntry?.content)
          ? lastEntry.content.map(
              (r: any) =>
                `[TOOL_RESULT ${r.tool_use_id}] ${typeof r.content === "string" ? r.content : JSON.stringify(r.content)}`,
            )
          : [String(lastEntry?.content || "")];

        // Re-state the user's original request so Nano remembers the full goal.
        const lastUserText =
          [...messages]
            .reverse()
            .find((m) => m?.role === "user" && typeof m.content === "string")
            ?.content || "";

        prompt = [
          "Tool execution results:",
          ...resultLines,
          "",
          "Available tools:",
          toolHints,
          "",
          lastUserText ? `Original user request: "${lastUserText}"` : "",
          "Decide: is the user's original request NOW fully satisfied?",
          '- YES, task is done → {"type":"response","response":"<summary of what was done>"}',
          '- NO, more tools needed → {"type":"tool_use","tool_calls":[{"name":"<tool>","input":{...}}]}',
          "Do NOT repeat a tool you already called with the same input.",
          "",
          jsonInstructions,
        ]
          .filter(Boolean)
          .join("\n");
      }

      let raw: string;

      /**
       * Stream the response from promptStreaming(), emitting typing/progress
       * events so the UI shows "Responding" and the activity log updates.
       */
      async function consumeStream(
        streamOrPromise: AsyncIterable<string>,
        emit: (message: any) => Promise<void> | void,
        groupId: string,
      ) {
        // Signal the UI that a streaming response is starting
        await emit({
          type: "streaming-start",
          payload: { groupId },
        });

        // promptStreaming may return cumulative chunks (full text so far) or

        let accumulated = "";
        let lastMeaningfulLength = 0;
        let staleCount = 0;
        const MAX_STALE = 3;
        let chunkCount = 0;
        let jsonComplete = false;
        let lastExtractedLength = 0;

        for await (const chunk of streamOrPromise) {
          const text = String(chunk);
          chunkCount++;

          // Heuristic: if the chunk is longer than accumulated so far, the API
          // is returning cumulative text (each chunk = full response to date).
          // Otherwise treat it as a delta and append.
          if (
            text.length >= accumulated.length &&
            text.startsWith(accumulated.slice(0, 20))
          ) {
            accumulated = text; // cumulative
          } else {
            accumulated += text; // delta
          }

          // Extract text from JSON if possible for the UI streaming bubble.
          // We do this at the top of the loop to ensure even the final chunk
          // is processed before the "complete JSON" break.
          let textToStream = "";
          const rawStr = accumulated.trimStart();
          if (rawStr.startsWith("{")) {
            // Heuristic for {"type":"response","response":"..."}
            // We look for the "response" field specifically
            const match = rawStr.match(
              /\"response\"\s*:\s*\"((?:[^\"\\]|\\.)*)/,
            );
            if (match) {
              textToStream = match[1]
                .replace(/\\"/g, '"')
                .replace(/\\n/g, "\n");
            }
          } else {
            // Not JSON (e.g. retry without constraint), stream raw
            textToStream = rawStr;
          }

          if (textToStream && textToStream.length > lastExtractedLength) {
            const delta = textToStream.slice(lastExtractedLength);
            lastExtractedLength = textToStream.length;

            await emit({
              type: "streaming-chunk",
              payload: { groupId, text: delta },
            });
          }

          const trimmed = accumulated.trim();
          const trimmedLen = trimmed.length;

          // Detect stale: no new meaningful (non-whitespace) content
          if (trimmedLen <= lastMeaningfulLength) {
            staleCount++;
            if (staleCount >= MAX_STALE) {
              console.debug(
                "[prompt-api] stream stale after",
                chunkCount,
                "chunks, breaking",
              );

              break;
            }

            continue;
          }

          staleCount = 0;
          lastMeaningfulLength = trimmedLen;

          // Detect complete JSON — the stream may never close, so once we have
          // a parseable JSON object that matches our expected envelope, stop.
          if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
              const test = JSON.parse(trimmed);
              if (
                test &&
                (test.type === "response" || test.type === "tool_use")
              ) {
                jsonComplete = true;
                console.debug(
                  "[prompt-api] complete JSON detected at",
                  accumulated.length,
                  "chars, breaking",
                );

                break;
              }
            } catch {
              // Not yet valid JSON — keep streaming
            }
          }

          // Emit typing so UI transitions from "Thinking" → "Responding"
          if (chunkCount === 1) {
            await emit({ type: "typing", payload: { groupId } });
          }

          // Log progress at milestones only — first chunk, then every ~500 chars
          const charMilestone = Math.floor(accumulated.length / 500);
          const lastMilestone = Math.floor(
            (accumulated.length - (trimmedLen - lastMeaningfulLength)) / 500,
          );
          if (chunkCount === 1 || charMilestone > lastMilestone) {
            const tail =
              accumulated.length > 100
                ? "…" + accumulated.slice(-100)
                : accumulated;
            await emit(
              createLogMessage(
                groupId,
                "streaming",
                `Generating (${accumulated.length} chars)`,
                tail,
              ),
            );
          }
        }

        return accumulated;
      }

      if (supportsPromptConstraintOptions()) {
        try {
          raw = await consumeStream(
            session.promptStreaming(prompt, {
              signal: abortSignal,
              responseConstraint: toolJsonSchema,
              omitResponseConstraintInput: true,
            }),
            emit,
            groupId,
          );
          // If the constrained stream stalled on incomplete JSON (e.g. '{"'),
          // retry without the constraint so the model can freely generate.
          if (!parseStructured(raw)) {
            console.debug(
              "[prompt-api] constrained output incomplete, retrying without constraint",
            );
            raw = await consumeStream(
              session.promptStreaming(prompt, { signal: abortSignal }),
              emit,
              groupId,
            );
          }
        } catch {
          raw = await consumeStream(
            session.promptStreaming(prompt, { signal: abortSignal }),
            emit,
            groupId,
          );
        }
      } else {
        raw = await consumeStream(
          session.promptStreaming(prompt, { signal: abortSignal }),
          emit,
          groupId,
        );
      }

      const parsed = parseStructured(raw);

      // Signal end of stream before processing results
      if (parsed?.type === "tool_use") {
        await emit({
          type: "streaming-end",
          payload: { groupId },
        });
      } else {
        // Extract final text for streaming-done
        let finalText = parsed?.response;
        if (!finalText) {
          const rawStr = String(raw || "").trim();
          finalText = rawStr.startsWith("{") ? "" : rawStr;
        }

        await emit({
          type: "streaming-done",
          payload: { groupId, text: finalText || "(no response)" },
        });
      }

      console.debug("[prompt-api] iteration", i, "raw:", raw?.slice?.(0, 300));
      console.debug(
        "[prompt-api] parsed:",
        JSON.stringify(parsed)?.slice(0, 300),
      );
      if (!parsed || parsed.type === "response") {
        // If the model returned valid JSON with type=response but no response
        // field, or returned something unparseable, treat the raw output as
        // plain text only if it doesn't look like our JSON envelope.
        let text = parsed?.response;
        if (!text) {
          const rawStr = String(raw || "").trim();
          text = rawStr.startsWith("{") ? "" : rawStr;
        }

        const preview =
          (text || "").length > 200
            ? (text || "").slice(0, 200) + "…"
            : text || "(no response)";
        await emit(createLogMessage(groupId, "text", "Response text", preview));
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
          payload: {
            groupId,
            text: parsed.response || "(no response)",
          },
        });

        return;
      }

      const toolResults: any[] = [];
      // Defer open-file messages until all tool calls in the batch complete.
      // Nano may emit open_file before write_file in the same batch — deferring
      // ensures the file exists on disk before the UI tries to read it.
      const deferredOpenFileMessages: any[] = [];

      for (const call of calls) {
        const inputPreview = JSON.stringify(call.input)?.slice(0, 200);
        await emit(
          createLogMessage(
            groupId,
            "tool-call",
            `Tool: ${call.name}`,
            inputPreview,
          ),
        );

        await emit(createToolActivityMessage(groupId, call.name, "running"));

        let toolOutput;
        // Route worker-originated side effects (toast/open-file/task updates)
        // to the orchestrator's normal inbound handler, but hold open-file.
        setPostHandler((msg) => {
          if (msg?.type === "open-file") {
            deferredOpenFileMessages.push(msg);
          } else {
            emit(msg);
          }
        });
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

        const outputPreview =
          typeof toolOutput === "string"
            ? toolOutput.slice(0, 200)
            : JSON.stringify(toolOutput)?.slice(0, 200);
        await emit(
          createLogMessage(
            groupId,
            "tool-result",
            `Result: ${call.name}`,
            outputPreview,
          ),
        );

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

      // Now that all tool calls are done, emit deferred open-file messages.
      for (const msg of deferredOpenFileMessages) {
        await emit(msg);
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

export async function compactWithPromptApi(
  systemPrompt: string,
  messages: any[],
  abortSignal: AbortSignal,
  emit: (message: any) => Promise<void> | void,
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
 */
export async function __resetPromptApiSessionCacheForTests(): Promise<void> {
  await destroyWarmSession();
}
