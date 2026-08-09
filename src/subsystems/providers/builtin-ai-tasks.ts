/**
 * ShadowClaw — Chrome Built-in AI Task APIs & Prompt API Polyfills
 *
 * Provides typed access to Chrome's built-in AI Task APIs:
 * - Summarizer API
 * - Writer API
 * - Rewriter API
 * - Language Detector API
 * - Translator API
 *
 * Automatically defers to polyfills (`built-in-ai-task-apis-polyfills` and `prompt-api-polyfill`)
 * when native browser support is not present.
 */

export type BuiltinTaskType =
  | "summarizer"
  | "writer"
  | "rewriter"
  | "language-detector"
  | "translator";

export interface SummarizeOptions {
  type?: "key-points" | "tldr" | "teaser" | "headline";
  format?: "plain-text" | "markdown";
  length?: "short" | "medium" | "long";
  sharedContext?: string;
  context?: string;
}

export interface WriteOptions {
  context?: string;
  sharedContext?: string;
}

export interface RewriteOptions {
  context?: string;
  sharedContext?: string;
  tone?: "as-is" | "more-formal" | "more-casual";
  length?: "as-is" | "shorter" | "longer";
}

export interface TranslateOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
}

/**
 * Dynamically import polyfills if native APIs are absent on globalThis.
 */
export async function ensureBuiltinAiPolyfills(): Promise<void> {
  const g = globalThis as any;
  const tasks: Promise<any>[] = [];

  if (!("LanguageModel" in g)) {
    tasks.push(import("prompt-api-polyfill").catch(() => {}));
  }
  if (!("Summarizer" in g)) {
    tasks.push(
      import("built-in-ai-task-apis-polyfills/summarizer").catch(() => {}),
    );
  }
  if (!("Writer" in g)) {
    tasks.push(
      import("built-in-ai-task-apis-polyfills/writer").catch(() => {}),
    );
  }
  if (!("Rewriter" in g)) {
    tasks.push(
      import("built-in-ai-task-apis-polyfills/rewriter").catch(() => {}),
    );
  }
  if (!("LanguageDetector" in g)) {
    tasks.push(
      import("built-in-ai-task-apis-polyfills/language-detector").catch(
        () => {},
      ),
    );
  }
  if (!("Translator" in g)) {
    tasks.push(
      import("built-in-ai-task-apis-polyfills/translator").catch(() => {}),
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
  const g = globalThis as any;
  switch (task) {
    case "summarizer":
      return typeof g.Summarizer !== "undefined";
    case "writer":
      return typeof g.Writer !== "undefined";
    case "rewriter":
      return typeof g.Rewriter !== "undefined";
    case "language-detector":
      return typeof g.LanguageDetector !== "undefined";
    case "translator":
      return typeof g.Translator !== "undefined";
    default:
      return false;
  }
}

/**
 * Summarize text using Chrome's Summarizer API or polyfill fallback.
 */
export async function summarizeText(
  text: string,
  options?: SummarizeOptions,
): Promise<string> {
  await ensureBuiltinAiPolyfills();
  const Summarizer = (globalThis as any).Summarizer;
  if (!Summarizer) {
    throw new Error("Summarizer API is not supported or polyfilled");
  }

  const summarizer = await Summarizer.create(options || {});
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
  const Writer = (globalThis as any).Writer;
  if (!Writer) {
    throw new Error("Writer API is not supported or polyfilled");
  }

  const writer = await Writer.create(options || {});
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
  const Rewriter = (globalThis as any).Rewriter;
  if (!Rewriter) {
    throw new Error("Rewriter API is not supported or polyfilled");
  }

  const rewriter = await Rewriter.create(options || {});
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
): Promise<LanguageDetectionResult[]> {
  await ensureBuiltinAiPolyfills();
  const LanguageDetector = (globalThis as any).LanguageDetector;
  if (!LanguageDetector) {
    throw new Error("Language Detector API is not supported or polyfilled");
  }

  const detector = await LanguageDetector.create();
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
  const Translator = (globalThis as any).Translator;
  if (!Translator) {
    throw new Error("Translator API is not supported or polyfilled");
  }

  const translator = await Translator.create(options);
  try {
    return await translator.translate(text);
  } finally {
    if (typeof translator.destroy === "function") {
      translator.destroy();
    }
  }
}
