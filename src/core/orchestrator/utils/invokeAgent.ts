import {
  CONFIG_KEYS,
  DEFAULT_PROMPT_API_FALLBACK_MODEL,
  getModelMaxTokens,
  getProvider,
} from "../../../config/config.js";

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
import { ensureBuiltinAiPolyfills } from "../../../subsystems/providers/builtin-ai-tasks.js";

import { getContextLimit } from "../../../subsystems/providers/providers.js";
import { invokeWithTransformersJs } from "../../../subsystems/providers/transformers-js-provider.js";
import { ulid } from "../../../utils/ulid.js";
import { buildSystemPrompt } from "../../../worker/utils/system-prompt.js";
import { discoverSkills } from "../../../subsystems/skills/discoverSkills.js";
import { activate_skill } from "../../../subsystems/skills/tool.js";
import { loadDeclarativeTools } from "../../../subsystems/tools/declarative.js";

import { compactContext } from "./compactContext.js";
import { deliverResponse } from "./deliverResponse.js";
import { dispatchSubagentInvoke } from "./dispatchSubagentInvoke.js";
import { handleWorkerMessage } from "./handleWorkerMessage.js";
import { getChannelTypeForGroup } from "./operations/channel.js";

import {
  getApiKeyForRequest,
  getProviderRuntimeHeaders,
  getReasoningConfig,
  startTransformersProgressPolling,
} from "./operations/provider.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { SubagentInvokeContext } from "../../../worker/tools/spawn-subagent/spawn-subagent.js";
import type { Orchestrator } from "../orchestrator.js";

