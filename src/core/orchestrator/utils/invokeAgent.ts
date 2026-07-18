import { CONFIG_KEYS, getProvider } from "../../../config/config.js";

import { buildDynamicContext } from "../../../context/buildDynamicContext.js";
import { estimateTokens } from "../../../context/estimateTokens.js";

import { buildConversationMessages } from "../../../db/buildConversationMessages.js";
import { getConfig } from "../../../db/getConfig.js";
import { listGroups } from "../../../db/groups.js";
import { saveMessage } from "../../../db/saveMessage.js";

import { readGroupFile } from "../../../storage/readGroupFile.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";
import { toolsStore } from "../../../stores/tools.js";

import {
  invokeWithLiteRtLm,
  isLiteRtLmSupported,
} from "../../../subsystems/providers/litert-lm-provider.js";

import {
  invokeWithPromptApi,
  isPromptApiSupported,
} from "../../../subsystems/providers/prompt-api-provider.js";

import { getContextLimit } from "../../../subsystems/providers/providers.js";
import { invokeWithTransformersJs } from "../../../subsystems/providers/transformers-js-provider.js";
import { ulid } from "../../../utils/ulid.js";
import { post as workerPost } from "../../../worker/post.js";
import { buildSystemPrompt } from "../../../worker/system-prompt.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { SubagentInvokeContext } from "../../../worker/tools/spawn-subagent/spawn-subagent.js";
import type { Orchestrator } from "../orchestrator.js";

