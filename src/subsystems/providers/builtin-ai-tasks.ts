/**
 * Provides typed access to
 *
 * - Summarizer API (supports capability/speed/auto performance preferences)
 * - Writer API
 * - Rewriter API
 * - Language Detector API
 * - Translator API
 * - Proofreader API (native or Rewriter fallback)
 *
 * Automatically defers to polyfills (`built-in-ai-task-apis-polyfills` and `prompt-api-polyfill`)
 * when native browser support is not present.
 */

import { createModelCacheFetch } from "./utils/index.js";
import { getDb } from "../../db/db.js";
import { getConfig } from "../../db/getConfig.js";
import { CONFIG_KEYS } from "../../config/config.js";

export type BuiltinTaskType =
  | "summarizer"
  | "writer"
  | "rewriter"
  | "language-detector"
  | "translator"
  | "proofreader"
  | "semantic-embedder";

export interface BuiltinTaskProgress {
  status: "running" | "done" | "error";
  progress: number | null;
  message?: string;
}

export type BuiltinTaskProgressCallback = (
  progress: BuiltinTaskProgress,
) => void;

export interface BaseBuiltinTaskOptions {
  onProgress?: BuiltinTaskProgressCallback;
}

export interface SummarizeOptions extends BaseBuiltinTaskOptions {
  type?: "key-points" | "tldr" | "teaser" | "headline";
  format?: "plain-text" | "markdown";
  length?: "short" | "medium" | "long";
  sharedContext?: string;
  context?: string;
  preference?: "capability" | "speed" | "auto";
}

export interface WriteOptions extends BaseBuiltinTaskOptions {
  context?: string;
  sharedContext?: string;
}

export interface RewriteOptions extends BaseBuiltinTaskOptions {
  context?: string;
  sharedContext?: string;
  tone?: "as-is" | "more-formal" | "more-casual";
  length?: "as-is" | "shorter" | "longer";
}

export interface TranslateOptions extends BaseBuiltinTaskOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export interface LanguageDetectorOptions extends BaseBuiltinTaskOptions {}

export interface ProofreadOptions extends BaseBuiltinTaskOptions {
  context?: string;
}

export interface EmbedTextOptions extends BaseBuiltinTaskOptions {
  taskType?:
    | "semantic-similarity"
    | "retrieval-query"
    | "retrieval-document"
    | "classification"
    | "clustering";
}

export interface EmbeddingResultItem {
  values: Float32Array | number[];
  statistics?: { tokenCount?: number; truncated?: boolean };
}

export interface EmbeddingResult {
  embeddings: EmbeddingResultItem[];
  metadata?: { embeddingSpace?: string; maxInputTokens?: number };
}

export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
}

export function getSummarizerFactory(): any {
  const g = globalThis as any;
  return g.Summarizer || g.ai?.summarizer;
}

export function getWriterFactory(): any {
  const g = globalThis as any;
  return g.Writer || g.ai?.writer;
}

export function getRewriterFactory(): any {
  const g = globalThis as any;
  return g.Rewriter || g.ai?.rewriter;
}

export function getLanguageDetectorFactory(): any {
  const g = globalThis as any;
  return (
    g.LanguageDetector ||
    g.ai?.languageDetector ||
    g.translation?.languageDetector
  );
}

export function getTranslatorFactory(): any {
  const g = globalThis as any;
  return g.Translator || g.ai?.translator || g.translation?.translator;
}

export function getProofreaderFactory(): any {
  const g = globalThis as any;
  return g.Proofreader || g.ai?.proofreader;
}

export function getSemanticEmbedderFactory(): any {
  const g = globalThis as any;
  return (
    g.SemanticEmbedder ||
    g.TextEmbedder ||
    g.ai?.semanticEmbedder ||
    g.ai?.textEmbedder
  );
}

