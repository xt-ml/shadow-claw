import { detectProviderHelpType } from "../../../components/common/help/providers.js";
import {
  CONFIG_KEYS,
  DEFAULT_GROUP_ID,
  DEFAULT_PROMPT_API_FALLBACK_MODEL,
  getProvider,
} from "../../../config/config.js";

import { buildDynamicContext } from "../../../context/buildDynamicContext.js";
import { estimateTokens } from "../../../context/estimateTokens.js";

import { buildConversationMessages } from "../../../db/buildConversationMessages.js";
import { getConfig } from "../../../db/getConfig.js";
import { listGroups } from "../../../db/groups.js";

import { readGroupFile } from "../../../storage/readGroupFile.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";
import { toolsStore } from "../../../stores/tools.js";

import {
  compactWithPromptApi,
  isPromptApiSupported,
} from "../../../subsystems/providers/prompt-api-provider.js";
import {
  ensureBuiltinAiPolyfills,
  summarizeText,
} from "../../../subsystems/providers/builtin-ai-tasks.js";

import { getContextLimit } from "../../../subsystems/providers/providers.js";
import { getCompactionSystemPrompt } from "../../../worker/utils/getCompactionSystemPrompt.js";
import { buildSystemPrompt } from "../../../worker/utils/system-prompt.js";
import { deliverResponse } from "./deliverResponse.js";
import { handleWorkerMessage } from "./handleWorkerMessage.js";

import {
  getApiKeyForRequest,
  getProviderRuntimeHeaders,
} from "./operations/provider.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

export async function compactContext(
  o: Orchestrator,
  db: ShadowClawDatabase,
  groupId = DEFAULT_GROUP_ID,
): Promise<void> {
  const groups = await listGroups(db);
  const group = groups.find((g) => g.groupId === groupId);

  const effectiveProviderId = group?.pinnedProvider ?? o.provider;
  const effectiveModel =
    group?.pinnedModel ??
    (group?.pinnedProvider
      ? (getProvider(group.pinnedProvider)?.defaultModel ?? o.model)
      : o.model);
  const effectiveProviderConfig =
    getProvider(effectiveProviderId) ?? o.providerConfig;

  const requiresApiKey = effectiveProviderConfig?.requiresApiKey !== false;
  const currentApiKey =
    effectiveProviderId === o.provider
      ? await getApiKeyForRequest(o)
      : await o.getApiKeyForSpecificProvider(db, effectiveProviderId);

  if (requiresApiKey && !currentApiKey) {
    const reason = "API key not configured. Cannot compact context.";

    o.events.emit("provider-help", {
      providerId: effectiveProviderId,
      reason,
      helpType: detectProviderHelpType(
        effectiveProviderId,
        reason,
        requiresApiKey,
      ),
    });

    o.events.emit("error", {
      groupId,
      error: reason,
    });

    return;
  }

  if (o.state !== "idle") {
    o.events.emit("error", {
      groupId,
      error:
        "Cannot compact while processing. Wait for the current response to finish.",
    });

    return;
  }

  o.setState("thinking", groupId);
  o.events.emit("typing", { groupId, typing: true });

  let memory = "";
  try {
    memory = await readGroupFile(db, groupId, "MEMORY.md");
  } catch {
    // No memory file yet
  }

  const compactTools = toolsStore.enabledTools;
  const peerState = orchestratorStore.getPeerState(groupId) || undefined;
  const systemPrompt = buildSystemPrompt(
    o.assistantName,
    memory,
    compactTools,
    toolsStore.systemPromptOverride,
    peerState,
  );

  let modelForContext = effectiveModel;
  if (
    effectiveProviderId === "prompt_api" &&
    (effectiveModel === "browser-built-in" || !effectiveModel) &&
    !isPromptApiSupported()
  ) {
    const configuredFallback = await getConfig(
      db,
      CONFIG_KEYS.PROMPT_API_FALLBACK_MODEL,
    );
    modelForContext = configuredFallback || DEFAULT_PROMPT_API_FALLBACK_MODEL;
  }

  const contextLimit = getContextLimit(modelForContext);
  const systemPromptTokens = estimateTokens(systemPrompt);
  const allMessages = await buildConversationMessages(groupId, 200);
  const dynamicContext = buildDynamicContext(allMessages, {
    contextLimit,
    systemPromptTokens,
    maxOutputTokens: 4096, // compaction output cap
    skimTop: o.contextCompressionEnabled,
  });

  const messages = dynamicContext.messages;

  const compactionPref = await getConfig(
    db,
    CONFIG_KEYS.COMPACTION_ENGINE_PREFERENCE,
  );
  if (compactionPref === "builtin_task_api") {
    try {
      const fullText = messages
        .map(
          (m) =>
            `${m.role.toUpperCase()}: ${
              typeof m.content === "string"
                ? m.content
                : JSON.stringify(m.content)
            }`,
        )
        .join("\n\n");

      const summary = await summarizeText(fullText, {
        type: "key-points",
        format: "markdown",
        length: "medium",
      });

      await o.handleCompactDone(db, groupId, summary);

      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await deliverResponse(
        o,
        db,
        groupId,
        `⚠️ Built-in Task API compaction failed, falling back to provider: ${message}`,
      );
    }
  }

  if (effectiveProviderId === "prompt_api") {
    if (!isPromptApiSupported()) {
      await ensureBuiltinAiPolyfills();
    }
    if (!isPromptApiSupported()) {
      o.events.emit("error", {
        groupId,
        error:
          "Prompt API is not available in this browser. Switch provider or enable experimental browser flags.",
      });

      o.events.emit("typing", { groupId, typing: false });
      o.setState("idle", groupId);

      return;
    }

    const controller = new AbortController();
    o.promptControllers.set(groupId, controller);

    try {
      const summary = await compactWithPromptApi(
        getCompactionSystemPrompt(systemPrompt),
        messages,
        controller.signal,
        async (msg) => {
          await handleWorkerMessage(o, db, msg);
        },
        groupId,
      );

      await o.handleCompactDone(db, groupId, summary);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      await deliverResponse(
        o,
        db,
        groupId,
        `⚠️ Error: Compaction failed: ${message}`,
      );
    } finally {
      o.promptControllers.delete(groupId);
    }

    return;
  }

  const providerRequestId = o.createProviderRequestId(groupId);

  o.agentWorker?.postMessage({
    type: "compact",
    payload: {
      apiKey: currentApiKey,
      assistantName: o.assistantName,
      contextCompression: o.contextCompressionEnabled,
      contextLimit: getContextLimit(modelForContext),
      groupId,
      memory,
      messages,
      model: effectiveModel,
      provider: effectiveProviderId,
      providerHeaders: getProviderRuntimeHeaders(
        o,
        effectiveProviderId,
        providerRequestId,
        group?.providerRuntimeOverrides,
      ),
      rateLimitAutoAdapt: o.rateLimitAutoAdapt,
      rateLimitCallsPerMinute: o.rateLimitCallsPerMinute,
      storageHandle: await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE),
      systemPrompt,
    },
  });
}
