import {
  ASSISTANT_NAME,
  CONFIG_KEYS,
  DEFAULT_MAX_ITERATIONS,
  buildTriggerPattern,
  getDefaultProvider,
  getModelMaxTokens,
  getProvider,
} from "../../../config/config.js";

import { getConfig } from "../../../db/getConfig.js";
import { deleteRoom, getRoomMetadata, upsertRoom } from "../../../db/rooms.js";
import { setConfig } from "../../../db/setConfig.js";

import { toTrustedScriptUrl } from "../../../security/trusted-types.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";

import { RoomManager } from "../../../subsystems/channels/room-manager.js";
import { setWebMcpMode as applyWebMcpMode } from "../../../subsystems/mcp/webmcp.js";
import { modelRegistry } from "../../../subsystems/providers/model-registry.js";
import { TaskScheduler } from "../../../subsystems/tools/task-scheduler.js";

import { parseDirectToolCommandPolicy } from "./parseDirectToolCommandPolicy.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { RoomTransport } from "../../../subsystems/channels/room-manager.js";

import type {
  InboundMessage,
  RoomMember,
} from "../../../subsystems/channels/types.js";

import type { Orchestrator } from "../orchestrator.js";

export function createRoomManager(orchestrator: Orchestrator): RoomManager {
  const transport: RoomTransport = {
    get myPeerId() {
      return orchestrator.peerjs.myPeerId || orchestrator.peerjsMyPeerId;
    },
    sendToPeer: (peerId, note) =>
      orchestrator.peerjs.sendRoomNotification(peerId, note),
    isConnected: (peerId) => orchestrator.peerjs.isPeerConnected(peerId),
    connectToPeer: (peerId) => orchestrator.peerjs.connectPeer(peerId),
  };

  return new RoomManager({
    transport,
    getLocalMember: (): RoomMember => ({
      peerId: orchestrator.peerjs.myPeerId || orchestrator.peerjsMyPeerId,
      alias:
        orchestrator.peerjsMyAlias ||
        orchestrator.peerjs.myPeerId ||
        orchestrator.peerjsMyPeerId ||
        orchestrator.assistantName,
      kind: "agent",
      agentName: orchestrator.assistantName,
    }),
    onMessage: (msg) => orchestrator.roomChannel.deliverInbound(msg),
    onInvite: (invite) => orchestrator.handleRoomInvite(invite),
    persistRoom: (room) => {
      if (orchestrator.db) {
        upsertRoom(orchestrator.db, room).catch((err) =>
          console.error("Failed to persist room:", err),
        );
      }
    },
    removeRoom: (roomId) => {
      if (orchestrator.db) {
        deleteRoom(orchestrator.db, roomId).catch((err) =>
          console.error("Failed to delete room:", err),
        );
      }
    },
  });
}

export async function initChannelsAndRooms(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
): Promise<void> {
  orchestrator.initializeChannelRegistry();

  orchestrator.channelRegistry.onMessage((msg: InboundMessage) => {
    orchestrator.enqueue(db, msg).catch((error) => {
      console.error("Failed to enqueue inbound message:", error);
    });
  });

  orchestrator.channelRegistry.onTyping((groupId: string, typing: boolean) => {
    orchestrator.events.emit("typing", { groupId, typing });
    // Update remote agent typing status for peer channels
    if (groupId.startsWith("peer:")) {
      orchestratorStore.setRemoteAgentTyping(groupId, typing);
    }
  });

  // A2A task completion: when a remote peer sends a terminal status update,
  // suppress further auto-triggers for that conversation.
  orchestrator.peerjs.onTaskComplete((groupId: string) => {
    orchestrator.peerCompletedContexts.add(groupId);
  });

  await orchestrator.loadChannelConfigurations(db);
  orchestrator.applyAllChannelRunningStates();

  // Restore persisted multi-party rooms
  try {
    const rooms = await getRoomMetadata(db);
    orchestrator.roomManager.loadRooms(rooms);
  } catch (err) {
    console.error("Failed to load rooms:", err);
  }
}

export async function initCoreConfig(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
): Promise<void> {
  orchestrator.assistantName =
    (await getConfig(db, CONFIG_KEYS.ASSISTANT_NAME)) || ASSISTANT_NAME;

  orchestrator.triggerPattern = buildTriggerPattern(orchestrator.assistantName);
}

