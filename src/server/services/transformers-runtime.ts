/**
 * Transformers.js Runtime Manager
 *
 * Encapsulates the lifecycle, caching, and execution of local ONNX models
 * using @huggingface/transformers. Replaces module-level globals with a
 * factory pattern to enable safe dependency injection.
 */

import { env } from "node:process";
import {
  readFile,
  writeFile,
  mkdir,
  stat,
  unlink,
  readdir,
} from "node:fs/promises";
import path from "node:path";

import { parsePositiveInteger } from "../utils/proxy-helpers.js";

const DEFAULT_USER_AGENT =
  process.env.SHADOWCLAW_USER_AGENT || "ShadowClaw/1.0";
const TRANSFORMERS_JS_MODULE_ID = "@huggingface/transformers";
export const DEFAULT_TRANSFORMERS_JS_MODEL =
  "onnx-community/gemma-4-E2B-it-ONNX";
const TRANSFORMERS_JS_MODELS_CACHE_FILE = path.resolve(
  process.cwd(),
  "assets/cache/transformers.js/models.json",
);
const TRANSFORMERS_JS_RUNTIME_CACHE_DIR = path.resolve(
  process.cwd(),
  "assets/cache/transformers.js",
);
const TRANSFORMERS_JS_DISCOVERY_DOWNLOAD_FILE = path.resolve(
  process.cwd(),
  "assets/cache/transformers.js/models-discovery.json.part",
);
const TRANSFORMERS_JS_RUNTIME_IDLE_MS = 10_000;
const DEFAULT_TRANSFORMERS_JS_REQUEST_TIMEOUT_MS = 300_000;

export type TransformersJsRuntime = {
  processor: any;
  model: any;
  TextStreamer: any;
  modelLoaderName: string;
};

export type TransformersJsDownloadStatus = {
  status: "idle" | "running" | "done" | "error";
  progress: number | null;
  message: string;
  modelId: string | null;
  updatedAt: number;
};

export type TransformersModelMetadata = {
  id: string;
  name: string;
  context_length: number;
  max_completion_tokens: number;
  supports_tools: boolean;
};

export type TransformersJsDiskCacheStatus = {
  modelsCatalogPath: string;
  modelsCatalogExists: boolean;
  runtimeCacheDir: string;
  runtimeCacheDirExists: boolean;
  runtimeCacheEntryCount: number;
  runtimeCacheEntries: string[];
  loadedRuntimeModels: string[];
};

const STATIC_MODELS: TransformersModelMetadata[] = [
  {
    id: DEFAULT_TRANSFORMERS_JS_MODEL,
    name: "Gemma 4 E2B (ONNX)",
    context_length: 32000,
    max_completion_tokens: 4096,
    supports_tools: true,
  },
  {
    id: "onnx-community/gemma-4-E4B-it-ONNX",
    name: "Gemma 4 E4B (ONNX)",
    context_length: 32000,
    max_completion_tokens: 4096,
    supports_tools: true,
  },
  {
    id: "onnx-community/gemma-4-E9B-it-ONNX",
    name: "Gemma 4 E9B (ONNX)",
    context_length: 32000,
    max_completion_tokens: 4096,
    supports_tools: true,
  },
  {
    id: "onnx-community/gemma-4-E27B-it-ONNX",
    name: "Gemma 4 E27B (ONNX)",
    context_length: 32000,
    max_completion_tokens: 4096,
    supports_tools: true,
  },
];

export interface TransformersRuntimeService {
  runChatCompletion(params: {
    modelId: string;
    messages: any[];
    maxCompletionTokens: number;
    verbose: boolean;
    onToken?: (text: string) => void;
    abortSignal?: AbortSignal;
  }): Promise<{ text: string; promptTokens: number; completionTokens: number }>;
  fetchDynamicModels(): Promise<TransformersModelMetadata[]>;
  getDownloadStatus(): TransformersJsDownloadStatus;
  getDiskCacheStatus(): Promise<TransformersJsDiskCacheStatus>;
  prewarmModel(params: {
    modelId: string;
    verbose: boolean;
  }): Promise<{ modelId: string; loader: string; cacheDir: string }>;
  disposeRuntime(modelId: string): Promise<void>;

