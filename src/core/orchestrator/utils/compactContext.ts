import { detectProviderHelpType } from "../../../components/common/help/providers.js";
import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../../../config/config.js";

import { buildDynamicContext } from "../../../context/buildDynamicContext.js";
import { estimateTokens } from "../../../context/estimateTokens.js";

import { buildConversationMessages } from "../../../db/buildConversationMessages.js";
import { getConfig } from "../../../db/getConfig.js";

import { readGroupFile } from "../../../storage/readGroupFile.js";

import { orchestratorStore } from "../../../stores/orchestrator.js";
import { toolsStore } from "../../../stores/tools.js";

import {
  compactWithPromptApi,
  isPromptApiSupported,
} from "../../../subsystems/providers/prompt-api-provider.js";

import { getContextLimit } from "../../../subsystems/providers/providers.js";
import { getCompactionSystemPrompt } from "../../../worker/getCompactionSystemPrompt.js";
import { buildSystemPrompt } from "../../../worker/system-prompt.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

export async function compactContext(
  o: Orchestrator,
  db: ShadowClawDatabase,
  groupId = DEFAULT_GROUP_ID,
): Promise<void> {
  const requiresApiKey = o.providerConfig?.requiresApiKey !== false;
  const currentApiKey = await o.getApiKeyForRequest();
  if (requiresApiKey && !currentApiKey) {
    const reason = "API key not configured. Cannot compact context.";

    o.events.emit("provider-help", {
      providerId: o.provider,
      reason,
      helpType: detectProviderHelpType(o.provider, reason, requiresApiKey),
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

  const contextLimit = getContextLimit(o.model);
  const systemPromptTokens = estimateTokens(systemPrompt);
  const allMessages = await buildConversationMessages(groupId, 200);
  const dynamicContext = buildDynamicContext(allMessages, {
    contextLimit,
    systemPromptTokens,
    maxOutputTokens: 4096, // compaction output cap
    skimTop: o.contextCompressionEnabled,
  });

  const messages = dynamicContext.messages;

  if (o.provider === "prompt_api") {
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
          await o.handleWorkerMessage(db, msg);
        },
        groupId,
      );

      await o.handleCompactDone(db, groupId, summary);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      await o.deliverResponse(
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
      apiKey: await o.getApiKeyForRequest(),
      assistantName: o.assistantName,
      contextCompression: o.contextCompressionEnabled,
      contextLimit: getContextLimit(o.model),
      groupId,
      memory,
      messages,
      model: o.model,
      provider: o.provider,
      providerHeaders: o.getProviderRuntimeHeaders(
        o.provider,
        providerRequestId,
      ),
      rateLimitAutoAdapt: o.rateLimitAutoAdapt,
      rateLimitCallsPerMinute: o.rateLimitCallsPerMinute,
      storageHandle: await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE),
      systemPrompt,
    },
  });
}
