import { jest } from "@jest/globals";
import { webcrypto } from "node:crypto";

const mockSubtle = {
  generateKey: jest.fn(async () => ({ type: "secret" })),
  encrypt: jest.fn(
    async (_cfg: unknown, _key: unknown, data: BufferSource) =>
      new Uint8Array(data as ArrayBuffer).slice().buffer,
  ),
  decrypt: jest.fn(
    async (_cfg: unknown, _key: unknown, data: BufferSource) =>
      new Uint8Array(data as ArrayBuffer).slice().buffer,
  ),
};

Object.defineProperty(globalThis, "crypto", {
  value: {
    ...webcrypto,
    subtle: mockSubtle,
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      if (array && "fill" in array) {
        (array as unknown as Uint8Array).fill(1);
      }
      return array;
    },
  },
  configurable: true,
  writable: true,
});

async function resetKeystore(): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("shadowclaw-keystore", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("keys");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = db.transaction("keys", "readwrite");
  tx.objectStore("keys").put(
    { type: "secret" } as CryptoKey,
    "api-key-encryption",
  );
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

import {
  ASSISTANT_NAME,
  CONFIG_KEYS,
  LLAMAFILE_PROXY_URL,
  getProvider,
  getProviderApiKeyConfigKey,
} from "../../config/config.js";
import {
  createGroup,
  saveGroupMetadata,
  updateGroupPinnedProvider,
} from "../../db/groups.js";
import { openDatabase } from "../../db/openDatabase.js";
import { getConfig } from "../../db/getConfig.js";
import { setConfig } from "../../db/setConfig.js";
import { encryptValue } from "../../security/crypto.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { toolsStore } from "../../stores/tools.js";
import { getWebMcpMode } from "../../subsystems/mcp/webmcp.js";
import { buildSystemPrompt } from "../../worker/utils/system-prompt.js";
import { Orchestrator } from "./orchestrator.js";
import type { ShadowClawDatabase } from "../../db/db.js";
import type { A2UIAction } from "../../ui/a2ui/types.js";
import type { ToolDefinition } from "../../subsystems/tools/tools.js";
import type { TaskScheduler } from "../../subsystems/tools/task-scheduler.js";
import type { ControlPlaneClient } from "../control-plane-client.js";

import {
  deliverIntermediateResponse,
  deliverResponse,
} from "./utils/deliverResponse.js";

import { enqueue, processQueue } from "./utils/enqueue.js";
import { handleWorkerMessage } from "./utils/handleWorkerMessage.js";

import {
  initChannelsAndRooms,
  initCoreConfig,
  initFeatureFlagsAndLimits,
  initLlamafileAndMesh,
  initProviderAndModel,
  initWorkerAndScheduler,
} from "./utils/initTasks.js";

import {
  applyAllChannelRunningStates,
  applyChannelRunningState,
  clearPeerJsTypingState,
  getChannelByType,
  getChannelEnabled,
  getChannelEnabledConfigKey,
  getChannelTypeForGroup,
  getIMessageConfig,
  getPeerJsConfig,
  getTelegramConfig,
} from "./utils/operations/channel.js";

import {
  applyLlamafileHeaders,
  applyMeshLlmHeaders,
  getAvailableProviders,
  getBedrockSettings,
  getLlamafileSettings,
  getProviderRuntimeHeaders,
  getReasoningConfig,
  getTransformersStatusUrl,
  setProvider,
} from "./utils/operations/provider.js";

import {
  createRoom,
  handleRoomInvite,
  inviteToRoom,
  joinRoomViaLink,
  leaveRoom,
  listRooms,
} from "./utils/operations/room.js";

import {
  runTaskAsScheduled,
  shouldStartLocalScheduler,
  warnIfNoPushSubscription,
} from "./utils/operations/task.js";

import {
  answerUserPrompt,
  closeTerminalSession,
  flushTerminalWorkspace,
  openTerminalSession,
  sendTerminalInput,
  syncTerminalWorkspace,
} from "./utils/operations/vm.js";

import { parseDirectToolCommand } from "./utils/parseDirectToolCommand.js";

describe("buildSystemPrompt", () => {
  const FETCH_URL_TOOL = "fetch_url";
  const TOOL_USE_STRATEGY = "Tool usage strategy:";
  const SHELL_FALLBACK_TIPS = "Shell fallback tips";
  const GIT_MERGE_CONFLICT_RESOLUTION = "Git merge conflict resolution:";

  it("includes patch_file in tool usage strategy", () => {
    const prompt = buildSystemPrompt(ASSISTANT_NAME, "");

    expect(prompt).toContain("patch_file");
    expect(prompt).toMatch(/patch_file.*targeted|surgical|partial/i);
  });

  it("includes fetch_url git auth guidance", () => {
    const prompt = buildSystemPrompt(ASSISTANT_NAME, "");

    expect(prompt).toContain(FETCH_URL_TOOL);
    expect(prompt).toContain("use_git_auth");
  });

  it("includes fetch_url account auth guidance", () => {
    const prompt = buildSystemPrompt(ASSISTANT_NAME, "");

    expect(prompt).toContain("use_account_auth");
    expect(prompt).toContain("Settings → Accounts");
  });

  it("routes email retrieval through email_read_messages", () => {
    const prompt = buildSystemPrompt(ASSISTANT_NAME, "");

    expect(prompt).toContain("email_read_messages");
    expect(prompt).toContain(
      "Use manage_email for email setup and inspection only",
    );
    expect(prompt).toContain("first identify or configure the IMAP connection");
  });

  it("prefers markdown file references for attachments", () => {
    const prompt = buildSystemPrompt(ASSISTANT_NAME, "");

    expect(prompt).toContain("markdown references to the file path");
    expect(prompt).toContain("![alt](path/to/image.png)");
    expect(prompt).toContain("[report.pdf](path/to/report.pdf)");
  });

  it("restricts open_file to explicit viewer requests", () => {
    const prompt = buildSystemPrompt(ASSISTANT_NAME, "");

    expect(prompt).toContain("Do not use open_file to attach or send files");
    expect(prompt).toContain("explicitly asks to open/view");
  });

  it("states no tools and omits tool strategy when tools are disabled", () => {
    const prompt = buildSystemPrompt(ASSISTANT_NAME, "", []);

    expect(prompt).toContain("No tools are currently enabled");
    expect(prompt).not.toContain(TOOL_USE_STRATEGY);
    expect(prompt).not.toContain(SHELL_FALLBACK_TIPS);
    expect(prompt).not.toContain(GIT_MERGE_CONFLICT_RESOLUTION);
  });

  it("includes only strategy guidance for enabled tools", () => {
    const prompt = buildSystemPrompt(ASSISTANT_NAME, "", [
      {
        name: "read_file",
        description: "Read files.",
        input_schema: { type: "object", properties: {} },
      },
    ]);

    expect(prompt).toContain(TOOL_USE_STRATEGY);
    expect(prompt).toContain("Prefer read_file over bash");
    expect(prompt).toContain("Use read_file with paths");
    expect(prompt).not.toContain(FETCH_URL_TOOL);
    expect(prompt).not.toContain(SHELL_FALLBACK_TIPS);
    expect(prompt).not.toContain(GIT_MERGE_CONFLICT_RESOLUTION);
  });
});

describe("Orchestrator", () => {
  const CHANNEL_TELEGRAM = "telegram";
  const CHANNEL_IMESSAGE = "imessage";

  it("initializes defaults", () => {
    const o = new Orchestrator();

    expect(o.state).toBe("idle");
    expect(typeof o.assistantName).toBe("string");
    expect(Array.isArray(getAvailableProviders())).toBe(true);
    expect(o.channelRegistry.getChannelType("tg:123")).toBe(CHANNEL_TELEGRAM);
    expect(o.channelRegistry.getChannelType("im:chat-1")).toBe(
      CHANNEL_IMESSAGE,
    );
  });

  it("setState emits state-change event with groupId", () => {
    const o = new Orchestrator();
    const events: any[] = [];

    o.events.on("state-change", (state: any) => events.push(state));
    o.setState("thinking", "group-a");

    expect(events).toEqual([{ state: "thinking", groupId: "group-a" }]);
    expect(o.state).toBe("thinking");
  });

  it("throws for unknown provider", async () => {
    const o = new Orchestrator();

    await expect(
      setProvider(o, {} as any, "not-a-provider", {
        loadApiKeyForProvider: jest.fn<any>(),
        getApiKeyForHeaders: jest.fn<any>(),
      }),
    ).rejects.toThrow("Unknown provider");
  });

  it("emits provider-help when queue processing lacks an API key", async () => {
    const o = new Orchestrator();
    o.provider = "openrouter";
    o.providerConfig = getProvider("openrouter")!;
    const helpEvents: any[] = [];
    const errorEvents: any[] = [];

    o.events.on("provider-help", (payload: any) => helpEvents.push(payload));
    o.events.on("error", (payload: any) => errorEvents.push(payload));

    o.messageQueue.push({
      channel: "browser",
      content: "hello",
      groupId: "br:main",
      id: "msg-1",
      sender: "User",
      timestamp: Date.now(),
    });

    const fakeRequest: any = {
      onerror: null,
      onsuccess: null,
      result: [],
    };

    const fakeDb: any = {
      transaction: () => ({
        objectStore: () => ({
          getAll: () => {
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
          get: () => {
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
          put: () => {
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
        }),
      }),
    };

    await processQueue(o, fakeDb as any);

    expect(helpEvents).toHaveLength(1);
    expect(helpEvents[0]).toMatchObject({
      helpType: "api-key-missing",
      providerId: "openrouter",
    });

    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].error).toContain("API key not configured");
  });

  it("emits provider-help for provider auth failures", async () => {
    const o = new Orchestrator();
    o.provider = "openrouter";
    o.providerConfig = getProvider("openrouter")!;
    const helpEvents: any[] = [];

    o.events.on("provider-help", (payload: any) => helpEvents.push(payload));

    const fakeRequest: any = {
      onerror: null,
      onsuccess: null,
      result: undefined,
    };

    const fakeDb: any = {
      transaction: () => ({
        objectStore: () => ({
          put: () => {
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
        }),
      }),
    };

    await handleWorkerMessage(o, fakeDb, {
      payload: {
        error: "HTTP 401 Unauthorized",
        groupId: "br:main",
      },
      type: "error",
    });

    expect(helpEvents).toHaveLength(1);
    expect(helpEvents[0]).toMatchObject({
      helpType: "api-key-invalid",
      providerId: "openrouter",
    });
  });

  it("emits open-file event from worker message", async () => {
    const o = new Orchestrator();
    const events: any[] = [];

    o.events.on("open-file", (payload: any) => events.push(payload));

    await handleWorkerMessage(o, {} as any, {
      payload: { groupId: "g1", path: "a.txt" },
      type: "open-file",
    });

    expect(events).toEqual([{ groupId: "g1", path: "a.txt" }]);
  });

  it("does not set remote agent responding status for inbound peer messages", () => {
    const statusSpy = jest.spyOn(orchestratorStore, "setRemoteAgentStatus");
    const typingSpy = jest.spyOn(orchestratorStore, "setRemoteAgentTyping");

    clearPeerJsTypingState("peer:remote-peer");

    expect(statusSpy).not.toHaveBeenCalled();
    expect(typingSpy).toHaveBeenCalledWith("peer:remote-peer", false);
  });

  it("tracks vm status from worker messages", async () => {
    const o = new Orchestrator();
    const events: any[] = [];

    o.events.on("vm-status", (payload: any) => events.push(payload));

    await handleWorkerMessage(o, {} as any, {
      payload: {
        bootAttempted: true,
        booting: false,
        error: null,
        mode: "9p",
        ready: true,
      },
      type: "vm-status",
    });

    expect(o.vmStatus).toEqual({
      bootAttempted: true,
      booting: false,
      error: null,
      mode: "9p",
      ready: true,
    });

    expect(events).toHaveLength(1);
  });

  it("emits model download progress from worker message", async () => {
    const o = new Orchestrator();
    const events: any[] = [];

    o.events.on("model-download-progress", (payload: any) =>
      events.push(payload),
    );

    await handleWorkerMessage(o, {} as any, {
      payload: {
        groupId: "g1",
        message: "Downloading Prompt API model... 42%",
        progress: 0.42,
        status: "running",
      },
      type: "model-download-progress",
    });

    expect(events).toEqual([
      {
        groupId: "g1",
        message: "Downloading Prompt API model... 42%",
        progress: 0.42,
        status: "running",
      },
    ]);
  });

  it("handles manage-tools message from worker", async () => {
    const o = new Orchestrator();
    const db = {} as any;

    const activateProfileSpy = jest
      .spyOn(toolsStore, "activateProfile")
      .mockResolvedValue(undefined);

    const setToolEnabledSpy = jest
      .spyOn(toolsStore, "setToolEnabled")
      .mockResolvedValue(undefined);

    // Test activate_profile
    await handleWorkerMessage(o, db, {
      type: "manage-tools",
      payload: { action: "activate_profile", profileId: "git-ops" },
    });

    expect(activateProfileSpy).toHaveBeenCalledWith(db, "git-ops");

    // Test enable
    await handleWorkerMessage(o, db, {
      type: "manage-tools",
      payload: { action: "enable", toolNames: ["git_add"] },
    });

    expect(setToolEnabledSpy).toHaveBeenCalledWith(db, "git_add", true);

    // Test disable
    await handleWorkerMessage(o, db, {
      type: "manage-tools",
      payload: { action: "disable", toolNames: ["bash"] },
    });

    expect(setToolEnabledSpy).toHaveBeenCalledWith(db, "bash", false);

    activateProfileSpy.mockRestore();
    setToolEnabledSpy.mockRestore();
  });

  it("posts silent host-to-vm sync requests", () => {
    const o = new Orchestrator();
    const postMessage = jest.fn();

    o.agentWorker = { postMessage } as any;
    syncTerminalWorkspace(o, "g1");

    expect(postMessage).toHaveBeenCalledWith({
      payload: { groupId: "g1" },
      type: "vm-workspace-sync",
    });
  });

  it("posts manual vm-to-host flush requests", () => {
    const o = new Orchestrator();
    const postMessage = jest.fn();

    o.agentWorker = { postMessage } as any;
    flushTerminalWorkspace(o, "g1");

    expect(postMessage).toHaveBeenCalledWith({
      payload: { groupId: "g1" },
      type: "vm-workspace-flush",
    });
  });

  it("sends an explicit llamafile cancel request when stopping", () => {
    const o = new Orchestrator();
    const postMessage = jest.fn();
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true } as Response);

    o.agentWorker = { postMessage } as any;
    o.provider = "llamafile";
    o.state = "thinking";
    o.inFlightProviderRequestIds.set("g1", "req-123");

    o.stopCurrentRequest("g1");

    expect(postMessage).toHaveBeenCalledWith({
      payload: { groupId: "g1" },
      type: "cancel",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      LLAMAFILE_PROXY_URL.replace("/chat/completions", "/cancel"),
      expect.objectContaining({
        body: JSON.stringify({ requestId: "req-123" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-shadowclaw-request-id": "req-123",
        }),
        keepalive: true,
        method: "POST",
      }),
    );

    expect(o.inFlightProviderRequestIds.has("g1")).toBe(false);

    fetchMock.mockRestore();
  });

  it("tracks vm boot mode preference", () => {
    const o = new Orchestrator();

    expect(o.vmBootMode).toBe("disabled");

    o.vmBootMode = "9p";

    expect(o.vmBootMode).toBe("9p");
  });

  it("saves intermediate-response as a message without going idle", async () => {
    const o = new Orchestrator();
    const messageEvents: any[] = [];
    const routerSend = jest.fn<any>().mockResolvedValue(undefined);
    const stateEvents: any[] = [];

    o.router = {
      send: routerSend,
      setTyping: jest.fn(),
    } as any;

    o.events.on("message", (msg: any) => messageEvents.push(msg));
    o.events.on("state-change", (state: any) => stateEvents.push(state));

    // Start in "thinking" state (as it would be during a tool-use loop)
    o.setState("thinking");
    stateEvents.length = 0; // clear the state-change from setUp

    // Create a fake db that satisfies saveMessage → txPromise
    const fakeRequest: any = {
      onerror: null,
      onsuccess: null,
      result: undefined,
    };

    const fakeDb: any = {
      transaction: () => ({
        objectStore: () => ({
          put: () => {
            // Simulate async success

            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
        }),
      }),
    };

    await handleWorkerMessage(o, fakeDb, {
      type: "intermediate-response",
      payload: { groupId: "g1", text: "Let me check that for you." },
    });

    // Should have emitted a message event with the intermediate text
    expect(messageEvents).toHaveLength(1);
    expect(messageEvents[0].content).toBe("Let me check that for you.");
    expect(messageEvents[0].groupId).toBe("g1");
    expect(messageEvents[0].isFromMe).toBe(true);
    expect(routerSend).not.toHaveBeenCalled();

    // Should NOT have changed state to idle — still thinking
    expect(o.state).toBe("thinking");
    expect(stateEvents).toHaveLength(0);
  });

  it("delivers intermediate-response to external channels", async () => {
    const o = new Orchestrator();
    const routerSend = jest.fn<any>().mockResolvedValue(undefined);

    o.router = {
      send: routerSend,
      setTyping: jest.fn(),
    } as any;

    const fakeRequest: any = {
      onerror: null,
      onsuccess: null,
      result: undefined,
    };

    const fakeDb: any = {
      transaction: () => ({
        objectStore: () => ({
          put: () => {
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
        }),
      }),
    };

    await deliverIntermediateResponse(
      o,
      fakeDb,
      "tg:123",
      "Let me check the weather for you.",
    );

    expect(routerSend).toHaveBeenCalledWith(
      "tg:123",
      "Let me check the weather for you.",
    );
  });

  it("enqueue queues messages from any browser-channel group, not just br:main", async () => {
    const o = new Orchestrator();

    // Stub saveMessage so it doesn't hit a real DB
    const fakeRequest: any = {
      onerror: null,
      onsuccess: null,
      result: undefined,
    };

    const fakeDb: any = {
      transaction: () => ({
        objectStore: () => ({
          put: () => {
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
        }),
      }),
    };

    // Prevent processQueue from running (it needs an API key etc.)
    o.processing = true;

    // Message from a non-default browser conversation (ULID-based groupId)

    await enqueue(o, fakeDb, {
      channel: "browser",
      content: "Hello",
      groupId: "br:01JNVWXYZ0000000000000000",
      id: "msg-1",
      sender: "You",
      timestamp: Date.now(),
    });

    expect(o.messageQueue).toHaveLength(1);
    expect(o.messageQueue[0].groupId).toBe("br:01JNVWXYZ0000000000000000");

    // Message from the default browser group should also be queued

    await enqueue(o, fakeDb, {
      channel: "browser",
      content: "Hi",
      groupId: "br:main",
      id: "msg-2",
      sender: "You",
      timestamp: Date.now(),
    });

    expect(o.messageQueue).toHaveLength(2);
  });

  it("enqueue does not queue non-browser messages without trigger word", async () => {
    const o = new Orchestrator();

    const fakeRequest: any = {
      onerror: null,
      onsuccess: null,
      result: undefined,
    };

    const fakeDb: any = {
      transaction: () => ({
        objectStore: () => ({
          put: () => {
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
        }),
      }),
    };

    o.processing = true;

    // Non-browser channel message without trigger word

    await enqueue(o, fakeDb, {
      channel: "external",
      content: "Hello",
      groupId: "ext:some-channel",
      id: "msg-3",
      sender: "User",
      timestamp: Date.now(),
    });

    // Should NOT be queued (no trigger word, not browser channel)
    expect(o.messageQueue).toHaveLength(0);
  });

  it("enqueue auto-queues iMessage messages without trigger word", async () => {
    const o = new Orchestrator();

    const fakeRequest: any = {
      onerror: null,
      onsuccess: null,
      result: undefined,
    };

    const fakeDb: any = {
      transaction: () => ({
        objectStore: () => ({
          put: () => {
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
        }),
      }),
    };

    o.processing = true;

    await enqueue(o, fakeDb, {
      channel: CHANNEL_IMESSAGE,
      content: "hello from phone",
      groupId: "im:chat-1",
      id: "msg-4",
      sender: "Alex",
      timestamp: Date.now(),
    });

    expect(o.messageQueue).toHaveLength(1);
    expect(o.messageQueue[0].groupId).toBe("im:chat-1");
  });

  it("enqueue queues browser-channel messages even when sent to non-browser conversations like Telegram", async () => {
    const o = new Orchestrator();

    const fakeRequest: any = {
      onerror: null,
      onsuccess: null,
      result: undefined,
    };

    const fakeDb: any = {
      transaction: () => ({
        objectStore: () => ({
          put: () => {
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
        }),
      }),
    };

    o.processing = true;

    // Browser-sourced message to a Telegram conversation (no @example trigger required)
    await enqueue(o, fakeDb, {
      channel: "browser",
      content: "I don't see this message in telegram",
      groupId: "tg:8352127045",
      id: "msg-telegram",
      sender: "You",
      timestamp: Date.now(),
    });

    // Should be queued because it's from the browser UI, not because of trigger word
    expect(o.messageQueue).toHaveLength(1);
    expect(o.messageQueue[0].groupId).toBe("tg:8352127045");
  });

  it("enqueue executes direct tool command from Telegram when policy allows it", async () => {
    const o = new Orchestrator();
    const postMessage = jest.fn();

    const fakeRequest: any = {
      onerror: null,
      onsuccess: null,
      result: undefined,
    };

    const fakeDb: any = {
      transaction: () => ({
        objectStore: () => ({
          put: () => {
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
        }),
      }),
    };

    o.processing = true;
    o.agentWorker = { postMessage } as any;

    await enqueue(o, fakeDb, {
      channel: CHANNEL_TELEGRAM,
      content: "@ShadowClaw - /clear_chat",
      groupId: "tg:8352127045",
      id: "msg-direct-tg",
      sender: "Sam",
      timestamp: Date.now(),
    });

    expect(o.messageQueue).toHaveLength(0);
    expect(postMessage).toHaveBeenCalledWith({
      payload: {
        groupId: "tg:8352127045",
        name: "clear_chat",
        input: {},
      },
      type: "execute-direct-tool",
    });
  });

  it("enqueue supports policy-configured direct commands for future channels like iMessage", async () => {
    const o = new Orchestrator();
    const postMessage = jest.fn();

    const fakeRequest: any = {
      onerror: null,
      onsuccess: null,
      result: undefined,
    };

    const fakeDb: any = {
      transaction: () => ({
        objectStore: () => ({
          put: () => {
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
        }),
      }),
    };

    o.processing = true;
    o.agentWorker = { postMessage } as any;
    o.directToolCommandPolicy = {
      allowedTools: ["clear_chat", "show_toast"],
      enabledChannelTypes: [CHANNEL_TELEGRAM, CHANNEL_IMESSAGE],
      requireMention: true,
    };

    await enqueue(o, fakeDb, {
      channel: CHANNEL_IMESSAGE,
      content: `@ShadowClaw /show_toast '{"message":"it works","duration":10}'`,
      groupId: "im:chat-1",
      id: "msg-direct-im",
      sender: "Alex",
      timestamp: Date.now(),
    });

    expect(o.messageQueue).toHaveLength(0);
    expect(postMessage).toHaveBeenCalledWith({
      payload: {
        groupId: "im:chat-1",
        name: "show_toast",
        input: {
          message: "it works",
          duration: 10,
        },
      },
      type: "execute-direct-tool",
    });
  });

  it("stores resolved channel type for assistant responses", async () => {
    const o = new Orchestrator();
    const saved: any[] = [];

    const fakeRequest: any = {
      onerror: null,
      onsuccess: null,
      result: undefined,
    };

    const fakeDb: any = {
      transaction: () => ({
        objectStore: () => ({
          put: (value: any) => {
            saved.push(value);
            setTimeout(() => fakeRequest.onsuccess?.(), 0);

            return fakeRequest;
          },
        }),
      }),
    };

    o.router = {
      send: jest.fn<any>().mockResolvedValue(undefined),
      setTyping: jest.fn(),
    } as any;

    await deliverResponse(o, fakeDb, "tg:123", "hello telegram");
    await deliverResponse(o, fakeDb, "im:chat-1", "hello imessage");

    expect(saved[0].channel).toBe(CHANNEL_TELEGRAM);
    expect(saved[1].channel).toBe(CHANNEL_IMESSAGE);
  });

  describe("warnIfNoPushSubscription", () => {
    let originalServiceWorker: any;

    beforeEach(() => {
      originalServiceWorker = navigator.serviceWorker;
    });

    afterEach(() => {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: originalServiceWorker,
      });
    });

    it("sets pushSubscriptionWarned flag when no subscription exists", async () => {
      const o = new Orchestrator();

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          addEventListener: jest.fn(),
          ready: Promise.resolve({
            pushManager: {
              getSubscription: (jest.fn() as any).mockResolvedValue(null),
            },
          }),
        },
      });

      await warnIfNoPushSubscription(o);
      expect(o.pushSubscriptionWarned).toBe(true);
    });

    it("does NOT warn when a push subscription exists", async () => {
      const o = new Orchestrator();

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          addEventListener: jest.fn(),
          ready: Promise.resolve({
            pushManager: {
              getSubscription: (jest.fn() as any).mockResolvedValue({
                endpoint: "https://example.com/push",
              }),
            },
          }),
        },
      });

      await warnIfNoPushSubscription(o);

      expect(o.pushSubscriptionWarned).toBe(false);
    });

    it("only warns once per session (deduplication)", async () => {
      const o = new Orchestrator();

      const mockGetSubscription = (jest.fn() as any).mockResolvedValue(null);

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          addEventListener: jest.fn(),
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
            },
          }),
        },
      });

      await warnIfNoPushSubscription(o);
      expect(o.pushSubscriptionWarned).toBe(true);

      mockGetSubscription.mockClear();
      await warnIfNoPushSubscription(o);

      // Should not call getSubscription again
      expect(mockGetSubscription).not.toHaveBeenCalled();
    });

    it("tolerates missing navigator.serviceWorker", async () => {
      const o = new Orchestrator();

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: undefined,
      });

      await warnIfNoPushSubscription(o);
      expect(o.pushSubscriptionWarned).toBe(false);
    });

    it("starts local scheduler when push subscription is missing", async () => {
      const mockGetSubscription = jest.fn(async () => null);
      const readyPromise = Promise.resolve({
        pushManager: { getSubscription: mockGetSubscription },
      } as any);

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          ready: readyPromise,
        },
      });

      const shouldStart = await shouldStartLocalScheduler();
      expect(shouldStart).toBe(true);
    });

    it("does not start local scheduler when push subscription exists", async () => {
      const mockGetSubscription = jest.fn(async () => ({}));
      const readyPromise = Promise.resolve({
        pushManager: { getSubscription: mockGetSubscription },
      } as any);

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          ready: readyPromise,
        },
      });

      const shouldStart = await shouldStartLocalScheduler();
      expect(shouldStart).toBe(false);
    });
  });

  describe("scheduler recursion guard (schedulerTriggeredGroups)", () => {
    // returns A minimal fake DB for handleWorkerMessage
    function fakeDb() {
      const fakeRequest: any = {
        onerror: null,
        onsuccess: null,
        result: undefined,
      };

      return {
        transaction: () => ({
          objectStore: () => ({
            get: () => {
              setTimeout(() => fakeRequest.onsuccess?.(), 0);

              return fakeRequest;
            },
            put: () => {
              setTimeout(() => fakeRequest.onsuccess?.(), 0);

              return fakeRequest;
            },
            delete: () => {
              setTimeout(() => fakeRequest.onsuccess?.(), 0);

              return fakeRequest;
            },
          }),
        }),
      };
    }

    it("blocks task-created when groupId is in schedulerTriggeredGroups", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      o.schedulerTriggeredGroups.add("br:main");

      await handleWorkerMessage(o, fakeDb() as any, {
        payload: {
          task: {
            createdAt: Date.now(),
            enabled: true,
            groupId: "br:main",
            id: "t1",
            prompt: "test",
            schedule: "* * * * *",
          },
        },
        type: "task-created",
      });

      // Task-change event should NOT have fired
      expect(events).toHaveLength(0);
    });

    it("allows task-created when groupId is NOT in schedulerTriggeredGroups", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      // Mock fetch so syncTaskToServer doesn't throw
      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
      });

      await handleWorkerMessage(o, fakeDb() as any, {
        payload: {
          task: {
            id: "t1",
            groupId: "br:main",
            schedule: "* * * * *",
            prompt: "test",
            enabled: true,
            createdAt: Date.now(),
          },
        },
        type: "task-created",
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("created");

      (globalThis as any).fetch = origFetch;
    });

    it("blocks update-task when groupId is in schedulerTriggeredGroups", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));
      o.schedulerTriggeredGroups.add("br:main");

      await handleWorkerMessage(o, fakeDb() as any, {
        payload: {
          task: {
            createdAt: Date.now(),
            enabled: true,
            groupId: "br:main",
            id: "t1",
            prompt: "updated",
            schedule: "* * * * *",
          },
        },
        type: "update-task",
      });

      expect(events).toHaveLength(0);
    });

    it("blocks delete-task when groupId is in schedulerTriggeredGroups", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));
      o.schedulerTriggeredGroups.add("br:main");

      await handleWorkerMessage(o, fakeDb() as any, {
        payload: { id: "t1", groupId: "br:main" },
        type: "delete-task",
      });

      expect(events).toHaveLength(0);
    });

    it("blocks send-notification when groupId is in schedulerTriggeredGroups", async () => {
      const o = new Orchestrator();

      o.schedulerTriggeredGroups.add("br:main");

      // Mock fetch to ensure it's NOT called
      const origFetch = (globalThis as any).fetch;
      const fetchSpy = jest.fn();

      (globalThis as any).fetch = fetchSpy;

      await handleWorkerMessage(o, fakeDb() as any, {
        type: "send-notification",
        payload: {
          body: "Hello",
          groupId: "br:main",
          title: "Test",
        },
      });

      expect(fetchSpy).not.toHaveBeenCalled();

      (globalThis as any).fetch = origFetch;
    });

    it("marks groupId as scheduled while running local scheduled tasks", async () => {
      const o = new Orchestrator();
      const runTaskSpy = jest
        .spyOn(orchestratorStore, "runTask")
        .mockResolvedValue(undefined);

      const task = {
        id: "t1",
        groupId: "br:main",
        prompt: "Hello",
        schedule: "* * * * *",
        enabled: true,
        createdAt: Date.now(),
        lastRun: null,
      };

      const before = o.schedulerTriggeredGroups.has(task.groupId);
      expect(before).toBe(false);

      await runTaskAsScheduled(o, task as any);

      expect(runTaskSpy).toHaveBeenCalledWith(task);
      expect(o.schedulerTriggeredGroups.has(task.groupId)).toBe(false);

      runTaskSpy.mockRestore();
    });
  });

  describe("HTTP-confirmed task operations", () => {
    // returns A minimal fake DB for handleWorkerMessage
    function fakeDb() {
      const fakeRequest: any = {
        onerror: null,
        onsuccess: null,
        result: undefined,
      };

      return {
        transaction: () => ({
          objectStore: () => ({
            get: () => {
              setTimeout(() => fakeRequest.onsuccess?.(), 0);

              return fakeRequest;
            },
            put: () => {
              setTimeout(() => fakeRequest.onsuccess?.(), 0);

              return fakeRequest;
            },
            delete: () => {
              setTimeout(() => fakeRequest.onsuccess?.(), 0);

              return fakeRequest;
            },
          }),
        }),
      };
    }

    const sampleTask: any = {
      createdAt: Date.now(),
      enabled: true,
      groupId: "br:main",
      id: "t1",
      prompt: "hello",
      schedule: "0 9 * * *",
    };

    it("delete-task removes from IndexedDB only after server 200", async () => {
      const o = new Orchestrator();
      o.taskServerEnabled = true;
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
      });

      await handleWorkerMessage(o, fakeDb() as any, {
        payload: { id: "t1", groupId: "br:main" },
        type: "delete-task",
      });

      expect((globalThis as any).fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/schedule\/tasks\/t1\?subscriberId=/),
        expect.objectContaining({ method: "DELETE" }),
      );

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: "deleted", id: "t1" });

      (globalThis as any).fetch = origFetch;
    });

    it("delete-task keeps task in view when server fails", async () => {
      const o = new Orchestrator();
      o.taskServerEnabled = true;
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await handleWorkerMessage(o, fakeDb() as any, {
        payload: { id: "t1", groupId: "br:main" },
        type: "delete-task",
      });

      // No task-change event — task stays in UI
      expect(events).toHaveLength(0);

      (globalThis as any).fetch = origFetch;
    });

    it("delete-task keeps task in view when server is unreachable", async () => {
      const o = new Orchestrator();
      o.taskServerEnabled = true;
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockRejectedValue(
        new Error("Network error"),
      );

      await handleWorkerMessage(o, fakeDb() as any, {
        payload: { id: "t1", groupId: "br:main" },
        type: "delete-task",
      });

      // No task-change event — task stays in UI
      expect(events).toHaveLength(0);

      (globalThis as any).fetch = origFetch;
    });

    it("task-created awaits server sync before saving to IndexedDB", async () => {
      const o = new Orchestrator();
      o.taskServerEnabled = true;
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
      });

      await handleWorkerMessage(o, fakeDb() as any, {
        payload: { task: sampleTask },
        type: "task-created",
      });

      expect((globalThis as any).fetch).toHaveBeenCalledWith(
        "/schedule/tasks",
        expect.objectContaining({ method: "POST" }),
      );

      expect(events).toHaveLength(1);

      expect(events[0].type).toBe("created");

      (globalThis as any).fetch = origFetch;
    });

    it("task-created does NOT save locally when server sync fails", async () => {
      const o = new Orchestrator();
      o.taskServerEnabled = true;
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await handleWorkerMessage(o, fakeDb() as any, {
        payload: { task: sampleTask },
        type: "task-created",
      });

      // Task NOT saved locally — no event fires
      expect(events).toHaveLength(0);

      (globalThis as any).fetch = origFetch;
    });

    it("update-task awaits server sync", async () => {
      const o = new Orchestrator();
      o.taskServerEnabled = true;
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
      });

      await handleWorkerMessage(o, fakeDb() as any, {
        payload: { task: { ...sampleTask, prompt: "updated" } },
        type: "update-task",
      });

      expect((globalThis as any).fetch).toHaveBeenCalledWith(
        "/schedule/tasks",
        expect.objectContaining({ method: "POST" }),
      );

      expect(events).toHaveLength(1);

      expect(events[0].type).toBe("updated");

      (globalThis as any).fetch = origFetch;
    });

    it("update-task does NOT save locally when server sync fails", async () => {
      const o = new Orchestrator();
      o.taskServerEnabled = true;
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await handleWorkerMessage(o, fakeDb() as any, {
        payload: { task: { ...sampleTask, prompt: "updated" } },
        type: "update-task",
      });

      // Task NOT saved locally — no event fires
      expect(events).toHaveLength(0);

      (globalThis as any).fetch = origFetch;
    });
  });

  describe("isScheduledTask flag logic", () => {
    it("schedulerTriggeredGroups determines isScheduledTask for a given groupId", () => {
      const o = new Orchestrator();

      o.schedulerTriggeredGroups.add("br:main");
      expect(o.schedulerTriggeredGroups.has("br:main")).toBe(true);
      expect(o.schedulerTriggeredGroups.has("br:other")).toBe(false);

      o.schedulerTriggeredGroups.delete("br:main");
      expect(o.schedulerTriggeredGroups.has("br:main")).toBe(false);
    });
  });

  describe("getters and setters and basic channel operations", () => {
    it("returns correct getters for basic properties", () => {
      const o = new Orchestrator();

      expect(getBedrockSettings(o)).toEqual({
        authMode: "provider_chain",
        profile: "",
        region: "",
      });

      expect(getChannelEnabled(o, "browser")).toBe(true);
      expect(getChannelEnabled(o, "telegram")).toBe(false);

      expect(getChannelEnabledConfigKey("telegram")).toBe(
        "channel_enabled:telegram",
      );

      expect(getChannelTypeForGroup(o, "non-existent")).toBe("browser");

      expect(o.contextCompressionEnabled).toBe(false);
      expect(o.gitProxyUrl).toBe("/git-proxy");

      expect(getIMessageConfig(o)).toEqual({
        apiKey: "",
        chatIds: [],
        enabled: false,
        serverUrl: "",
      });

      expect(getLlamafileSettings(o)).toEqual({
        mode: "cli",
        host: "127.0.0.1",
        port: 8080,
        offline: true,
      });

      expect({ host: o.meshLlmHost }).toEqual({ host: "" });
      expect(o.model).toBe(o.model);

      expect(getPeerJsConfig(o)).toEqual({
        enabled: false,
        myAlias: "",
        myPeerId: "",
        peerAliases: {},
        serverHost: "",
        serverPath: "",
        serverPort: 0,
        serverSecure: true,
        trustedPeerIds: [],
      });

      expect(o.provider).toBe("prompt_api");
      expect(o.proxyUrl).toBe("/proxy");

      expect(o.rateLimitAutoAdapt).toBe(true);
      expect(o.rateLimitCallsPerMinute).toBe(0);

      expect(getReasoningConfig(o)).toBeUndefined();
      o.reasoningEffort = "high";
      expect(getReasoningConfig(o)).toEqual({ effort: "high" });
      expect(o.reasoningEffort).toBe("high");

      expect(o.streamingEnabled).toBe(true);
      expect(o.taskServerUrl).toBe("/schedule");

      expect(getTelegramConfig(o)).toEqual({
        botToken: "",
        chatIds: [],
        enabled: false,
        useProxy: false,
      });

      expect(o.useProxy).toBe(false);
      expect(o.vmBashFullInternetAccess).toBe(false);
      expect(o.vmBootMode).toBe("disabled");

      expect(o.vmStatus).toEqual({
        ready: false,
        booting: false,
        bootAttempted: false,
        error: null,
      });

      expect(getWebMcpMode()).toBeDefined();
      expect(o.webMcpToolsEnabled).toBe(true);
    });

    it("applies channel running states properly", () => {
      const o = new Orchestrator();

      const browserSpy = jest.spyOn(o.browserChat, "start");
      const peerjsSpy = jest.spyOn(o.peerjs, "stop");

      applyChannelRunningState(o, "browser");
      expect(browserSpy).toHaveBeenCalled();

      applyChannelRunningState(o, "peerjs");
      expect(peerjsSpy).toHaveBeenCalled();

      const telegramSpy = jest.spyOn(o.telegram, "stop");
      const imessageSpy = jest.spyOn(o.imessage, "stop");

      applyAllChannelRunningStates(o);

      expect(browserSpy).toHaveBeenCalled(); // Should still be called (or called again)
      expect(telegramSpy).toHaveBeenCalled();
      expect(imessageSpy).toHaveBeenCalled();
      expect(peerjsSpy).toHaveBeenCalled();
    });

    it("returns null for unknown channel type", () => {
      const o = new Orchestrator();
      expect(getChannelByType(o, "unknown" as any)).toBeNull();
    });

    it("applies Llamafile and MeshLlm headers", () => {
      const o = new Orchestrator();

      // Mesh-llm
      o.providerConfig = { id: "mesh-llm" } as any;
      o.meshLlmHost = "localhost:5000";
      applyMeshLlmHeaders(o);
      expect(o.providerConfig.headers?.["x-mesh-llm-host"]).toBe(
        "localhost:5000",
      );

      // Llamafile
      o.providerConfig = { id: "llamafile" } as any;
      o.llamafileMode = "cli";
      o.llamafileHost = "127.0.0.1";
      o.llamafilePort = 8080;
      o.llamafileOffline = true;
      applyLlamafileHeaders(o);
      expect(o.providerConfig.headers?.["x-llamafile-mode"]).toBe("cli");
      expect(o.providerConfig.headers?.["x-llamafile-host"]).toBe("127.0.0.1");
      expect(o.providerConfig.headers?.["x-llamafile-port"]).toBe("8080");
      expect(o.providerConfig.headers?.["x-llamafile-offline"]).toBe("true");
    });

    it("clears peerjs typing state correctly", () => {
      const typingSpy = jest.spyOn(orchestratorStore, "setRemoteAgentTyping");

      clearPeerJsTypingState("group-1");
      expect(typingSpy).toHaveBeenCalledWith("group-1", false);
    });

    it("creates and clears provider request ids", () => {
      const o = new Orchestrator();
      o.provider = "llamafile";
      const id = o.createProviderRequestId("group-1");
      expect(id).toMatch(/^group-1:/);
      expect(o.inFlightProviderRequestIds.has("group-1")).toBe(true);

      o.clearProviderRequest("group-1");
      expect(o.inFlightProviderRequestIds.has("group-1")).toBe(false);

      // non-llamafile
      o.provider = "openrouter";
      const id2 = o.createProviderRequestId("group-1");
      expect(id2).toBe("");
    });

    it("creates, joins, and leaves rooms", () => {
      const o = new Orchestrator();
      const events: any[] = [];
      o.events.on("rooms-changed", (payload: any) => events.push(payload));

      const createSpy = jest
        .spyOn(o.roomManager, "createRoom")
        .mockReturnValue({ roomId: "room-1" } as any);
      const room = createRoom(o, "test-room");
      expect(createSpy).toHaveBeenCalledWith("test-room");
      expect(room.roomId).toBe("room-1");
      expect(events).toHaveLength(1);

      const joinSpy = jest
        .spyOn(o.roomManager, "joinRoom")
        .mockReturnValue({ roomId: "room-2" } as any);
      const room2 = joinRoomViaLink(o, "room-2", "host-1", "test-room-2");
      expect(joinSpy).toHaveBeenCalledWith("room-2", "host-1", "test-room-2");
      expect(room2.roomId).toBe("room-2");

      const leaveSpy = jest.spyOn(o.roomManager, "leaveRoom").mockReturnValue();
      leaveRoom(o, "room-2");
      expect(leaveSpy).toHaveBeenCalledWith("room-2");

      const inviteSpy = jest
        .spyOn(o.roomManager, "invite")
        .mockReturnValue(true);
      expect(inviteToRoom(o, "room-1", "peer-1")).toBe(true);
      expect(inviteSpy).toHaveBeenCalledWith("room-1", "peer-1");

      const listSpy = jest.spyOn(o.roomManager, "list").mockReturnValue([]);
      expect(listRooms(o)).toEqual([]);
      expect(listSpy).toHaveBeenCalled();
    });

    it("emits room invites", () => {
      const o = new Orchestrator();
      const events: any[] = [];
      o.events.on("room-invite", (payload: any) => events.push(payload));

      handleRoomInvite(o, {
        roomId: "room-1",
        inviterId: "peer-1",
        name: "room",
      } as any);
      expect(events).toHaveLength(1);
    });

    it("sends close terminal session messages", () => {
      const o = new Orchestrator();
      const postMessage = jest.fn();
      o.agentWorker = { postMessage } as any;

      closeTerminalSession(o, "group-1");
      expect(postMessage).toHaveBeenCalledWith({
        payload: { groupId: "group-1" },
        type: "vm-terminal-close",
      });
    });

    it("sends open terminal session messages", () => {
      const o = new Orchestrator();
      const postMessage = jest.fn();
      o.agentWorker = { postMessage } as any;

      openTerminalSession(o, "group-1");
      expect(postMessage).toHaveBeenCalledWith({
        payload: { groupId: "group-1" },
        type: "vm-terminal-open",
      });
    });

    it("sends terminal input messages", () => {
      const o = new Orchestrator();
      const postMessage = jest.fn();
      o.agentWorker = { postMessage } as any;

      sendTerminalInput(o, "ls -la");
      expect(postMessage).toHaveBeenCalledWith({
        payload: { data: "ls -la" },
        type: "vm-terminal-input",
      });
    });

    it("parses direct tool command", () => {
      const o = new Orchestrator();
      const result = parseDirectToolCommand(
        o.directToolCommandPolicy,
        o.assistantName,
        {
          id: "1",
          channel: "telegram",
          groupId: "tg:1",
          sender: "User",
          timestamp: Date.now(),
          content: "@assistant /hello",
        },
      );
      expect(result).toBeDefined();
    });

    it("sets state", () => {
      const o = new Orchestrator();
      const events: any[] = [];
      o.events.on("state-change", (payload: any) => events.push(payload));
      o.setState("thinking");
      expect(o.state).toBe("thinking");
      expect(events).toHaveLength(1);
    });

    it("resolves transformers status url", () => {
      const o = new Orchestrator();
      o.providerConfig = { baseUrl: "http://api/chat/completions" } as any;
      expect(getTransformersStatusUrl(o)).toBe("http://api/status");

      o.providerConfig = { baseUrl: "other" } as any;
      expect(getTransformersStatusUrl(o)).toBe(
        "http://localhost:8888/transformers-js-proxy/status",
      );
    });

    it("returns runtime headers for bedrock_proxy", () => {
      const o = new Orchestrator();
      o.bedrockRegionFallback = "us-east-1";
      o.bedrockProfileFallback = "default";
      o.bedrockAuthMode = "provider_chain";

      const headers = getProviderRuntimeHeaders(o, "bedrock_proxy");
      expect(headers["x-bedrock-region"]).toBe("us-east-1");
      expect(headers["x-bedrock-profile"]).toBe("default");
      expect(headers["x-bedrock-auth-mode"]).toBe("provider_chain");

      const overrideHeaders = getProviderRuntimeHeaders(
        o,
        "bedrock_proxy",
        "",
        {
          bedrock_proxy: {
            region: "us-west-2",
            profile: "other",
            authMode: "sso",
          },
        },
      );
      expect(overrideHeaders["x-bedrock-region"]).toBe("us-west-2");
      expect(overrideHeaders["x-bedrock-profile"]).toBe("other");
      expect(overrideHeaders["x-bedrock-auth-mode"]).toBe("sso");
    });

    it("returns runtime headers for llamafile", () => {
      const o = new Orchestrator();
      o.llamafileMode = "cli";
      o.llamafileHost = "127.0.0.1";
      o.llamafilePort = 8080;
      o.llamafileOffline = true;

      const headers = getProviderRuntimeHeaders(o, "llamafile", "req-1");
      expect(headers["x-llamafile-mode"]).toBe("cli");
      expect(headers["x-llamafile-host"]).toBe("127.0.0.1");
      expect(headers["x-llamafile-port"]).toBe("8080");
      expect(headers["x-llamafile-offline"]).toBe("true");
      expect(headers["x-shadowclaw-request-id"]).toBe("req-1");

      const overrideHeaders = getProviderRuntimeHeaders(o, "llamafile", "", {
        llamafile: {
          mode: "server",
          host: "192.168.1.1",
          port: 9090,
          offline: false,
        },
      });
      expect(overrideHeaders["x-llamafile-mode"]).toBe("server");
      expect(overrideHeaders["x-llamafile-host"]).toBe("192.168.1.1");
      expect(overrideHeaders["x-llamafile-port"]).toBe("9090");
      expect(overrideHeaders["x-llamafile-offline"]).toBe("false");
    });

    it("answers user prompt", () => {
      const o = new Orchestrator();
      const postMessage = jest.fn();
      o.agentWorker = { postMessage } as any;

      answerUserPrompt(o, "prompt-1", "yes");
      expect(postMessage).toHaveBeenCalledWith({
        payload: { id: "prompt-1", response: "yes" },
        type: "ask-user-response",
      });
    });

    it("shuts down cleanly", () => {
      const o = new Orchestrator();
      const stopAllSpy = jest.spyOn(o.channelRegistry, "stopAll");
      o.shutdown();
      expect(stopAllSpy).toHaveBeenCalled();
    });

    it("refreshContextUsage uses effective model context limit when group has pinned model", async () => {
      const o = new Orchestrator();
      const db = await o.init();

      // Create group first
      await createGroup(db, "Test Group", "", "group-pinned-usage");

      // Pin a model with a small context limit (Llama-3 model context limit is 8192)
      await updateGroupPinnedProvider(
        db,
        "group-pinned-usage",
        "transformers_js_local",
        "onnx-community/Llama-3.2-1B-Instruct-ONNX",
        1024,
      );

      let contextLimitResult = 0;
      o.events.on("context-usage", (e: any) => {
        contextLimitResult = e.contextLimit;
      });

      await o.refreshContextUsage(db, "group-pinned-usage");

      expect(contextLimitResult).toBe(8192); // context limit of Llama-3 model is 8192
    });
  });

  describe("init functionality", () => {
    it("calls all init tasks without throwing", async () => {
      const o = new Orchestrator();

      // The fake DB queues callbacks via setTimeout so that each IDB
      // operation resolves asynchronously. With parallel Promise.all reads,
      // multiple get() calls may be in-flight at once — each needs its own
      // request object so they don't stomp each other.
      const fakeDb = {
        transaction: () => ({
          objectStore: () => ({
            put: () => {
              const req: any = { onerror: null, onsuccess: null };
              setTimeout(() => req.onsuccess?.(), 0);
              return req;
            },
            delete: () => {
              const req: any = { onerror: null, onsuccess: null };
              setTimeout(() => req.onsuccess?.(), 0);
              return req;
            },
            get: (key: string) => {
              const req: any = {
                onerror: null,
                onsuccess: null,
                result: undefined,
              };
              setTimeout(() => {
                req.result = { value: key };
                req.onsuccess?.();
              }, 0);
              return req;
            },
          }),
        }),
      } as any;

      jest.spyOn(o.roomManager, "loadRooms").mockImplementation(() => {});
      jest.spyOn(o, "loadApiKeyForProvider").mockResolvedValue();
      jest.spyOn(o, "loadSecretConfig").mockResolvedValue("");

      const origWorker = (globalThis as any).Worker;
      if (!origWorker) {
        (globalThis as any).Worker = class {
          postMessage() {}
          terminate() {}
        };
      }

      await initCoreConfig(o, fakeDb);
      await initProviderAndModel(o, fakeDb);
      await initLlamafileAndMesh(o, fakeDb);
      await initFeatureFlagsAndLimits(o, fakeDb);
      await initChannelsAndRooms(o, fakeDb);
      await initWorkerAndScheduler(o, fakeDb);

      // shouldStartLocalScheduler() and fetchModelInfo are now background
      // void-promises. Flush the microtask queue a few ticks so their
      // .then() chains settle (they resolve via mockResolvedValue, not timers).
      await Promise.resolve();
      await Promise.resolve();

      expect(o.assistantName).toBeDefined();
      expect(o.triggerPattern).toBeDefined();

      if (!origWorker) {
        delete (globalThis as any).Worker;
      }
    });
  });

  describe("ensureAllConnections", () => {
    it("coordinates Control Plane, channels, task server, and scheduler", async () => {
      const o = new Orchestrator();
      const fakeDb = {} as unknown as ShadowClawDatabase;
      o.db = fakeDb;
      o.taskServerEnabled = true;

      const mockScheduler = {
        start: jest.fn(),
        tick: jest.fn().mockResolvedValue(undefined as never),
      };
      o.scheduler = mockScheduler as unknown as TaskScheduler;

      const ensureControlPlaneSpy = jest
        .spyOn(o, "ensureControlPlaneConnected")
        .mockResolvedValue(null as unknown as ControlPlaneClient);

      const peerjsEnsureSpy = jest.fn();
      (
        o.peerjs as unknown as { ensureConnected: (force?: boolean) => void }
      ).ensureConnected = peerjsEnsureSpy;
      o.peerjs.running = true;
      o.channelEnabledByType.peerjs = true;
      o.peerjsMyPeerId = "my-peer";

      const replaySpy = jest
        .spyOn(orchestratorStore, "replayTaskSyncOutbox")
        .mockResolvedValue();
      const loadTasksSpy = jest
        .spyOn(orchestratorStore, "loadTasks")
        .mockResolvedValue();

      await o.ensureAllConnections({ force: true });

      expect(ensureControlPlaneSpy).toHaveBeenCalledWith({
        orchestrator: o,
        db: fakeDb,
        force: true,
      });
      expect(peerjsEnsureSpy).toHaveBeenCalledWith(true);
      expect(replaySpy).toHaveBeenCalledWith(fakeDb);
      expect(loadTasksSpy).toHaveBeenCalledWith(fakeDb);
      expect(mockScheduler.start).toHaveBeenCalled();
      expect(mockScheduler.tick).toHaveBeenCalled();

      // Test with default options (force: false) and no taskServer / no scheduler
      o.taskServerEnabled = false;
      o.db = null;
      o.scheduler = null;
      await o.ensureAllConnections();
      expect(ensureControlPlaneSpy).toHaveBeenCalledWith({
        orchestrator: o,
        db: undefined,
        force: false,
      });

      // Test error handling in Control Plane and channel running states
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      ensureControlPlaneSpy.mockRejectedValueOnce(
        new Error("CP network failure"),
      );
      jest.spyOn(o.browserChat, "start").mockImplementationOnce(() => {
        throw new Error("Browser chat error");
      });

      await o.ensureAllConnections();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();

      ensureControlPlaneSpy.mockRestore();
      replaySpy.mockRestore();
      loadTasksSpy.mockRestore();
    });
  });

  describe("Orchestrator instance methods and lifecycle", () => {
    it("initializes room notification handler delegating to roomManager", () => {
      const o = new Orchestrator();
      const handleSpy = jest
        .spyOn(o.roomManager, "handleNotification")
        .mockImplementation(() => {});

      const peerChannel = o.peerjs as unknown as {
        _roomNotificationHandler?: (
          from: string,
          method: string,
          params: unknown,
        ) => void;
      };
      peerChannel._roomNotificationHandler?.("peer-sender", "room/ping", {
        data: 123,
      });

      expect(handleSpy).toHaveBeenCalledWith("peer-sender", "room/ping", {
        data: 123,
      });
    });

    it("initializes orchestrator via init() and sets database and listeners", async () => {
      const origWorker = globalThis.Worker;
      globalThis.Worker = class {
        postMessage() {}
        terminate() {}
        addEventListener() {}
        removeEventListener() {}
      } as unknown as typeof Worker;

      const o = new Orchestrator();
      jest.spyOn(o.roomManager, "loadRooms").mockImplementation(() => {});
      jest.spyOn(toolsStore, "load").mockResolvedValue(undefined);
      jest.spyOn(o, "loadApiKeyForProvider").mockResolvedValue();
      jest.spyOn(o, "loadSecretConfig").mockResolvedValue("");

      const readySpy = jest.fn();
      o.events.on("ready", readySpy);

      const db = await o.init();
      expect(db).toBeDefined();
      expect(o.db).toBe(db);
      expect(readySpy).toHaveBeenCalled();

      // Flush microtasks and tick timer for background channel setup
      await new Promise<void>((resolve) => setTimeout(resolve, 30));
      await o.browserChat.send("br:main", "test-display");

      if (!origWorker) {
        delete (globalThis as unknown as { Worker?: unknown }).Worker;
      } else {
        globalThis.Worker = origWorker;
      }
    });

    it("shuts down channels, scheduler, pollers, worker, and webMcp cleanup", () => {
      const o = new Orchestrator();
      const mockWorker = {
        terminate: jest.fn(),
        postMessage: jest.fn(),
      } as unknown as Worker;
      o.agentWorker = mockWorker;

      const mockScheduler = {
        stop: jest.fn(),
        start: jest.fn(),
        tick: jest.fn(),
      } as unknown as TaskScheduler;
      o.scheduler = mockScheduler;

      const mockCleanup = jest.fn();
      o.webMcpEffectCleanup = mockCleanup;

      o.transformersProgressPollers.set("group-poll-1", 123);

      o.shutdown();

      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(mockScheduler.stop).toHaveBeenCalled();
      expect(mockCleanup).toHaveBeenCalled();
      expect(o.transformersProgressPollers.size).toBe(0);
    });

    it("manages provider request IDs for llamafile vs other providers", () => {
      const o = new Orchestrator();
      o.provider = "openrouter";
      expect(o.createProviderRequestId("group-1")).toBe("");

      o.provider = "llamafile";
      const reqId = o.createProviderRequestId("group-llama");
      expect(reqId).toContain("group-llama:");
      expect(o.inFlightProviderRequestIds.get("group-llama")).toBe(reqId);

      o.clearProviderRequest("group-llama");
      expect(o.inFlightProviderRequestIds.has("group-llama")).toBe(false);
    });

    it("manages state transitions, submitMessage, and stopCurrentRequest across providers", () => {
      const o = new Orchestrator();
      const stateSpy = jest.fn();
      o.events.on("state-change", stateSpy);

      o.setState("thinking", "group-state");
      expect(o.state).toBe("thinking");
      expect(stateSpy).toHaveBeenCalledWith({
        state: "thinking",
        groupId: "group-state",
      });

      const submitSpy = jest
        .spyOn(o.browserChat, "submit")
        .mockImplementation(() => {});
      o.submitMessage("Hello from user", "group-submit");
      expect(submitSpy).toHaveBeenCalledWith("Hello from user", "group-submit");
      o.submitMessage("Default message");
      expect(submitSpy).toHaveBeenCalledWith("Default message", "br:main");

      // Early return when not thinking or responding
      o.state = "idle";
      o.stopCurrentRequest("group-idle");
      o.stopCurrentRequest();

      // Stop current request with llamafile, promptController, and agentWorker
      o.state = "thinking";
      o.provider = "llamafile";
      o.inFlightProviderRequestIds.set("group-stop", "req-stop-1");
      const mockAbort = jest.fn();
      o.promptControllers.set("group-stop", {
        abort: mockAbort,
      } as unknown as AbortController);
      o.inFlightTriggerByGroup.set("group-stop", "trigger-content");
      o.inFlightEffectiveProviderByGroup.set("group-stop", {
        providerId: "llamafile",
        providerConfig: o.providerConfig,
        model: "model",
      });

      const mockWorker = {
        postMessage: jest.fn(),
        terminate: jest.fn(),
      } as unknown as Worker;
      o.agentWorker = mockWorker;

      o.stopCurrentRequest("group-stop");

      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: "cancel",
        payload: { groupId: "group-stop" },
      });
      expect(mockAbort).toHaveBeenCalled();
      expect(o.inFlightTriggerByGroup.has("group-stop")).toBe(false);
      expect(o.inFlightEffectiveProviderByGroup.has("group-stop")).toBe(false);
      expect(o.state).toBe("idle");

      // Stop current request when responding with non-llamafile
      o.state = "responding";
      o.provider = "anthropic";
      o.stopCurrentRequest("group-resp");
      expect(o.state).toBe("idle");
    });

    it("handles API key retrieval, caching, setting, and decryption failure", async () => {
      const o = new Orchestrator();
      const db = await openDatabase();

      // No encrypted key returns null
      expect(await o.getApiKey()).toBeNull();

      // Set key and retrieve (first call decrypts, second hits cache)
      await o.setApiKey(db, "sk-test-secret-key-1");
      const key1 = await o.getApiKey();
      expect(key1).toBe("sk-test-secret-key-1");

      const key2 = await o.getApiKey();
      expect(key2).toBe("sk-test-secret-key-1");

      // setApiKey throws when encryptValue returns null
      indexedDB.deleteDatabase("shadowclaw-keystore");
      mockSubtle.generateKey.mockResolvedValue(null as unknown as CryptoKey);
      await expect(o.setApiKey(db, "bad-key")).rejects.toThrow(
        "key failed to encrypt",
      );
      mockSubtle.generateKey.mockResolvedValue({ type: "secret" });
      await resetKeystore();

      // Decryption failure caught and returns null
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      await o.setApiKey(db, "key-to-fail");
      mockSubtle.decrypt.mockRejectedValueOnce(new Error("Decryption error"));
      const failedKey = await o.getApiKey();
      expect(failedKey).toBeNull();
      errSpy.mockRestore();

      // Decryption returns null when decryptValue returns null
      indexedDB.deleteDatabase("shadowclaw-keystore");
      mockSubtle.generateKey.mockResolvedValueOnce(
        null as unknown as CryptoKey,
      );
      const nullKey = await o.getApiKey();
      expect(nullKey).toBeNull();
      await resetKeystore();
    });

    it("gets API key for specific provider with openrouter legacy fallback and error handling", async () => {
      const o = new Orchestrator();
      const db = await openDatabase();

      // Provider key exists
      const encAnthropic = await encryptValue("sk-anthropic-specific");
      await setConfig(
        db,
        getProviderApiKeyConfigKey("anthropic"),
        encAnthropic,
      );
      expect(await o.getApiKeyForSpecificProvider(db, "anthropic")).toBe(
        "sk-anthropic-specific",
      );

      // OpenRouter legacy fallback
      await setConfig(db, getProviderApiKeyConfigKey("openrouter"), "");
      const encLegacy = await encryptValue("sk-openrouter-legacy");
      await setConfig(db, CONFIG_KEYS.API_KEY, encLegacy);
      expect(await o.getApiKeyForSpecificProvider(db, "openrouter")).toBe(
        "sk-openrouter-legacy",
      );

      // OpenRouter with empty key and empty legacy key
      await setConfig(db, getProviderApiKeyConfigKey("openrouter"), "");
      await setConfig(db, CONFIG_KEYS.API_KEY, "");
      expect(await o.getApiKeyForSpecificProvider(db, "openrouter")).toBe("");

      // Decrypted empty string returns empty string
      const encVal = await encryptValue("val");
      await setConfig(db, getProviderApiKeyConfigKey("openrouter"), encVal);
      mockSubtle.decrypt.mockResolvedValueOnce(new Uint8Array(0).buffer);
      expect(await o.getApiKeyForSpecificProvider(db, "openrouter")).toBe("");

      // Missing key returns empty string
      expect(await o.getApiKeyForSpecificProvider(db, "nonexistent")).toBe("");

      // Decryption failure caught and returns empty string
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockSubtle.decrypt.mockRejectedValueOnce(new Error("Bad cipher"));
      expect(await o.getApiKeyForSpecificProvider(db, "openrouter")).toBe("");
      errSpy.mockRestore();
    });

    it("loads API key for provider with legacy migration and missing key handling", async () => {
      const o = new Orchestrator();
      const db = await openDatabase();

      // Direct key exists
      const encDirect = await encryptValue("sk-direct-key");
      await setConfig(
        db,
        getProviderApiKeyConfigKey("bedrock_proxy"),
        encDirect,
      );
      await o.loadApiKeyForProvider(db, "bedrock_proxy");
      expect(await o.getApiKey()).toBe("sk-direct-key");

      // OpenRouter with legacy key migration
      await setConfig(db, getProviderApiKeyConfigKey("openrouter"), "");
      const encLegacy = await encryptValue("sk-migrated-openrouter");
      await setConfig(db, CONFIG_KEYS.API_KEY, encLegacy);
      await o.loadApiKeyForProvider(db, "openrouter");
      expect(await o.getApiKey()).toBe("sk-migrated-openrouter");
      expect(
        await getConfig(db, getProviderApiKeyConfigKey("openrouter")),
      ).toBe(encLegacy);

      // OpenRouter with missing key and missing legacy key
      await setConfig(db, getProviderApiKeyConfigKey("openrouter"), "");
      await setConfig(db, CONFIG_KEYS.API_KEY, "");
      await o.loadApiKeyForProvider(db, "openrouter");
      expect(await o.getApiKey()).toBeNull();

      // Missing key clears internal key
      await o.loadApiKeyForProvider(db, "missing-provider");
      expect(await o.getApiKey()).toBeNull();
    });

    it("loads and saves secret config with auto-migration and error handling", async () => {
      const o = new Orchestrator();
      const db = await openDatabase();

      // Empty value clears secret
      await o.saveSecretConfig(db, "empty_secret", "");
      expect(await getConfig(db, "empty_secret")).toBe("");
      expect(await o.loadSecretConfig(db, "empty_secret")).toBe("");

      // Non-empty value encrypted and decrypted
      await o.saveSecretConfig(db, "my_secret", "secret-content-xyz");
      const storedEncrypted = await getConfig(db, "my_secret");
      expect(storedEncrypted).not.toBe("secret-content-xyz");
      expect(await o.loadSecretConfig(db, "my_secret")).toBe(
        "secret-content-xyz",
      );

      // Decrypted empty string returns empty string
      const encEmptyCipher = await encryptValue("val-empty");
      await setConfig(db, "empty_cipher_secret", encEmptyCipher);
      mockSubtle.decrypt.mockResolvedValueOnce(new Uint8Array(0).buffer);
      expect(await o.loadSecretConfig(db, "empty_cipher_secret")).toBe("");

      // Auto-encrypt migration for plaintext value
      await setConfig(db, "legacy_plaintext", "raw-secret-value");
      const migrated = await o.loadSecretConfig(db, "legacy_plaintext");
      expect(migrated).toBe("raw-secret-value");
      const newEncrypted = await getConfig(db, "legacy_plaintext");
      expect(newEncrypted).not.toBe("raw-secret-value");

      // Auto-encrypt migration where encryptValue returns null
      const encTemp = await encryptValue("plain-text-val");
      await setConfig(db, "unencrypted-secret-fail", encTemp);
      mockSubtle.decrypt.mockImplementationOnce(async () => {
        indexedDB.deleteDatabase("shadowclaw-keystore");
        mockSubtle.generateKey.mockResolvedValue(null as unknown as CryptoKey);
        throw new Error("bad decrypt");
      });
      expect(await o.loadSecretConfig(db, "unencrypted-secret-fail")).toBe(
        encTemp,
      );
      mockSubtle.generateKey.mockResolvedValue({ type: "secret" });
      await resetKeystore();

      // saveSecretConfig throws when encryptValue returns null
      indexedDB.deleteDatabase("shadowclaw-keystore");
      mockSubtle.generateKey.mockResolvedValueOnce(
        null as unknown as CryptoKey,
      );
      await expect(
        o.saveSecretConfig(db, "fail_secret", "val"),
      ).rejects.toThrow("Failed to encrypt secret config");
      mockSubtle.generateKey.mockResolvedValue({ type: "secret" });
      await resetKeystore();
    });

    it("handles compaction and new session lifecycle", async () => {
      const o = new Orchestrator();
      const db = await openDatabase();

      const compactSpy = jest.fn();
      const typingSpy = jest.fn();
      o.events.on("context-compacted", compactSpy);
      o.events.on("typing", typingSpy);

      await o.handleCompactDone(db, "group-compact", "Compacted chat history");
      expect(compactSpy).toHaveBeenCalledWith({
        groupId: "group-compact",
        summary: "Compacted chat history",
      });
      expect(typingSpy).toHaveBeenCalledWith({
        groupId: "group-compact",
        typing: false,
      });
      expect(o.state).toBe("idle");

      const sessionSpy = jest.fn();
      o.events.on("session-reset", sessionSpy);
      await o.newSession(db, "group-session");
      expect(sessionSpy).toHaveBeenCalledWith({ groupId: "group-session" });

      // newSession with default groupId
      await o.newSession(db);
      expect(sessionSpy).toHaveBeenCalledWith({ groupId: "br:main" });
    });

    it("restarts current request when active or returns false when inactive", async () => {
      const o = new Orchestrator();

      // State is idle (also testing default groupId)
      o.state = "idle";
      expect(await o.restartCurrentRequest("g-restart")).toBe(false);
      expect(await o.restartCurrentRequest()).toBe(false);

      // State is thinking but db is null
      o.state = "thinking";
      o.db = null;
      expect(await o.restartCurrentRequest("g-restart")).toBe(false);

      // Db present but no in-flight trigger
      const db = await openDatabase();
      o.db = db;
      expect(await o.restartCurrentRequest("g-restart")).toBe(false);

      // Active request restarted
      o.state = "thinking";
      o.inFlightTriggerByGroup.set("g-restart", "Original prompt");
      o.agentWorker = {
        postMessage: jest.fn(),
        terminate: jest.fn(),
      } as unknown as Worker;

      const stopSpy = jest.spyOn(o, "stopCurrentRequest");
      const restarted = await o.restartCurrentRequest("g-restart");
      expect(restarted).toBe(true);
      expect(stopSpy).toHaveBeenCalledWith("g-restart");
    });

    it("routes room A2UI actions to local enqueue or remote broadcast", async () => {
      const o = new Orchestrator();
      const action: A2UIAction = {
        type: "a2ui-action",
        actionId: "act-1",
        surfaceId: "surf-1",
        dataModel: { val: 42 },
      };

      // Local surface with no db returns early
      o.db = null;
      await o.routeRoomA2UIAction("room:room-local", action);
      expect(o.messageQueue).toHaveLength(0);

      // Local surface with db enqueues action
      const db = await openDatabase();
      o.db = db;
      o.peerjsMyPeerId = "peer-local";
      o.peerjs.myPeerId = "peer-local";
      jest
        .spyOn(o.roomManager, "getSurfaceOwner")
        .mockReturnValue("peer-local");

      await o.routeRoomA2UIAction("room:room-local", action);
      expect(o.messageQueue.length).toBeGreaterThanOrEqual(1);

      // Local surface with missing alias and peer id defaults sender to "you"
      o.peerjsMyAlias = "";
      o.peerjs.myPeerId = "";
      o.peerjsMyPeerId = "";
      jest.spyOn(o.roomManager, "getSurfaceOwner").mockReturnValue("");
      await o.routeRoomA2UIAction("room:room-local-you", action);
      expect(o.messageQueue[o.messageQueue.length - 1].sender).toBe("you");

      // Remote surface broadcasts action to room mesh
      jest
        .spyOn(o.roomManager, "getSurfaceOwner")
        .mockReturnValue("peer-remote-99");
      const broadcastSpy = jest
        .spyOn(o.roomManager, "broadcastA2UIAction")
        .mockImplementation(() => null);

      await o.routeRoomA2UIAction("room:room-remote", action);
      expect(broadcastSpy).toHaveBeenCalledWith("room-remote", action);
    });

    it("refreshes context usage across group pinned models, prompt_api fallbacks, and tokenUsage blending", async () => {
      const o = new Orchestrator();
      const db = await openDatabase();
      o.db = db;

      const contextSpy = jest.fn();
      o.events.on("context-usage", contextSpy);

      // Groups with pinnedProvider, pinnedModel, pinnedMaxTokens, and prompt_api
      await saveGroupMetadata(db, [
        {
          groupId: "group-pinned-model",
          name: "Pinned Group",
          createdAt: Date.now(),
          pinnedProvider: "openrouter",
          pinnedModel: "anthropic/claude-3-5-sonnet",
          pinnedMaxTokens: 4096,
        },
        {
          groupId: "group-provider-default-model",
          name: "Provider Default Model",
          createdAt: Date.now(),
          pinnedProvider: "anthropic",
        },
        {
          groupId: "group-unknown-provider",
          name: "Unknown Provider",
          createdAt: Date.now(),
          pinnedProvider: "unknown_xyz_provider",
        },
        {
          groupId: "group-prompt-api",
          name: "Prompt API Group",
          createdAt: Date.now(),
          pinnedProvider: "prompt_api",
          pinnedModel: "browser-built-in",
        },
        {
          groupId: "group-prompt-api-default",
          name: "Prompt API Default Fallback",
          createdAt: Date.now(),
          pinnedProvider: "prompt_api",
          pinnedModel: "",
        },
      ]);

      // Token usage blending via orchestratorStore
      const usageSpy = jest
        .spyOn(orchestratorStore, "tokenUsage", "get")
        .mockReturnValue({
          inputTokens: 600,
          cacheReadTokens: 150,
          outputTokens: 250,
          totalTokens: 1000,
          cacheCreationTokens: 0,
          contextLimit: 4096,
          groupId: "group-pinned-model",
        });

      await o.refreshContextUsage(db, "group-pinned-model");
      expect(contextSpy).toHaveBeenCalled();
      usageSpy.mockRestore();

      // Token usage blending with falsy/zero values
      const usageZeroSpy = jest
        .spyOn(orchestratorStore, "tokenUsage", "get")
        .mockReturnValue({
          inputTokens: 0,
          cacheReadTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cacheCreationTokens: 0,
          contextLimit: 4096,
          groupId: "group-provider-default-model",
        });

      await o.refreshContextUsage(db, "group-provider-default-model");
      expect(contextSpy).toHaveBeenCalled();
      usageZeroSpy.mockRestore();

      // Provider default model lookup when pinnedProvider has no pinnedModel
      await o.refreshContextUsage(db, "group-provider-default-model");
      // Unknown provider fallback to this.model
      await o.refreshContextUsage(db, "group-unknown-provider");

      // Active tools undefined fallback to 0 tokens
      const toolsSpy = jest
        .spyOn(toolsStore, "enabledTools", "get")
        .mockReturnValue(undefined as unknown as ToolDefinition[]);
      await o.refreshContextUsage(db, "group-provider-default-model");
      toolsSpy.mockRestore();

      // Default groupId argument
      await o.refreshContextUsage(db);

      const savedLm = (globalThis as Record<string, unknown>).LanguageModel;
      const savedWinLm = (window as unknown as Record<string, unknown>)
        .LanguageModel;
      (globalThis as Record<string, unknown>).LanguageModel = undefined;
      (window as unknown as Record<string, unknown>).LanguageModel = undefined;

      // Configured fallback model for prompt_api
      await setConfig(
        db,
        CONFIG_KEYS.PROMPT_API_FALLBACK_MODEL,
        "custom-prompt-fallback",
      );
      await o.refreshContextUsage(db, "group-prompt-api");
      expect(contextSpy).toHaveBeenCalled();

      // Default fallback model for prompt_api when configuredFallback is empty
      await setConfig(db, CONFIG_KEYS.PROMPT_API_FALLBACK_MODEL, "");
      await o.refreshContextUsage(db, "group-prompt-api-default");
      expect(contextSpy).toHaveBeenCalled();

      // Prompt API fallback when this.provider === "prompt_api" and group has no pinned provider
      o.provider = "prompt_api";
      o.model = "";
      await o.refreshContextUsage(db, "group-unknown");
      expect(contextSpy).toHaveBeenCalled();

      if (savedLm !== undefined) {
        (globalThis as Record<string, unknown>).LanguageModel = savedLm;
      }
      if (savedWinLm !== undefined) {
        (window as unknown as Record<string, unknown>).LanguageModel =
          savedWinLm;
      }
    });

    it("handles saveSecretConfig encryption failure", async () => {
      const o = new Orchestrator();
      const db = await openDatabase();
      indexedDB.deleteDatabase("shadowclaw-keystore");
      mockSubtle.generateKey.mockResolvedValue(null as unknown as CryptoKey);
      await expect(
        o.saveSecretConfig(db, "secret-key", "secret-value"),
      ).rejects.toThrow("Failed to encrypt secret config");
      mockSubtle.generateKey.mockResolvedValue({ type: "secret" });
      await resetKeystore();
    });
  });
});
