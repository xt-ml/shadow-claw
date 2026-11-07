import { isHeadlessMode } from "../../../config/headless.js";
import { executeNativeAiTask } from "../../../subsystems/providers/execute-native-ai-task.js";
import { ulid } from "../../../utils/ulid.js";
import { post } from "../../utils/post.js";

export type NativeAiTaskHandler = (
  taskType: string,
  input: Record<string, any>,
  groupId?: string,
  context?: { db?: any; invokeContext?: any },
) => Promise<any>;

let customNativeAiTaskHandler: NativeAiTaskHandler | null = null;

export function setNativeAiTaskHandler(
  handler: NativeAiTaskHandler | null,
): void {
  customNativeAiTaskHandler = handler;
}

export interface BuiltinToolContext {
  db?: any;
  invokeContext?: any;
}

function writingTaskErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/user (?:gesture|activation)|transient activation/i.test(message)) {
    return `${message} Open Settings > AI and select Download Local AI Model, then retry.`;
  }
  return message;
}

async function requestNativeTask(
  groupId: string | undefined,
  taskType: string,
  input: Record<string, any>,
  context?: BuiltinToolContext,
): Promise<any> {
  if (customNativeAiTaskHandler) {
    return await customNativeAiTaskHandler(taskType, input, groupId, context);
  }

  if (isHeadlessMode()) {
    const invokeContext = context?.invokeContext;
    return await executeNativeAiTask({
      taskType,
      input,
      groupId,
      providerId: invokeContext?.provider,
      model: invokeContext?.model,
      apiKey: invokeContext?.apiKey,
      maxTokens: invokeContext?.maxTokens,
      headers: invokeContext?.providerHeaders,
      db: context?.db || invokeContext?.db,
      abortSignal: invokeContext?.abortSignal,
    });
  }

  const id = ulid();
  const signal: AbortSignal | undefined = context?.invokeContext?.abortSignal;
  return await new Promise<any>((resolve, reject) => {
    const global = globalThis as any;
    global.pendingNativeAiResolvers = global.pendingNativeAiResolvers || {};
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
      delete global.pendingNativeAiResolvers[id];
    };
    const onAbort = () => {
      cleanup();
      post({ type: "cancel-native-ai-task", payload: { id, groupId } });
      reject(signal?.reason || new DOMException("Aborted", "AbortError"));
    };

    if (signal?.aborted) {
      reject(signal.reason || new DOMException("Aborted", "AbortError"));
      return;
    }

    global.pendingNativeAiResolvers[id] = {
      resolve: (value: any) => {
        cleanup();
        resolve(value);
      },
      reject: (error: any) => {
        cleanup();
        reject(error);
      },
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    post({
      type: "request-native-ai-task",
      payload: { id, groupId, taskType, input },
    });
  });
}

export async function executeSummarizeText(
  input: Record<string, any>,
  groupId?: string,
  context?: BuiltinToolContext,
): Promise<string> {
  const text = String(input.text || "").trim();
  if (!text) {
    return "Error: text is required for summarize_text";
  }

  try {
    return await requestNativeTask(
      groupId,
      "summarize",
      {
        text,
        type: input.type,
        format: input.format,
        length: input.length,
        preference: input.preference,
        context: input.context,
        outputLanguage: input.outputLanguage,
        overridePrompt: input.overridePrompt,
        sharedContext: input.sharedContext,
      },
      context,
    );
  } catch (err) {
    return `Error summarizing text: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeWriteText(
  input: Record<string, any>,
  groupId?: string,
  context?: BuiltinToolContext,
): Promise<string> {
  const prompt = String(input.prompt || "").trim();
  if (!prompt) {
    return "Error: prompt is required for write_text";
  }

  try {
    return await requestNativeTask(
      groupId,
      "write",
      {
        prompt,
        context: input.context,
        tone: input.tone,
        format: input.format,
        length: input.length,
        outputLanguage: input.outputLanguage,
        sharedContext: input.sharedContext,
      },
      context,
    );
  } catch (err) {
    return `Error writing text: ${writingTaskErrorMessage(err)}`;
  }
}

export async function executeRewriteText(
  input: Record<string, any>,
  groupId?: string,
  context?: BuiltinToolContext,
): Promise<string> {
  const text = String(input.text || "").trim();
  if (!text) {
    return "Error: text is required for rewrite_text";
  }

  try {
    return await requestNativeTask(
      groupId,
      "rewrite",
      {
        text,
        tone: input.tone,
        format: input.format,
        length: input.length,
        context: input.context,
        outputLanguage: input.outputLanguage,
        sharedContext: input.sharedContext,
      },
      context,
    );
  } catch (err) {
    return `Error rewriting text: ${writingTaskErrorMessage(err)}`;
  }
}

export async function executeProofreadText(
  input: Record<string, any>,
  groupId?: string,
  context?: BuiltinToolContext,
): Promise<string> {
  const text = String(input.text || "").trim();
  if (!text) {
    return "Error: text is required for proofread_text";
  }

  try {
    return await requestNativeTask(
      groupId,
      "proofread",
      {
        text,
        context: input.context,
      },
      context,
    );
  } catch (err) {
    return `Error proofreading text: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeDetectLanguage(
  input: Record<string, any>,
  groupId?: string,
  context?: BuiltinToolContext,
): Promise<string> {
  const text = String(input.text || "").trim();
  if (!text) {
    return "Error: text is required for detect_language";
  }

  try {
    const results = await requestNativeTask(
      groupId,
      "detect-language",
      {
        text,
      },
      context,
    );
    return typeof results === "string"
      ? results
      : JSON.stringify(results, null, 2);
  } catch (err) {
    return `Error detecting language: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeTranslateText(
  input: Record<string, any>,
  groupId?: string,
  context?: BuiltinToolContext,
): Promise<string> {
  const text = String(input.text || "").trim();
  const sourceLanguage = String(input.sourceLanguage || "").trim();
  const targetLanguage = String(input.targetLanguage || "").trim();

  if (!text || !sourceLanguage || !targetLanguage) {
    return "Error: text, sourceLanguage, and targetLanguage are required for translate_text";
  }

  try {
    return await requestNativeTask(
      groupId,
      "translate",
      {
        text,
        sourceLanguage,
        targetLanguage,
      },
      context,
    );
  } catch (err) {
    return `Error translating text: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeEmbedText(
  input: Record<string, any>,
  groupId?: string,
  context?: BuiltinToolContext,
): Promise<string> {
  const text = input.text;
  if (!text || (Array.isArray(text) && text.length === 0)) {
    return "Error: text is required for embed_text";
  }

  try {
    const result = await requestNativeTask(
      groupId,
      "semantic-embedder",
      {
        text,
        taskType: input.taskType,
      },
      context,
    );
    return typeof result === "string"
      ? result
      : JSON.stringify(result, null, 2);
  } catch (err) {
    return `Error generating embeddings: ${err instanceof Error ? err.message : String(err)}`;
  }
}
