import { ulid } from "../../../utils/ulid.js";
import { post } from "../../utils/post.js";

async function requestNativeTask(
  groupId: string | undefined,
  taskType: string,
  input: Record<string, any>,
): Promise<any> {
  const id = ulid();
  post({
    type: "request-native-ai-task",
    payload: { id, groupId, taskType, input },
  });

  return await new Promise<any>((resolve, reject) => {
    (globalThis as any).pendingNativeAiResolvers =
      (globalThis as any).pendingNativeAiResolvers || {};

    (globalThis as any).pendingNativeAiResolvers[id] = { resolve, reject };
  });
}

export async function executeSummarizeText(
  input: Record<string, any>,
  groupId?: string,
): Promise<string> {
  const text = String(input.text || "").trim();
  if (!text) {
    return "Error: text is required for summarize_text";
  }

  try {
    return await requestNativeTask(groupId, "summarize", {
      text,
      type: input.type,
      format: input.format,
      length: input.length,
      preference: input.preference,
      context: input.context,
    });
  } catch (err) {
    return `Error summarizing text: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeWriteText(
  input: Record<string, any>,
  groupId?: string,
): Promise<string> {
  const prompt = String(input.prompt || "").trim();
  if (!prompt) {
    return "Error: prompt is required for write_text";
  }

  try {
    return await requestNativeTask(groupId, "write", {
      prompt,
      context: input.context,
    });
  } catch (err) {
    return `Error writing text: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeRewriteText(
  input: Record<string, any>,
  groupId?: string,
): Promise<string> {
  const text = String(input.text || "").trim();
  if (!text) {
    return "Error: text is required for rewrite_text";
  }

  try {
    return await requestNativeTask(groupId, "rewrite", {
      text,
      tone: input.tone,
      length: input.length,
      context: input.context,
    });
  } catch (err) {
    return `Error rewriting text: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeProofreadText(
  input: Record<string, any>,
  groupId?: string,
): Promise<string> {
  const text = String(input.text || "").trim();
  if (!text) {
    return "Error: text is required for proofread_text";
  }

  try {
    return await requestNativeTask(groupId, "proofread", {
      text,
      context: input.context,
    });
  } catch (err) {
    return `Error proofreading text: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeDetectLanguage(
  input: Record<string, any>,
  groupId?: string,
): Promise<string> {
  const text = String(input.text || "").trim();
  if (!text) {
    return "Error: text is required for detect_language";
  }

  try {
    const results = await requestNativeTask(groupId, "detect-language", {
      text,
    });
    return JSON.stringify(results, null, 2);
  } catch (err) {
    return `Error detecting language: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeTranslateText(
  input: Record<string, any>,
  groupId?: string,
): Promise<string> {
  const text = String(input.text || "").trim();
  const sourceLanguage = String(input.sourceLanguage || "").trim();
  const targetLanguage = String(input.targetLanguage || "").trim();

  if (!text || !sourceLanguage || !targetLanguage) {
    return "Error: text, sourceLanguage, and targetLanguage are required for translate_text";
  }

  try {
    return await requestNativeTask(groupId, "translate", {
      text,
      sourceLanguage,
      targetLanguage,
    });
  } catch (err) {
    return `Error translating text: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeEmbedText(
  input: Record<string, any>,
  groupId?: string,
): Promise<string> {
  const text = input.text;
  if (!text || (Array.isArray(text) && text.length === 0)) {
    return "Error: text is required for embed_text";
  }

  try {
    const result = await requestNativeTask(groupId, "semantic-embedder", {
      text,
      taskType: input.taskType,
    });
    return JSON.stringify(result, null, 2);
  } catch (err) {
    return `Error generating embeddings: ${err instanceof Error ? err.message : String(err)}`;
  }
}