export async function isWebGpuAdapterAvailable(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return false;
  }
  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    if (device) {
      if (typeof device.destroy === "function") {
        device.destroy();
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Returns true when the error indicates the accelerated backend (WebGPU/WebNN)
 * failed due to a missing operator or unsupported model quantization format,
 * rather than a recoverable app-level error.
 *
 * Covers:
 * - Generic WebGPU init failures ("webgpu", "webgpuInit", "no available backend")
 * - ONNX Runtime ORT_NOT_IMPLEMENTED (ERROR_CODE: 9) — fires when a GPU driver
 *   supports WebGPU/WebNN but lacks a specific kernel (e.g. GatherBlockQuantized
 *   for block-quantized q4f16 models)
 * - WebNN backend errors
 */
function isAcceleratedBackendError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes("webgpu") ||
    lower.includes("webgpuinit") ||
    lower.includes("no available backend") ||
    lower.includes("webnn") ||
    // ONNX Runtime ORT_NOT_IMPLEMENTED — unsupported op on this GPU driver
    lower.includes("error_code: 9") ||
    lower.includes("could not find an implementation") ||
    lower.includes("gatherblockquantized") ||
    lower.includes("ort_not_implemented") ||
    // ONNX Runtime / GPU memory allocation failures (ORT_ENGINE_ERROR / ORT_FAIL)
    lower.includes("error_code: 6") ||
    lower.includes("bad_alloc") ||
    lower.includes("out of memory") ||
    lower.includes("allocation failed")
  );
}

export let PROMPT_API_POLYFILL_MODEL = "onnx-community/gemma-3-1b-it-ONNX-GQA";

export async function getPromptApiFallbackModel(): Promise<string> {
  try {
    const db = await getDb();
    if (db) {
      const configured = await getConfig(
        db,
        CONFIG_KEYS.PROMPT_API_FALLBACK_MODEL,
      );
      if (configured && typeof configured === "string") {
        return configured;
      }
    }
  } catch (e) {
    // ignore
  }
  return PROMPT_API_POLYFILL_MODEL;
}

export async function createTaskInstanceWithFallback<T = any>(
  factory: { create: (opts?: any) => Promise<T> },
  createOpts: any,
): Promise<T> {
  try {
    return await factory.create(createOpts);
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    const g = globalThis as any;
    const currentDevice: string = g.TRANSFORMERS_CONFIG?.device ?? "";
    const isAccelerated =
      currentDevice === "webgpu" || currentDevice.startsWith("webnn");

    if (isAccelerated && isAcceleratedBackendError(errMsg)) {
      let fallbackModel = await getPromptApiFallbackModel();

      console.warn(
        `Built-in AI Polyfill: ${currentDevice} backend failed (${errMsg.slice(0, 120)}). Retrying with WASM/q4 CPU fallback (${fallbackModel})...`,
        err,
      );
      if (!g.TRANSFORMERS_CONFIG) {
        g.TRANSFORMERS_CONFIG = { apiKey: "dummy" };
      }
      g.TRANSFORMERS_CONFIG.device = "wasm";
      g.TRANSFORMERS_CONFIG.dtype = "q4";
      g.TRANSFORMERS_CONFIG.modelName = fallbackModel;
      if (!g.TRANSFORMERS_CONFIG.env) {
        g.TRANSFORMERS_CONFIG.env = {
          useBrowserCache: false,
          useWasmCache: true,
          fetch: createModelCacheFetch(),
        };
      }
      return await factory.create(createOpts);
    }
    throw err;
  }
}

/**
 * Dynamically import polyfills if native APIs are absent on globalThis or window.ai.
 */
