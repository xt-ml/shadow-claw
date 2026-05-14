import {
  ASSISTANT_NAME,
  CONFIG_KEYS,
  DEFAULT_GROUP_ID,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_PROVIDER,
  LLAMAFILE_PROXY_URL,
  PROVIDERS,
  buildTriggerPattern,
  getDefaultProvider,
  getModelMaxTokens,
  getProvider,
  getProviderApiKeyConfigKey,
} from "./config.js";

import {
  compactWithPromptApi,
  invokeWithPromptApi,
  isPromptApiSupported,
} from "./prompt-api-provider.js";
import { isLlamafileResolutionError } from "./components/common/help/llamafile.js";
import { detectProviderHelpType } from "./components/common/help/providers.js";
import { isTransformersJsResolutionError } from "./components/common/help/transformers.js";
import { invokeWithTransformersJs } from "./transformers-js-provider.js";

import {
  registerWebMcpTools,
  unregisterWebMcpTools,
  setWebMcpMode as applyWebMcpMode,
  getWebMcpMode as readWebMcpMode,
  type WebMcpMode,
} from "./webmcp.js";

import { playNotificationChime } from "./audio.js";
import { decryptValue, encryptValue } from "./crypto.js";
import { effect } from "./effect.js";
import { modelRegistry } from "./model-registry.js";
import {
  inferAttachmentMimeType,
  persistMessageAttachments,
} from "./message-attachments.js";
import { getContextLimit } from "./providers.js";
import { Router } from "./router.js";
import { TaskScheduler } from "./task-scheduler.js";
import { showToast } from "./toast.js";
import { ulid } from "./ulid.js";
import { VMBootMode, VMStatus } from "./vm.js";

import { type ShadowClawDatabase } from "./db/db.js";

import { buildConversationMessages } from "./db/buildConversationMessages.js";
import { clearGroupMessages } from "./db/clearGroupMessages.js";
import { deleteTask } from "./db/deleteTask.js";
import { getAllTasks } from "./db/getAllTasks.js";
import { getConfig } from "./db/getConfig.js";
import { openDatabase } from "./db/openDatabase.js";
import { saveMessage } from "./db/saveMessage.js";
import { saveTask } from "./db/saveTask.js";
import { setConfig } from "./db/setConfig.js";

import { buildDynamicContext } from "./context/buildDynamicContext.js";
import { estimateTokens } from "./context/estimateTokens.js";

import { BrowserChatChannel } from "./channels/browser-chat.js";
import { ChannelRegistry } from "./channels/channel-registry.js";
import { IMessageChannel } from "./channels/imessage.js";
import { TelegramChannel } from "./channels/telegram.js";

import { readGroupFile } from "./storage/readGroupFile.js";
import { readGroupFileBytes } from "./storage/readGroupFileBytes.js";
import { toolsStore } from "./stores/tools.js";
import { getCompactionSystemPrompt } from "./worker/getCompactionSystemPrompt.js";
import { buildSystemPrompt } from "./worker/system-prompt.js";
import { getPushUrl } from "./notifications/push-client.js";
import { getRemoteMcpConnection } from "./mcp-connections.js";
import { reconnectMcpOAuth } from "./mcp-reconnect.js";

import type {
  Channel,
  ChannelType,
  InboundMessage,
  LLMProvider,
  MessageAttachment,
  ModelDownloadProgressPayload,
  Task,
} from "./types.js";

/**
 * Simple event emitter for orchestrator events
 */
class EventBus {
  listeners: Map<string, Set<Function>>;

