/**
 * LiteRT-LM Browser Provider
 *
 * Wraps the Google LiteRT-LM Web API (@litert-lm/core) to provide
 * in-browser LLM inference for Gemma 4 models via WebGPU.
 *
 * https://developers.google.com/edge/litert-lm/js
 *
 * Currently supports:
 *   - litert-community/gemma-4-E2B-it-litert-lm  (gemma-4-E2B-it-web.litertlm)
 *   - litert-community/gemma-4-E4B-it-litert-lm  (gemma-4-E4B-it-web.litertlm)
 *
 * Model IDs in config use the litert-community HuggingFace repo ID. We resolve
 * the actual .litertlm file URL from the repo's main branch.
 */

import { ShadowClawDatabase } from "./db/db.js";
import { createLogMessage } from "./worker/createLogMessage.js";
import { sanitizeModelOutput } from "./chat-template-sanitizer.js";

/**
 * Map from provider model ID (HuggingFace repo) to the .litertlm web model URL.
 */
const LITERT_LM_MODEL_URLS: Record<string, string> = {
  "litert-community/gemma-4-E2B-it-litert-lm":
    "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm",
  "litert-community/gemma-4-E4B-it-litert-lm":
    "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.litertlm",
};

export const LITERT_LM_SUPPORTED_MODELS = Object.keys(LITERT_LM_MODEL_URLS);

export const DEFAULT_LITERT_LM_MODEL =
  "litert-community/gemma-4-E2B-it-litert-lm";

/**
 * Returns true if the LiteRT-LM JS API is available (WebGPU required).
 */
export function isLiteRtLmSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/**
 * Lazy-loaded LiteRT-LM Engine singleton per model.
 * We keep one engine alive to avoid expensive re-initialization.
 */
let liteRtEngine: any | null = null;
let liteRtEngineModelId: string | null = null;

let liteRtEnginePromise: Promise<any> | null = null;
let liteRtEnginePromiseModelId: string | null = null;

type LiteRtProgressCallback = (received: number, total: number | null) => void;

export async function fetchModelStream(
  url: string,
  onProgress: LiteRtProgressCallback,
  abortSignal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  let response: Response;
  try {
    response = await fetch(url, { signal: abortSignal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw err;
    }

    throw new Error(
      `LiteRT-LM: Failed to fetch model from '${url}': ${err?.message ?? String(err)}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `LiteRT-LM: Failed to fetch model from '${url}': ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error(
      `LiteRT-LM: Failed to fetch model from '${url}': No response body`,
    );
  }

  const totalHeader = response.headers.get("content-length");
  const parsedTotal = totalHeader ? Number(totalHeader) : NaN;
  const total =
    Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : null;
  let received = 0;

  const reader = response.body.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          controller.close();

          return;
        }

        received += value.byteLength;
        onProgress(received, total);
        controller.enqueue(value);
      } catch (err: any) {
        controller.error(err);
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
}

async function getLiteRtEngine(
  modelId: string,
  onProgress?: LiteRtProgressCallback,
  abortSignal?: AbortSignal,
): Promise<any> {
  if (liteRtEngineModelId === modelId && liteRtEngine) {
    return liteRtEngine;
  }

  if (liteRtEnginePromise && liteRtEnginePromiseModelId === modelId) {
    return liteRtEnginePromise;
  }

  liteRtEnginePromiseModelId = modelId;
  liteRtEnginePromise = (async () => {
    if (liteRtEngine) {
      try {
        await liteRtEngine.delete?.();
      } catch {}

      liteRtEngine = null;
      liteRtEngineModelId = null;
    }

    const modelUrl = LITERT_LM_MODEL_URLS[modelId];
    if (!modelUrl) {
      throw new Error(
        `LiteRT-LM: Model '${modelId} is not supported. Supported models: ${LITERT_LM_SUPPORTED_MODELS.join(", ")}`,
      );
    }

    const litertlm = await import("@litert-lm/core").catch(() => {
      throw new Error(
        "LiteRT-LM: The @litert-lm/core package is not installed. Run: npm install @litert-lm/core",
      );
    });

    const Engine: any = litertlm.Engine ?? (litertlm as any).default?.Engine;
    if (typeof Engine?.create !== "function") {
      throw new Error(
        "LiteRT-LM: Could not locate Engine.create in @litert-lm/core. Ensure you have the latest version installed.",
      );
    }

    const modelStream = await fetchModelStream(
      modelUrl,
      onProgress ?? (() => {}),
      abortSignal,
    );

    const engine = await Engine.create({
      model: modelStream,
      mainExecutorSettings: {
        maxNumTokens: 8192,
      },
    });

    liteRtEngine = engine;
    liteRtEngineModelId = modelId;

    return engine;
  })();

  try {
    return await liteRtEnginePromise;
  } finally {
    liteRtEnginePromise = null;
    liteRtEnginePromiseModelId = null;
  }
}

/**
 * Map ShadowClaw internal message format to the LiteRT-LM conversation preface.
 * System prompts are passed as a preface; user/assistant turns are sent
 * individually via sendMessageStreaming.
 */
function buildLiteRtMessages(
  systemPrompt: string,
  messages: any[],
): { preface: any[]; turns: string[] } {
  const preface: any[] = [];
  if (systemPrompt) {
    preface.push({ role: "system", content: systemPrompt });
  }

  // Build prior turns as a flat prompt transcript (LiteRT-LM conversation is
  // stateful so we replay prior turns by sending them sequentially).
  // For a single-turn invocation we just send the latest user message.
  const turns: string[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      const content = Array.isArray(msg.content)
        ? msg.content
            .map((b: any) => {
              if (b?.type === "text") {
                return b.text;
              }

              if (b?.type === "tool_result") {
                return `[Tool result] ${String(b.content || "")}`;
              }

              return "";
            })
            .filter(Boolean)
            .join("\n")
        : String(msg.content || "");
      if (content) {
        turns.push(content);
      }
    }
  }

  return { preface, turns };
}

