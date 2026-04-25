import { getProvider, ProviderConfig } from "../config.js";
import { buildHeaders, formatRequest, parseResponse } from "../providers.js";
import { setStorageRoot } from "../storage/storage.js";
import { getCompactionMessages } from "./getCompactionMessages.js";
import { getCompactionSystemPrompt } from "./getCompactionSystemPrompt.js";
import { log } from "./log.js";
import { post } from "./post.js";
import { CompactPayload } from "../types.js";

/**
 * Handle context compaction
 */
export async function handleCompact(
  db: any,
  payload: CompactPayload,
  abortSignal?: AbortSignal,
): Promise<void> {
  const {
    groupId,
    messages,
    systemPrompt,
    apiKey,
    model,
    maxTokens,
    provider: providerId,
    storageHandle,
    contextCompression = false,
  } = payload;

  if (storageHandle) {
    setStorageRoot(storageHandle);
  }

  const provider = getProvider(providerId);
  if (!provider) {
    post({
      type: "error",
      payload: { groupId, error: `Unknown provider: ${providerId}` },
    });

    return;
  }

  const typedProvider = provider as ProviderConfig;

  post({ type: "typing", payload: { groupId } });

  log(
    groupId,
    "info",
    "Compacting context",
    `Summarizing ${messages.length} messages`,
  );

  try {
    const body = formatRequest(
      typedProvider,
      getCompactionMessages(messages as any),
      [],
      {
        model,
        maxTokens: Math.min(maxTokens, 4096),
        system: getCompactionSystemPrompt(systemPrompt),
        contextCompression,
      },
    );

    const headers = buildHeaders(typedProvider, apiKey);
    const res = await fetch(typedProvider.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    if (!res.ok) {
      const errBody = await res.text();

      throw new Error(
        `${typedProvider.name} API error ${res.status}: ${errBody}`,
      );
    }

    const rawResult = await res.json();
    const result = parseResponse(typedProvider, rawResult);
    const summary = result.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    log(
      groupId,
      "info",
      "Compaction complete",
      `Summary: ${summary.length} chars`,
    );

    post({ type: "compact-done", payload: { groupId, summary } });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return;
    }

    const message = err instanceof Error ? err.message : String(err);

    post({
      type: "error",
      payload: { groupId, error: `Compaction failed: ${message}` },
    });
  }
}