  // Test helpers
  __setRuntimeForTests(modelId: string, runtime: TransformersJsRuntime): void;
  __setDownloadStatusForTests(
    next: Partial<TransformersJsDownloadStatus>,
  ): void;
  __resetRuntimeForTests(): Promise<void>;
}

export function createTransformersRuntimeService(): TransformersRuntimeService {
  // Encapsulated State
  const runtimeCache = new Map<string, Promise<TransformersJsRuntime>>();
  const activeRequests = new Map<string, number>();
  const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let modelsCache: { models: TransformersModelMetadata[] } | null = null;
  const downloadStatus: TransformersJsDownloadStatus = {
    status: "idle",
    progress: null,
    message: "Idle",
    modelId: null,
    updatedAt: Date.now(),
  };

  // Internal Helpers
  function setDownloadStatus(next: Partial<TransformersJsDownloadStatus>) {
    Object.assign(downloadStatus, next, { updatedAt: Date.now() });
  }

  function clearCleanupTimer(modelId: string): void {
    const timer = cleanupTimers.get(modelId);
    if (timer) {
      clearTimeout(timer);
      cleanupTimers.delete(modelId);
    }
  }

  function markRuntimeInUse(modelId: string): void {
    clearCleanupTimer(modelId);
    const active = activeRequests.get(modelId) || 0;
    activeRequests.set(modelId, active + 1);
  }

  function releaseRuntime(modelId: string): void {
    const active = activeRequests.get(modelId) || 0;
    if (active <= 1) {
      activeRequests.delete(modelId);
      scheduleCleanup(modelId);

      return;
    }

    activeRequests.set(modelId, active - 1);
  }

  function scheduleCleanup(modelId: string): void {
    clearCleanupTimer(modelId);
    const timer = setTimeout(() => {
      const active = activeRequests.get(modelId) || 0;
      if (active > 0) {
        return;
      }

      void disposeRuntime(modelId);
    }, TRANSFORMERS_JS_RUNTIME_IDLE_MS);
    cleanupTimers.set(modelId, timer);
  }

  async function disposeRuntime(modelId: string): Promise<void> {
    clearCleanupTimer(modelId);
    const pendingRuntime = runtimeCache.get(modelId);
    runtimeCache.delete(modelId);
    activeRequests.delete(modelId);

    if (!pendingRuntime) {
      return;
    }

    try {
      const runtime = await pendingRuntime;
      await Promise.resolve(runtime.model?.dispose?.()).catch(() => {});
      await Promise.resolve(runtime.processor?.dispose?.()).catch(() => {});
    } catch {
      // Ignore dispose failures
    }
  }

  function createAbortError(message: string): Error {
    const error = new Error(message);
    error.name = "AbortError";

    return error;
  }

  function isAbortError(error: unknown): boolean {
    return error instanceof DOMException
      ? error.name === "AbortError"
      : error instanceof Error && error.name === "AbortError";
  }

  async function awaitOperation<T>(
    promise: Promise<T>,
    opts: {
      modelId: string;
      phase: string;
      timeoutMs: number;
      abortSignal?: AbortSignal;
    },
  ): Promise<T> {
    const { modelId, phase, timeoutMs, abortSignal } = opts;
    if (!timeoutMs || timeoutMs <= 0) {
      return promise;
    }

    return await new Promise<T>((resolve, reject) => {
      let settled = false;
      const timeoutPollIntervalMs = Math.max(
        25,
        Math.min(1000, Math.floor(timeoutMs / 10)),
      );
      let timeoutHandle: ReturnType<
        typeof setInterval | typeof setTimeout
      > | null = null;
      let lastProgressValue =
        phase === "model load" &&
        downloadStatus.modelId === modelId &&
        typeof downloadStatus.progress === "number"
          ? downloadStatus.progress
          : null;
      let lastProgressIncreaseAt = Date.now();

      const rejectTimedOut = () => {
        const message = `Transformers.js ${phase} timed out after ${timeoutMs}ms for model '${modelId}'.`;
        setDownloadStatus({
          status: "error",
          progress: null,
          message,
          modelId,
        });

        if (phase === "model load") {
          void disposeRuntime(modelId);
        }

        reject(new Error(message));
      };

      const finalize = () => {
        settled = true;
        if (timeoutHandle !== null) {
          if (phase === "model load") {
            clearInterval(timeoutHandle as ReturnType<typeof setInterval>);
          } else {
            clearTimeout(timeoutHandle as ReturnType<typeof setTimeout>);
          }
        }

        abortSignal?.removeEventListener("abort", onAbort);
      };

      const onAbort = () => {
        if (settled) {
          return;
        }

        finalize();
        reject(createAbortError("Transformers.js request was aborted"));
      };

      if (phase === "model load") {
        timeoutHandle = setInterval(() => {
          if (settled) {
            return;
          }

          const isMatchingModel = downloadStatus.modelId === modelId;
          const currentProgress = downloadStatus.progress;

          if (
            isMatchingModel &&
            typeof currentProgress === "number" &&
            (lastProgressValue === null || currentProgress > lastProgressValue)
          ) {
            lastProgressValue = currentProgress;
            lastProgressIncreaseAt = Date.now();
          }

          if (Date.now() - lastProgressIncreaseAt >= timeoutMs) {
            finalize();
            rejectTimedOut();
          }
        }, timeoutPollIntervalMs);
      } else {
        timeoutHandle = setTimeout(() => {
          if (settled) {
            return;
          }

          finalize();
          rejectTimedOut();
        }, timeoutMs);
      }

      abortSignal?.addEventListener("abort", onAbort, { once: true });

      promise.then(
        (value) => {
          if (settled) {
            return;
          }

          finalize();
          resolve(value);
        },
        (error) => {
          if (settled) {
            return;
          }

          finalize();
          reject(error);
        },
      );
    });
  }

  function getRequestTimeoutMs(): number {
    return parsePositiveInteger(
      env.TRANSFORMERS_JS_REQUEST_TIMEOUT_MS,
      DEFAULT_TRANSFORMERS_JS_REQUEST_TIMEOUT_MS,
    );
  }

  async function ensureDiskCacheConfig(transformers: any) {
    const envConfig = Reflect.get(transformers, "env");
    if (!envConfig || typeof envConfig !== "object") {
      return;
    }

    await mkdir(TRANSFORMERS_JS_RUNTIME_CACHE_DIR, { recursive: true });
    Reflect.set(envConfig, "useFSCache", true);
    Reflect.set(envConfig, "useBrowserCache", false);
    Reflect.set(envConfig, "cacheDir", TRANSFORMERS_JS_RUNTIME_CACHE_DIR);
  }

  async function pathExists(target: string): Promise<boolean> {
    try {
      await stat(target);

      return true;
    } catch {
      return false;
    }
  }

  function estimateTextTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  function sanitizeOutputText(text: string): string {
    return text.replace(/<\s*turn\|>\s*|<\|end_of_turn\|>|<\|eot_id\|>/gi, "");
  }

  function extractMessageText(message: any): string {
    const content = message?.content;
    if (typeof content === "string") {
      return content;
    }

    if (!Array.isArray(content)) {
      return "";
    }

    return content
      .map((block: any) => {
        if (block?.type === "text" && typeof block.text === "string") {
          return block.text;
        }

        if (
          block?.type === "tool_result" &&
          typeof block.content === "string" &&
          block.content
        ) {
          return `[tool-result] ${block.content}`;
        }

        if (block?.type === "attachment") {
          return `[attachment:${block.mediaType}] ${block.fileName} (${block.mimeType})`;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  function buildPromptFromMessages(messages: any[]): string {
    const lines = messages
      .map((message: any) => {
        const role =
          message?.role === "assistant"
            ? "assistant"
            : message?.role === "system"
              ? "system"
              : "user";
        const text = extractMessageText(message).trim();
        if (!text) {
          return "";
        }

        return `${role}: ${text}`;
      })
      .filter(Boolean);

    if (lines.length === 0) {
      return "user: Say hello.";
    }

    return lines.join("\n");
  }

  async function loadRuntime(
    modelId: string,
    verbose: boolean,
  ): Promise<TransformersJsRuntime> {
    const supportedModelIds = STATIC_MODELS.map((m) => m.id);
    if (!supportedModelIds.includes(modelId)) {
      const supportedList = STATIC_MODELS.map(
        (m) => `${m.id} (${m.name})`,
      ).join(", ");
      const message = `Model '${modelId}' is not supported by Transformers.js. This provider only supports ONNX-converted models. Supported models: ${supportedList}`;
      setDownloadStatus({
        status: "error",
        progress: null,
        message,
        modelId,
      });

      throw new Error(message);
    }

    const cached = runtimeCache.get(modelId);
    if (cached) {
      return cached;
    }

    const loadingPromise = (async () => {
      const transformers = await import(TRANSFORMERS_JS_MODULE_ID);
      await ensureDiskCacheConfig(transformers);
      const AutoProcessor = Reflect.get(transformers, "AutoProcessor");
      const Gemma4Processor = Reflect.get(transformers, "Gemma4Processor");
      const Gemma4ForConditionalGeneration = Reflect.get(
        transformers,
        "Gemma4ForConditionalGeneration",
      );
      const AutoModelForImageTextToText = Reflect.get(
        transformers,
        "AutoModelForImageTextToText",
      );
      const AutoModelForCausalLM = Reflect.get(
        transformers,
        "AutoModelForCausalLM",
      );
      const TextStreamer = Reflect.get(transformers, "TextStreamer");
      const isGemma4Model = modelId.toLowerCase().includes("gemma-4");

      const loaderCandidates: Array<{
        name: string;
        from_pretrained?: Function;
      }> = [];

      if (
        isGemma4Model &&
        typeof Gemma4ForConditionalGeneration?.from_pretrained === "function"
      ) {
        loaderCandidates.push({
          name: "Gemma4ForConditionalGeneration",
          from_pretrained: Gemma4ForConditionalGeneration.from_pretrained,
        });
      }

      if (
        !isGemma4Model &&
        typeof AutoModelForImageTextToText?.from_pretrained === "function"
      ) {
        loaderCandidates.push({
          name: "AutoModelForImageTextToText",
          from_pretrained: AutoModelForImageTextToText.from_pretrained,
        });
      }

      if (
        !isGemma4Model &&
        typeof AutoModelForCausalLM?.from_pretrained === "function"
      ) {
        loaderCandidates.push({
          name: "AutoModelForCausalLM",
          from_pretrained: AutoModelForCausalLM.from_pretrained,
        });
      }

      if (
        typeof AutoProcessor?.from_pretrained !== "function" ||
        loaderCandidates.length === 0 ||
        typeof TextStreamer !== "function"
      ) {
        if (isGemma4Model) {
          throw new Error(
            "Transformers.js runtime is unavailable for Gemma 4. Ensure @huggingface/transformers exports Gemma4Processor and Gemma4ForConditionalGeneration, then restart the server.",
          );
        }

        throw new Error(
          "Transformers.js runtime is unavailable. Ensure @huggingface/transformers exports AutoProcessor and at least one model loader.",
        );
      }

      if (verbose) {
        console.log(`[Proxy] Loading Transformers.js model: ${modelId}`);
      }

      setDownloadStatus({
        status: "running",
        progress: 0,
        message: `Preparing model ${modelId}...`,
        modelId,
      });

      const processor = isGemma4Model
        ? await (typeof Gemma4Processor?.from_pretrained === "function"
            ? Gemma4Processor.from_pretrained(modelId)
            : AutoProcessor.from_pretrained(modelId))
        : await AutoProcessor.from_pretrained(modelId);

      let model: any = null;
      let modelLoaderName = "";
      let lastLoaderError: unknown = null;

      if (isGemma4Model) {
        const gemmaDtypes = ["q4f16", "q4", "fp16"];
        for (const dtype of gemmaDtypes) {
          try {
            model = await Gemma4ForConditionalGeneration.from_pretrained(
              modelId,
              {
                dtype,
                device: "cpu",
                progress_callback: (info: any) => {
                  if (info?.status === "progress_total") {
                    const pct = Number(info.progress);
                    setDownloadStatus({
                      status: "running",
                      progress: Number.isFinite(pct)
                        ? Math.max(0, Math.min(1, pct / 100))
                        : null,
                      message: `Downloading ${modelId} (${dtype})...`,
                      modelId,
                    });
                  }
                },
              },
            );
            modelLoaderName = `Gemma4ForConditionalGeneration/${dtype}`;

            break;
          } catch (error) {
            lastLoaderError = error;
          }
        }
      } else {
        for (const candidate of loaderCandidates) {
          try {
            model = await candidate.from_pretrained?.(modelId, {
              dtype: "q4f16",
              device: "cpu",
              progress_callback: (info: any) => {
                if (info?.status === "progress_total") {
                  const pct = Number(info.progress);
                  setDownloadStatus({
                    status: "running",
                    progress: Number.isFinite(pct)
                      ? Math.max(0, Math.min(1, pct / 100))
                      : null,
                    message: `Downloading ${modelId} (${candidate.name})...`,
                    modelId,
                  });
                }
              },
            });
            modelLoaderName = candidate.name;

            break;
          } catch (error) {
            lastLoaderError = error;
          }
        }
      }

      if (!model) {
        const detail =
          lastLoaderError instanceof Error
            ? lastLoaderError.message
            : String(lastLoaderError || "unknown error");

        setDownloadStatus({
          status: "error",
          progress: null,
          message: detail,
          modelId,
        });

        throw new Error(
          `No supported Transformers.js model loader could initialize '${modelId}'. Last error: ${detail}`,
        );
      }

      setDownloadStatus({
        status: "done",
        progress: 1,
        message: `Model ready: ${modelId}`,
        modelId,
      });

      return { processor, model, TextStreamer, modelLoaderName };
    })().catch((error) => {
      runtimeCache.delete(modelId);

      throw error;
    });

    runtimeCache.set(modelId, loadingPromise);

    return loadingPromise;
  }

  // Model Discovery Helpers
  function normalizeModelInfo(modelId: string): TransformersModelMetadata {
    const shortId = modelId.replace(/^onnx-community\//, "");
    const gemmaMatch = shortId.match(/gemma-4-([^-]+)-it-onnx/i);
    const name = gemmaMatch?.[1]
      ? `Gemma 4 ${gemmaMatch[1].toUpperCase()} (ONNX)`
      : shortId;

    return {
      id: modelId,
      name,
      context_length: 32000,
      max_completion_tokens: 4096,
      supports_tools: true,
    };
  }

  async function downloadDiscoveryRows(endpoint: string) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const shouldTryResume = attempt === 0;
      let resumeOffset = 0;
      if (shouldTryResume) {
        try {
          const info = await stat(TRANSFORMERS_JS_DISCOVERY_DOWNLOAD_FILE);
          if (info.isFile()) {
            resumeOffset = info.size;
          }
        } catch {
          resumeOffset = 0;
        }
      }

      const headers: Record<string, string> = {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "application/json",
        "Accept-Encoding": "identity",
      };

      if (resumeOffset > 0) {
        headers.Range = `bytes=${resumeOffset}-`;
      }

      const response = await fetch(endpoint, { headers });
      if (response.status === 416 && shouldTryResume) {
        await unlink(TRANSFORMERS_JS_DISCOVERY_DOWNLOAD_FILE).catch(() => {});

        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Failed to discover Transformers.js models (${response.status})`,
        );
      }

      const appendMode = resumeOffset > 0 && response.status === 206;
      if (!appendMode) {
        await writeFile(TRANSFORMERS_JS_DISCOVERY_DOWNLOAD_FILE, "", "utf8");
      }

      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            if (value && value.length > 0) {
              await writeFile(TRANSFORMERS_JS_DISCOVERY_DOWNLOAD_FILE, value, {
                flag: "a",
              });
            }
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        const bodyText = await response.text();
        await writeFile(TRANSFORMERS_JS_DISCOVERY_DOWNLOAD_FILE, bodyText, {
          encoding: "utf8",
          flag: "a",
        });
      }

      try {
        const raw = await readFile(
          TRANSFORMERS_JS_DISCOVERY_DOWNLOAD_FILE,
          "utf8",
        );
        const parsed = JSON.parse(raw);

        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        if (shouldTryResume && resumeOffset > 0) {
          await unlink(TRANSFORMERS_JS_DISCOVERY_DOWNLOAD_FILE).catch(() => {});

          continue;
        }

        throw error;
      }
    }

    throw new Error("Failed to download Transformers.js discovery catalog");
  }

  return {
    async runChatCompletion(params) {
      const {
        modelId,
        messages,
        maxCompletionTokens,
        verbose,
        onToken,
        abortSignal,
      } = params;
      const requestTimeoutMs = getRequestTimeoutMs();
      markRuntimeInUse(modelId);
      let runtime: TransformersJsRuntime;
      try {
        runtime = await awaitOperation(loadRuntime(modelId, verbose), {
          modelId,
          phase: "model load",
          timeoutMs: requestTimeoutMs,
          abortSignal,
        });
      } catch (error) {
        releaseRuntime(modelId);

        throw error;
      }

      try {
        const promptText = buildPromptFromMessages(messages);
        const formattedMessages = [
          { role: "user", content: [{ type: "text", text: promptText }] },
        ];

        const prompt = runtime.processor.apply_chat_template(
          formattedMessages,
          {
            enable_thinking: false,
            add_generation_prompt: true,
          },
        );

        const inputs = await runtime.processor(prompt, null, null, {
          add_special_tokens: false,
        });
        const streamed: string[] = [];

        const outputs: any = await awaitOperation(
          runtime.model.generate({
            ...inputs,
            ...(abortSignal ? { signal: abortSignal } : {}),
            max_new_tokens: maxCompletionTokens,
            do_sample: false,
            streamer: new runtime.TextStreamer(runtime.processor.tokenizer, {
              skip_prompt: true,
              skip_special_tokens: true,
              callback_function: (text: string) => {
                if (abortSignal?.aborted) {
                  return;
                }

                const cleaned = sanitizeOutputText(text);
                if (!cleaned) {
                  return;
                }

                streamed.push(cleaned);
                onToken?.(cleaned);
              },
            }),
          }),
          {
            modelId,
            phase: "generation",
            timeoutMs: requestTimeoutMs,
            abortSignal,
          },
        );

        let text = sanitizeOutputText(streamed.join("")).trim();
        if (!text) {
          const decoded = runtime.processor.batch_decode(
            outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
            { skip_special_tokens: true },
          );
          text = sanitizeOutputText(String(decoded?.[0] || "")).trim();
        }

        return {
          text,
          promptTokens: estimateTextTokens(promptText),
          completionTokens: estimateTextTokens(text),
        };
      } catch (error) {
        if (isAbortError(error) && abortSignal?.aborted) {
          throw error;
        }

        throw error;
      } finally {
        releaseRuntime(modelId);
      }
    },

    async fetchDynamicModels() {
      if (modelsCache) {
        return modelsCache.models;
      }

      try {
        const raw = await readFile(TRANSFORMERS_JS_MODELS_CACHE_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.models)) {
          modelsCache = { models: parsed.models };

          return parsed.models;
        }
      } catch {
        // Cache miss
      }

      const endpoint =
        env.TRANSFORMERS_JS_MODELS_DISCOVERY_URL ||
        "https://huggingface.co/api/models?author=onnx-community&limit=100";
      const rows = await downloadDiscoveryRows(endpoint).catch(() => []);

      const ids = rows
        .map((row: any) => (typeof row?.id === "string" ? row.id : ""))
        .filter((id: string) => id.toLowerCase().includes("onnx"));

      const uniqueIds = [...new Set(ids)];
      const baselineIds = STATIC_MODELS.map((model) => model.id);
      const mergedIds = [...new Set([...baselineIds, ...uniqueIds])];
      if (!mergedIds.includes(DEFAULT_TRANSFORMERS_JS_MODEL)) {
        mergedIds.unshift(DEFAULT_TRANSFORMERS_JS_MODEL);
      }

      const staticModelsById = new Map(
        STATIC_MODELS.map((model) => [model.id, model]),
      );
      const models = mergedIds
        .sort((a, b) => a.localeCompare(b))
        .map((id) => staticModelsById.get(id) || normalizeModelInfo(id));

      modelsCache = { models };

      try {
        await mkdir(path.dirname(TRANSFORMERS_JS_MODELS_CACHE_FILE), {
          recursive: true,
        });
        await writeFile(
          TRANSFORMERS_JS_MODELS_CACHE_FILE,
          JSON.stringify({ models }, null, 2),
          "utf8",
        );
      } catch {}

      return models;
    },

    getDownloadStatus() {
      return { ...downloadStatus };
    },

    async getDiskCacheStatus() {
      const [modelsCatalogExists, runtimeCacheDirExists] = await Promise.all([
        pathExists(TRANSFORMERS_JS_MODELS_CACHE_FILE),
        pathExists(TRANSFORMERS_JS_RUNTIME_CACHE_DIR),
      ]);

      const runtimeCacheEntries = runtimeCacheDirExists
        ? await readdir(TRANSFORMERS_JS_RUNTIME_CACHE_DIR).catch(() => [])
        : [];

      return {
        modelsCatalogPath: TRANSFORMERS_JS_MODELS_CACHE_FILE,
        modelsCatalogExists,
        runtimeCacheDir: TRANSFORMERS_JS_RUNTIME_CACHE_DIR,
        runtimeCacheDirExists,
        runtimeCacheEntryCount: runtimeCacheEntries.length,
        runtimeCacheEntries,
        loadedRuntimeModels: [...runtimeCache.keys()],
      };
    },

    async prewarmModel(params) {
      const { modelId, verbose } = params;
      const runtime = await loadRuntime(modelId, verbose);

      return {
        modelId,
        loader: runtime.modelLoaderName,
        cacheDir: TRANSFORMERS_JS_RUNTIME_CACHE_DIR,
      };
    },

    disposeRuntime,

    __setRuntimeForTests(modelId, runtime) {
      clearCleanupTimer(modelId);
      runtimeCache.set(modelId, Promise.resolve(runtime));
    },

    __setDownloadStatusForTests(next) {
      setDownloadStatus(next);
    },

    async __resetRuntimeForTests() {
      const modelIds = new Set([
        ...runtimeCache.keys(),
        ...cleanupTimers.keys(),
        ...activeRequests.keys(),
      ]);
      await Promise.all([...modelIds].map((id) => disposeRuntime(id)));
    },
  };
}