export async function invokeAgent(
  o: Orchestrator,
  db: ShadowClawDatabase,
  groupId: string,
  triggerContent: string,
  freshContext = false,
  subagent = false,
): Promise<void> {
  const executionGroupId = subagent ? `subagent:${ulid()}` : groupId;

  o.inFlightTriggerByGroup.set(executionGroupId, triggerContent);
  o.setState("thinking", executionGroupId);
  o.router?.setTyping(executionGroupId, true);
  o.events.emit("typing", { groupId: executionGroupId, typing: true });

  // Save scheduled task as client message
  if (triggerContent.startsWith("[SCHEDULED TASK]")) {
    o.pendingScheduledTasks.add(groupId);

    const stored = {
      id: ulid(),
      groupId,
      sender: "Scheduler",
      content: triggerContent,
      timestamp: Date.now(),
      channel: getChannelTypeForGroup(o, groupId),
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

  const configuredMaxTokens =
    typeof group?.pinnedMaxTokens === "number" &&
    Number.isFinite(group.pinnedMaxTokens) &&
    group.pinnedMaxTokens > 0
      ? Math.floor(group.pinnedMaxTokens)
      : o.maxTokens;

  let modelForTokenLimits = effectiveModel;
  if (
    effectiveProviderId === "prompt_api" &&
    (effectiveModel === "browser-built-in" || !effectiveModel) &&
    !isPromptApiSupported()
  ) {
    const configuredFallback = await getConfig(
      db,
      CONFIG_KEYS.PROMPT_API_FALLBACK_MODEL,
    );
    modelForTokenLimits =
      configuredFallback || DEFAULT_PROMPT_API_FALLBACK_MODEL;
  }

  const effectiveMaxTokens = Math.max(
    1,
    Math.min(configuredMaxTokens, getModelMaxTokens(modelForTokenLimits)),
  );

  const effectiveProviderConfig =
    getProvider(effectiveProviderId) ?? o.providerConfig;

  // Track the effective provider for this group so the error handler
  // can show the right help UI and avoid showing the wrong provider's error.
  o.inFlightEffectiveProviderByGroup.set(executionGroupId, {
    providerId: effectiveProviderId,
    providerConfig: effectiveProviderConfig,
    model: effectiveModel,
  });

  // Use pinned tools if set; otherwise fallback to global enabled tools.
  const configuredTools = Array.isArray(group?.toolTags)
    ? toolsStore.allTools.filter((t) => group.toolTags!.includes(t.name))
    : toolsStore.enabledTools;
  const declarativeToolResult = await loadDeclarativeTools(
    db,
    executionGroupId,
  );
  const declarativeTools = declarativeToolResult.tools.filter(
    (tool) =>
      !toolsStore.allTools.some((builtIn) => builtIn.name === tool.name),
  );
  const toolsWithDeclarative = [...configuredTools, ...declarativeTools];
  const skillDiscovery = await discoverSkills(db, executionGroupId);
  const activeTools =
    skillDiscovery.skills.length > 0 &&
    !toolsWithDeclarative.some((tool) => tool.name === activate_skill.name)
      ? [...toolsWithDeclarative, activate_skill]
      : toolsWithDeclarative;

  const subagentModelSelectionMode =
    group?.subagentModelSelectionMode === "manual" ? "manual" : "automatic";
  const subagentMaxTokens = group?.subagentMaxTokens;
  const subagentPinnedProvider = group?.subagentPinnedProvider;
  const subagentPinnedModel = group?.subagentPinnedModel;
  const subagentFastProvider = group?.subagentFastProvider;
  const subagentFastModel = group?.subagentFastModel;
  const subagentSmartProvider = group?.subagentSmartProvider;
  const subagentSmartModel = group?.subagentSmartModel;
  const subagentPowerfulProvider = group?.subagentPowerfulProvider;
  const subagentPowerfulModel = group?.subagentPowerfulModel;
  const providerRuntimeOverrides = group?.providerRuntimeOverrides;

  const peerState = orchestratorStore.getPeerState(groupId) || undefined;
  const systemPrompt = buildSystemPrompt(
    o.assistantName,
    memory,
    activeTools,
    toolsStore.systemPromptOverride,
    peerState,
    skillDiscovery.skills,
  );

  // Build conversation context with dynamic token-aware windowing
  const contextLimit = getContextLimit(modelForTokenLimits);
  const systemPromptTokens =
    estimateTokens(systemPrompt) +
    (activeTools?.reduce(
      (acc, t) => acc + estimateTokens(JSON.stringify(t)),
      0,
    ) ?? 0);
  let allMessages = await buildConversationMessages(groupId, 200);
  if (freshContext) {
    if (allMessages.length > 0) {
      allMessages = [allMessages[allMessages.length - 1]];
    } else {
      allMessages = [{ role: "user", content: triggerContent }];
    }
  }
  const dynamicContext = buildDynamicContext(allMessages, {
    contextLimit,
    systemPromptTokens,
    maxOutputTokens: effectiveMaxTokens,
    skimTop: o.contextCompressionEnabled,
  });

  const messages = dynamicContext.messages;

  let displayTokens = dynamicContext.estimatedTokens + systemPromptTokens;

  if (orchestratorStore.tokenUsage) {
    const u = orchestratorStore.tokenUsage;
    const actualPrompt =
      (u.inputTokens || 0) + (u.cacheReadTokens || 0) + (u.outputTokens || 0);

    displayTokens = Math.max(displayTokens, actualPrompt);
  }

  // Emit context usage for UI display
  o.events.emit("context-usage", {
    estimatedTokens: displayTokens,
    contextLimit,
    usagePercent: Math.min(
      100,
      Math.max(
        dynamicContext.usagePercent,
        (displayTokens / contextLimit) * 100,
      ),
    ),
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
    queueMicrotask(() => compactContext(o, db, groupId));
  }

  if (effectiveProviderId === "transformers_js_browser") {
    const controller = new AbortController();
    o.promptControllers.set(executionGroupId, controller);

    const transformersInvokeContext: SubagentInvokeContext = {
      apiKey: "",
      assistantName: o.assistantName,
      db,
      enabledTools: activeTools as any,
      invokeSubagent: async (subPayload) => {
        await dispatchSubagentInvoke(db, subPayload, controller.signal);
      },
      maxTokens: effectiveMaxTokens,
      memory: memory ?? "",
      model: effectiveModel,
      provider: effectiveProviderId,
      providerHeaders: getProviderRuntimeHeaders(
        o,
        effectiveProviderId,
        "",
        providerRuntimeOverrides,
      ),
      providerRuntimeOverrides,
      streaming: false,
      subagentModelSelectionMode,
      subagentMaxTokens,
      subagentPinnedProvider,
      subagentPinnedModel,
      subagentFastProvider,
      subagentFastModel,
      subagentSmartProvider,
      subagentSmartModel,
      subagentPowerfulProvider,
      subagentPowerfulModel,
      systemPrompt,
    };

    try {
      await invokeWithTransformersJs(
        db,
        executionGroupId,
        systemPrompt,
        messages,
        effectiveMaxTokens,
        async (msg) => {
          await handleWorkerMessage(o, db, msg);
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
      await deliverResponse(o, db, executionGroupId, `⚠️ Error: ${message}`);
    } finally {
      o.promptControllers.delete(executionGroupId);
    }

    return;
  }

  if (effectiveProviderId === "prompt_api") {
    if (!isPromptApiSupported()) {
      await ensureBuiltinAiPolyfills();
    }
    if (!isPromptApiSupported()) {
      await deliverResponse(
        o,
        db,
        executionGroupId,
        "⚠️ Error: Prompt API is not available in this browser. Switch provider or enable experimental browser flags.",
      );

      return;
    }

    const controller = new AbortController();
    o.promptControllers.set(executionGroupId, controller);

    const promptApiInvokeContext: SubagentInvokeContext = {
      apiKey: "",
      assistantName: o.assistantName,
      db,
      enabledTools: activeTools as any,
      invokeSubagent: async (subPayload) => {
        await dispatchSubagentInvoke(db, subPayload, controller.signal);
      },
      maxTokens: effectiveMaxTokens,
      memory: memory ?? "",
      model: effectiveModel,
      provider: effectiveProviderId,
      providerHeaders: getProviderRuntimeHeaders(
        o,
        effectiveProviderId,
        "",
        providerRuntimeOverrides,
      ),
      providerRuntimeOverrides,
      streaming: false,
      subagentModelSelectionMode,
      subagentMaxTokens,
      subagentPinnedProvider,
      subagentPinnedModel,
      subagentFastProvider,
      subagentFastModel,
      subagentSmartProvider,
      subagentSmartModel,
      subagentPowerfulProvider,
      subagentPowerfulModel,
      systemPrompt,
    };

    try {
      await invokeWithPromptApi(
        db,
        executionGroupId,
        systemPrompt,
        messages,
        effectiveMaxTokens,
        async (msg) => {
          await handleWorkerMessage(o, db, msg);
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
      await deliverResponse(o, db, executionGroupId, `⚠️ Error: ${message}`);
    } finally {
      o.promptControllers.delete(executionGroupId);
    }

    return;
  }

  if (effectiveProviderId === "litert_lm_browser") {
    if (!isLiteRtLmSupported()) {
      await deliverResponse(
        o,
        db,
        executionGroupId,
        "⚠️ LiteRT-LM requires WebGPU and WebAssembly.Suspending. These are not both available in this browser.",
      );

      return;
    }

    const controller = new AbortController();
    o.promptControllers.set(executionGroupId, controller);

    const liteRtInvokeContext: SubagentInvokeContext = {
      apiKey: "",
      assistantName: o.assistantName,
      db,
      enabledTools: activeTools as any,
      invokeSubagent: async (subPayload) => {
        await dispatchSubagentInvoke(db, subPayload, controller.signal);
      },
      maxTokens: effectiveMaxTokens,
      memory: memory ?? "",
      model: effectiveModel,
      provider: effectiveProviderId,
      providerHeaders: getProviderRuntimeHeaders(
        o,
        effectiveProviderId,
        "",
        providerRuntimeOverrides,
      ),
      providerRuntimeOverrides,
      streaming: false,
      subagentModelSelectionMode,
      subagentMaxTokens,
      subagentPinnedProvider,
      subagentPinnedModel,
      subagentFastProvider,
      subagentFastModel,
      subagentSmartProvider,
      subagentSmartModel,
      subagentPowerfulProvider,
      subagentPowerfulModel,
      systemPrompt,
    };

    try {
      await invokeWithLiteRtLm(
        db,
        executionGroupId,
        systemPrompt,
        messages,
        effectiveMaxTokens,
        async (msg) => {
          await handleWorkerMessage(o, db, msg);
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
      await deliverResponse(o, db, executionGroupId, `⚠️ Error: ${message}`);
    } finally {
      o.promptControllers.delete(executionGroupId);
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
    startTransformersProgressPolling(o, o.events, executionGroupId);
  }

  const providerRequestId = o.createProviderRequestId(executionGroupId);

  // Send to agent worker
  o.agentWorker?.postMessage({
    type: "invoke",
    payload: {
      apiKey:
        effectiveProviderId === o.provider
          ? await getApiKeyForRequest(o)
          : await o.getApiKeyForSpecificProvider(db, effectiveProviderId),
      assistantName: o.assistantName,
      contextCompression: o.contextCompressionEnabled,
      contextLimit: getContextLimit(modelForTokenLimits),
      enabledTools: activeTools,
      groupId: executionGroupId,
      isScheduledTask: o.schedulerTriggeredGroups.has(groupId),
      maxIterations: o.maxIterations,
      maxTokens: effectiveMaxTokens,
      memory,
      messages,
      model: effectiveModel,
      provider: effectiveProviderId,
      providerHeaders: getProviderRuntimeHeaders(
        o,
        effectiveProviderId,
        providerRequestId,
        providerRuntimeOverrides,
      ),
      providerRuntimeOverrides,
      reasoning: getReasoningConfig(o),
      rateLimitAutoAdapt: o.rateLimitAutoAdapt,
      rateLimitCallsPerMinute: o.rateLimitCallsPerMinute,
      storageHandle: await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE),
      streaming: shouldStream,
      subagentModelSelectionMode,
      subagentMaxTokens,
      subagentPinnedProvider,
      subagentPinnedModel,
      subagentFastProvider,
      subagentFastModel,
      subagentSmartProvider,
      subagentSmartModel,
      subagentPowerfulProvider,
      subagentPowerfulModel,
      systemPrompt,
      subagentTask: subagent,
    },
  });
}