export async function invokeAgent(
  o: Orchestrator,
  db: ShadowClawDatabase,
  groupId: string,
  triggerContent: string,
): Promise<void> {
  o.inFlightTriggerByGroup.set(groupId, triggerContent);
  o.setState("thinking", groupId);
  o.router?.setTyping(groupId, true);
  o.events.emit("typing", { groupId, typing: true });

  // Save scheduled task as client message
  if (triggerContent.startsWith("[SCHEDULED TASK]")) {
    o.pendingScheduledTasks.add(groupId);

    const stored = {
      id: ulid(),
      groupId,
      sender: "Scheduler",
      content: triggerContent,
      timestamp: Date.now(),
      channel: o.getChannelTypeForGroup(groupId),
      isFromMe: false,
      isTrigger: true,
    };

    await saveMessage(db, stored);

    o.events.emit("message", stored);
  }

  // Load group memory
  let memory = "";
  try {
    memory = await readGroupFile(db, groupId, "MEMORY.md");
  } catch {}

  // Load group metadata to check for conversation-specific pinned tools
  const groups = await listGroups(db);
  const group = groups.find((g) => g.groupId === groupId);

  const effectiveProviderId = group?.pinnedProvider ?? o.provider;

  // When a provider is pinned but no specific model is pinned, default to that provider's own defaultModel
  const effectiveModel =
    group?.pinnedModel ??
    (group?.pinnedProvider
      ? (getProvider(group.pinnedProvider)?.defaultModel ?? o.model)
      : o.model);

  const effectiveProviderConfig =
    getProvider(effectiveProviderId) ?? o.providerConfig;

  // Track the effective provider for this group so the error handler
  // can show the right help UI and avoid showing the wrong provider's error.
  o.inFlightEffectiveProviderByGroup.set(groupId, {
    providerId: effectiveProviderId,
    providerConfig: effectiveProviderConfig,
  });

  // Use pinned tools if set; otherwise fallback to global enabled tools.
  const activeTools =
    group?.toolTags && group.toolTags.length > 0
      ? toolsStore.allTools.filter((t) => group.toolTags!.includes(t.name))
      : toolsStore.enabledTools;

  const peerState = orchestratorStore.getPeerState(groupId) || undefined;
  const systemPrompt = buildSystemPrompt(
    o.assistantName,
    memory,
    activeTools,
    toolsStore.systemPromptOverride,
    peerState,
  );

  // Build conversation context with dynamic token-aware windowing
  const contextLimit = getContextLimit(effectiveModel);
  const systemPromptTokens = estimateTokens(systemPrompt);
  const allMessages = await buildConversationMessages(groupId, 200);
  const dynamicContext = buildDynamicContext(allMessages, {
    contextLimit,
    systemPromptTokens,
    maxOutputTokens: o.maxTokens,
    skimTop: o.contextCompressionEnabled,
  });

  const messages = dynamicContext.messages;

  // Emit context usage for UI display
  o.events.emit("context-usage", {
    estimatedTokens: dynamicContext.estimatedTokens + systemPromptTokens,
    contextLimit,
    usagePercent: dynamicContext.usagePercent,
    truncatedCount: dynamicContext.truncatedCount,
  });

  // Auto-compact when context usage exceeds 80% and there are enough messages
  if (
    dynamicContext.usagePercent > 80 &&
    dynamicContext.truncatedCount > 0 &&
    allMessages.length > 10
  ) {
    o.events.emit("show-toast", {
      message: `Context ${dynamicContext.usagePercent.toFixed(0)}% full — auto-compacting older messages…`,
      type: "info",
      duration: 4000,
    });
    // Queue compaction after this invocation completes
    queueMicrotask(() => o.compactContext(db, groupId));
  }

  if (effectiveProviderId === "transformers_js_browser") {
    const controller = new AbortController();
    o.promptControllers.set(groupId, controller);

    const transformersInvokeContext: SubagentInvokeContext = {
      apiKey: "",
      assistantName: o.assistantName,
      db,
      enabledTools: activeTools as any,
      invokeSubagent: async (subPayload) => {
        await invokeWithTransformersJs(
          db,
          subPayload.groupId,
          subPayload.systemPrompt,
          subPayload.messages,
          subPayload.maxTokens,
          async (msg: any) => {
            workerPost(msg);
          },
          controller.signal,
          subPayload.enabledTools,
          subPayload.model,
        );
      },
      maxTokens: o.maxTokens,
      memory: memory ?? "",
      model: effectiveModel,
      provider: effectiveProviderId,
      providerHeaders: {},
      streaming: false,
      systemPrompt,
    };

    try {
      await invokeWithTransformersJs(
        db,
        groupId,
        systemPrompt,
        messages,
        o.maxTokens,
        async (msg) => {
          await o.handleWorkerMessage(db, msg);
        },
        controller.signal,
        activeTools,
        effectiveModel,
        transformersInvokeContext,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      await o.deliverResponse(db, groupId, `⚠️ Error: ${message}`);
    } finally {
      o.promptControllers.delete(groupId);
    }

    return;
  }

  if (effectiveProviderId === "prompt_api") {
    if (!isPromptApiSupported()) {
      await o.deliverResponse(
        db,
        groupId,
        "⚠️ Error: Prompt API is not available in this browser. Switch provider or enable experimental browser flags.",
      );

      return;
    }

    const controller = new AbortController();
    o.promptControllers.set(groupId, controller);

    const promptApiInvokeContext: SubagentInvokeContext = {
      apiKey: "",
      assistantName: o.assistantName,
      db,
      enabledTools: activeTools as any,
      invokeSubagent: async (subPayload) => {
        await invokeWithPromptApi(
          db,
          subPayload.groupId,
          subPayload.systemPrompt,
          subPayload.messages,
          subPayload.maxTokens,
          async (msg: any) => {
            workerPost(msg);
          },
          controller.signal,
          subPayload.enabledTools,
        );
      },
      maxTokens: o.maxTokens,
      memory: memory ?? "",
      model: effectiveModel,
      provider: effectiveProviderId,
      providerHeaders: {},
      streaming: false,
      systemPrompt,
    };

    try {
      await invokeWithPromptApi(
        db,
        groupId,
        systemPrompt,
        messages,
        o.maxTokens,
        async (msg) => {
          await o.handleWorkerMessage(db, msg);
        },
        controller.signal,
        activeTools,
        promptApiInvokeContext,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      await o.deliverResponse(db, groupId, `⚠️ Error: ${message}`);
    } finally {
      o.promptControllers.delete(groupId);
    }

    return;
  }

  if (effectiveProviderId === "litert_lm_browser") {
    if (!isLiteRtLmSupported()) {
      await o.deliverResponse(
        db,
        groupId,
        "⚠️ LiteRT-LM requires WebGPU and WebAssembly.Suspending. These are not both available in this browser.",
      );

      return;
    }

    const controller = new AbortController();
    o.promptControllers.set(groupId, controller);

    const liteRtInvokeContext: SubagentInvokeContext = {
      apiKey: "",
      assistantName: o.assistantName,
      db,
      enabledTools: activeTools as any,
      invokeSubagent: async (subPayload) => {
        await invokeWithLiteRtLm(
          db,
          subPayload.groupId,
          subPayload.systemPrompt,
          subPayload.messages,
          subPayload.maxTokens,
          async (msg: any) => {
            workerPost(msg);
          },
          controller.signal,
          subPayload.model,
          subPayload.enabledTools,
        );
      },
      maxTokens: o.maxTokens,
      memory: memory ?? "",
      model: effectiveModel,
      provider: effectiveProviderId,
      providerHeaders: {},
      streaming: false,
      systemPrompt,
    };

    try {
      await invokeWithLiteRtLm(
        db,
        groupId,
        systemPrompt,
        messages,
        o.maxTokens,
        async (msg) => {
          await o.handleWorkerMessage(db, msg);
        },
        controller.signal,
        effectiveModel,
        activeTools,
        liteRtInvokeContext,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      await o.deliverResponse(db, groupId, `⚠️ Error: ${message}`);
    } finally {
      o.promptControllers.delete(groupId);
    }

    return;
  }

  // Determine whether to stream. The provider must explicitly opt in via
  // supportsStreaming (proxies like bedrock_proxy use synchronous
  // InvokeModelCommand and cannot return SSE streams).
  const shouldStream =
    o.streamingEnabled &&
    effectiveProviderConfig.supportsStreaming === true &&
    (effectiveProviderConfig.format === "openai" ||
      effectiveProviderConfig.format === "anthropic");

  if (effectiveProviderId === "transformers_js_local") {
    o.startTransformersProgressPolling(groupId);
  }

  const providerRequestId = o.createProviderRequestId(groupId);

  // Send to agent worker
  o.agentWorker?.postMessage({
    type: "invoke",
    payload: {
      apiKey:
        effectiveProviderId === o.provider
          ? await o.getApiKeyForRequest()
          : await o.getApiKeyForSpecificProvider(db, effectiveProviderId),
      assistantName: o.assistantName,
      contextCompression: o.contextCompressionEnabled,
      contextLimit: getContextLimit(effectiveModel),
      enabledTools: activeTools,
      groupId,
      isScheduledTask: o.schedulerTriggeredGroups.has(groupId),
      maxIterations: o.maxIterations,
      maxTokens: o.maxTokens,
      memory,
      messages,
      model: effectiveModel,
      provider: effectiveProviderId,
      providerHeaders: o.getProviderRuntimeHeaders(
        effectiveProviderId,
        providerRequestId,
      ),
      reasoning: o.getReasoningConfig(),
      rateLimitAutoAdapt: o.rateLimitAutoAdapt,
      rateLimitCallsPerMinute: o.rateLimitCallsPerMinute,
      storageHandle: await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE),
      streaming: shouldStream,
      systemPrompt,
    },
  });
}
