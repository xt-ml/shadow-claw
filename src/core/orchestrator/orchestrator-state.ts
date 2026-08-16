import type { ProviderConfig } from "../../config/config.js";
import type { ShadowClawDatabase } from "../../db/db.js";
import type { VMBootMode, VMStatus } from "../../shell/vm.js";
import type { OrchestratorDisplayState } from "../../stores/orchestrator.js";
import type { BrowserChatChannel } from "../../subsystems/channels/browser-chat.js";
import type { ChannelRegistry } from "../../subsystems/channels/channel-registry.js";
import type { IMessageChannel } from "../../subsystems/channels/imessage.js";
import type { PeerJsChannel } from "../../subsystems/channels/peerjs.js";
import type { RoomManager } from "../../subsystems/channels/room-manager.js";
import type { RoomChannel } from "../../subsystems/channels/room.js";
import type { TaskScheduler } from "../../subsystems/tools/task-scheduler.js";
import type { Router } from "../router.js";
import type { EventBus } from "./utils/EventBus.js";
import type { DirectToolCommandPolicy } from "./utils/types.js";

export interface OrchestratorState {
  // ── Core ──────────────────────────────────────────────────────────────────
  agentWorker: Worker | null;
  assistantName: string;
  db: ShadowClawDatabase | null;
  events: EventBus;
  router: Router | null;
  state: OrchestratorDisplayState;
  triggerPattern: RegExp;

  // ── Provider / Model ──────────────────────────────────────────────────────
  model: string;
  maxIterations: number;
  maxTokens: number;
  provider: string;
  providerConfig: ProviderConfig;
  reasoningEffort: string;
  streamingEnabled: boolean;

  // ── Bedrock ───────────────────────────────────────────────────────────────
  bedrockAuthMode: string;
  bedrockProfileFallback: string;
  bedrockRegionFallback: string;

  // ── Llamafile ─────────────────────────────────────────────────────────────
  llamafileHost: string;
  llamafileMode: "server" | "cli";
  llamafileOffline: boolean;
  llamafilePort: number;

  // ── Mesh-LLM ─────────────────────────────────────────────────────────────
  meshLlmHost: string;

  // ── Channels ──────────────────────────────────────────────────────────────
  browserChat: BrowserChatChannel;
  channelEnabledByType: Record<string, boolean>;
  channelRegistry: ChannelRegistry;
  imessage: IMessageChannel;
  imessageApiKey: string;
  imessageChatIds: string[];
  imessageServerUrl: string;
  peerjs: PeerJsChannel;
  peerjsMyAlias: string;
  peerjsMyPeerId: string;
  peerjsPeerAliases: Record<string, string>;
  peerjsServerHost: string;
  peerjsServerPath: string;
  peerjsServerPort: number;
  peerjsServerSecure: boolean;
  peerjsTrustedPeerIds: string[];
  roomChannel: RoomChannel;
  roomManager: RoomManager;
  telegram: TelegramChannel;
  telegramBotToken: string;
  telegramChatIds: string[];
  telegramUseProxy: boolean;

  // ── In-flight tracking ────────────────────────────────────────────────────
  inFlightEffectiveProviderByGroup: Map<
    string,
    { providerId: string; providerConfig: ProviderConfig }
  >;
  inFlightProviderRequestIds: Map<string, string>;
  inFlightTriggerByGroup: Map<string, string>;
  messageQueue: any[];
  processing: boolean;
  promptControllers: Map<string, AbortController>;

  // ── Proxy / Network ───────────────────────────────────────────────────────
  gitProxyUrl: string;
  proxyUrl: string;
  useProxy: boolean;

  // ── Context ───────────────────────────────────────────────────────────────
  contextCompressionEnabled: boolean;

  // ── Rate limiting ─────────────────────────────────────────────────────────
  rateLimitAutoAdapt: boolean;
  rateLimitCallsPerMinute: number;

  // ── Tasks / Scheduling ────────────────────────────────────────────────────
  pendingScheduledTasks: Set<string>;
  pushSubscriptionWarned: boolean;
  scheduler: TaskScheduler | null;
  schedulerTriggeredGroups: Set<string>;
  taskServerEnabled: boolean;
  taskServerUrl: string;

  // ── Peer / Rooms ──────────────────────────────────────────────────────────
  directToolCommandPolicy: DirectToolCommandPolicy;
  peerCompletedContexts: Set<string>;

  // ── VM / Terminal ─────────────────────────────────────────────────────────
  transformersProgressPollers: Map<string, number>;
  vmBashFullInternetAccess: boolean;
  vmBootMode: VMBootMode;
  vmStatus: VMStatus;

  // ── WebMCP ────────────────────────────────────────────────────────────────
  webMcpEffectCleanup: (() => void) | null;
  webMcpRegistrationLock: Promise<void>;
  webMcpToolsEnabled: boolean;
}

// Re-export the channel type so consumers don't need a separate import.
import type { TelegramChannel } from "../../subsystems/channels/telegram.js";