export async function initFeatureFlagsAndLimits(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
): Promise<void> {
  const storedVMBootMode = await getConfig(db, CONFIG_KEYS.VM_BOOT_MODE);
  orchestrator.vmBootMode =
    storedVMBootMode === "disabled" ||
    storedVMBootMode === "auto" ||
    storedVMBootMode === "9p" ||
    storedVMBootMode === "ext2"
      ? (storedVMBootMode as any)
      : "disabled";

  const storedStreaming = await getConfig(db, CONFIG_KEYS.STREAMING_ENABLED);
  orchestrator.streamingEnabled = storedStreaming !== "false";

  const storedWebMcpToolsEnabled = await getConfig(
    db,
    CONFIG_KEYS.WEBMCP_TOOLS_ENABLED,
  );

  orchestrator.webMcpToolsEnabled = storedWebMcpToolsEnabled !== "false";

  const storedBashFullInternetAccess = await getConfig(
    db,
    CONFIG_KEYS.VM_BASH_FULL_INTERNET_ACCESS,
  );

  orchestrator.vmBashFullInternetAccess =
    storedBashFullInternetAccess === "true";

  const storedWebMcpMode = await getConfig(db, CONFIG_KEYS.WEBMCP_MODE);
  if (storedWebMcpMode === "native" || storedWebMcpMode === "polyfill") {
    applyWebMcpMode(storedWebMcpMode);
  }

  const storedCompression = await getConfig(
    db,
    CONFIG_KEYS.CONTEXT_COMPRESSION_ENABLED,
  );

  orchestrator.contextCompressionEnabled = storedCompression === "true";

  const storedReasoningEffort = await getConfig(db, CONFIG_KEYS.REASONING_EFFORT);
  orchestrator.reasoningEffort = storedReasoningEffort
    ? storedReasoningEffort.trim().toLowerCase()
    : "none";

  const storedDirectToolPolicy = await getConfig(
    db,
    CONFIG_KEYS.DIRECT_TOOL_COMMAND_POLICY,
  );

  orchestrator.directToolCommandPolicy = parseDirectToolCommandPolicy(
    storedDirectToolPolicy,
  );

  const storedUseProxy = await getConfig(db, CONFIG_KEYS.USE_PROXY);
  orchestrator.useProxy = storedUseProxy === "true";

  orchestrator.proxyUrl =
    (await getConfig(db, CONFIG_KEYS.PROXY_URL)) || "/proxy";
  orchestrator.gitProxyUrl =
    (await getConfig(db, CONFIG_KEYS.GIT_PROXY_URL)) || "/git-proxy";
  orchestrator.taskServerUrl =
    (await getConfig(db, CONFIG_KEYS.TASK_SERVER_URL)) || "/schedule";
}

export async function initLlamafileAndMesh(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
): Promise<void> {
  const storedLlamafileMode = await getConfig(db, CONFIG_KEYS.LLAMAFILE_MODE);
  if (storedLlamafileMode === "cli" || storedLlamafileMode === "server") {
    orchestrator.llamafileMode = storedLlamafileMode;
  } else {
    await setConfig(db, CONFIG_KEYS.LLAMAFILE_MODE, orchestrator.llamafileMode);
  }

  const storedLlamafileHost = await getConfig(db, CONFIG_KEYS.LLAMAFILE_HOST);
  if (storedLlamafileHost) {
    orchestrator.llamafileHost = storedLlamafileHost;
  }

  const storedLlamafilePort = await getConfig(db, CONFIG_KEYS.LLAMAFILE_PORT);
  if (storedLlamafilePort) {
    const parsedPort = parseInt(storedLlamafilePort, 10);
    if (Number.isFinite(parsedPort) && parsedPort >= 1 && parsedPort <= 65535) {
      orchestrator.llamafilePort = parsedPort;
    }
  }

  const storedLlamafileOffline = await getConfig(
    db,
    CONFIG_KEYS.LLAMAFILE_OFFLINE,
  );

  if (storedLlamafileOffline === "false") {
    orchestrator.llamafileOffline = false;
  }

  orchestrator.applyLlamafileHeaders();

  const storedmeshLlmHost = await getConfig(db, CONFIG_KEYS.MESH_LLM_HOST);
  if (storedmeshLlmHost) {
    orchestrator.meshLlmHost = storedmeshLlmHost;
  }

  orchestrator.applyMeshLlmHeaders();
}

