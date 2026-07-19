import { jest } from "@jest/globals";

import { ASSISTANT_NAME, LLAMAFILE_PROXY_URL } from "../../config/config.js";
import { Orchestrator } from "./orchestrator.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { toolsStore } from "../../stores/tools.js";
import { buildSystemPrompt } from "../../worker/utils/system-prompt.js";

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

    expect(o.getState()).toBe("idle");
    expect(typeof o.getAssistantName()).toBe("string");
    expect(Array.isArray(o.getAvailableProviders())).toBe(true);
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
    expect(o.getState()).toBe("thinking");
  });

  it("throws for unknown provider", async () => {
    const o = new Orchestrator();

    await expect(o.setProvider({} as any, "not-a-provider")).rejects.toThrow(
      "Unknown provider",
    );
  });

  it("emits provider-help when queue processing lacks an API key", async () => {
    const o = new Orchestrator();
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

    await o.processQueue({} as any);

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

    await o.handleWorkerMessage(fakeDb, {
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

    await o.handleWorkerMessage({} as any, {
      payload: { groupId: "g1", path: "a.txt" },
      type: "open-file",
    });

    expect(events).toEqual([{ groupId: "g1", path: "a.txt" }]);
  });

  it("does not set remote agent responding status for inbound peer messages", () => {
    const o = new Orchestrator();
    const statusSpy = jest.spyOn(orchestratorStore, "setRemoteAgentStatus");
    const typingSpy = jest.spyOn(orchestratorStore, "setRemoteAgentTyping");

    (o as any).clearPeerJsTypingState?.("peer:remote-peer");

    expect(statusSpy).not.toHaveBeenCalled();
    expect(typingSpy).toHaveBeenCalledWith("peer:remote-peer", false);
  });

  it("tracks vm status from worker messages", async () => {
    const o = new Orchestrator();
    const events: any[] = [];

    o.events.on("vm-status", (payload: any) => events.push(payload));

    await o.handleWorkerMessage({} as any, {
      payload: {
        bootAttempted: true,
        booting: false,
        error: null,
        mode: "9p",
        ready: true,
      },
      type: "vm-status",
    });

    expect(o.getVMStatus()).toEqual({
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

    await o.handleWorkerMessage({} as any, {
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
    await o.handleWorkerMessage(db, {
      type: "manage-tools",
      payload: { action: "activate_profile", profileId: "git-ops" },
    });

    expect(activateProfileSpy).toHaveBeenCalledWith(db, "git-ops");

    // Test enable
    await o.handleWorkerMessage(db, {
      type: "manage-tools",
      payload: { action: "enable", toolNames: ["git_add"] },
    });

    expect(setToolEnabledSpy).toHaveBeenCalledWith(db, "git_add", true);

    // Test disable
    await o.handleWorkerMessage(db, {
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
    o.syncTerminalWorkspace("g1");

    expect(postMessage).toHaveBeenCalledWith({
      payload: { groupId: "g1" },
      type: "vm-workspace-sync",
    });
  });

  it("posts manual vm-to-host flush requests", () => {
    const o = new Orchestrator();
    const postMessage = jest.fn();

    o.agentWorker = { postMessage } as any;
    o.flushTerminalWorkspace("g1");

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

    expect(o.getVMBootMode()).toBe("disabled");

    o.vmBootMode = "9p";

    expect(o.getVMBootMode()).toBe("9p");
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

    await o.handleWorkerMessage(fakeDb, {
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
    expect(o.getState()).toBe("thinking");
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

    await o.deliverIntermediateResponse(
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

    await o.enqueue(fakeDb, {
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

    await o.enqueue(fakeDb, {
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

    await o.enqueue(fakeDb, {
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

    await o.enqueue(fakeDb, {
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
    await o.enqueue(fakeDb, {
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

    await o.enqueue(fakeDb, {
      channel: CHANNEL_TELEGRAM,
      content: "@example - /clear_chat",
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

    await o.enqueue(fakeDb, {
      channel: CHANNEL_IMESSAGE,
      content: `@example /show_toast '{"message":"it works","duration":10}'`,
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

    await o.deliverResponse(fakeDb, "tg:123", "hello telegram");
    await o.deliverResponse(fakeDb, "im:chat-1", "hello imessage");

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

      await o.warnIfNoPushSubscription();
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

      await o.warnIfNoPushSubscription();

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

      await o.warnIfNoPushSubscription();
      expect(o.pushSubscriptionWarned).toBe(true);

      mockGetSubscription.mockClear();
      await o.warnIfNoPushSubscription();

      // Should not call getSubscription again
      expect(mockGetSubscription).not.toHaveBeenCalled();
    });

    it("tolerates missing navigator.serviceWorker", async () => {
      const o = new Orchestrator();

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: undefined,
      });

      await o.warnIfNoPushSubscription();
      expect(o.pushSubscriptionWarned).toBe(false);
    });

    it("starts local scheduler when push subscription is missing", async () => {
      const o = new Orchestrator();
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

      const shouldStart = await o.shouldStartLocalScheduler();
      expect(shouldStart).toBe(true);
    });

    it("does not start local scheduler when push subscription exists", async () => {
      const o = new Orchestrator();
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

      const shouldStart = await o.shouldStartLocalScheduler();
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

      await o.handleWorkerMessage(fakeDb() as any, {
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

      await o.handleWorkerMessage(fakeDb() as any, {
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

      await o.handleWorkerMessage(fakeDb() as any, {
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

      await o.handleWorkerMessage(fakeDb() as any, {
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

      await o.handleWorkerMessage(fakeDb() as any, {
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

      await o.runTaskAsScheduled(task as any);

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
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
        payload: { id: "t1", groupId: "br:main" },
        type: "delete-task",
      });

      expect((globalThis as any).fetch).toHaveBeenCalledWith(
        "/schedule/tasks/t1",
        expect.objectContaining({ method: "DELETE" }),
      );

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: "deleted", id: "t1" });

      (globalThis as any).fetch = origFetch;
    });

    it("delete-task keeps task in view when server fails", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
        payload: { id: "t1", groupId: "br:main" },
        type: "delete-task",
      });

      // No task-change event — task stays in UI
      expect(events).toHaveLength(0);

      (globalThis as any).fetch = origFetch;
    });

    it("delete-task keeps task in view when server is unreachable", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockRejectedValue(
        new Error("Network error"),
      );

      await o.handleWorkerMessage(fakeDb() as any, {
        payload: { id: "t1", groupId: "br:main" },
        type: "delete-task",
      });

      // No task-change event — task stays in UI
      expect(events).toHaveLength(0);

      (globalThis as any).fetch = origFetch;
    });

    it("task-created awaits server sync before saving to IndexedDB", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
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
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
        payload: { task: sampleTask },
        type: "task-created",
      });

      // Task NOT saved locally — no event fires
      expect(events).toHaveLength(0);

      (globalThis as any).fetch = origFetch;
    });

    it("update-task awaits server sync", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
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
      const events: any[] = [];

      o.events.on("task-change", (e: any) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
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
});
