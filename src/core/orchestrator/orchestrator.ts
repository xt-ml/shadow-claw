import {
  ASSISTANT_NAME,
  CONFIG_KEYS,
  DEFAULT_GROUP_ID,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_PROVIDER,
  ProviderConfig,
  buildTriggerPattern,
  getDefaultProvider,
  getProviderApiKeyConfigKey,
} from "../../config/config.js";

import { buildDynamicContext } from "../../context/buildDynamicContext.js";
import { estimateTokens } from "../../context/estimateTokens.js";
import { buildConversationMessages } from "../../db/buildConversationMessages.js";
import { clearGroupMessages } from "../../db/clearGroupMessages.js";
import { getConfig } from "../../db/getConfig.js";
import { openDatabase } from "../../db/openDatabase.js";
import { roomIdFromGroupId } from "../../db/rooms.js";
import { saveMessage } from "../../db/saveMessage.js";
import { setConfig } from "../../db/setConfig.js";
import { decryptValue, encryptValue } from "../../security/crypto.js";
import { VMBootMode, VMStatus } from "../../shell/vm.js";
import { readGroupFile } from "../../storage/readGroupFile.js";

import {
  OrchestratorDisplayState,
  orchestratorStore,
} from "../../stores/orchestrator.js";

import { toolsStore } from "../../stores/tools.js";
import { BrowserChatChannel } from "../../subsystems/channels/browser-chat.js";
import { ChannelRegistry } from "../../subsystems/channels/channel-registry.js";
import { IMessageChannel } from "../../subsystems/channels/imessage.js";
import { PeerJsChannel } from "../../subsystems/channels/peerjs.js";
import { RoomManager } from "../../subsystems/channels/room-manager.js";
import { RoomChannel } from "../../subsystems/channels/room.js";
import { TelegramChannel } from "../../subsystems/channels/telegram.js";

import { unregisterWebMcpTools } from "../../subsystems/mcp/webmcp.js";

import { getContextLimit } from "../../subsystems/providers/providers.js";
import { TaskScheduler } from "../../subsystems/tools/task-scheduler.js";
import { formatA2UIActionPrompt } from "../../ui/a2ui/utils/formatA2UIActionPrompt.js";
import { ulid } from "../../utils/ulid.js";
import { buildSystemPrompt } from "../../worker/utils/system-prompt.js";
import { Router } from "../router.js";
import { enqueue } from "./utils/enqueue.js";
import { EventBus } from "./utils/EventBus.js";

import {
  createRoomManager,
  initChannelsAndRooms,
  initCoreConfig,
  initFeatureFlagsAndLimits,
  initLlamafileAndMesh,
  initProviderAndModel,
  initWorkerAndScheduler,
} from "./utils/initTasks.js";

import { invokeAgent } from "./utils/invokeAgent.js";

import {
  cancelLlamafileRequest,
  stopTransformersProgressPolling,
} from "./utils/operations/provider.js";

import { syncWebMcpRegistration } from "./utils/syncWebMcpRegistration.js";
import { DEFAULT_DIRECT_TOOL_COMMAND_POLICY } from "./utils/types.js";

import type { ShadowClawDatabase } from "../../db/db.js";
import type { A2UIAction } from "../../ui/a2ui/types.js";
import type { DirectToolCommandPolicy } from "./utils/types.js";

export class Orchestrator {
  agentWorker: Worker | null = null;
  assistantName: string = ASSISTANT_NAME;

  bedrockAuthMode: string = "provider_chain";
  bedrockProfileFallback: string = "";
  bedrockRegionFallback: string = "";

  browserChat: BrowserChatChannel = new BrowserChatChannel();

  channelEnabledByType: Record<string, boolean> = {
    browser: true,
    peerjs: false,
    telegram: false,
    imessage: false,
  };

  channelRegistry: ChannelRegistry = new ChannelRegistry();
  contextCompressionEnabled: boolean = false;

  db: ShadowClawDatabase | null = null;
  directToolCommandPolicy: DirectToolCommandPolicy = {
    ...DEFAULT_DIRECT_TOOL_COMMAND_POLICY,
  };

