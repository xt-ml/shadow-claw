import { getProvider } from "../config.mjs";
import { buildHeaders, formatRequest, parseResponse } from "../providers.mjs";
import { setStorageRoot } from "../storage/storage.mjs";
import { getCompactionMessages } from "./getCompactionMessages.mjs";
import { getCompactionSystemPrompt } from "./getCompactionSystemPrompt.mjs";
import { log } from "./log.mjs";
import { post } from "./post.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Handle context compaction
 *
 * @param {ShadowClawDatabase} db
 * @param {any} payload
 * @param {AbortSignal} [abortSignal]
 */
export async function handleCompact(db, payload, abortSignal) {
  const {
    groupId,
    messages,
    systemPrompt,
    apiKey,
    model,
    maxTokens,
    provider: providerId,
    storageHandle,
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

  /** @type {import('../config.mjs').ProviderConfig} */
  const typedProvider = provider;

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
      getCompactionMessages(messages),
      [],
      {
        model,
        maxTokens: Math.min(maxTokens, 4096),
        system: getCompactionSystemPrompt(systemPrompt),
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
      .filter((/** @type {any} */ b) => b.type === "text")
      .map((/** @type {any} */ b) => b.text)
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