  constructor() {
    this.listeners = new Map();
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

export type OrchestratorState = "idle" | "thinking" | "responding" | "error";

interface DirectToolCommandPolicy {
  enabledChannelTypes: string[];
  allowedTools: string[];
  requireMention: boolean;
}

const DEFAULT_DIRECT_TOOL_COMMAND_POLICY: DirectToolCommandPolicy = {
  enabledChannelTypes: ["telegram"],
  allowedTools: ["clear_chat", "show_toast"],
  requireMention: true,
};

type ParsedDirectToolCommand = {
  toolName: string;
  input: Record<string, any>;
};

/**
 * Main orchestrator class
 */
export class Orchestrator {
  _pushSubscriptionWarned: boolean = false;
  _schedulerTriggeredGroups: Set<string> = new Set();
  _webMcpEffectCleanup: (() => void) | null = null;
  _webMcpRegistrationLock: Promise<void> = Promise.resolve();

  agentWorker: Worker | null = null;
  #encryptedApiKey: string | null = null;
  #apiKeyCache: { value: string; expiresAt: number } | null = null;

  assistantName: string = ASSISTANT_NAME;
  browserChat: BrowserChatChannel = new BrowserChatChannel();
  bedrockRegionFallback: string = "";
  bedrockProfileFallback: string = "";
  bedrockAuthMode: string = "provider_chain";
  channelRegistry: ChannelRegistry = new ChannelRegistry();
  contextCompressionEnabled: boolean = false;
  channelEnabledByType: Record<string, boolean> = {
    browser: true,
    telegram: true,
    imessage: true,
  };
  db: ShadowClawDatabase | null = null;
  events: EventBus = new EventBus();
  directToolCommandPolicy: DirectToolCommandPolicy = {
    ...DEFAULT_DIRECT_TOOL_COMMAND_POLICY,
  };
  gitProxyUrl: string = "/git-proxy";
  taskServerUrl: string = "/schedule";
  imessage: IMessageChannel = new IMessageChannel();
  imessageApiKey: string = "";
  imessageChatIds: string[] = [];
  imessageServerUrl: string = "";
  llamafileMode: "server" | "cli" = "cli";
  llamafileHost: string = "127.0.0.1";
  llamafilePort: number = 8080;
  llamafileOffline: boolean = true;
  maxIterations: number = DEFAULT_MAX_ITERATIONS;
  maxTokens: number = DEFAULT_MAX_TOKENS;
  rateLimitCallsPerMinute: number = 0;
  rateLimitAutoAdapt: boolean = true;
  messageQueue: any[] = [];
  model: string = getDefaultProvider().defaultModel;
  pendingScheduledTasks: Set<string> = new Set();
  processing: boolean = false;
  promptControllers: Map<string, AbortController> = new Map();
  transformersProgressPollers: Map<string, number> = new Map();
  inFlightTriggerByGroup: Map<string, string> = new Map();
  inFlightProviderRequestIds: Map<string, string> = new Map();
  provider: string = DEFAULT_PROVIDER;
  providerConfig: import("./config.js").ProviderConfig = getDefaultProvider();
  proxyUrl: string = "/proxy";
  router: Router | null = null;
  scheduler: TaskScheduler | null = null;
  state: OrchestratorState = "idle";
  streamingEnabled: boolean = true;
  telegram: TelegramChannel = new TelegramChannel();
  telegramBotToken: string = "";
  telegramChatIds: string[] = [];
  telegramUseProxy: boolean = false;
  triggerPattern: RegExp = buildTriggerPattern(ASSISTANT_NAME);
  useProxy: boolean = false;
  vmBootMode: VMBootMode = "disabled";
  vmStatus: VMStatus = {
    ready: false,
    booting: false,
    bootAttempted: false,
    error: null,
  };
  webMcpToolsEnabled: boolean = false;

  constructor() {
    this.initializeChannelRegistry();
  }

  async init(): Promise<ShadowClawDatabase> {
    // Open database
    const db = await openDatabase();
    this.db = db;

    // Load config
    this.assistantName =
      (await getConfig(db, CONFIG_KEYS.ASSISTANT_NAME)) || ASSISTANT_NAME;

    this.triggerPattern = buildTriggerPattern(this.assistantName);

    // Load provider
    const storedProvider = await getConfig(db, CONFIG_KEYS.PROVIDER);
    if (storedProvider && getProvider(storedProvider)) {
      this.provider = storedProvider;
      this.providerConfig = getProvider(storedProvider) || getDefaultProvider();
    }

    // Load API key first so we can pass it to fetchModelInfo for
    // providers that require authentication (e.g. HuggingFace).
    await this.loadApiKeyForProvider(db, this.provider);

    // load config settings
    this.bedrockRegionFallback = (
      (await getConfig(db, CONFIG_KEYS.BEDROCK_REGION_FALLBACK)) || ""
    ).trim();

    this.bedrockProfileFallback = (
      (await getConfig(db, CONFIG_KEYS.BEDROCK_PROFILE_FALLBACK)) || ""
    ).trim();

    this.bedrockAuthMode = (
      (await getConfig(db, CONFIG_KEYS.BEDROCK_AUTH_MODE)) || "provider_chain"
    ).trim();

    // Fetch model info for the current provider (passes apiKey for auth).
    await modelRegistry.fetchModelInfo(
      this.providerConfig,
      (await this.getApiKeyForHeaders()) || undefined,
      this.getProviderRuntimeHeaders(this.provider),
    );

    // Load model and max tokens
    const storedModel = await getConfig(db, CONFIG_KEYS.MODEL);
    if (storedModel) {
      this.model = storedModel;
    } else {
      this.model = this.providerConfig.defaultModel;
    }

    const storedMaxTokens = await getConfig(db, CONFIG_KEYS.MAX_TOKENS);
    const dynamicMaxTokens = getModelMaxTokens(this.model);

    // If the stored value is exactly 8192 (our legacy fallback), prioritize the dynamic value
    // from our registry and updated limits definitions.
    if (storedMaxTokens === "8192") {
      this.maxTokens = dynamicMaxTokens;
    } else {
      const parsedStored = parseInt(
        storedMaxTokens || String(dynamicMaxTokens),
        10,
      );
      // Hard clamp any stored manual overrides against our new safe dynamic boundaries
      // to avoid 400 errors if a user previously forced a too-large MAX_TOKENS in the DB.
      this.maxTokens = Math.min(parsedStored, dynamicMaxTokens);
    }

    const storedMaxIterations = await getConfig(db, CONFIG_KEYS.MAX_ITERATIONS);
    if (storedMaxIterations) {
      this.maxIterations =
        parseInt(storedMaxIterations, 10) || DEFAULT_MAX_ITERATIONS;
    }

    const storedRateLimitCallsPerMinute = await getConfig(
      db,
      CONFIG_KEYS.RATE_LIMIT_CALLS_PER_MINUTE,
    );
    if (storedRateLimitCallsPerMinute) {
      const parsed = parseInt(storedRateLimitCallsPerMinute, 10);
      this.rateLimitCallsPerMinute = Number.isFinite(parsed)
        ? Math.max(0, parsed)
        : 0;
    }

    const storedRateLimitAutoAdapt = await getConfig(
      db,
      CONFIG_KEYS.RATE_LIMIT_AUTO_ADAPT,
    );
    this.rateLimitAutoAdapt = storedRateLimitAutoAdapt !== "false";

    const storedLlamafileMode = await getConfig(db, CONFIG_KEYS.LLAMAFILE_MODE);
    if (storedLlamafileMode === "cli" || storedLlamafileMode === "server") {
      this.llamafileMode = storedLlamafileMode;
    } else {
      await setConfig(db, CONFIG_KEYS.LLAMAFILE_MODE, this.llamafileMode);
    }

    const storedLlamafileHost = await getConfig(db, CONFIG_KEYS.LLAMAFILE_HOST);
    if (storedLlamafileHost) {
      this.llamafileHost = storedLlamafileHost;
    }

    const storedLlamafilePort = await getConfig(db, CONFIG_KEYS.LLAMAFILE_PORT);
    if (storedLlamafilePort) {
      const parsedPort = parseInt(storedLlamafilePort, 10);
      if (
        Number.isFinite(parsedPort) &&
        parsedPort >= 1 &&
        parsedPort <= 65535
      ) {
        this.llamafilePort = parsedPort;
      }
    }

    const storedLlamafileOffline = await getConfig(
      db,
      CONFIG_KEYS.LLAMAFILE_OFFLINE,
    );
    if (storedLlamafileOffline === "false") {
      this.llamafileOffline = false;
    }

    this.applyLlamafileHeaders();

    const storedVMBootMode = await getConfig(db, CONFIG_KEYS.VM_BOOT_MODE);
    this.vmBootMode =
      storedVMBootMode === "disabled" ||
      storedVMBootMode === "auto" ||
      storedVMBootMode === "9p" ||
      storedVMBootMode === "ext2"
        ? storedVMBootMode
        : "disabled";

    // Load streaming preference (default: enabled)
    const storedStreaming = await getConfig(db, CONFIG_KEYS.STREAMING_ENABLED);
    this.streamingEnabled = storedStreaming !== "false";

    const storedWebMcpToolsEnabled = await getConfig(
      db,
      CONFIG_KEYS.WEBMCP_TOOLS_ENABLED,
    );
    this.webMcpToolsEnabled = storedWebMcpToolsEnabled === "true";

    // Load WebMCP mode preference (default: polyfill)
    const storedWebMcpMode = await getConfig(db, CONFIG_KEYS.WEBMCP_MODE);
    if (storedWebMcpMode === "native" || storedWebMcpMode === "polyfill") {
      applyWebMcpMode(storedWebMcpMode);
    }

    // Load context compression preference (default: false)
    const storedCompression = await getConfig(
      db,
      CONFIG_KEYS.CONTEXT_COMPRESSION_ENABLED,
    );
    this.contextCompressionEnabled = storedCompression === "true";

    const storedDirectToolPolicy = await getConfig(
      db,
      CONFIG_KEYS.DIRECT_TOOL_COMMAND_POLICY,
    );
    this.directToolCommandPolicy = this.parseDirectToolCommandPolicy(
      storedDirectToolPolicy,
    );

    // Load proxy preference (default: disabled)
    const storedUseProxy = await getConfig(db, CONFIG_KEYS.USE_PROXY);
    this.useProxy = storedUseProxy === "true";

    // Load proxy URLs
    this.proxyUrl = (await getConfig(db, CONFIG_KEYS.PROXY_URL)) || "/proxy";
    this.gitProxyUrl =
      (await getConfig(db, CONFIG_KEYS.GIT_PROXY_URL)) || "/git-proxy";
    this.taskServerUrl =
      (await getConfig(db, CONFIG_KEYS.TASK_SERVER_URL)) || "/schedule";

    // Set up channel registry and router
    this.initializeChannelRegistry();

    // Wire inbound messages from all channels
    this.channelRegistry.onMessage((msg: InboundMessage) => {
      this.enqueue(db, msg).catch((error) => {
        console.error("Failed to enqueue inbound message:", error);
      });
    });

    await this.loadChannelConfigurations(db);
    this.applyAllChannelRunningStates();

    this.agentWorker = new Worker(
      new URL("./agent.worker.js", import.meta.url),
      {
        type: "module",
      },
    );

    this.agentWorker.onmessage = (event) =>
      this.handleWorkerMessage(db, event.data);

    this.agentWorker.onerror = (err) => {
      console.error("Agent worker error:", err);
    };

    // Pass storage handle if it exists
    const storageHandle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);
    if (storageHandle) {
      this.agentWorker.postMessage({
        type: "set-storage",
        payload: { storageHandle },
      });
    }

    // Sync proxy config to Service Worker
    this.syncProxyConfigToServiceWorker();
    // The worker reads persisted VM boot mode and eagerly boots the VM itself.

    // Set up task scheduler
    this.scheduler = new TaskScheduler(async (task) => {
      this.submitMessage(task.prompt, task.groupId);
    });

    this.scheduler.start();

    // Listen for scheduled-task-trigger messages from the service worker.
    // When the server-side scheduler fires, it sends a push notification;
    // the service worker relays it here so we can invoke the agent.
    this._setupPushTaskListener(db);

    // Wire up browser chat display callback
    this.browserChat.onDisplay(() => {
      // Display handled via events.emit('message', ...)
    });

    this.events.emit("ready", undefined);

    // Load persisted tool configuration before WebMCP registration.
    await toolsStore.load(db);

    this.syncWebMcpRegistration(db);

    return db;
  }

  /**
   * Get current state
   */
  getState(): OrchestratorState {
    return this.state;
  }

  isConfigured(): boolean {
    return this.#encryptedApiKey ? this.#encryptedApiKey.length > 0 : false;
  }

  async getApiKeyForRequest(): Promise<string> {
    return (await this.#getApiKey()) || "";
  }

  async getApiKeyForHeaders(): Promise<string | undefined> {
    return (await this.#getApiKey()) || undefined;
  }

  async #getApiKey(): Promise<string | null> {
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
        value: decrypted,
        expiresAt: now + 30000, // 30s TTL
      };

      return decrypted;
    } catch (e) {
      console.error("[Orchestrator] Failed to decrypt API key:", e);

      return null;
    }
  }

