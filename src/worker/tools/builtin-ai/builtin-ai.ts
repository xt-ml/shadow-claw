import {
  detectLanguage,
  rewriteText,
  summarizeText,
  translateText,
  writeText,
} from "../../../subsystems/providers/builtin-ai-tasks.js";

export async function executeSummarizeText(
  input: Record<string, any>,
): Promise<string> {
  const text = String(input.text || "").trim();
  if (!text) {
    return "Error: text is required for summarize_text";
  }

  try {
    const summary = await summarizeText(text, {
      type: input.type,
      format: input.format,
      length: input.length,
      context: input.context,
    });

    return summary;
  } catch (err) {
    return `Error summarizing text: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeWriteText(
  input: Record<string, any>,
): Promise<string> {
  const prompt = String(input.prompt || "").trim();
  if (!prompt) {
    return "Error: prompt is required for write_text";
  }

  try {
    const result = await writeText(prompt, { context: input.context });

    return result;
  } catch (err) {
    return `Error writing text: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeRewriteText(
  input: Record<string, any>,
): Promise<string> {
  const text = String(input.text || "").trim();
  if (!text) {
    return "Error: text is required for rewrite_text";
  }

  try {
    const result = await rewriteText(text, {
      tone: input.tone,
      length: input.length,
      context: input.context,
    });

    return result;
  } catch (err) {
    return `Error rewriting text: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeDetectLanguage(
  input: Record<string, any>,
): Promise<string> {
  const text = String(input.text || "").trim();
  if (!text) {
    return "Error: text is required for detect_language";
  }

  try {
    const results = await detectLanguage(text);

    return JSON.stringify(results, null, 2);
  } catch (err) {
    return `Error detecting language: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function executeTranslateText(
  input: Record<string, any>,
): Promise<string> {
  const text = String(input.text || "").trim();
  const sourceLanguage = String(input.sourceLanguage || "").trim();
  const targetLanguage = String(input.targetLanguage || "").trim();

  if (!text || !sourceLanguage || !targetLanguage) {
    return "Error: text, sourceLanguage, and targetLanguage are required for translate_text";
  }

  try {
    const result = await translateText(text, {
      sourceLanguage,
      targetLanguage,
    });

    return result;
  } catch (err) {
    return `Error translating text: ${err instanceof Error ? err.message : String(err)}`;
  }
}