export async function ensureBuiltinAiPolyfills(): Promise<void> {
  const g = globalThis as any;
  const tasks: Promise<any>[] = [];

  // Web Workers lack document and MutationObserver, which prompt-api-polyfill and built-in-ai-task-apis-polyfills require.
  if (!("document" in g)) {
    g.document = {
      defaultView: g,
      documentElement: null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: (tag: string) => {
        if (typeof OffscreenCanvas !== "undefined" && tag === "canvas") {
          return new OffscreenCanvas(300, 150);
        }
        return {};
      },
    };
  }

  if (!("MutationObserver" in g)) {
    g.MutationObserver = class MutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
  }

  let currentFallbackModel: string | undefined;

  if (!("LanguageModel" in g) && !g.ai?.languageModel) {
    currentFallbackModel = await getPromptApiFallbackModel();

    if (!g.TRANSFORMERS_CONFIG) {
      let device = "wasm";
      let dtype = "q4";

      if (typeof navigator !== "undefined") {
        if ("ml" in navigator) {
          device = "webnn";
          dtype = "q4f16";
        } else if ("gpu" in navigator) {
          const webgpuOk = await isWebGpuAdapterAvailable();
          if (webgpuOk) {
            device = "webgpu";
            dtype = "q4f16";
          }
        }
      }

      g.TRANSFORMERS_CONFIG = {
        apiKey: "dummy",
        device,
        dtype,
        ...(currentFallbackModel ? { modelName: currentFallbackModel } : {}),
        env: {
          useBrowserCache: false,
          useWasmCache: true,
          fetch: createModelCacheFetch(),
        },
      };
    } else if (!g.TRANSFORMERS_CONFIG.env) {
      g.TRANSFORMERS_CONFIG.env = {
        useBrowserCache: false,
        useWasmCache: true,
        fetch: createModelCacheFetch(),
      };
    }
    tasks.push(
      import("prompt-api-polyfill")
        .then((mod) => {
          if (mod?.LanguageModel && !g.LanguageModel) {
            g.LanguageModel = mod.LanguageModel;
          }
        })
        .catch(() => {}),
    );
  }

  if (g.TRANSFORMERS_CONFIG) {
    if (!currentFallbackModel) {
      currentFallbackModel = await getPromptApiFallbackModel();
    }
    if (currentFallbackModel) {
      g.TRANSFORMERS_CONFIG.modelName = currentFallbackModel;
    }
  }
  if (!getSummarizerFactory()) {
    tasks.push(
      import("built-in-ai-task-apis-polyfills/summarizer")
        .then((mod) => {
          if (mod?.Summarizer && !g.Summarizer) {
            g.Summarizer = mod.Summarizer;
          }
        })
        .catch(() => {}),
    );
  }
  if (!getWriterFactory()) {
    tasks.push(
      import("built-in-ai-task-apis-polyfills/writer")
        .then((mod) => {
          if (mod?.Writer && !g.Writer) {
            g.Writer = mod.Writer;
          }
        })
        .catch(() => {}),
    );
  }
  if (!getRewriterFactory()) {
    tasks.push(
      import("built-in-ai-task-apis-polyfills/rewriter")
        .then((mod) => {
          if (mod?.Rewriter && !g.Rewriter) {
            g.Rewriter = mod.Rewriter;
          }
        })
        .catch(() => {}),
    );
  }
  if (!getLanguageDetectorFactory()) {
    tasks.push(
      import("built-in-ai-task-apis-polyfills/language-detector")
        .then((mod) => {
          if (mod?.LanguageDetector && !g.LanguageDetector) {
            g.LanguageDetector = mod.LanguageDetector;
          }
        })
        .catch(() => {}),
    );
  }
  if (!getTranslatorFactory()) {
    tasks.push(
      import("built-in-ai-task-apis-polyfills/translator")
        .then((mod) => {
          if (mod?.Translator && !g.Translator) {
            g.Translator = mod.Translator;
          }
        })
        .catch(() => {}),
    );
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}

/**
 * Check if a built-in AI task API is currently available (natively or polyfilled).
 */
export function isBuiltinTaskSupported(task: BuiltinTaskType): boolean {
  switch (task) {
    case "summarizer":
      return typeof getSummarizerFactory() !== "undefined";
    case "writer":
      return typeof getWriterFactory() !== "undefined";
    case "rewriter":
      return typeof getRewriterFactory() !== "undefined";
    case "language-detector":
      return typeof getLanguageDetectorFactory() !== "undefined";
    case "translator":
      return typeof getTranslatorFactory() !== "undefined";
    case "proofreader":
      return typeof getProofreaderFactory() !== "undefined";
    case "semantic-embedder":
      return typeof getSemanticEmbedderFactory() !== "undefined";
    default:
      return false;
  }
}

function createMonitorHandler(
  taskLabel: string,
  onProgress?: BuiltinTaskProgressCallback,
) {
  if (!onProgress) return undefined;
  return (monitorTarget: any) => {
    if (
      !monitorTarget ||
      typeof monitorTarget.addEventListener !== "function"
    ) {
      return;
    }
    onProgress({
      status: "running",
      progress: 0,
      message: `Downloading ${taskLabel} model... 0%`,
    });
    monitorTarget.addEventListener("downloadprogress", (e: any) => {
      const loaded = Number(e?.loaded);
      const total = Number(e?.total);
      let ratio: number | null = null;
      let messageSuffix = "";

      if (Number.isFinite(loaded) && Number.isFinite(total) && total > 0) {
        ratio = Math.max(0, Math.min(1, loaded / total));
        messageSuffix = ` ${Math.round(ratio * 100)}%`;
      } else if (Number.isFinite(loaded) && loaded >= 0 && loaded <= 1) {
        ratio = Math.max(0, Math.min(1, loaded));
        messageSuffix = ` ${Math.round(ratio * 100)}%`;
      } else if (Number.isFinite(loaded) && loaded > 1) {
        const mb = (loaded / 1024 / 1024).toFixed(1);
        messageSuffix = ` (${mb} MB downloaded)`;
      }

      onProgress({
        status: "running",
        progress: ratio,
        message: `Downloading ${taskLabel} model...${messageSuffix}`,
      });
    });
  };
}

/**
 * Summarize text using Chrome's Summarizer API or polyfill fallback.
 */
export async function summarizeText(
  text: string,
  options?: SummarizeOptions,
): Promise<string> {
  await ensureBuiltinAiPolyfills();
  const Summarizer = getSummarizerFactory();
  if (!Summarizer) {
    throw new Error("Summarizer API is not supported or polyfilled");
  }

  const monitor = createMonitorHandler("Summarizer", options?.onProgress);
  const createOpts = {
    ...(options || {}),
    ...(monitor ? { monitor } : {}),
  };
  const summarizer = await createTaskInstanceWithFallback(
    Summarizer,
    createOpts,
  );
  try {
    return await summarizer.summarize(
      text,
      options?.context ? { context: options.context } : undefined,
    );
  } finally {
    if (typeof summarizer.destroy === "function") {
      summarizer.destroy();
    }
  }
}

/**
 * Draft/write text using Chrome's Writer API or polyfill fallback.
 */
export async function writeText(
  prompt: string,
  options?: WriteOptions,
): Promise<string> {
  await ensureBuiltinAiPolyfills();
  const Writer = getWriterFactory();
  if (!Writer) {
    throw new Error("Writer API is not supported or polyfilled");
  }

  const monitor = createMonitorHandler("Writer", options?.onProgress);
  const createOpts = {
    ...(options || {}),
    ...(monitor ? { monitor } : {}),
  };
  const writer = await createTaskInstanceWithFallback(Writer, createOpts);
  try {
    return await writer.write(
      prompt,
      options?.context ? { context: options.context } : undefined,
    );
  } finally {
    if (typeof writer.destroy === "function") {
      writer.destroy();
    }
  }
}

/**
 * Rewrite/rephrase text using Chrome's Rewriter API or polyfill fallback.
 */
export async function rewriteText(
  text: string,
  options?: RewriteOptions,
): Promise<string> {
  await ensureBuiltinAiPolyfills();
  const Rewriter = getRewriterFactory();
  if (!Rewriter) {
    throw new Error("Rewriter API is not supported or polyfilled");
  }

  const monitor = createMonitorHandler("Rewriter", options?.onProgress);
  const createOpts = {
    ...(options || {}),
    ...(monitor ? { monitor } : {}),
  };
  const rewriter = await createTaskInstanceWithFallback(Rewriter, createOpts);
  try {
    return await rewriter.rewrite(
      text,
      options?.context ? { context: options.context } : undefined,
    );
  } finally {
    if (typeof rewriter.destroy === "function") {
      rewriter.destroy();
    }
  }
}

/**
 * Detect input text language using Chrome's Language Detector API or polyfill fallback.
 */
export async function detectLanguage(
  text: string,
  options?: LanguageDetectorOptions,
): Promise<LanguageDetectionResult[]> {
  await ensureBuiltinAiPolyfills();
  const LanguageDetector = getLanguageDetectorFactory();
  if (!LanguageDetector) {
    throw new Error("Language Detector API is not supported or polyfilled");
  }

  const monitor = createMonitorHandler("LanguageDetector", options?.onProgress);
  const createOpts = {
    ...(options || {}),
    ...(monitor ? { monitor } : {}),
  };
  const detector = await createTaskInstanceWithFallback(
    LanguageDetector,
    createOpts,
  );
  try {
    return await detector.detect(text);
  } finally {
    if (typeof detector.destroy === "function") {
      detector.destroy();
    }
  }
}

/**
 * Translate text using Chrome's Translator API or polyfill fallback.
 */
export async function translateText(
  text: string,
  options: TranslateOptions,
): Promise<string> {
  await ensureBuiltinAiPolyfills();
  const Translator = getTranslatorFactory();
  if (!Translator) {
    throw new Error("Translator API is not supported or polyfilled");
  }

  const monitor = createMonitorHandler("Translator", options?.onProgress);
  const createOpts = {
    ...options,
    ...(monitor ? { monitor } : {}),
  };
  const translator = await createTaskInstanceWithFallback(
    Translator,
    createOpts,
  );
  try {
    return await translator.translate(text);
  } finally {
    if (typeof translator.destroy === "function") {
      translator.destroy();
    }
  }
}

/**
 * Proofread text using Chrome's Proofreader API (or Rewriter fallback).
 */
export async function proofreadText(
  text: string,
  options?: ProofreadOptions,
): Promise<string> {
  await ensureBuiltinAiPolyfills();
  const Proofreader = getProofreaderFactory();
  if (Proofreader) {
    const monitor = createMonitorHandler("Proofreader", options?.onProgress);
    const createOpts = {
      ...(options || {}),
      ...(monitor ? { monitor } : {}),
    };
    const proofreader = await createTaskInstanceWithFallback(
      Proofreader,
      createOpts,
    );
    try {
      if (typeof proofreader.proofread === "function") {
        return await proofreader.proofread(
          text,
          options?.context ? { context: options.context } : undefined,
        );
      }
    } finally {
      if (typeof proofreader.destroy === "function") {
        proofreader.destroy();
      }
    }
  }

  // Fallback to Rewriter API with proofreading prompt
  return await rewriteText(text, {
    context: options?.context
      ? `Proofread and correct grammar, spelling, and style errors. ${options.context}`
      : "Proofread and correct grammar, spelling, and style errors.",
    onProgress: options?.onProgress,
  });
}

/**
 * Generate semantic embeddings for input text using Chrome's Semantic Embedder API.
 */
export async function embedText(
  text: string | string[],
  options?: EmbedTextOptions,
): Promise<EmbeddingResult> {
  await ensureBuiltinAiPolyfills();
  const SemanticEmbedder = getSemanticEmbedderFactory();
  if (!SemanticEmbedder) {
    throw new Error(
      "Semantic Embedder API is not supported in this browser environment. Enable #semantic-embedder-api in chrome://flags or Edge Canary.",
    );
  }

  const monitor = createMonitorHandler("SemanticEmbedder", options?.onProgress);
  const createOpts = {
    ...(options?.taskType ? { taskType: options.taskType } : {}),
    ...(monitor ? { monitor } : {}),
  };
  const embedder = await createTaskInstanceWithFallback(
    SemanticEmbedder,
    createOpts,
  );
  try {
    return await embedder.embed(text);
  } finally {
    if (typeof embedder.destroy === "function") {
      embedder.destroy();
    }
  }
}