  async setApiKey(db: ShadowClawDatabase, key: string): Promise<void> {
    this.#encryptedApiKey = await encryptValue(key);
    this.#apiKeyCache = null; // Invalidate cache

    const encrypted = await encryptValue(key);

    if (!encrypted) {
      throw new Error("key failed to encrypt. config cannot set.");
    }

    await setConfig(db, getProviderApiKeyConfigKey(this.provider), encrypted);
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

  getProvider(): string {
    return this.provider;
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

  async setProvider(db: ShadowClawDatabase, providerId: string): Promise<void> {
    const newProvider = getProvider(providerId);
    if (!newProvider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    this.provider = providerId;
    this.providerConfig = newProvider;
    this.model = newProvider.defaultModel;
    this.applyLlamafileHeaders();

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
    await this._autoActivateProfile(db);
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

  getLlamafileSettings(): {
    mode: "server" | "cli";
    host: string;
    port: number;
    offline: boolean;
  } {
    return {
      mode: this.llamafileMode,
      host: this.llamafileHost,
      port: this.llamafilePort,
      offline: this.llamafileOffline,
    };
  }

  async setLlamafileSettings(
    db: ShadowClawDatabase,
    settings: {
      mode: "server" | "cli";
      host: string;
      port: number;
      offline: boolean;
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

  getModel(): string {
    return this.model;
  }

  getMaxIterations(): number {
    return this.maxIterations;
  }

  getMaxTokens(): number {
    return this.maxTokens;
  }

  async setMaxTokens(db: ShadowClawDatabase, value: number): Promise<void> {
    const dynamicMaxTokens = getModelMaxTokens(this.model);
    const normalized = Math.max(1, Math.min(value, dynamicMaxTokens));

    this.maxTokens = normalized;
    await setConfig(db, CONFIG_KEYS.MAX_TOKENS, String(normalized));
  }

  async setMaxIterations(db: ShadowClawDatabase, value: number): Promise<void> {
    this.maxIterations = value;
    await setConfig(db, CONFIG_KEYS.MAX_ITERATIONS, String(value));
  }

  getRateLimitCallsPerMinute(): number {
    return this.rateLimitCallsPerMinute;
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

  getRateLimitAutoAdapt(): boolean {
    return this.rateLimitAutoAdapt;
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

  async setModel(db: ShadowClawDatabase, model: string): Promise<void> {
    this.model = model;

    // Update max tokens based on new info
    this.maxTokens = getModelMaxTokens(this.model);

    await setConfig(db, CONFIG_KEYS.MODEL, model);

    // Auto-activate matching tool profile if one exists.
    await this._autoActivateProfile(db);
  }

  getStreamingEnabled(): boolean {
    return this.streamingEnabled;
  }

  getWebMcpToolsEnabled(): boolean {
    return this.webMcpToolsEnabled;
  }

  getWebMcpMode(): WebMcpMode {
    return readWebMcpMode();
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

  getContextCompressionEnabled(): boolean {
    return this.contextCompressionEnabled;
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

  getUseProxy(): boolean {
    return this.useProxy;
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

  getProxyUrl(): string {
    return this.proxyUrl;
  }

  async setProxyUrl(db: ShadowClawDatabase, url: string): Promise<void> {
    this.proxyUrl = url || "/proxy";
    await setConfig(db, CONFIG_KEYS.PROXY_URL, this.proxyUrl);
    this.syncProxyConfigToServiceWorker();
  }

  getGitProxyUrl(): string {
    return this.gitProxyUrl;
  }

  async setGitProxyUrl(db: ShadowClawDatabase, url: string): Promise<void> {
    this.gitProxyUrl = url || "/git-proxy";
    await setConfig(db, CONFIG_KEYS.GIT_PROXY_URL, this.gitProxyUrl);
  }

  getTaskServerUrl(): string {
    return this.taskServerUrl;
  }

  async setTaskServerUrl(db: ShadowClawDatabase, url: string): Promise<void> {
    this.taskServerUrl = url || "/schedule";
    await setConfig(db, CONFIG_KEYS.TASK_SERVER_URL, this.taskServerUrl);
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

  async setVMBootMode(db: ShadowClawDatabase, mode: VMBootMode): Promise<void> {
    const normalized =
      mode === "disabled" || mode === "9p" || mode === "ext2" || mode === "auto"
        ? mode
        : "disabled";

    this.vmBootMode = normalized;

    await setConfig(db, CONFIG_KEYS.VM_BOOT_MODE, normalized);

    this.agentWorker?.postMessage({
      type: "set-vm-mode",
      payload: { mode: normalized },
    });
  }

  async setVMBootHost(db: ShadowClawDatabase, bootHost: string): Promise<void> {
    const normalized = typeof bootHost === "string" ? bootHost.trim() : "";

    await setConfig(db, CONFIG_KEYS.VM_BOOT_HOST, normalized);

    this.agentWorker?.postMessage({
      type: "set-vm-mode",
      payload: { bootHost: normalized },
    });
  }

  async setVMNetworkRelayURL(
    db: ShadowClawDatabase,
    relayUrl: string,
  ): Promise<void> {
    const normalized = typeof relayUrl === "string" ? relayUrl.trim() : "";

    await setConfig(db, CONFIG_KEYS.VM_NETWORK_RELAY_URL, normalized);

    this.agentWorker?.postMessage({
      type: "set-vm-mode",
      payload: { networkRelayUrl: normalized },
    });
  }

  async setVMBashTimeout(
    db: ShadowClawDatabase,
    timeoutSec: number,
  ): Promise<void> {
    const normalized = Math.min(Math.max(Math.floor(timeoutSec), 1), 1800);

    await setConfig(db, CONFIG_KEYS.VM_BASH_TIMEOUT_SEC, String(normalized));
  }

  getVMStatus(): VMStatus {
    return this.vmStatus;
  }

  getVMBootMode(): VMBootMode {
    return this.vmBootMode;
  }

  openTerminalSession(groupId = DEFAULT_GROUP_ID): void {
    this.agentWorker?.postMessage({
      type: "vm-terminal-open",
      payload: { groupId },
    });
  }

  syncTerminalWorkspace(groupId = DEFAULT_GROUP_ID): void {
    this.agentWorker?.postMessage({
      type: "vm-workspace-sync",
      payload: { groupId },
    });
  }

  flushTerminalWorkspace(groupId = DEFAULT_GROUP_ID): void {
    this.agentWorker?.postMessage({
      type: "vm-workspace-flush",
      payload: { groupId },
    });
  }

  sendTerminalInput(data: string): void {
    this.agentWorker?.postMessage({
      type: "vm-terminal-input",
      payload: { data },
    });
  }

  closeTerminalSession(groupId = DEFAULT_GROUP_ID): void {
    this.agentWorker?.postMessage({
      type: "vm-terminal-close",
      payload: { groupId },
    });
  }

  getAssistantName(): string {
    return this.assistantName;
  }

  getTelegramConfig(): {
    botToken: string;
    chatIds: string[];
    useProxy: boolean;
    enabled: boolean;
  } {
    return {
      botToken: this.telegramBotToken,
      chatIds: [...this.telegramChatIds],
      useProxy: this.telegramUseProxy,
      enabled: this.getChannelEnabled("telegram"),
    };
  }

  getIMessageConfig(): {
    serverUrl: string;
    apiKey: string;
    chatIds: string[];
    enabled: boolean;
  } {
    return {
      serverUrl: this.imessageServerUrl,
      apiKey: this.imessageApiKey,
      chatIds: [...this.imessageChatIds],
      enabled: this.getChannelEnabled("imessage"),
    };
  }

  getChannelEnabled(channelType: ChannelType): boolean {
    if (channelType === "browser") {
      return true;
    }

    return this.channelEnabledByType[channelType] !== false;
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

  async setAssistantName(db: ShadowClawDatabase, name: string): Promise<void> {
    this.assistantName = name;
    this.triggerPattern = buildTriggerPattern(name);

    await setConfig(db, CONFIG_KEYS.ASSISTANT_NAME, name);
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

  submitMessage(
    text: string,
    groupId = DEFAULT_GROUP_ID,
    attachments: MessageAttachment[] = [],
  ): void {
    this.browserChat.submit(text, groupId, attachments);
  }

  async newSession(
    db: ShadowClawDatabase,
    groupId = DEFAULT_GROUP_ID,
  ): Promise<void> {
    await clearGroupMessages(db, groupId);

    this.events.emit("session-reset", { groupId });
  }

  async compactContext(
    db: ShadowClawDatabase,
    groupId = DEFAULT_GROUP_ID,
  ): Promise<void> {
    const requiresApiKey = this.providerConfig?.requiresApiKey !== false;
    const currentApiKey = await this.getApiKeyForRequest();
    if (requiresApiKey && !currentApiKey) {
      const reason = "API key not configured. Cannot compact context.";

      this.events.emit("provider-help", {
        providerId: this.provider,
        reason,
        helpType: detectProviderHelpType(this.provider, reason, requiresApiKey),
      });

      this.events.emit("error", {
        groupId,
        error: reason,
      });

      return;
    }

    if (this.state !== "idle") {
      this.events.emit("error", {
        groupId,
        error:
          "Cannot compact while processing. Wait for the current response to finish.",
      });

      return;
    }

    this.setState("thinking");
    this.events.emit("typing", { groupId, typing: true });

    let memory = "";
    try {
      memory = await readGroupFile(db, groupId, "MEMORY.md");
    } catch {
      // No memory file yet
    }

    const compactTools = toolsStore.enabledTools;
    const systemPrompt = buildSystemPrompt(
      this.assistantName,
      memory,
      compactTools,
      toolsStore.systemPromptOverride,
    );

    const contextLimit = getContextLimit(this.model);
    const systemPromptTokens = estimateTokens(systemPrompt);
    const allMessages = await buildConversationMessages(groupId, 200);
    const dynamicContext = buildDynamicContext(allMessages, {
      contextLimit,
      systemPromptTokens,
      maxOutputTokens: 4096, // compaction output cap
      skimTop: this.contextCompressionEnabled,
    });

    const messages = dynamicContext.messages;

    if (this.provider === "prompt_api") {
      if (!isPromptApiSupported()) {
        this.events.emit("error", {
          groupId,
          error:
            "Prompt API is not available in this browser. Switch provider or enable experimental browser flags.",
        });

        this.events.emit("typing", { groupId, typing: false });
        this.setState("idle");

        return;
      }

      const controller = new AbortController();
      this.promptControllers.set(groupId, controller);

      try {
        const summary = await compactWithPromptApi(
          getCompactionSystemPrompt(systemPrompt),
          messages,
          controller.signal,
          async (msg) => {
            await this.handleWorkerMessage(db, msg);
          },
          groupId,
        );

        await this.handleCompactDone(db, groupId, summary);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const message = err instanceof Error ? err.message : String(err);
        await this.deliverResponse(
          db,
          groupId,
          `⚠️ Error: Compaction failed: ${message}`,
        );
      } finally {
        this.promptControllers.delete(groupId);
      }

      return;
    }

    const providerRequestId = this.createProviderRequestId(groupId);

    this.agentWorker?.postMessage({
      type: "compact",
      payload: {
        groupId,
        messages,
        systemPrompt,
        assistantName: this.assistantName,
        memory,
        apiKey: await this.getApiKeyForRequest(),
        model: this.model,

        provider: this.provider,
        storageHandle: await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE),
        providerHeaders: this.getProviderRuntimeHeaders(
          this.provider,
          providerRequestId,
        ),
        contextCompression: this.contextCompressionEnabled,
        contextLimit: getContextLimit(this.model),
        rateLimitCallsPerMinute: this.rateLimitCallsPerMinute,
        rateLimitAutoAdapt: this.rateLimitAutoAdapt,
      },
    });
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
    const systemPrompt = buildSystemPrompt(
      this.assistantName,
      memory,
      activeTools,
      toolsStore.systemPromptOverride,
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

  getBedrockSettings(): {
    region: string;
    profile: string;
    authMode: string;
  } {
    return {
      region: this.bedrockRegionFallback,
      profile: this.bedrockProfileFallback,
      authMode: this.bedrockAuthMode,
    };
  }

  async setBedrockSettings(
    db: ShadowClawDatabase,
    settings: {
      region: string;
      profile: string;
      authMode: string;
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

  private createProviderRequestId(groupId: string): string {
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

  private clearProviderRequest(groupId: string): void {
    this.inFlightProviderRequestIds.delete(groupId);
  }

  private async cancelLlamafileRequest(requestId: string): Promise<void> {
    try {
      await fetch(LLAMAFILE_PROXY_URL.replace("/chat/completions", "/cancel"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-shadowclaw-request-id": requestId,
        },
        body: JSON.stringify({ requestId }),
        keepalive: true,
      });
    } catch {
      // Best-effort cancellation only.
    }
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

  private getTransformersStatusUrl(): string {
    const base = this.providerConfig?.baseUrl || "";
    if (base.includes("/chat/completions")) {
      return base.replace("/chat/completions", "/status");
    }

    return "http://localhost:8888/transformers-js-proxy/status";
  }

  private stopTransformersProgressPolling(groupId: string): void {
    const timer = this.transformersProgressPollers.get(groupId);
    if (typeof timer === "number") {
      clearInterval(timer);
      this.transformersProgressPollers.delete(groupId);
    }
  }

  private async pollTransformersProgress(groupId: string): Promise<void> {
    try {
      const res = await fetch(this.getTransformersStatusUrl(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
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
        status:
          status?.status === "done" || status?.status === "error"
            ? status.status
            : "running",
        progress: normalizedProgress,
        message:
          typeof status?.message === "string" && status.message
            ? status.message
            : undefined,
      };

      this.events.emit("model-download-progress", payload);

      if (payload.status === "done" || payload.status === "error") {
        this.stopTransformersProgressPolling(groupId);
      }
    } catch {
      // Ignore status polling failures so inference can continue uninterrupted.
    }
  }

  private startTransformersProgressPolling(groupId: string): void {
    this.stopTransformersProgressPolling(groupId);

    // Show immediate feedback while the first network poll is in flight.
    this.events.emit("model-download-progress", {
      groupId,
      status: "running",
      progress: null,
      message: "Preparing local model download...",
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

    this.events.emit("typing", { groupId, typing: false });
    this.router?.setTyping(groupId, false);
    this.setState("idle");
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
   * Auto-activate the best matching tool profile for the current provider + model.
   * Prefers exact provider+model match, then provider-only, then does nothing.
   */
  async _autoActivateProfile(db: ShadowClawDatabase): Promise<void> {
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

  /**
   * Listen for service worker messages that relay scheduled-task push triggers.
   * When the server-side scheduler fires a task, it sends a push notification.
   * The service worker relays it here as a `scheduled-task-trigger` message.
   */
  _setupPushTaskListener(_db: ShadowClawDatabase): void {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) {
      return;
    }

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "request-proxy-config") {
        // The service worker just restarted and lost its in-memory proxy config.
        // Re-sync so fetch interception resumes immediately.
        this.syncProxyConfigToServiceWorker();

        return;
      }

      if (event.data?.type !== "scheduled-task-trigger") {
        return;
      }

      const { taskId, groupId, prompt } = event.data;
      if (!groupId || !prompt) {
        return;
      }

      // Mark this group as scheduler-triggered for recursion prevention
      this._schedulerTriggeredGroups.add(groupId);

      const task = { id: taskId, groupId, prompt };

      // Execute the task via the same path as client-side scheduler
      const runTask = async () => {
        this.submitMessage(task.prompt, task.groupId);
      };

      runTask()
        .catch((err) =>
          console.error(`Push-triggered task ${taskId} failed:`, err),
        )
        .finally(() => {
          this._schedulerTriggeredGroups.delete(groupId);
        });
    });
  }

  /**
   * Sync a task schedule to the server-side SQLite store.
   * Returns true if the server acknowledged (HTTP 2xx), false otherwise.
   */
  async _syncTaskToServer(task: Task): Promise<boolean> {
    try {
      const base = this.taskServerUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
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
      this._warnIfNoPushSubscription();
    }
  }

  /**
   * Check if push notifications are subscribed and warn if not.
   * Only warns once per session to avoid spamming the user.
   */
  async _warnIfNoPushSubscription() {
    if (this._pushSubscriptionWarned) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.serviceWorker) {
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (!sub) {
        this._pushSubscriptionWarned = true;
        showToast(
          "Push notifications are not enabled. Scheduled tasks will only run while the app is open. Enable push in Settings for background execution.",
          { type: "warning" },
        );
      }
    } catch {
      // Service worker or Push API not available — ignore
    }
  }

  /**
   * Delete a task schedule from the server-side SQLite store.
   * Returns true if the server acknowledged (HTTP 2xx), false otherwise.
   */
  async _deleteTaskFromServer(id: string): Promise<boolean> {
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
   * Shut down everything
   */
  shutdown() {
    this.scheduler?.stop();
    this.channelRegistry.stopAll();
    for (const groupId of this.transformersProgressPollers.keys()) {
      this.stopTransformersProgressPolling(groupId);
    }

    this.agentWorker?.terminate();

    if (typeof this._webMcpEffectCleanup === "function") {
      this._webMcpEffectCleanup();
    }

    unregisterWebMcpTools();
  }

  syncWebMcpRegistration(db: ShadowClawDatabase): void {
    if (typeof this._webMcpEffectCleanup === "function") {
      this._webMcpEffectCleanup();
      this._webMcpEffectCleanup = null;
    }

    if (!this.webMcpToolsEnabled) {
      unregisterWebMcpTools();

      return;
    }

    // Register WebMCP tools and re-register when tool config changes.
    // This effect runs once immediately to perform the initial registration.
    // We intentionally do NOT call isWebMcpSupported() here — that accesses
    // navigator.modelContext which can crash Chrome Canary's early-preview
    // renderer.  Instead, registerWebMcpTools handles feature detection
    // internally and skips modelContext access entirely when 0 tools are
    // passed.
    this._webMcpEffectCleanup = effect(() => {
      // Access the computed signal to establish tracking.
      const tools = toolsStore.enabledTools;

      // Serialize WebMCP registration calls to prevent overlapping unregister/register cycles.
      this._webMcpRegistrationLock = this._webMcpRegistrationLock
        .then(async () => {
          unregisterWebMcpTools();
          // Small delay to allow the browser's ModelContext to process the unregistrations.
          await new Promise((resolve) => setTimeout(resolve, 0));

          await registerWebMcpTools(
            this.agentWorker,
            async (msg) => {
              await this.handleWorkerMessage(db, msg);
            },
            DEFAULT_GROUP_ID,
            tools,
          );
        })
        .catch((err) => {
          console.error("WebMCP registration failed:", err);
        });
    });
  }

  setState(state: OrchestratorState): void {
    this.state = state;
    this.events.emit("state-change", state);
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
    this.router = new Router(this.channelRegistry);
  }

  async loadChannelConfigurations(db: ShadowClawDatabase): Promise<void> {
    this.channelEnabledByType.telegram = await this.loadChannelEnabled(
      db,
      "telegram",
    );
    this.channelEnabledByType.imessage = await this.loadChannelEnabled(
      db,
      "imessage",
    );

    const telegramToken = await this.loadSecretConfig(
      db,
      CONFIG_KEYS.TELEGRAM_BOT_TOKEN,
    );

    const telegramChatIds = parseStoredStringList(
      await getConfig(db, CONFIG_KEYS.TELEGRAM_CHAT_IDS),
    );

    const telegramUseProxy =
      (await getConfig(db, CONFIG_KEYS.TELEGRAM_USE_PROXY)) === "true";
    this.telegramBotToken = telegramToken;
    this.telegramChatIds = telegramChatIds;
    this.telegramUseProxy = telegramUseProxy;
    this.telegram.configure(telegramToken, telegramChatIds, telegramUseProxy);
    const readWorkspaceFileAsBlob = async (
      groupId: string,
      path: string,
    ): Promise<Blob | null> => {
      try {
        const bytes = await readGroupFileBytes(db, groupId, path);
        const blobBytes = new Uint8Array(bytes.byteLength);
        blobBytes.set(bytes);

        const fileName = path.split("/").pop() || path;
        const mimeType = inferAttachmentMimeType(fileName);

        return new Blob([blobBytes], { type: mimeType });
      } catch (err) {
        console.warn(
          `Orchestrator: channel fileReader failed for ${path}:`,
          err,
        );

        return null;
      }
    };
    this.telegram.fileReader = readWorkspaceFileAsBlob;
    this.imessage.fileReader = readWorkspaceFileAsBlob;

    const imessageServerUrl = (
      (await getConfig(db, CONFIG_KEYS.IMESSAGE_SERVER_URL)) || ""
    )
      .trim()
      .replace(/\/+$/, "");
    const imessageApiKey = await this.loadSecretConfig(
      db,
      CONFIG_KEYS.IMESSAGE_API_KEY,
    );

    const imessageChatIds = parseStoredStringList(
      await getConfig(db, CONFIG_KEYS.IMESSAGE_CHAT_IDS),
    );
    this.imessageServerUrl = imessageServerUrl;
    this.imessageApiKey = imessageApiKey;
    this.imessageChatIds = imessageChatIds;
    this.imessage.configure(imessageServerUrl, imessageApiKey, imessageChatIds);
  }

  getChannelEnabledConfigKey(channelType: ChannelType): string {
    return `${CONFIG_KEYS.CHANNEL_ENABLED_PREFIX}${channelType}`;
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
      return true;
    }

    return stored !== "false";
  }

  getChannelByType(channelType: ChannelType): Channel | null {
    switch (channelType) {
      case "browser":
        return this.browserChat;
      case "telegram":
        return this.telegram;
      case "imessage":
        return this.imessage;
      default:
        return null;
    }
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
      default:
        return true;
    }
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

  applyAllChannelRunningStates(): void {
    this.applyChannelRunningState("browser");
    this.applyChannelRunningState("telegram");
    this.applyChannelRunningState("imessage");
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

  getChannelTypeForGroup(groupId: string): ChannelType {
    return this.channelRegistry.getChannelType(groupId) ?? "browser";
  }

  parseDirectToolCommandPolicy(
    raw: string | null | undefined,
  ): DirectToolCommandPolicy {
    if (!raw) {
      return { ...DEFAULT_DIRECT_TOOL_COMMAND_POLICY };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<DirectToolCommandPolicy>;
      const enabledChannelTypes = Array.isArray(parsed.enabledChannelTypes)
        ? parsed.enabledChannelTypes.filter(
            (v): v is string => typeof v === "string" && v.trim().length > 0,
          )
        : DEFAULT_DIRECT_TOOL_COMMAND_POLICY.enabledChannelTypes;
      const allowedTools = Array.isArray(parsed.allowedTools)
        ? parsed.allowedTools.filter(
            (v): v is string => typeof v === "string" && v.trim().length > 0,
          )
        : DEFAULT_DIRECT_TOOL_COMMAND_POLICY.allowedTools;

      return {
        enabledChannelTypes,
        allowedTools,
        requireMention:
          typeof parsed.requireMention === "boolean"
            ? parsed.requireMention
            : DEFAULT_DIRECT_TOOL_COMMAND_POLICY.requireMention,
      };
    } catch {
      return { ...DEFAULT_DIRECT_TOOL_COMMAND_POLICY };
    }
  }

  parseDirectToolCommand(msg: InboundMessage): ParsedDirectToolCommand | null {
    const policy = this.directToolCommandPolicy;
    if (!policy.enabledChannelTypes.includes(msg.channel)) {
      return null;
    }

    const content = msg.content.trim();
    const escapedAssistant = this.assistantName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    let commandPart = content;
    if (policy.requireMention) {
      const mentionPrefix = new RegExp(
        `^@${escapedAssistant}\\b\\s*(?:-|:)?\\s*`,
        "i",
      );
      if (!mentionPrefix.test(commandPart)) {
        return null;
      }

      commandPart = commandPart.replace(mentionPrefix, "").trim();
    }

    const toolMatch = commandPart.match(/^\/([a-zA-Z0-9_]+)(?:\s+([\s\S]+))?$/);
    if (!toolMatch) {
      return null;
    }

    const toolName = toolMatch[1];
    if (!policy.allowedTools.includes(toolName)) {
      return null;
    }

    const rawArgs = (toolMatch[2] || "").trim();
    if (!rawArgs) {
      return { toolName, input: {} };
    }

    const unwrappedArgs =
      (rawArgs.startsWith("'") && rawArgs.endsWith("'")) ||
      (rawArgs.startsWith('"') && rawArgs.endsWith('"'))
        ? rawArgs.slice(1, -1).trim()
        : rawArgs;

    try {
      const parsedInput = JSON.parse(unwrappedArgs);
      if (parsedInput && typeof parsedInput === "object") {
        return {
          toolName,
          input: parsedInput as Record<string, any>,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async enqueue(db: ShadowClawDatabase, msg: InboundMessage): Promise<void> {
    const directToolCommand = this.parseDirectToolCommand(msg);
    const isFromBrowser = msg.channel === "browser"; // Messages submitted in ShadowClaw UI
    const autoTrigger = this.channelRegistry.shouldAutoTrigger(msg.groupId);
    const hasTrigger = this.triggerPattern.test(msg.content.trim());
    const isDirectToolCommand = !!directToolCommand;
    const attachments = await persistMessageAttachments(
      db,
      msg.groupId,
      msg.attachments || [],
    );

    const stored = {
      ...msg,
      attachments,
      isFromMe: false,
      isTrigger:
        isFromBrowser || autoTrigger || hasTrigger || isDirectToolCommand,
    };

    if ((isFromBrowser || autoTrigger || hasTrigger) && !isDirectToolCommand) {
      this.messageQueue.push(msg);
    }

    await saveMessage(db, stored);
    this.events.emit("message", stored);

    if (directToolCommand && this.agentWorker) {
      this.agentWorker.postMessage({
        type: "execute-direct-tool",
        payload: {
          groupId: msg.groupId,
          name: directToolCommand.toolName,
          input: directToolCommand.input,
        },
      });

      return;
    }

    this.processQueue(db);
  }

  async processQueue(db: ShadowClawDatabase): Promise<void> {
    if (this.processing) {
      return;
    }

    if (this.messageQueue.length === 0) {
      return;
    }

    const requiresApiKey = this.providerConfig?.requiresApiKey !== false;
    const currentApiKey = await this.getApiKeyForRequest();
    if (requiresApiKey && !currentApiKey) {
      const reason =
        "API key not configured. Go to Settings to add your API key.";

      this.events.emit("provider-help", {
        providerId: this.provider,
        reason,
        helpType: detectProviderHelpType(this.provider, reason, requiresApiKey),
      });

      const msg = this.messageQueue.shift();
      this.events.emit("error", {
        groupId: msg.groupId,
        error: reason,
      });

      return;
    }

    this.processing = true;
    const msg = this.messageQueue.shift();

    try {
      await this.invokeAgent(db, msg.groupId, msg.content);
    } catch (err) {
      console.error("Failed to invoke agent:", err);
    } finally {
      this.processing = false;
      if (this.messageQueue.length > 0) {
        this.processQueue(db);
      }
    }
  }

  async invokeAgent(
    db: ShadowClawDatabase,
    groupId: string,
    triggerContent: string,
  ): Promise<void> {
    this.inFlightTriggerByGroup.set(groupId, triggerContent);
    this.setState("thinking");
    this.router?.setTyping(groupId, true);
    this.events.emit("typing", { groupId, typing: true });

    // Save scheduled task as client message
    if (triggerContent.startsWith("[SCHEDULED TASK]")) {
      this.pendingScheduledTasks.add(groupId);

      const stored = {
        id: ulid(),
        groupId,
        sender: "Scheduler",
        content: triggerContent,
        timestamp: Date.now(),
        channel: this.getChannelTypeForGroup(groupId),
        isFromMe: false,
        isTrigger: true,
      };

      await saveMessage(db, stored);

      this.events.emit("message", stored);
    }

    // Load group memory
    let memory = "";
    try {
      memory = await readGroupFile(db, groupId, "MEMORY.md");
    } catch {}

    // Use whatever tools the user has enabled (via profile or manual selection).
    const activeTools = toolsStore.enabledTools;

    const systemPrompt = buildSystemPrompt(
      this.assistantName,
      memory,
      activeTools,
      toolsStore.systemPromptOverride,
    );

    // Build conversation context with dynamic token-aware windowing
    const contextLimit = getContextLimit(this.model);
    const systemPromptTokens = estimateTokens(systemPrompt);
    const allMessages = await buildConversationMessages(groupId, 200);
    const dynamicContext = buildDynamicContext(allMessages, {
      contextLimit,
      systemPromptTokens,
      maxOutputTokens: this.maxTokens,
      skimTop: this.contextCompressionEnabled,
    });

    const messages = dynamicContext.messages;

    // Emit context usage for UI display
    this.events.emit("context-usage", {
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
      this.events.emit("show-toast", {
        message: `Context ${dynamicContext.usagePercent.toFixed(0)}% full — auto-compacting older messages…`,
        type: "info",
        duration: 4000,
      });
      // Queue compaction after this invocation completes
      queueMicrotask(() => this.compactContext(db, groupId));
    }

    if (this.provider === "transformers_js_browser") {
      const controller = new AbortController();
      this.promptControllers.set(groupId, controller);

      try {
        await invokeWithTransformersJs(
          db,
          groupId,
          systemPrompt,
          messages,
          this.maxTokens,
          async (msg) => {
            await this.handleWorkerMessage(db, msg);
          },
          controller.signal,
          activeTools,
          this.model,
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const message = err instanceof Error ? err.message : String(err);
        await this.deliverResponse(db, groupId, `⚠️ Error: ${message}`);
      } finally {
        this.promptControllers.delete(groupId);
      }

      return;
    }

    if (this.provider === "prompt_api") {
      if (!isPromptApiSupported()) {
        await this.deliverResponse(
          db,
          groupId,
          "⚠️ Error: Prompt API is not available in this browser. Switch provider or enable experimental browser flags.",
        );

        return;
      }

      const controller = new AbortController();
      this.promptControllers.set(groupId, controller);

      try {
        await invokeWithPromptApi(
          db,
          groupId,
          systemPrompt,
          messages,
          this.maxTokens,
          async (msg) => {
            await this.handleWorkerMessage(db, msg);
          },
          controller.signal,
          activeTools,
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const message = err instanceof Error ? err.message : String(err);
        await this.deliverResponse(db, groupId, `⚠️ Error: ${message}`);
      } finally {
        this.promptControllers.delete(groupId);
      }

      return;
    }

    // Determine whether to stream. The provider must explicitly opt in via
    // supportsStreaming (proxies like bedrock_proxy use synchronous
    // InvokeModelCommand and cannot return SSE streams).
    const shouldStream =
      this.streamingEnabled &&
      this.providerConfig.supportsStreaming === true &&
      (this.providerConfig.format === "openai" ||
        this.providerConfig.format === "anthropic");

    if (this.provider === "transformers_js_local") {
      this.startTransformersProgressPolling(groupId);
    }

    const providerRequestId = this.createProviderRequestId(groupId);

    // Send to agent worker
    this.agentWorker?.postMessage({
      type: "invoke",
      payload: {
        groupId,
        messages,
        systemPrompt,
        assistantName: this.assistantName,
        memory,
        apiKey: await this.getApiKeyForRequest(),

        model: this.model,
        maxTokens: this.maxTokens,
        maxIterations: this.maxIterations,
        provider: this.provider,
        storageHandle: await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE),
        enabledTools: activeTools,
        providerHeaders: this.getProviderRuntimeHeaders(
          this.provider,
          providerRequestId,
        ),
        streaming: shouldStream,
        contextCompression: this.contextCompressionEnabled,
        contextLimit: getContextLimit(this.model),
        rateLimitCallsPerMinute: this.rateLimitCallsPerMinute,
        rateLimitAutoAdapt: this.rateLimitAutoAdapt,
        isScheduledTask: this._schedulerTriggeredGroups.has(groupId),
      },
    });
  }

  async handleWorkerMessage(db: ShadowClawDatabase, msg: any): Promise<void> {
    switch (msg.type) {
      case "response": {
        const { groupId, text } = msg.payload;
        this.stopTransformersProgressPolling(groupId);
        this.clearProviderRequest(groupId);
        this.inFlightTriggerByGroup.delete(groupId);
        await this.deliverResponse(db, groupId, text);

        break;
      }

      case "streaming-start": {
        const { groupId } = msg.payload;
        this.setState("responding");
        this.events.emit("streaming-start", { groupId });

        break;
      }

      case "streaming-chunk": {
        const { groupId, text } = msg.payload;
        this.events.emit("streaming-chunk", { groupId, text });

        break;
      }

      case "intermediate-response": {
        const { groupId, text } = msg.payload;
        await this.deliverIntermediateResponse(db, groupId, text);

        break;
      }

      case "streaming-end": {
        const { groupId } = msg.payload;
        this.events.emit("streaming-end", { groupId });
        // Switch back to thinking (tool calls are about to execute)
        this.setState("thinking");

        break;
      }

      case "streaming-done": {
        const { groupId } = msg.payload;
        this.events.emit("streaming-done", { groupId });

        break;
      }

      case "streaming-error": {
        const { groupId, error } = msg.payload;
        this.events.emit("streaming-error", { groupId, error });

        break;
      }

      case "task-created": {
        const { task } = msg.payload;

        if (task.groupId && this._schedulerTriggeredGroups.has(task.groupId)) {
          showToast(
            "\u26a0\ufe0f Task creation blocked \u2014 scheduled tasks cannot create new tasks (recursion prevention).",
            { type: "warning", duration: 8000 },
          );

          break;
        }

        try {
          const serverOk = await this._syncTaskToServer(task);

          if (!serverOk) {
            showToast("Failed to sync task to server — task was not saved.", {
              type: "error",
            });

            break;
          }

          await saveTask(db, task);
          this.events.emit("task-change", { type: "created", task });
        } catch (err) {
          console.error("Failed to save task from agent:", err);
          showToast("Failed to save task.", { type: "error" });
        }

        break;
      }

      case "error": {
        const { groupId, error } = msg.payload;
        this.stopTransformersProgressPolling(groupId);
        this.clearProviderRequest(groupId);
        this.inFlightTriggerByGroup.delete(groupId);
        let finalError = error;
        let hasProviderHelp = false;

        // Detect context limit/request too large errors (HTTP 413 or specific error codes)
        const isContextError =
          error.includes("413") ||
          error.includes("tokens_limit_reached") ||
          error.includes("context_length_exceeded") ||
          error.includes("too many tokens");

        if (isContextError) {
          finalError +=
            "\n\n\u26a0\ufe0f This model has a small context window. Try clicking **'Compact'** in the header to summarize the conversation and reduce token usage.";
        }

        if (
          this.getProvider() === "llamafile" &&
          isLlamafileResolutionError(error)
        ) {
          hasProviderHelp = true;
          this.events.emit("provider-help", {
            providerId: "llamafile",
            reason: error,
          });
        }

        if (
          this.getProvider() === "transformers_js_local" &&
          isTransformersJsResolutionError(error)
        ) {
          hasProviderHelp = true;
          this.events.emit("provider-help", {
            providerId: "transformers_js_local",
            reason: error,
          });
        }

        if (!hasProviderHelp) {
          const providerId = this.getProvider();
          const helpType = detectProviderHelpType(
            providerId,
            error,
            this.providerConfig?.requiresApiKey !== false,
          );

          if (helpType) {
            this.events.emit("provider-help", {
              providerId,
              reason: error,
              helpType,
            });
          }
        }

        await this.deliverResponse(db, groupId, `⚠️ Error: ${finalError}`);

        break;
      }

      case "typing": {
        const { groupId } = msg.payload;
        this.router?.setTyping(groupId, true);
        this.events.emit("typing", { groupId, typing: true });

        break;
      }

      case "tool-activity": {
        this.events.emit("tool-activity", msg.payload);
        // If a file was written, or bash finished (might have changed files), emit file-change
        if (
          (msg.payload.tool === "write_file" &&
            msg.payload.status === "done") ||
          (msg.payload.tool === "bash" && msg.payload.status === "done")
        ) {
          this.events.emit("file-change", {
            groupId: msg.payload.groupId,
          });
        }

        break;
      }

      case "model-download-progress": {
        this.events.emit("model-download-progress", msg.payload);

        break;
      }

      case "thinking-log": {
        this.events.emit("thinking-log", msg.payload);

        break;
      }

      case "compact-done": {
        this.clearProviderRequest(msg.payload.groupId);
        await this.handleCompactDone(
          db,
          msg.payload.groupId,
          msg.payload.summary,
        );

        break;
      }

      case "token-usage": {
        this.events.emit("token-usage", msg.payload);

        break;
      }

      case "task-list-request": {
        const { groupId } = msg.payload;
        const tasks = await getAllTasks(db);
        const groupTasks = tasks.filter((t) => t.groupId === groupId);
        this.agentWorker?.postMessage({
          type: "task-list-response",
          payload: { groupId, tasks: groupTasks },
        });

        break;
      }

      case "update-task": {
        const { task } = msg.payload;

        if (task.groupId && this._schedulerTriggeredGroups.has(task.groupId)) {
          showToast(
            "\u26a0\ufe0f Task update blocked \u2014 scheduled tasks cannot modify tasks (recursion prevention).",
            { type: "warning", duration: 8000 },
          );

          break;
        }

        try {
          const serverOk = await this._syncTaskToServer(task);

          if (!serverOk) {
            showToast(
              "Failed to sync task update to server — task was not updated.",
              { type: "error" },
            );

            break;
          }

          await saveTask(db, task);
          this.events.emit("task-change", { type: "updated", task });
        } catch (err) {
          console.error("Failed to update task from agent:", err);
          showToast("Failed to update task.", { type: "error" });
        }

        break;
      }

      case "delete-task": {
        const { id, groupId: deleteGroupId } = msg.payload;

        if (
          deleteGroupId &&
          this._schedulerTriggeredGroups.has(deleteGroupId)
        ) {
          showToast(
            "\u26a0\ufe0f Task deletion blocked \u2014 scheduled tasks cannot delete tasks (recursion prevention).",
            { type: "warning", duration: 8000 },
          );

          break;
        }

        try {
          const serverOk = await this._deleteTaskFromServer(id);

          if (!serverOk) {
            showToast(
              "Failed to delete task from server — task kept in view.",
              { type: "error" },
            );

            break;
          }

          await deleteTask(db, id);
          this.events.emit("task-change", { type: "deleted", id });
        } catch (err) {
          console.error("Failed to delete task from agent:", err);
        }

        break;
      }

      case "clear-chat": {
        const { groupId } = msg.payload;
        try {
          await this.newSession(db, groupId);
        } catch (err) {
          console.error("Failed to clear chat from agent:", err);
        }

        break;
      }

      case "show-toast": {
        const { message, type, duration } = msg.payload;
        showToast(message, { type: type || "info", duration });

        break;
      }

      case "mcp-reauth-required": {
        const { connectionId } = msg.payload;

        const connection = await getRemoteMcpConnection(db, connectionId);
        const label = connection?.label || connectionId;

        if (connection?.autoReconnectOAuth) {
          showToast(
            `🔑 MCP connection "${label}" returned 401 — auto-reconnecting OAuth…`,
            { type: "info", duration: 5000 },
          );

          const result = await reconnectMcpOAuth(db, connectionId, {
            silentOnly: true,
          });

          if (result.success) {
            showToast(`🔑 OAuth reconnected for "${label}"`, {
              type: "success",
              duration: 5000,
            });
          } else {
            showToast(
              `🔑 OAuth auto-reconnect failed for "${label}": ${result.error}`,
              {
                type: "error",
                duration: 15000,
                action: {
                  label: "Reconnect Now",
                  onClick: async () => {
                    const popupResult = await reconnectMcpOAuth(
                      db,
                      connectionId,
                    );
                    if (popupResult.success) {
                      showToast(`🔑 OAuth reconnected for "${label}"`, {
                        type: "success",
                        duration: 5000,
                      });
                    } else {
                      showToast(
                        `🔑 OAuth reconnect failed for "${label}": ${popupResult.error}`,
                        { type: "error", duration: 10000 },
                      );
                    }
                  },
                },
              },
            );
          }

          this.agentWorker?.postMessage({
            type: "mcp-reauth-result",
            payload: { connectionId, success: result.success },
          });
        } else {
          showToast(
            `🔑 MCP connection "${label}" returned 401 — OAuth re-authentication required. Go to Settings → Remote MCP to reconnect.`,
            { type: "warning", duration: 10000 },
          );

          this.agentWorker?.postMessage({
            type: "mcp-reauth-result",
            payload: { connectionId, success: false },
          });
        }

        this.events.emit("mcp-reauth-required", {
          connectionId,
          label,
        });

        break;
      }

      case "manage-tools": {
        const { action, toolNames, profileId } = msg.payload;
        if (action === "activate_profile" && profileId) {
          await toolsStore.activateProfile(db, profileId);
        } else if ((action === "enable" || action === "disable") && toolNames) {
          const enabled = action === "enable";
          for (const name of toolNames) {
            await toolsStore.setToolEnabled(db, name, enabled);
          }
        }

        const finalGroupId = msg.payload.groupId || DEFAULT_GROUP_ID;
        this.agentWorker?.postMessage({
          type: "update-tools",
          payload: {
            groupId: finalGroupId,
            enabledTools: toolsStore.enabledTools,
            systemPromptOverride: toolsStore.systemPromptOverride,
          },
        });

        break;
      }

      case "send-notification": {
        const { title, body, groupId: notifGroupId } = msg.payload;

        // Recursion guard: push-triggered tasks must NEVER send push
        // notifications — this would create an infinite loop.
        if (notifGroupId && this._schedulerTriggeredGroups.has(notifGroupId)) {
          showToast(
            "⚠️ Notification blocked — scheduled tasks triggered via push cannot send push notifications (recursion prevention).",
            { type: "warning", duration: 8000 },
          );

          break;
        }

        getPushUrl("/push/broadcast").then((url) => {
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, body }),
          }).catch((err) =>
            console.error("Failed to broadcast push notification:", err),
          );
        });

        break;
      }

      case "vm-status": {
        this.vmStatus = { ...msg.payload };
        this.events.emit("vm-status", this.vmStatus);

        break;
      }

      case "vm-terminal-opened": {
        this.events.emit("vm-terminal-opened", msg.payload);

        break;
      }

      case "vm-terminal-output": {
        this.events.emit("vm-terminal-output", msg.payload);

        break;
      }

      case "vm-terminal-closed": {
        this.events.emit("vm-terminal-closed", msg.payload);

        break;
      }

      case "vm-workspace-synced": {
        this.events.emit("file-change", { groupId: msg.payload?.groupId });

        break;
      }

      case "vm-terminal-error": {
        this.events.emit("vm-terminal-error", msg.payload);

        break;
      }

      case "open-file": {
        this.events.emit("open-file", msg.payload);

        break;
      }
    }
  }

  async handleCompactDone(
    db: ShadowClawDatabase,
    groupId: string,
    summary: string,
  ): Promise<void> {
    await clearGroupMessages(db, groupId);

    const stored = {
      id: ulid(),
      groupId,
      sender: this.assistantName,
      content: `📝 **Context Compacted**\n\n${summary}`,
      timestamp: Date.now(),
      channel: this.getChannelTypeForGroup(groupId),
      isFromMe: true,
      isTrigger: false,
    };

    await saveMessage(db, stored);

    this.events.emit("context-compacted", { groupId, summary });
    this.events.emit("typing", { groupId, typing: false });
    this.setState("idle");
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
    const channelType = this.getChannelTypeForGroup(groupId);
    const stored = {
      id: ulid(),
      groupId,
      sender: this.assistantName,
      content: text,
      timestamp: Date.now(),
      channel: channelType,
      isFromMe: true,
      isTrigger: false,
    };

    await saveMessage(db, stored);

    if (channelType !== "browser") {
      try {
        await this.router?.send(groupId, text);
      } catch (error) {
        const deliveryError =
          error instanceof Error ? error : new Error(String(error));
        console.error(
          "Failed to deliver intermediate channel response:",
          deliveryError,
        );
        this.events.emit("error", {
          groupId,
          error: `Failed to deliver response to ${channelType}: ${deliveryError.message}`,
        });
      }
    }

    this.events.emit("message", stored);
  }

  async deliverResponse(
    db: ShadowClawDatabase,
    groupId: string,
    text: string,
  ): Promise<void> {
    const stored = {
      id: ulid(),
      groupId,
      sender: this.assistantName,
      content: text,
      timestamp: Date.now(),
      channel: this.getChannelTypeForGroup(groupId),
      isFromMe: true,
      isTrigger: false,
    };

    await saveMessage(db, stored);

    let deliveryError: Error | null = null;
    try {
      await this.router?.send(groupId, text);
    } catch (error) {
      deliveryError = error instanceof Error ? error : new Error(String(error));
      console.error("Failed to deliver channel response:", deliveryError);
    }

    if (this.pendingScheduledTasks.has(groupId)) {
      this.pendingScheduledTasks.delete(groupId);
      playNotificationChime();
    }

    this.events.emit("message", stored);
    this.events.emit("typing", { groupId, typing: false });

    this.setState("idle");
    this.router?.setTyping(groupId, false);

    if (deliveryError) {
      this.events.emit("error", {
        groupId,
        error: `Failed to deliver response to ${this.getChannelTypeForGroup(groupId)}: ${deliveryError.message}`,
      });
    }
  }
}

function normalizeStringList(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function parseStoredStringList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return normalizeStringList(parsed.map((entry) => String(entry)));
    }
  } catch {
    // Fall back to comma-separated input for forward compatibility.
  }

  return normalizeStringList(value.split(","));
}