export async function initProviderAndModel(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
): Promise<void> {
  const storedProvider = await getConfig(db, CONFIG_KEYS.PROVIDER);
  if (storedProvider && getProvider(storedProvider)) {
    orchestrator.provider = storedProvider;
    orchestrator.providerConfig =
      getProvider(storedProvider) || getDefaultProvider();
  }

  // Load API key first so we can pass it to fetchModelInfo for
  // providers that require authentication (e.g. HuggingFace).
  await orchestrator.loadApiKeyForProvider(db, orchestrator.provider);

  orchestrator.bedrockRegionFallback = (
    (await getConfig(db, CONFIG_KEYS.BEDROCK_REGION_FALLBACK)) || ""
  ).trim();

  orchestrator.bedrockProfileFallback = (
    (await getConfig(db, CONFIG_KEYS.BEDROCK_PROFILE_FALLBACK)) || ""
  ).trim();

  orchestrator.bedrockAuthMode = (
    (await getConfig(db, CONFIG_KEYS.BEDROCK_AUTH_MODE)) || "provider_chain"
  ).trim();

  // Fetch model info for the current provider (passes apiKey for auth).
  await modelRegistry.fetchModelInfo(
    orchestrator.providerConfig,
    (await orchestrator.getApiKeyForHeaders()) || undefined,
    orchestrator.getProviderRuntimeHeaders(orchestrator.provider),
  );

  const storedModel = await getConfig(db, CONFIG_KEYS.MODEL);
  if (storedModel) {
    orchestrator.model = storedModel;
  } else {
    orchestrator.model = orchestrator.providerConfig.defaultModel;
  }

  const storedMaxTokens = await getConfig(db, CONFIG_KEYS.MAX_TOKENS);
  const dynamicMaxTokens = getModelMaxTokens(orchestrator.model);

  // If the stored value is exactly 8192 (our legacy fallback), prioritize the dynamic value
  // from our registry and updated limits definitions.
  if (storedMaxTokens === "8192") {
    orchestrator.maxTokens = dynamicMaxTokens;
  } else {
    const parsedStored = parseInt(
      storedMaxTokens || String(dynamicMaxTokens),
      10,
    );

    // Hard clamp any stored manual overrides against our new safe dynamic boundaries
    // to avoid 400 errors if a user previously forced a too-large MAX_TOKENS in the DB.
    orchestrator.maxTokens = Math.min(parsedStored, dynamicMaxTokens);
  }

  const storedMaxIterations = await getConfig(db, CONFIG_KEYS.MAX_ITERATIONS);
  if (storedMaxIterations) {
    orchestrator.maxIterations =
      parseInt(storedMaxIterations, 10) || DEFAULT_MAX_ITERATIONS;
  }

  const storedRateLimitCallsPerMinute = await getConfig(
    db,
    CONFIG_KEYS.RATE_LIMIT_CALLS_PER_MINUTE,
  );

  if (storedRateLimitCallsPerMinute) {
    const parsed = parseInt(storedRateLimitCallsPerMinute, 10);
    orchestrator.rateLimitCallsPerMinute = Number.isFinite(parsed)
      ? Math.max(0, parsed)
      : 0;
  }

  const storedRateLimitAutoAdapt = await getConfig(
    db,
    CONFIG_KEYS.RATE_LIMIT_AUTO_ADAPT,
  );

  orchestrator.rateLimitAutoAdapt = storedRateLimitAutoAdapt !== "false";
}

export async function initWorkerAndScheduler(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
): Promise<void> {
  orchestrator.agentWorker = new Worker(
    toTrustedScriptUrl(
      new URL("./agent.worker.js", import.meta.url).href,
    ) as string,
    {
      type: "module",
    },
  );

  orchestrator.agentWorker.onmessage = (event) =>
    orchestrator.handleWorkerMessage(db, event.data);

  orchestrator.agentWorker.onerror = (err) => {
    console.error("Agent worker error:", err);
  };

  const storageHandle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);
  if (storageHandle) {
    orchestrator.agentWorker.postMessage({
      payload: { storageHandle },
      type: "set-storage",
    });
  }

  // Sync proxy config to Service Worker
  orchestrator.syncProxyConfigToServiceWorker();

  // Set up task scheduler.
  // When push scheduling is available, the server-side scheduler should be
  // authoritative. The local client scheduler is only used as a fallback
  // when push background execution is unavailable.
  orchestrator.scheduler = new TaskScheduler(
    async (task) => {
      await orchestrator.runTaskAsScheduled(task);
    },
    () => {
      orchestrator.events.emit("task-change", { type: "executed" });
    },
  );

  if (await orchestrator.shouldStartLocalScheduler()) {
    orchestrator.scheduler.start();
  }

  orchestrator.setupPushTaskListener(db);
}