/**
 * Main entry point. Invokes the LiteRT-LM browser engine and streams the
 * response back via the emit callback, following the same protocol as
 * invokeWithTransformersJs / invokeWithPromptApi.
 */
export async function invokeWithLiteRtLm(
  _db: ShadowClawDatabase,
  groupId: string,
  systemPrompt: string,
  messages: any[],
  _maxTokens: number,
  emit: (message: any) => Promise<void> | void,
  abortSignal: AbortSignal | undefined,
  modelId: string,
) {
  if (!isLiteRtLmSupported()) {
    await emit({
      type: "response",
      payload: {
        groupId,
        text: "⚠️ LiteRT-LM requires WebGPU, which is not available in this browser. Try Chrome or Edge on a desktop with GPU support.",
      },
    });

    return;
  }

  await emit(
    createLogMessage(
      groupId,
      "info",
      "Starting",
      `Provider: LiteRT-LM (Browser · WebGPU) · Model: ${modelId}`,
    ),
  );

  // Emit model-download-progress so the UI shows a loading state
  await emit({
    type: "model-download-progress",
    payload: {
      groupId,
      status: "running",
      progress: 0,
      message: `Loading LiteRT-LM model: ${modelId}…`,
    },
  });

  const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(0);

  let lastEmittedPct = -1;

  const onProgress: LiteRtProgressCallback = (received, total) => {
    const progress = total ? received / total : null;
    const pct = progress != null ? Math.floor(progress * 100) : -1;

    if (pct === lastEmittedPct) {
      return;
    }

    lastEmittedPct = pct;

    const message = total
      ? `Downloading ${modelId}: ${formatMb(received)} / ${formatMb(total)} MB`
      : `Downloading ${modelId}: ${formatMb(received)} MB`;

    void emit({
      type: "model-download-progress",
      payload: { groupId, status: "running", progress, message },
    });
  };

  let engine: any;

  try {
    engine = await getLiteRtEngine(modelId, onProgress, abortSignal);
  } catch (err: any) {
    if (abortSignal?.aborted || err?.name === "AbortError") {
      await emit({
        type: "model-download-progress",
        payload: {
          groupId,
          status: "error",
          progress: null,
          message: "LiteRT-LM model download cancelled.",
        },
      });

      return;
    }

    await emit({
      type: "model-download-progress",
      payload: {
        groupId,
        status: "error",
        progress: null,
        message: `LiteRT-LM model failed to load: ${err?.message ?? String(err)}`,
      },
    });

    await emit({
      type: "response",
      payload: {
        groupId,
        text: `⚠️ LiteRT-LM failed to initialize: ${err?.message ?? String(err)}`,
      },
    });

    return;
  }

  await emit({
    type: "model-download-progress",
    payload: {
      groupId,
      status: "done",
      progress: 1,
      message: "LiteRT-LM model ready.",
    },
  });

  const { preface, turns } = buildLiteRtMessages(systemPrompt, messages);

  let conversation: any;
  try {
    conversation = await engine.createConversation({
      preface: { messages: preface },
    });
  } catch (err: any) {
    await emit({
      type: "response",
      payload: {
        groupId,
        text: `⚠️ LiteRT-LM failed to create conversation: ${err?.message ?? String(err)}`,
      },
    });

    return;
  }

  // Replay prior turns (if any) — LiteRT-LM conversation is stateful.
  // All turns except the final user turn are sent non-streaming.
  const priorTurns = turns.slice(0, -1);
  const lastTurn = turns[turns.length - 1] ?? "Hello.";

  for (const turn of priorTurns) {
    if (abortSignal?.aborted) {
      return;
    }

    try {
      await conversation.sendMessage(turn);
    } catch {
      // If replaying history fails, continue to latest turn anyway
    }
  }

  if (abortSignal?.aborted) {
    return;
  }

  await emit({ type: "streaming-start", payload: { groupId } });

  let accumulated = "";
  try {
    const stream = conversation.sendMessageStreaming(lastTurn);
    for await (const chunk of stream) {
      if (abortSignal?.aborted) {
        break;
      }

      const text = chunk?.content?.[0]?.text ?? "";
      if (text) {
        const cleaned = sanitizeModelOutput(text, "openai");
        if (cleaned) {
          accumulated += cleaned;
          await emit({
            type: "streaming-chunk",
            payload: { groupId, text: cleaned },
          });
        }
      }
    }
  } catch (err: any) {
    if (abortSignal?.aborted) {
      return;
    }

    await emit({
      type: "response",
      payload: {
        groupId,
        text: `⚠️ LiteRT-LM generation error: ${err?.message ?? String(err)}`,
      },
    });

    return;
  }

  await emit({
    type: "streaming-done",
    payload: { groupId, text: accumulated },
  });

  await emit({
    type: "response",
    payload: { groupId, text: accumulated },
  });
}