  events: EventBus = new EventBus();
  gitProxyUrl: string = "/git-proxy";

  imessage: IMessageChannel = new IMessageChannel();
  imessageApiKey: string = "";
  imessageChatIds: string[] = [];
  imessageServerUrl: string = "";

  inFlightEffectiveProviderByGroup: Map<
    string,
    {
      providerId: string;
      providerConfig: ProviderConfig;
    }
  > = new Map();

  inFlightProviderRequestIds: Map<string, string> = new Map();
  inFlightTriggerByGroup: Map<string, string> = new Map();

  llamafileHost: string = "127.0.0.1";
  llamafileMode: "server" | "cli" = "cli";
  llamafileOffline: boolean = true;
  llamafilePort: number = 8080;

  maxIterations: number = DEFAULT_MAX_ITERATIONS;
  maxTokens: number = DEFAULT_MAX_TOKENS;

  meshLlmHost: string = "";

  messageQueue: any[] = [];
  model: string = getDefaultProvider().defaultModel;

  /** Peer groupIds where the A2A task has reached a terminal state */
  peerCompletedContexts = new Set<string>();
  peerjs: PeerJsChannel = new PeerJsChannel();
  peerjsMyAlias: string = "";
  peerjsMyPeerId: string = "";
  peerjsPeerAliases: Record<string, string> = {};
  peerjsServerHost: string = "";
  peerjsServerPath: string = "";
  peerjsServerPort: number = 0;
  peerjsServerSecure: boolean = true;
  peerjsTrustedPeerIds: string[] = [];

  pendingScheduledTasks: Set<string> = new Set();
  processing: boolean = false;
  promptControllers: Map<string, AbortController> = new Map();

  provider: string = DEFAULT_PROVIDER;
  providerConfig: ProviderConfig = getDefaultProvider();

  proxyUrl: string = "/proxy";
  pushSubscriptionWarned: boolean = false;
  rateLimitAutoAdapt: boolean = true;

  rateLimitCallsPerMinute: number = 0;
  reasoningEffort: string = "none";

  /** Multi-party room channel + manager (layered on the PeerJS transport). */
  roomChannel: RoomChannel = new RoomChannel();
  roomManager!: RoomManager;

  router: Router | null = null;

  scheduler: TaskScheduler | null = null;
  schedulerTriggeredGroups: Set<string> = new Set();

  state: OrchestratorDisplayState = "idle";
  streamingEnabled: boolean = true;
  taskServerUrl: string = "/schedule";

  telegram: TelegramChannel = new TelegramChannel();
  telegramBotToken: string = "";
  telegramChatIds: string[] = [];
  telegramUseProxy: boolean = false;

  transformersProgressPollers: Map<string, number> = new Map();
  triggerPattern: RegExp = buildTriggerPattern(ASSISTANT_NAME);
  useProxy: boolean = false;

  vmBashFullInternetAccess: boolean = false;
  vmBootMode: VMBootMode = "disabled";
  vmStatus: VMStatus = {
    ready: false,
    booting: false,
    bootAttempted: false,
    error: null,
  };

  webMcpEffectCleanup: (() => void) | null = null;
  webMcpRegistrationLock: Promise<void> = Promise.resolve();
  webMcpToolsEnabled: boolean = true;

  #apiKeyCache: { value: string; expiresAt: number } | null = null;
  #encryptedApiKey: string | null = null;

  constructor() {
    this.roomManager = createRoomManager(this);
    this.initializeChannelRegistry();
  }

  clearProviderRequest(groupId: string): void {
    this.inFlightProviderRequestIds.delete(groupId);
  }

