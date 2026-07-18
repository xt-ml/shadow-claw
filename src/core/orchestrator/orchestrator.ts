import {
  ASSISTANT_NAME,
  CONFIG_KEYS,
  DEFAULT_GROUP_ID,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_PROVIDER,
  LLAMAFILE_PROXY_URL,
  PROVIDERS,
  ProviderConfig,
  buildTriggerPattern,
  getDefaultProvider,
  getModelMaxTokens,
  getProvider,
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

import {
  setWebMcpMode as applyWebMcpMode,
  getWebMcpMode as readWebMcpMode,
  unregisterWebMcpTools,
} from "../../subsystems/mcp/webmcp.js";

import { modelRegistry } from "../../subsystems/providers/model-registry.js";
import { getContextLimit } from "../../subsystems/providers/providers.js";
import { TaskScheduler } from "../../subsystems/tools/task-scheduler.js";

import { formatA2UIActionPrompt } from "../../ui/a2ui.js";
import { showToast } from "../../ui/toast.js";
import { ulid } from "../../utils/ulid.js";
import { buildSystemPrompt } from "../../worker/system-prompt.js";

import {
  deliverIntermediateResponse,
  deliverResponse,
} from "./utils/deliverResponse.js";

import { compactContext } from "./utils/compactContext.js";
import { enqueue, processQueue } from "./utils/enqueue.js";
import { EventBus } from "./utils/EventBus.js";
import { handleWorkerMessage } from "./utils/handleWorkerMessage.js";

import {
  createRoomManager,
  initChannelsAndRooms,
  initCoreConfig,
  initFeatureFlagsAndLimits,
  initLlamafileAndMesh,
  initProviderAndModel,
  initWorkerAndScheduler,
} from "./utils/initTasks.js";

import { configurePeerJs } from "./utils/configurePeerJs.js";
import { invokeAgent } from "./utils/invokeAgent.js";
import { loadChannelConfigurations } from "./utils/loadChannelConfigurations.js";
import { normalizeStringList } from "./utils/normalizeStringList.js";
import { parseDirectToolCommand } from "./utils/parseDirectToolCommand.js";
import { setupPushTaskListener } from "./utils/setupPushTaskListener.js";
import { syncWebMcpRegistration } from "./utils/syncWebMcpRegistration.js";
import { DEFAULT_DIRECT_TOOL_COMMAND_POLICY } from "./utils/types.js";

import { Router } from "../router.js";

import type { MessageAttachment } from "../../content/types.js";
import type { ShadowClawDatabase } from "../../db/db.js";
import type { Task } from "../../db/types.js";
import type { RoomInvitePayload } from "../../subsystems/channels/peer-protocol.js";

import type {
  Channel,
  ChannelType,
  InboundMessage,
  RoomMeta,
} from "../../subsystems/channels/types.js";

import type { WebMcpMode } from "../../subsystems/mcp/webmcp.js";
import type { LLMProvider } from "../../subsystems/providers/types.js";
import type { ModelDownloadProgressPayload } from "../../subsystems/worker/types.js";
import type { A2UIAction } from "../../ui/a2ui.js";

import type {
  DirectToolCommandPolicy,
  ParsedDirectToolCommand,
} from "./utils/types.js";

/**
 * Main orchestrator class
 */
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
    this.roomManager = this.createRoomManager();
    this.initializeChannelRegistry();
  }

  /**
   * Respond to an agent's ask_user prompt, unblocking its execution.
   */
  answerUserPrompt(id: string, response: string | null): void {
    this.agentWorker?.postMessage({
      payload: { id, response },
      type: "ask-user-response",
    });
  }

  applyAllChannelRunningStates(): void {
    this.applyChannelRunningState("browser");
    this.applyChannelRunningState("telegram");
    this.applyChannelRunningState("imessage");
    this.applyChannelRunningState("peerjs");
  }

  applyChannelRunningState(channelType: ChannelType): void {
    const channel = this.getChannelByType(channelType);
    if (!channel) {
      return;
    }

    if (this.shouldRunChannel(channelType)) {
      channel.start();

      return;
    }

    channel.stop();
  }

  applyLlamafileHeaders() {
    if (this.providerConfig?.id !== "llamafile") {
      return;
    }

    this.providerConfig = {
      ...this.providerConfig,
      headers: {
        ...(this.providerConfig.headers || {}),
        "x-llamafile-mode": this.llamafileMode,
        "x-llamafile-host": this.llamafileHost,
        "x-llamafile-port": String(this.llamafilePort),
        "x-llamafile-offline": this.llamafileOffline ? "true" : "false",
      },
    };
  }

  applyMeshLlmHeaders() {
    if (this.providerConfig?.id !== "mesh-llm") {
      return;
    }

    this.providerConfig = {
      ...this.providerConfig,
      headers: {
        ...(this.providerConfig.headers || {}),
        "x-mesh-llm-host": this.meshLlmHost,
      },
    };
  }

  clearPeerJsTypingState(groupId: string): void {
    orchestratorStore.setRemoteAgentTyping(groupId, false);
  }

  clearProviderRequest(groupId: string): void {
    this.inFlightProviderRequestIds.delete(groupId);
  }

  closeTerminalSession(groupId = DEFAULT_GROUP_ID): void {
    this.agentWorker?.postMessage({
      payload: { groupId },
      type: "vm-terminal-close",
    });
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

  // ---------------------------------------------------------------------------
  // Multi-party room public API
  // ---------------------------------------------------------------------------

  /** Create a new room hosted by the local peer. */
  createRoom(name: string): RoomMeta {
    const room = this.roomManager.createRoom(name);
    this.events.emit("rooms-changed", this.roomManager.list());

    return room;
  }

  /**
   * Build the multi-party {@link RoomManager}, wiring it to the PeerJS channel
   * for transport and to the orchestrator for inbound delivery + persistence.
   */
  createRoomManager(): RoomManager {
    return createRoomManager(this);
  }

  flushTerminalWorkspace(groupId = DEFAULT_GROUP_ID): void {
    this.agentWorker?.postMessage({
      payload: { groupId },
      type: "vm-workspace-flush",
    });
  }

  getAssistantName(): string {
    return this.assistantName;
  }

  getAvailableProviders(): LLMProvider[] {
    return Object.entries(PROVIDERS).map(([id, config]) => ({
      id,
      name: config.name,
      // Only populate a static models list when there is no modelsUrl.
      // When modelsUrl is present the settings UI must reach the dynamic-fetch
      // branch; including even a single-item [defaultModel] here would cause it
      // to short-circuit and never call modelsUrl.
      ...(!config.modelsUrl && {
        models:
          Array.isArray(config.models) && config.models.length > 0
            ? config.models
            : [config.defaultModel],
      }),
      ...(config.modelsUrl && { modelsUrl: config.modelsUrl }),
      ...(config.headers && { headers: config.headers }),
      ...(config.apiKeyHeader && { apiKeyHeader: config.apiKeyHeader }),
      ...(config.apiKeyHeaderFormat && {
        apiKeyHeaderFormat: config.apiKeyHeaderFormat,
      }),
      ...(typeof config.requiresApiKey === "boolean" && {
        requiresApiKey: config.requiresApiKey,
      }),
    }));
  }

  getBedrockSettings(): {
    authMode: string;
    profile: string;
    region: string;
  } {
    return {
      authMode: this.bedrockAuthMode,
      profile: this.bedrockProfileFallback,
      region: this.bedrockRegionFallback,
    };
  }

  getChannelByType(channelType: ChannelType): Channel | null {
    switch (channelType) {
      case "browser":
        return this.browserChat;
      case "telegram":
        return this.telegram;
      case "imessage":
        return this.imessage;
      case "peerjs":
        return this.peerjs;
      default:
        return null;
    }
  }

  getChannelEnabled(channelType: ChannelType): boolean {
    if (channelType === "browser") {
      return true;
    }

    return this.channelEnabledByType[channelType] !== false;
  }

  getChannelEnabledConfigKey(channelType: ChannelType): string {
    return `${CONFIG_KEYS.CHANNEL_ENABLED_PREFIX}${channelType}`;
  }

  getChannelTypeForGroup(groupId: string): ChannelType {
    return this.channelRegistry.getChannelType(groupId) ?? "browser";
  }

  getContextCompressionEnabled(): boolean {
    return this.contextCompressionEnabled;
  }

  getGitProxyUrl(): string {
    return this.gitProxyUrl;
  }

  getIMessageConfig(): {
    apiKey: string;
    chatIds: string[];
    enabled: boolean;
    serverUrl: string;
  } {
    return {
      apiKey: this.imessageApiKey,
      chatIds: [...this.imessageChatIds],
      enabled: this.getChannelEnabled("imessage"),
      serverUrl: this.imessageServerUrl,
    };
  }

  getLlamafileSettings(): {
    host: string;
    mode: "server" | "cli";
    offline: boolean;
    port: number;
  } {
    return {
      mode: this.llamafileMode,
      host: this.llamafileHost,
      port: this.llamafilePort,
      offline: this.llamafileOffline,
    };
  }

  getMaxIterations(): number {
    return this.maxIterations;
  }

  getMaxTokens(): number {
    return this.maxTokens;
  }

  getMeshLlmSettings(): { host: string } {
    return {
      host: this.meshLlmHost,
    };
  }

  getModel(): string {
    return this.model;
  }

  getPeerJsConfig(): {
    enabled: boolean;
    myAlias: string;
    myPeerId: string;
    peerAliases: Record<string, string>;
    serverHost: string;
    serverPath: string;
    serverPort: number;
    serverSecure: boolean;
    trustedPeerIds: string[];
  } {
    return {
      enabled: this.getChannelEnabled("peerjs"),
      myAlias: this.peerjsMyAlias,
      myPeerId: this.peerjsMyPeerId,
      peerAliases: { ...this.peerjsPeerAliases },
      serverHost: this.peerjsServerHost,
      serverPath: this.peerjsServerPath,
      serverPort: this.peerjsServerPort,
      serverSecure: this.peerjsServerSecure,
      trustedPeerIds: [...this.peerjsTrustedPeerIds],
    };
  }

  getProvider(): string {
    return this.provider;
  }

  getProviderRuntimeHeaders(
    providerId: string,
    requestId = "",
  ): Record<string, string> {
    if (providerId === "llamafile") {
      const headers: Record<string, string> = {
        "x-llamafile-mode": this.llamafileMode,
        "x-llamafile-host": this.llamafileHost,
        "x-llamafile-port": String(this.llamafilePort),
        "x-llamafile-offline": this.llamafileOffline ? "true" : "false",
      };

      if (requestId) {
        headers["x-shadowclaw-request-id"] = requestId;
      }

      return headers;
    }

    if (providerId === "bedrock_proxy") {
      const headers: Record<string, string> = {};
      if (this.bedrockRegionFallback) {
        headers["x-bedrock-region"] = this.bedrockRegionFallback;
      }

      if (this.bedrockProfileFallback) {
        headers["x-bedrock-profile"] = this.bedrockProfileFallback;
      }

      headers["x-bedrock-auth-mode"] = this.bedrockAuthMode;

      return headers;
    }

    return {};
  }

  getProxyUrl(): string {
    return this.proxyUrl;
  }

  getRateLimitAutoAdapt(): boolean {
    return this.rateLimitAutoAdapt;
  }

  getRateLimitCallsPerMinute(): number {
    return this.rateLimitCallsPerMinute;
  }

  /**
   * Get current state
   */
  getState(): OrchestratorDisplayState {
    return this.state;
  }

  getStreamingEnabled(): boolean {
    return this.streamingEnabled;
  }

  getTaskServerUrl(): string {
    return this.taskServerUrl;
  }

  getTelegramConfig(): {
    botToken: string;
    chatIds: string[];
    enabled: boolean;
    useProxy: boolean;
  } {
    return {
      botToken: this.telegramBotToken,
      chatIds: [...this.telegramChatIds],
      enabled: this.getChannelEnabled("telegram"),
      useProxy: this.telegramUseProxy,
    };
  }

  getTransformersStatusUrl(): string {
    const base = this.providerConfig?.baseUrl || "";
    if (base.includes("/chat/completions")) {
      return base.replace("/chat/completions", "/status");
    }

    return "http://localhost:8888/transformers-js-proxy/status";
  }

  getUseProxy(): boolean {
    return this.useProxy;
  }

  getVMBashFullInternetAccess(): boolean {
    return this.vmBashFullInternetAccess;
  }

  getVMBootMode(): VMBootMode {
    return this.vmBootMode;
  }

  getVMStatus(): VMStatus {
    return this.vmStatus;
  }

  getWebMcpMode(): WebMcpMode {
    return readWebMcpMode();
  }

  getWebMcpToolsEnabled(): boolean {
    return this.webMcpToolsEnabled;
  }

  handleRoomInvite(invite: RoomInvitePayload): void {
    this.events.emit("room-invite", invite);
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

  /** Invite a (trusted) peer into an existing room. */
  inviteToRoom(roomId: string, peerId: string): boolean {
    return this.roomManager.invite(roomId, peerId);
  }

  isConfigured(): boolean {
    return this.#encryptedApiKey ? this.#encryptedApiKey.length > 0 : false;
  }

  /** Join a room advertised by a host (e.g. via a shared link/QR). */
  joinRoomViaLink(roomId: string, hostPeerId: string, name: string): RoomMeta {
    const room = this.roomManager.joinRoom(roomId, hostPeerId, name);
    this.events.emit("rooms-changed", this.roomManager.list());

    return room;
  }

  /** Leave (member) or disband (host) a room. */
  leaveRoom(roomId: string): void {
    this.roomManager.leaveRoom(roomId);
    this.events.emit("rooms-changed", this.roomManager.list());
  }

  /** List all joined rooms. */
  listRooms(): RoomMeta[] {
    return this.roomManager.list();
  }

  openTerminalSession(groupId = DEFAULT_GROUP_ID): void {
    this.agentWorker?.postMessage({
      payload: { groupId },
      type: "vm-terminal-open",
    });
  }

  parseDirectToolCommand(msg: InboundMessage): ParsedDirectToolCommand | null {
    return parseDirectToolCommand(
      this.directToolCommandPolicy,
      this.assistantName,
      msg,
    );
  }

  sendTerminalInput(data: string): void {
    this.agentWorker?.postMessage({
      payload: { data },
      type: "vm-terminal-input",
    });
  }

  setState(state: OrchestratorDisplayState, groupId?: string): void {
    this.state = state;
    this.events.emit("state-change", { state, groupId });
  }

  /**
   * Listen for service worker messages that relay scheduled-task push triggers.
   * When the server-side scheduler fires a task, it sends a push notification.
   * The service worker relays it here as a `scheduled-task-trigger` message.
   */
  setupPushTaskListener(db: ShadowClawDatabase): void {
    return setupPushTaskListener(this, db);
  }

  shouldRunChannel(channelType: ChannelType): boolean {
    if (channelType === "browser") {
      return true;
    }

    if (!this.getChannelEnabled(channelType)) {
      return false;
    }

    switch (channelType) {
      case "telegram":
        return this.telegramBotToken.length > 0;
      case "imessage":
        return this.imessageServerUrl.length > 0;
      case "peerjs":
        return this.peerjsMyPeerId.length > 0;
      default:
        return true;
    }
  }

  /**
   * Shut down everything
   */
  shutdown() {
    this.channelRegistry.stopAll();
    this.scheduler?.stop();

    for (const groupId of this.transformersProgressPollers.keys()) {
      this.stopTransformersProgressPolling(groupId);
    }

    this.agentWorker?.terminate();

    if (typeof this.webMcpEffectCleanup === "function") {
      this.webMcpEffectCleanup();
    }

    unregisterWebMcpTools();
  }

  startTransformersProgressPolling(groupId: string): void {
    this.stopTransformersProgressPolling(groupId);

    // Show immediate feedback while the first network poll is in flight.
    this.events.emit("model-download-progress", {
      groupId,
      message: "Preparing local model download...",
      progress: null,
      status: "running",
    });

    void this.pollTransformersProgress(groupId);

    const timer = setInterval(() => {
      void this.pollTransformersProgress(groupId);
    }, 1000);

    this.transformersProgressPollers.set(groupId, timer as unknown as number);
  }

  stopCurrentRequest(groupId = DEFAULT_GROUP_ID): void {
    if (this.state !== "thinking" && this.state !== "responding") {
      return;
    }

    this.stopTransformersProgressPolling(groupId);
    const providerRequestId =
      this.inFlightProviderRequestIds.get(groupId) || "";
    this.clearProviderRequest(groupId);

    this.agentWorker?.postMessage({
      type: "cancel",
      payload: { groupId },
    });

    if (this.provider === "llamafile" && providerRequestId) {
      void this.cancelLlamafileRequest(providerRequestId);
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

  stopTransformersProgressPolling(groupId: string): void {
    const timer = this.transformersProgressPollers.get(groupId);
    if (typeof timer === "number") {
      clearInterval(timer);

      this.transformersProgressPollers.delete(groupId);
    }
  }

  submitMessage(
    text: string,
    groupId = DEFAULT_GROUP_ID,
    attachments: MessageAttachment[] = [],
    a2uiAction?: A2UIAction,
  ): void {
    this.browserChat.submit(text, groupId, attachments, a2uiAction);
  }

  /**
   * Sync current proxy settings to the Service Worker interceptor.
   */
  syncProxyConfigToServiceWorker() {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "set-proxy-config",
        payload: {
          useProxy: this.useProxy,
          proxyUrl: this.proxyUrl,
        },
      });
    }
  }

  syncTerminalWorkspace(groupId = DEFAULT_GROUP_ID): void {
    this.agentWorker?.postMessage({
      payload: { groupId },
      type: "vm-workspace-sync",
    });
  }

  syncWebMcpRegistration(db: ShadowClawDatabase): void {
    return syncWebMcpRegistration(this, db);
  }

  /**
   * Auto-activate the best matching tool profile for the current provider + model.
   * Prefers exact provider+model match, then provider-only, then does nothing.
   */
  async autoActivateProfile(db: ShadowClawDatabase): Promise<void> {
    // Preserve an explicit manual "no tools" configuration.
    if (!toolsStore.activeProfileId && toolsStore.enabledToolNames.size === 0) {
      return;
    }

    const candidates = toolsStore.findProfilesForProvider(
      this.provider,
      this.model,
    );

    if (candidates.length === 0) {
      return;
    }

    // Prefer exact provider+model match.
    const exact = candidates.find(
      (p) => p.providerId === this.provider && p.model === this.model,
    );

    if (exact) {
      await toolsStore.activateProfile(db, exact.id);

      return;
    }

    // Then provider-only match.
    const providerOnly = candidates.find(
      (p) => p.providerId === this.provider && !p.model,
    );

    if (providerOnly) {
      await toolsStore.activateProfile(db, providerOnly.id);
    }
  }

  async cancelLlamafileRequest(requestId: string): Promise<void> {
    try {
      await fetch(LLAMAFILE_PROXY_URL.replace("/chat/completions", "/cancel"), {
        body: JSON.stringify({ requestId }),
        headers: {
          "Content-Type": "application/json",
          "x-shadowclaw-request-id": requestId,
        },
        keepalive: true,
        method: "POST",
      });
    } catch {
      // Best-effort cancellation only.
    }
  }

  async compactContext(
    db: ShadowClawDatabase,
    groupId = DEFAULT_GROUP_ID,
  ): Promise<void> {
    return compactContext(this, db, groupId);
  }

  async configureIMessage(
    db: ShadowClawDatabase,
    serverUrl: string,
    apiKey: string,
    chatIds: string[],
  ): Promise<void> {
    const normalizedServerUrl = serverUrl.trim().replace(/\/+$/, "");
    const normalizedApiKey = apiKey.trim();
    const normalizedChatIds = normalizeStringList(chatIds);

    this.imessageServerUrl = normalizedServerUrl;
    this.imessageApiKey = normalizedApiKey;
    this.imessageChatIds = normalizedChatIds;

    await setConfig(db, CONFIG_KEYS.IMESSAGE_SERVER_URL, normalizedServerUrl);
    await this.saveSecretConfig(
      db,
      CONFIG_KEYS.IMESSAGE_API_KEY,
      normalizedApiKey,
    );

    await setConfig(
      db,
      CONFIG_KEYS.IMESSAGE_CHAT_IDS,
      JSON.stringify(normalizedChatIds),
    );

    this.imessage.stop();
    this.imessage.configure(
      normalizedServerUrl,
      normalizedApiKey,
      normalizedChatIds,
    );

    if (normalizedServerUrl && this.getChannelEnabled("imessage")) {
      this.imessage.start();
    }
  }

  async configurePeerJs(
    db: ShadowClawDatabase,
    myPeerId: string,
    trustedPeerIds: string[],
    serverHost = "",
    serverPort = 0,
    serverPath = "",
    serverSecure = true,
  ): Promise<void> {
    return configurePeerJs(
      this,
      db,
      myPeerId,
      trustedPeerIds,
      serverHost,
      serverPort,
      serverPath,
      serverSecure,
    );
  }

  async configureTelegram(
    db: ShadowClawDatabase,
    token: string,
    chatIds: string[],
    useProxy = false,
  ): Promise<void> {
    const normalizedToken = token.trim();
    const normalizedChatIds = normalizeStringList(chatIds);
    const normalizedUseProxy = !!useProxy;

    this.telegramBotToken = normalizedToken;
    this.telegramChatIds = normalizedChatIds;
    this.telegramUseProxy = normalizedUseProxy;

    await this.saveSecretConfig(
      db,
      CONFIG_KEYS.TELEGRAM_BOT_TOKEN,
      normalizedToken,
    );

    await setConfig(
      db,
      CONFIG_KEYS.TELEGRAM_CHAT_IDS,
      JSON.stringify(normalizedChatIds),
    );

    await setConfig(
      db,
      CONFIG_KEYS.TELEGRAM_USE_PROXY,
      normalizedUseProxy ? "true" : "false",
    );

    this.telegram.stop();
    this.telegram.configure(
      normalizedToken,
      normalizedChatIds,
      normalizedUseProxy,
    );

    if (normalizedToken && this.getChannelEnabled("telegram")) {
      this.telegram.start();
    }
  }

  /**
   * Delete a task schedule from the server-side SQLite store.
   * Returns true if the server acknowledged (HTTP 2xx), false otherwise.
   */
  async deleteTaskFromServer(id: string): Promise<boolean> {
    try {
      const base = this.taskServerUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/tasks/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        console.error("Server rejected task deletion:", res.status);

        return false;
      }

      return true;
    } catch (err) {
      console.error("Failed to delete task from server:", err);

      return false;
    }
  }

  /**
   * Persist an intermediate assistant message (e.g. text emitted before
   * tool calls) without changing orchestrator state.
   */
  async deliverIntermediateResponse(
    db: ShadowClawDatabase,
    groupId: string,
    text: string,
  ): Promise<void> {
    return deliverIntermediateResponse(this, db, groupId, text);
  }

  async deliverResponse(
    db: ShadowClawDatabase,
    groupId: string,
    text: string,
  ): Promise<void> {
    return deliverResponse(this, db, groupId, text);
  }

  async enqueue(db: ShadowClawDatabase, msg: InboundMessage): Promise<void> {
    return enqueue(this, db, msg);
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

  async getApiKeyForHeaders(): Promise<string | undefined> {
    return (await this.getApiKey()) || undefined;
  }

  async getApiKeyForRequest(): Promise<string> {
    return (await this.getApiKey()) || "";
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
      channel: this.getChannelTypeForGroup(groupId),
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

  async handleWorkerMessage(db: ShadowClawDatabase, msg: any): Promise<void> {
    return handleWorkerMessage(this, db, msg);
  }

  async init(): Promise<ShadowClawDatabase> {
    const db = await openDatabase();
    this.db = db;

    await this.initCoreConfig(db);
    await this.initProviderAndModel(db);
    await this.initLlamafileAndMesh(db);
    await this.initFeatureFlagsAndLimits(db);
    await this.initChannelsAndRooms(db);
    await this.initWorkerAndScheduler(db);

    this.browserChat.onDisplay(() => {});
    this.events.emit("ready", undefined);

    await toolsStore.load(db);
    this.syncWebMcpRegistration(db);

    return db;
  }

  async initChannelsAndRooms(db: ShadowClawDatabase): Promise<void> {
    return initChannelsAndRooms(this, db);
  }

  async initCoreConfig(db: ShadowClawDatabase): Promise<void> {
    return initCoreConfig(this, db);
  }

  async initFeatureFlagsAndLimits(db: ShadowClawDatabase): Promise<void> {
    return initFeatureFlagsAndLimits(this, db);
  }

  async initLlamafileAndMesh(db: ShadowClawDatabase): Promise<void> {
    return initLlamafileAndMesh(this, db);
  }

  async initProviderAndModel(db: ShadowClawDatabase): Promise<void> {
    return initProviderAndModel(this, db);
  }

  async initWorkerAndScheduler(db: ShadowClawDatabase): Promise<void> {
    return initWorkerAndScheduler(this, db);
  }

  async invokeAgent(
    db: ShadowClawDatabase,
    groupId: string,
    triggerContent: string,
  ): Promise<void> {
    return invokeAgent(this, db, groupId, triggerContent);
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

  async loadChannelConfigurations(db: ShadowClawDatabase): Promise<void> {
    return loadChannelConfigurations(this, db);
  }

  async loadChannelEnabled(
    db: ShadowClawDatabase,
    channelType: ChannelType,
  ): Promise<boolean> {
    const stored = await getConfig(
      db,
      this.getChannelEnabledConfigKey(channelType),
    );

    if (!stored) {
      return false;
    }

    return stored !== "false";
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

  async pollTransformersProgress(groupId: string): Promise<void> {
    try {
      const res = await fetch(this.getTransformersStatusUrl(), {
        headers: {
          Accept: "application/json",
        },
        method: "GET",
      });

      if (!res.ok) {
        return;
      }

      const status = await res.json();
      const raw = Number(status?.progress);
      const normalizedProgress =
        Number.isFinite(raw) && raw > 1
          ? Math.max(0, Math.min(1, raw / 100))
          : Number.isFinite(raw)
            ? Math.max(0, Math.min(1, raw))
            : null;

      const payload: ModelDownloadProgressPayload = {
        groupId,
        message:
          typeof status?.message === "string" && status.message
            ? status.message
            : undefined,
        progress: normalizedProgress,
        status:
          status?.status === "done" || status?.status === "error"
            ? status.status
            : "running",
      };

      this.events.emit("model-download-progress", payload);

      if (payload.status === "done" || payload.status === "error") {
        this.stopTransformersProgressPolling(groupId);
      }
    } catch {
      // Ignore status polling failures so inference can continue uninterrupted.
    }
  }

  async processQueue(db: ShadowClawDatabase): Promise<void> {
    return processQueue(this, db);
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
    const systemPromptTokens = estimateTokens(systemPrompt);
    const allMessages = await buildConversationMessages(groupId, 200);
    const dynamicContext = buildDynamicContext(allMessages, {
      contextLimit,
      systemPromptTokens,
      maxOutputTokens: this.maxTokens,
      skimTop: this.contextCompressionEnabled,
    });

    this.events.emit("context-usage", {
      estimatedTokens: dynamicContext.estimatedTokens + systemPromptTokens,
      contextLimit,
      usagePercent: dynamicContext.usagePercent,
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

    await this.invokeAgent(this.db, groupId, triggerContent);

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

      await this.enqueue(this.db, {
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

  async runTaskAsScheduled(task: Task): Promise<void> {
    if (!task.groupId) {
      console.error(
        "Scheduled task has no groupId — refusing to execute to prevent context pollution.",
      );

      return;
    }

    this.schedulerTriggeredGroups.add(task.groupId);

    try {
      await orchestratorStore.runTask(task);
    } finally {
      this.schedulerTriggeredGroups.delete(task.groupId);
    }
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

  async setAssistantName(db: ShadowClawDatabase, name: string): Promise<void> {
    this.assistantName = name;
    this.triggerPattern = buildTriggerPattern(name);

    await setConfig(db, CONFIG_KEYS.ASSISTANT_NAME, name);
  }

  async setBedrockSettings(
    db: ShadowClawDatabase,
    settings: {
      authMode: string;
      profile: string;
      region: string;
    },
  ): Promise<void> {
    const region =
      typeof settings.region === "string" ? settings.region.trim() : "";

    const profile =
      typeof settings.profile === "string" ? settings.profile.trim() : "";

    const authMode = settings.authMode === "sso" ? "sso" : "provider_chain";

    this.bedrockRegionFallback = region;
    this.bedrockProfileFallback = profile;
    this.bedrockAuthMode = authMode;

    await setConfig(db, CONFIG_KEYS.BEDROCK_REGION_FALLBACK, region);
    await setConfig(db, CONFIG_KEYS.BEDROCK_PROFILE_FALLBACK, profile);
    await setConfig(db, CONFIG_KEYS.BEDROCK_AUTH_MODE, authMode);
  }

  async setChannelEnabled(
    db: ShadowClawDatabase,
    channelType: ChannelType,
    enabled: boolean,
  ): Promise<void> {
    if (channelType === "browser") {
      return;
    }

    const normalizedEnabled = !!enabled;
    this.channelEnabledByType[channelType] = normalizedEnabled;

    await setConfig(
      db,
      this.getChannelEnabledConfigKey(channelType),
      normalizedEnabled ? "true" : "false",
    );

    this.applyChannelRunningState(channelType);
  }

  async setContextCompressionEnabled(
    db: ShadowClawDatabase,
    enabled: boolean,
  ): Promise<void> {
    this.contextCompressionEnabled = !!enabled;

    await setConfig(
      db,
      CONFIG_KEYS.CONTEXT_COMPRESSION_ENABLED,
      this.contextCompressionEnabled ? "true" : "false",
    );
  }

  async setGitProxyUrl(db: ShadowClawDatabase, url: string): Promise<void> {
    this.gitProxyUrl = url || "/git-proxy";

    await setConfig(db, CONFIG_KEYS.GIT_PROXY_URL, this.gitProxyUrl);
  }

  async setLlamafileSettings(
    db: ShadowClawDatabase,
    settings: {
      host: string;
      mode: "server" | "cli";
      offline: boolean;
      port: number;
    },
  ): Promise<void> {
    this.llamafileMode = settings.mode;
    this.llamafileHost = settings.host;
    this.llamafilePort = settings.port;
    this.llamafileOffline = settings.offline;

    await setConfig(db, CONFIG_KEYS.LLAMAFILE_MODE, settings.mode);
    await setConfig(db, CONFIG_KEYS.LLAMAFILE_HOST, settings.host);
    await setConfig(db, CONFIG_KEYS.LLAMAFILE_PORT, String(settings.port));
    await setConfig(
      db,
      CONFIG_KEYS.LLAMAFILE_OFFLINE,
      settings.offline ? "true" : "false",
    );

    this.applyLlamafileHeaders();
  }

  async setMaxIterations(db: ShadowClawDatabase, value: number): Promise<void> {
    this.maxIterations = value;

    await setConfig(db, CONFIG_KEYS.MAX_ITERATIONS, String(value));
  }

  async setMaxTokens(db: ShadowClawDatabase, value: number): Promise<void> {
    const dynamicMaxTokens = getModelMaxTokens(this.model);
    const normalized = Math.max(1, Math.min(value, dynamicMaxTokens));

    this.maxTokens = normalized;

    await setConfig(db, CONFIG_KEYS.MAX_TOKENS, String(normalized));
  }

  async setMeshLlmSettings(
    db: ShadowClawDatabase,
    settings: { host: string },
  ): Promise<void> {
    this.meshLlmHost = settings.host;

    await setConfig(db, CONFIG_KEYS.MESH_LLM_HOST, settings.host);

    this.applyMeshLlmHeaders();
  }

  async setModel(db: ShadowClawDatabase, model: string): Promise<void> {
    this.model = model;

    // Update max tokens based on new info
    this.maxTokens = getModelMaxTokens(this.model);

    await setConfig(db, CONFIG_KEYS.MODEL, model);

    // Auto-activate matching tool profile if one exists.
    await this.autoActivateProfile(db);
  }

  async setPeerjsMyAlias(db: ShadowClawDatabase, alias: string): Promise<void> {
    this.peerjsMyAlias = alias.trim();

    await setConfig(db, CONFIG_KEYS.PEERJS_MY_ALIAS, this.peerjsMyAlias);
  }

  async setPeerjsPeerAliases(
    db: ShadowClawDatabase,
    aliases: Record<string, string>,
  ): Promise<void> {
    this.peerjsPeerAliases = { ...aliases };

    await setConfig(
      db,
      CONFIG_KEYS.PEERJS_PEER_ALIASES,
      JSON.stringify(this.peerjsPeerAliases),
    );
  }

  async setProvider(db: ShadowClawDatabase, providerId: string): Promise<void> {
    const newProvider = getProvider(providerId);
    if (!newProvider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    this.provider = providerId;
    this.providerConfig = newProvider;
    this.model = newProvider.defaultModel;
    this.applyLlamafileHeaders();
    this.applyMeshLlmHeaders();

    // Load API key for the new provider first so fetchModelInfo can use it.
    await this.loadApiKeyForProvider(db, providerId);

    // Fetch model info for the new provider (passes apiKey for auth).
    await modelRegistry.fetchModelInfo(
      newProvider,
      (await this.getApiKeyForHeaders()) || undefined,
      this.getProviderRuntimeHeaders(providerId),
    );

    // Update max tokens based on new info
    this.maxTokens = getModelMaxTokens(this.model);

    await setConfig(db, CONFIG_KEYS.PROVIDER, providerId);
    await setConfig(db, CONFIG_KEYS.MODEL, this.model);

    // Auto-activate matching tool profile if one exists.
    await this.autoActivateProfile(db);
  }

  async setProxyUrl(db: ShadowClawDatabase, url: string): Promise<void> {
    this.proxyUrl = url || "/proxy";

    await setConfig(db, CONFIG_KEYS.PROXY_URL, this.proxyUrl);

    this.syncProxyConfigToServiceWorker();
  }

  async setRateLimitAutoAdapt(
    db: ShadowClawDatabase,
    enabled: boolean,
  ): Promise<void> {
    this.rateLimitAutoAdapt = !!enabled;

    await setConfig(
      db,
      CONFIG_KEYS.RATE_LIMIT_AUTO_ADAPT,
      this.rateLimitAutoAdapt ? "true" : "false",
    );
  }

  async setRateLimitCallsPerMinute(
    db: ShadowClawDatabase,
    value: number,
  ): Promise<void> {
    const normalized = Number.isFinite(value)
      ? Math.max(0, Math.floor(value))
      : 0;

    this.rateLimitCallsPerMinute = normalized;

    await setConfig(
      db,
      CONFIG_KEYS.RATE_LIMIT_CALLS_PER_MINUTE,
      String(normalized),
    );
  }

  async setStreamingEnabled(
    db: ShadowClawDatabase,
    enabled: boolean,
  ): Promise<void> {
    this.streamingEnabled = !!enabled;

    await setConfig(
      db,
      CONFIG_KEYS.STREAMING_ENABLED,
      this.streamingEnabled ? "true" : "false",
    );
  }

  async setTaskServerUrl(db: ShadowClawDatabase, url: string): Promise<void> {
    this.taskServerUrl = url || "/schedule";

    await setConfig(db, CONFIG_KEYS.TASK_SERVER_URL, this.taskServerUrl);
  }

  async setUseProxy(db: ShadowClawDatabase, enabled: boolean): Promise<void> {
    this.useProxy = !!enabled;

    await setConfig(
      db,
      CONFIG_KEYS.USE_PROXY,
      this.useProxy ? "true" : "false",
    );
    this.syncProxyConfigToServiceWorker();
  }

  async setVMBashFullInternetAccess(
    db: ShadowClawDatabase,
    enabled: boolean,
  ): Promise<void> {
    this.vmBashFullInternetAccess = !!enabled;

    await setConfig(
      db,
      CONFIG_KEYS.VM_BASH_FULL_INTERNET_ACCESS,
      this.vmBashFullInternetAccess ? "true" : "false",
    );
  }

  async setVMBashTimeout(
    db: ShadowClawDatabase,
    timeoutSec: number,
  ): Promise<void> {
    const normalized = Math.min(Math.max(Math.floor(timeoutSec), 1), 1800);

    await setConfig(db, CONFIG_KEYS.VM_BASH_TIMEOUT_SEC, String(normalized));
  }

  async setVMBootHost(db: ShadowClawDatabase, bootHost: string): Promise<void> {
    const normalized = typeof bootHost === "string" ? bootHost.trim() : "";

    await setConfig(db, CONFIG_KEYS.VM_BOOT_HOST, normalized);

    this.agentWorker?.postMessage({
      payload: { bootHost: normalized },
      type: "set-vm-mode",
    });
  }

  async setVMBootMode(db: ShadowClawDatabase, mode: VMBootMode): Promise<void> {
    const normalized =
      mode === "disabled" || mode === "9p" || mode === "ext2" || mode === "auto"
        ? mode
        : "disabled";

    this.vmBootMode = normalized;

    await setConfig(db, CONFIG_KEYS.VM_BOOT_MODE, normalized);

    this.agentWorker?.postMessage({
      payload: { mode: normalized },
      type: "set-vm-mode",
    });
  }

  async setVMNetworkRelayURL(
    db: ShadowClawDatabase,
    relayUrl: string,
  ): Promise<void> {
    const normalized = typeof relayUrl === "string" ? relayUrl.trim() : "";

    await setConfig(db, CONFIG_KEYS.VM_NETWORK_RELAY_URL, normalized);

    this.agentWorker?.postMessage({
      payload: { networkRelayUrl: normalized },
      type: "set-vm-mode",
    });
  }

  async setWebMcpMode(db: ShadowClawDatabase, mode: WebMcpMode): Promise<void> {
    // Unregister with old mode, switch, re-register with new mode.
    unregisterWebMcpTools();
    applyWebMcpMode(mode);

    await setConfig(db, CONFIG_KEYS.WEBMCP_MODE, mode);

    this.syncWebMcpRegistration(db);
  }

  async setWebMcpToolsEnabled(
    db: ShadowClawDatabase,
    enabled: boolean,
  ): Promise<void> {
    this.webMcpToolsEnabled = !!enabled;

    await setConfig(
      db,
      CONFIG_KEYS.WEBMCP_TOOLS_ENABLED,
      this.webMcpToolsEnabled ? "true" : "false",
    );

    this.syncWebMcpRegistration(db);
  }

  async shouldStartLocalScheduler(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) {
      return true;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      return !sub;
    } catch {
      return true;
    }
  }

  /**
   * Sync a task schedule to the server-side SQLite store.
   * Returns true if the server acknowledged (HTTP 2xx), false otherwise.
   */
  async syncTaskToServer(task: Task): Promise<boolean> {
    try {
      const base = this.taskServerUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/tasks`, {
        body: JSON.stringify(task),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!res.ok) {
        console.error("Server rejected task sync:", res.status);

        return false;
      }

      return true;
    } catch (err) {
      console.error("Failed to sync task to server:", err);

      return false;
    } finally {
      this.warnIfNoPushSubscription();
    }
  }

  /**
   * Check if push notifications are subscribed and warn if not.
   * Only warns once per session to avoid spamming the user.
   */
  async warnIfNoPushSubscription() {
    if (this.pushSubscriptionWarned) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.serviceWorker) {
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (!sub) {
        this.pushSubscriptionWarned = true;

        showToast(
          "Push notifications are not enabled. Scheduled tasks will only run while the app is open. Enable push in Settings for background execution.",
          { type: "warning" },
        );
      }
    } catch {
      // Service worker or Push API not available — ignore
    }
  }
}