  createProviderRequestId(groupId: string): string {
    if (this.provider !== "llamafile") {
      this.inFlightProviderRequestIds.delete(groupId);

      return "";
    }

    const requestId = `${groupId}:${Date.now().toString(36)}:${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    this.inFlightProviderRequestIds.set(groupId, requestId);

    return requestId;
  }

  initializeChannelRegistry(): void {
    this.channelRegistry = new ChannelRegistry();
    this.channelRegistry.register("br:", this.browserChat, {
      badge: "Browser",
      autoTrigger: true,
    });

    this.channelRegistry.register("tg:", this.telegram, {
      badge: "Telegram",
      autoTrigger: false,
    });

    this.channelRegistry.register("im:", this.imessage, {
      badge: "iMessage",
      autoTrigger: true,
    });

    this.channelRegistry.register("peer:", this.peerjs, {
      badge: "PeerJS",
      autoTrigger: false,
    });

    this.channelRegistry.register("room:", this.roomChannel, {
      badge: "Room",
      autoTrigger: false,
    });

    this.roomChannel.setManager(this.roomManager);
    this.peerjs.setRoomNotificationHandler((from, method, params) =>
      this.roomManager.handleNotification(from, method, params),
    );

    this.router = new Router(this.channelRegistry);
  }

  setState(state: OrchestratorDisplayState, groupId?: string): void {
    this.state = state;
    this.events.emit("state-change", { state, groupId });
  }

  /**
   * Shut down everything
   */
  shutdown() {
    this.channelRegistry.stopAll();
    this.scheduler?.stop();

    for (const groupId of this.transformersProgressPollers.keys()) {
      stopTransformersProgressPolling(this, groupId);
    }

    this.agentWorker?.terminate();

    if (typeof this.webMcpEffectCleanup === "function") {
      this.webMcpEffectCleanup();
    }

    unregisterWebMcpTools();
  }

  stopCurrentRequest(groupId = DEFAULT_GROUP_ID): void {
    if (this.state !== "thinking" && this.state !== "responding") {
      return;
    }

    stopTransformersProgressPolling(this, groupId);
    const providerRequestId =
      this.inFlightProviderRequestIds.get(groupId) || "";
    this.clearProviderRequest(groupId);

    this.agentWorker?.postMessage({
      type: "cancel",
      payload: { groupId },
    });

    if (this.provider === "llamafile" && providerRequestId) {
      void cancelLlamafileRequest(providerRequestId);
    }

    const promptController = this.promptControllers.get(groupId);
    if (promptController) {
      promptController.abort();

      this.promptControllers.delete(groupId);
    }

    this.inFlightTriggerByGroup.delete(groupId);
    this.inFlightEffectiveProviderByGroup.delete(groupId);

    this.events.emit("typing", { groupId, typing: false });
    this.router?.setTyping(groupId, false);
    this.setState("idle", groupId);
  }

  async getApiKey(): Promise<string | null> {
    if (!this.#encryptedApiKey) {
      return null;
    }

    const now = Date.now();
    if (this.#apiKeyCache && this.#apiKeyCache.expiresAt > now) {
      return this.#apiKeyCache.value;
    }

    try {
      const decrypted = await decryptValue(this.#encryptedApiKey);
      if (decrypted === null) {
        return null;
      }

      this.#apiKeyCache = {
        expiresAt: now + 30000, // 30s TTL
        value: decrypted,
      };

      return decrypted;
    } catch (e) {
      console.error("[Orchestrator] Failed to decrypt API key:", e);

      return null;
    }
  }

  async getApiKeyForSpecificProvider(
    db: ShadowClawDatabase,
    providerId: string,
  ): Promise<string> {
    let storedKey = await getConfig(db, getProviderApiKeyConfigKey(providerId));

    if (!storedKey && providerId === "openrouter") {
      const legacyKey = await getConfig(db, CONFIG_KEYS.API_KEY);
      if (legacyKey) {
        storedKey = legacyKey;
      }
    }

    if (!storedKey) {
      return "";
    }

    try {
      const decrypted = await decryptValue(storedKey);

      return decrypted || "";
    } catch (e) {
      console.error("[Orchestrator] Failed to decrypt API key:", e);

      return "";
    }
  }

  async handleCompactDone(
    db: ShadowClawDatabase,
    groupId: string,
    summary: string,
  ): Promise<void> {
    await clearGroupMessages(db, groupId);

    const stored = {
      channel: this.channelRegistry.getChannelType(groupId) ?? "browser",
      content: `📝 **Context Compacted**\n\n${summary}`,
      groupId,
      id: ulid(),
      isFromMe: true,
      isTrigger: false,
      sender: this.assistantName,
      timestamp: Date.now(),
    };

    await saveMessage(db, stored);

    this.events.emit("context-compacted", { groupId, summary });
    this.events.emit("typing", { groupId, typing: false });

    this.setState("idle", groupId);
  }

  async init(): Promise<ShadowClawDatabase> {
    const db = await openDatabase();
    this.db = db;

    // Fast parallel path: these four functions only read from IndexedDB and are
    // fully independent of each other. Running them concurrently saves ~200–400 ms
    // compared to the previous sequential await chain.
    await Promise.all([
      initCoreConfig(this, db),
      initProviderAndModel(this, db),
      initLlamafileAndMesh(this, db),
      initFeatureFlagsAndLimits(this, db),
    ]);

    // Worker + scheduler need provider/model/flags to be ready, so they still
    // start synchronously after the parallel group above.
    await initWorkerAndScheduler(this, db);

    // Channels/rooms are deferred to a background microtask so the UI reaches
    // "ready" without waiting for room metadata reads or peer-channel setup.
    // browserChat.onDisplay is called after channels are configured.
    void initChannelsAndRooms(this, db).then(() => {
      this.browserChat.onDisplay(() => {});
    });

    this.events.emit("ready", undefined);

    await toolsStore.load(db);
    // syncWebMcpRegistration only installs an effect listener; it is safe to
    // call before channels are fully ready because it reacts reactively.
    syncWebMcpRegistration(this, db);

    return db;
  }

  /**
   * Load the API key for a provider into memory.
   */
  async loadApiKeyForProvider(
    db: ShadowClawDatabase,
    providerId: string,
  ): Promise<void> {
    let storedKey = await getConfig(db, getProviderApiKeyConfigKey(providerId));

    if (!storedKey && providerId === "openrouter") {
      const legacyKey = await getConfig(db, CONFIG_KEYS.API_KEY);
      if (legacyKey) {
        storedKey = legacyKey;
        await setConfig(db, getProviderApiKeyConfigKey(providerId), legacyKey);
      }
    }

    if (!storedKey) {
      this.#encryptedApiKey = "";
    } else {
      try {
        // We now store the encrypted key directly in the field.
        // decryptValue is only called on-demand.
        this.#encryptedApiKey = storedKey;
      } catch (e) {
        console.warn("[Orchestrator] Failed to load API key:", e);

        this.#encryptedApiKey = "";
      }
    }

    this.#apiKeyCache = null; // Invalidate cache
  }

  async loadSecretConfig(db: ShadowClawDatabase, key: string): Promise<string> {
    const storedValue = await getConfig(db, key);
    if (!storedValue) {
      return "";
    }

    try {
      return (await decryptValue(storedValue)) || "";
    } catch {
      const encrypted = await encryptValue(storedValue);
      if (encrypted) {
        await setConfig(db, key, encrypted);
      }

      return storedValue;
    }
  }

  async newSession(
    db: ShadowClawDatabase,
    groupId = DEFAULT_GROUP_ID,
  ): Promise<void> {
    await clearGroupMessages(db, groupId);

    this.events.emit("session-reset", { groupId });
  }

  /**
   * Recompute and emit context usage for the given conversation.
   * Useful after message mutation operations (for example delete) so the
   * context bar updates without waiting for the next model invocation.
   */
  async refreshContextUsage(
    db: ShadowClawDatabase,
    groupId = DEFAULT_GROUP_ID,
  ): Promise<void> {
    let memory = "";
    try {
      memory = await readGroupFile(db, groupId, "MEMORY.md");
    } catch {
      // No memory file yet.
    }

    const activeTools = toolsStore.enabledTools;
    const peerState = orchestratorStore.getPeerState(groupId) || undefined;
    const systemPrompt = buildSystemPrompt(
      this.assistantName,
      memory,
      activeTools,
      toolsStore.systemPromptOverride,
      peerState,
    );

    const contextLimit = getContextLimit(this.model);
    const systemPromptTokens =
      estimateTokens(systemPrompt) +
      (activeTools?.reduce(
        (acc, t) => acc + estimateTokens(JSON.stringify(t)),
        0,
      ) ?? 0);
    const allMessages = await buildConversationMessages(groupId, 200);
    const dynamicContext = buildDynamicContext(allMessages, {
      contextLimit,
      systemPromptTokens,
      maxOutputTokens: this.maxTokens,
      skimTop: this.contextCompressionEnabled,
    });

    let displayTokens = dynamicContext.estimatedTokens + systemPromptTokens;

    // If we have actual token usage from the most recent request,
    // and our heuristic is significantly lower, blend it in to provide a more accurate percentage.
    if (orchestratorStore.tokenUsage) {
      const u = orchestratorStore.tokenUsage;
      const actualPrompt =
        (u.inputTokens || 0) + (u.cacheReadTokens || 0) + (u.outputTokens || 0);

      displayTokens = Math.max(displayTokens, actualPrompt);
    }

    this.events.emit("context-usage", {
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
  }

  async restartCurrentRequest(groupId = DEFAULT_GROUP_ID): Promise<boolean> {
    if (this.state !== "thinking" && this.state !== "responding") {
      return false;
    }

    if (!this.db) {
      return false;
    }

    const triggerContent = this.inFlightTriggerByGroup.get(groupId);
    if (!triggerContent) {
      return false;
    }

    this.stopCurrentRequest(groupId);

    await invokeAgent(this, this.db, groupId, triggerContent);

    return true;
  }

  /**
   * Route a user interaction on a **shared room surface** (owner-authoritative).
   *
   * - If the local peer owns the surface (it called `render_component`), the
   *   action is enqueued locally so this peer's agent processes it and
   *   broadcasts the resulting `updateDataModel` envelope to the room.
   * - Otherwise the action is broadcast over the room mesh so the surface
   *   owner's agent can process it. The owner then broadcasts the data-model
   *   update, keeping every member's surface in lockstep.
   */
  async routeRoomA2UIAction(
    groupId: string,
    action: A2UIAction,
  ): Promise<void> {
    const roomId = roomIdFromGroupId(groupId);
    const myPeerId = this.peerjs.myPeerId || this.peerjsMyPeerId;
    const ownerPeerId = this.roomManager.getSurfaceOwner(action.surfaceId);

    // We own the surface (or no owner is recorded yet — treat a locally
    // initiated action on an unknown surface as ours): process it here.
    if (!ownerPeerId || ownerPeerId === myPeerId) {
      if (!this.db) {
        return;
      }

      await enqueue(this, this.db, {
        id: ulid(),
        groupId,
        sender: this.peerjsMyAlias || myPeerId || "you",
        content: formatA2UIActionPrompt(action),
        timestamp: Date.now(),
        channel: "room",
        a2uiAction: action,
      });

      return;
    }

    // A remote peer owns the surface — broadcast the action to the room so the
    // owner's agent processes it and synchronizes everyone.
    this.roomManager.broadcastA2UIAction(roomId, action);
  }

  async saveSecretConfig(
    db: ShadowClawDatabase,
    key: string,
    value: string,
  ): Promise<void> {
    if (!value) {
      await setConfig(db, key, "");

      return;
    }

    const encrypted = await encryptValue(value);
    if (!encrypted) {
      throw new Error(`Failed to encrypt secret config for ${key}`);
    }

    await setConfig(db, key, encrypted);
  }

  async setApiKey(db: ShadowClawDatabase, key: string): Promise<void> {
    this.#encryptedApiKey = await encryptValue(key);

    // Invalidate cache
    this.#apiKeyCache = null;

    const encrypted = await encryptValue(key);

    if (!encrypted) {
      throw new Error("key failed to encrypt. config cannot set.");
    }

    await setConfig(db, getProviderApiKeyConfigKey(this.provider), encrypted);
  }
}
