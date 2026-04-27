import { jest } from "@jest/globals";

import { Orchestrator, buildSystemPrompt } from "./orchestrator.js";

describe("buildSystemPrompt", () => {
  it("includes patch_file in tool usage strategy", () => {
    const prompt = buildSystemPrompt("TestAgent", "");

    expect(prompt).toContain("patch_file");
    expect(prompt).toMatch(/patch_file.*targeted|surgical|partial/i);
  });

  it("includes fetch_url git auth guidance", () => {
    const prompt = buildSystemPrompt("TestAgent", "");

    expect(prompt).toContain("fetch_url");
    expect(prompt).toContain("use_git_auth");
  });

  it("includes fetch_url account auth guidance", () => {
    const prompt = buildSystemPrompt("TestAgent", "");

    expect(prompt).toContain("use_account_auth");
    expect(prompt).toContain("Settings → Accounts");
  });

  it("prefers markdown file references for attachments", () => {
    const prompt = buildSystemPrompt("TestAgent", "");

    expect(prompt).toContain("markdown references to the file path");
    expect(prompt).toContain("![alt](path/to/image.png)");
    expect(prompt).toContain("[report.pdf](path/to/report.pdf)");
  });

  it("restricts open_file to explicit viewer requests", () => {
    const prompt = buildSystemPrompt("TestAgent", "");

    expect(prompt).toContain("Do not use open_file to attach or send files");
    expect(prompt).toContain("explicitly asks to open/view");
  });
});

describe("Orchestrator", () => {
  it("initializes defaults", () => {
    const o = new Orchestrator();

    expect(o.getState()).toBe("idle");

    expect(typeof o.getAssistantName()).toBe("string");

    expect(Array.isArray(o.getAvailableProviders())).toBe(true);
    expect(o.channelRegistry.getChannelType("tg:123")).toBe("telegram");
    expect(o.channelRegistry.getChannelType("im:chat-1")).toBe("imessage");
  });

  it("setState emits state-change event", () => {
    const o = new Orchestrator();
    const events: any[] = [];

    o.events.on("state-change", (state) => events.push(state));

    o.setState("thinking");

    expect(events).toEqual(["thinking"]);

    expect(o.getState()).toBe("thinking");
  });

  it("throws for unknown provider", async () => {
    const o = new Orchestrator();

    await expect(o.setProvider({} as any, "not-a-provider")).rejects.toThrow(
      "Unknown provider",
    );
  });

  it("emits open-file event from worker message", async () => {
    const o = new Orchestrator();
    const events: any[] = [];

    o.events.on("open-file", (payload) => events.push(payload));

    await o.handleWorkerMessage({} as any, {
      type: "open-file",
      payload: { groupId: "g1", path: "a.txt" },
    });

    expect(events).toEqual([{ groupId: "g1", path: "a.txt" }]);
  });

  it("tracks vm status from worker messages", async () => {
    const o = new Orchestrator();
    const events: any[] = [];

    o.events.on("vm-status", (payload) => events.push(payload));

    await o.handleWorkerMessage({} as any, {
      type: "vm-status",
      payload: {
        ready: true,
        booting: false,
        bootAttempted: true,
        mode: "9p",
        error: null,
      },
    });

    expect(o.getVMStatus()).toEqual({
      ready: true,
      booting: false,
      bootAttempted: true,
      mode: "9p",
      error: null,
    });

    expect(events).toHaveLength(1);
  });

  it("emits model download progress from worker message", async () => {
    const o = new Orchestrator();
    const events: any[] = [];

    o.events.on("model-download-progress", (payload) => events.push(payload));

    await o.handleWorkerMessage({} as any, {
      type: "model-download-progress",
      payload: {
        groupId: "g1",
        status: "running",
        progress: 0.42,
        message: "Downloading Prompt API model... 42%",
      },
    });

    expect(events).toEqual([
      {
        groupId: "g1",
        status: "running",
        progress: 0.42,
        message: "Downloading Prompt API model... 42%",
      },
    ]);
  });

  it("posts silent host-to-vm sync requests", () => {
    const o = new Orchestrator();
    const postMessage = jest.fn();

    o.agentWorker = { postMessage } as any;
    o.syncTerminalWorkspace("g1");

    expect(postMessage).toHaveBeenCalledWith({
      type: "vm-workspace-sync",
      payload: { groupId: "g1" },
    });
  });

  it("posts manual vm-to-host flush requests", () => {
    const o = new Orchestrator();
    const postMessage = jest.fn();

    o.agentWorker = { postMessage } as any;
    o.flushTerminalWorkspace("g1");

    expect(postMessage).toHaveBeenCalledWith({
      type: "vm-workspace-flush",
      payload: { groupId: "g1" },
    });
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
    const stateEvents: any[] = [];
    const routerSend = jest.fn<any>().mockResolvedValue(undefined);

    o.router = {
      send: routerSend,
      setTyping: jest.fn(),
    } as any;

    o.events.on("message", (msg) => messageEvents.push(msg));

    o.events.on("state-change", (state) => stateEvents.push(state));

    // Start in "thinking" state (as it would be during a tool-use loop)
    o.setState("thinking");
    stateEvents.length = 0; // clear the state-change from setUp

    // Create a fake db that satisfies saveMessage → txPromise
    const fakeRequest: any = {
      onsuccess: null,
      onerror: null,
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
      onsuccess: null,
      onerror: null,
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
      onsuccess: null,
      onerror: null,
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
      id: "msg-1",
      groupId: "br:01JNVWXYZ0000000000000000",
      sender: "You",
      content: "Hello",
      timestamp: Date.now(),
      channel: "browser",
    });

    expect(o.messageQueue).toHaveLength(1);
    expect(o.messageQueue[0].groupId).toBe("br:01JNVWXYZ0000000000000000");

    // Message from the default browser group should also be queued

    await o.enqueue(fakeDb, {
      id: "msg-2",
      groupId: "br:main",
      sender: "You",
      content: "Hi",
      timestamp: Date.now(),
      channel: "browser",
    });

    expect(o.messageQueue).toHaveLength(2);
  });

  it("enqueue does not queue non-browser messages without trigger word", async () => {
    const o = new Orchestrator();

    const fakeRequest: any = {
      onsuccess: null,
      onerror: null,
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
      id: "msg-3",
      groupId: "ext:some-channel",
      sender: "User",
      content: "Hello",
      timestamp: Date.now(),
      channel: "external",
    });

    // Should NOT be queued (no trigger word, not browser channel)
    expect(o.messageQueue).toHaveLength(0);
  });

  it("enqueue auto-queues iMessage messages without trigger word", async () => {
    const o = new Orchestrator();

    const fakeRequest: any = {
      onsuccess: null,
      onerror: null,
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
      id: "msg-4",
      groupId: "im:chat-1",
      sender: "Alex",
      content: "hello from phone",
      timestamp: Date.now(),
      channel: "imessage",
    });

    expect(o.messageQueue).toHaveLength(1);
    expect(o.messageQueue[0].groupId).toBe("im:chat-1");
  });

  it("enqueue queues browser-channel messages even when sent to non-browser conversations like Telegram", async () => {
    const o = new Orchestrator();

    const fakeRequest: any = {
      onsuccess: null,
      onerror: null,
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

    // Browser-sourced message to a Telegram conversation (no @k9 trigger required)
    await o.enqueue(fakeDb, {
      id: "msg-telegram",
      groupId: "tg:8352127045",
      sender: "You",
      content: "I don't see this message in telegram",
      timestamp: Date.now(),
      channel: "browser",
    });

    // Should be queued because it's from the browser UI, not because of trigger word
    expect(o.messageQueue).toHaveLength(1);
    expect(o.messageQueue[0].groupId).toBe("tg:8352127045");
  });

  it("enqueue executes direct tool command from Telegram when policy allows it", async () => {
    const o = new Orchestrator();
    const postMessage = jest.fn();

    const fakeRequest: any = {
      onsuccess: null,
      onerror: null,
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
      id: "msg-direct-tg",
      groupId: "tg:8352127045",
      sender: "Sam",
      content: "@k9 - /clear_chat",
      timestamp: Date.now(),
      channel: "telegram",
    });

    expect(o.messageQueue).toHaveLength(0);
    expect(postMessage).toHaveBeenCalledWith({
      type: "execute-direct-tool",
      payload: {
        groupId: "tg:8352127045",
        name: "clear_chat",
        input: {},
      },
    });
  });

  it("enqueue supports policy-configured direct commands for future channels like iMessage", async () => {
    const o = new Orchestrator();
    const postMessage = jest.fn();

    const fakeRequest: any = {
      onsuccess: null,
      onerror: null,
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
      enabledChannelTypes: ["telegram", "imessage"],
      allowedTools: ["clear_chat", "show_toast"],
      requireMention: true,
    };

    await o.enqueue(fakeDb, {
      id: "msg-direct-im",
      groupId: "im:chat-1",
      sender: "Alex",
      content: `@k9 /show_toast '{"message":"it works","duration":10}'`,
      timestamp: Date.now(),
      channel: "imessage",
    });

    expect(o.messageQueue).toHaveLength(0);
    expect(postMessage).toHaveBeenCalledWith({
      type: "execute-direct-tool",
      payload: {
        groupId: "im:chat-1",
        name: "show_toast",
        input: {
          message: "it works",
          duration: 10,
        },
      },
    });
  });

  it("stores resolved channel type for assistant responses", async () => {
    const o = new Orchestrator();
    const saved: any[] = [];

    const fakeRequest: any = {
      onsuccess: null,
      onerror: null,
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

    expect(saved[0].channel).toBe("telegram");
    expect(saved[1].channel).toBe("imessage");
  });

  describe("_warnIfNoPushSubscription", () => {
    let originalServiceWorker;

    beforeEach(() => {
      originalServiceWorker = navigator.serviceWorker;
    });

    afterEach(() => {
      Object.defineProperty(navigator, "serviceWorker", {
        value: originalServiceWorker,
        configurable: true,
      });
    });

    it("sets _pushSubscriptionWarned flag when no subscription exists", async () => {
      const o = new Orchestrator();

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: (jest.fn() as any).mockResolvedValue(null),
            },
          }),
          addEventListener: jest.fn(),
        },
        configurable: true,
      });

      await o._warnIfNoPushSubscription();
      expect(o._pushSubscriptionWarned).toBe(true);
    });

    it("does NOT warn when a push subscription exists", async () => {
      const o = new Orchestrator();

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: (jest.fn() as any).mockResolvedValue({
                endpoint: "https://example.com/push",
              }),
            },
          }),
          addEventListener: jest.fn(),
        },
        configurable: true,
      });

      await o._warnIfNoPushSubscription();
      expect(o._pushSubscriptionWarned).toBe(false);
    });

    it("only warns once per session (deduplication)", async () => {
      const o = new Orchestrator();

      const mockGetSubscription = (jest.fn() as any).mockResolvedValue(null);

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
            },
          }),
          addEventListener: jest.fn(),
        },
        configurable: true,
      });

      await o._warnIfNoPushSubscription();
      expect(o._pushSubscriptionWarned).toBe(true);

      mockGetSubscription.mockClear();
      await o._warnIfNoPushSubscription();
      // Should not call getSubscription again
      expect(mockGetSubscription).not.toHaveBeenCalled();
    });

    it("tolerates missing navigator.serviceWorker", async () => {
      const o = new Orchestrator();

      Object.defineProperty(navigator, "serviceWorker", {
        value: undefined,
        configurable: true,
      });

      await o._warnIfNoPushSubscription();
      expect(o._pushSubscriptionWarned).toBe(false);
    });
  });

  describe("scheduler recursion guard (_schedulerTriggeredGroups)", () => {
    // returns A minimal fake DB for handleWorkerMessage
    function fakeDb() {
      const fakeRequest: any = {
        onsuccess: null,
        onerror: null,
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

    it("blocks task-created when groupId is in _schedulerTriggeredGroups", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e) => events.push(e));

      o._schedulerTriggeredGroups.add("br:main");

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "task-created",
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
      });

      // Task-change event should NOT have fired
      expect(events).toHaveLength(0);
    });

    it("allows task-created when groupId is NOT in _schedulerTriggeredGroups", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e) => events.push(e));

      // Mock fetch so _syncTaskToServer doesn't throw
      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "task-created",
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
      });

      expect(events).toHaveLength(1);

      expect(events[0].type).toBe("created");
      (globalThis as any).fetch = origFetch;
    });

    it("blocks update-task when groupId is in _schedulerTriggeredGroups", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e) => events.push(e));

      o._schedulerTriggeredGroups.add("br:main");

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "update-task",
        payload: {
          task: {
            id: "t1",
            groupId: "br:main",
            schedule: "* * * * *",
            prompt: "updated",
            enabled: true,
            createdAt: Date.now(),
          },
        },
      });

      expect(events).toHaveLength(0);
    });

    it("blocks delete-task when groupId is in _schedulerTriggeredGroups", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e) => events.push(e));

      o._schedulerTriggeredGroups.add("br:main");

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "delete-task",
        payload: { id: "t1", groupId: "br:main" },
      });

      expect(events).toHaveLength(0);
    });

    it("blocks send-notification when groupId is in _schedulerTriggeredGroups", async () => {
      const o = new Orchestrator();

      o._schedulerTriggeredGroups.add("br:main");

      // Mock fetch to ensure it's NOT called
      const origFetch = (globalThis as any).fetch;
      const fetchSpy = jest.fn();

      (globalThis as any).fetch = fetchSpy;

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "send-notification",
        payload: {
          title: "Test",
          body: "Hello",
          groupId: "br:main",
        },
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      (globalThis as any).fetch = origFetch;
    });
  });

  describe("HTTP-confirmed task operations", () => {
    // returns A minimal fake DB for handleWorkerMessage
    function fakeDb() {
      const fakeRequest: any = {
        onsuccess: null,
        onerror: null,
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
      id: "t1",
      groupId: "br:main",
      schedule: "0 9 * * *",
      prompt: "hello",
      enabled: true,
      createdAt: Date.now(),
    };

    it("delete-task removes from IndexedDB only after server 200", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "delete-task",
        payload: { id: "t1", groupId: "br:main" },
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

      o.events.on("task-change", (e) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "delete-task",
        payload: { id: "t1", groupId: "br:main" },
      });

      // No task-change event — task stays in UI
      expect(events).toHaveLength(0);
      (globalThis as any).fetch = origFetch;
    });

    it("delete-task keeps task in view when server is unreachable", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockRejectedValue(
        new Error("Network error"),
      );

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "delete-task",
        payload: { id: "t1", groupId: "br:main" },
      });

      // No task-change event — task stays in UI
      expect(events).toHaveLength(0);
      (globalThis as any).fetch = origFetch;
    });

    it("task-created awaits server sync before saving to IndexedDB", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "task-created",
        payload: { task: sampleTask },
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

      o.events.on("task-change", (e) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "task-created",
        payload: { task: sampleTask },
      });

      // Task NOT saved locally — no event fires
      expect(events).toHaveLength(0);
      (globalThis as any).fetch = origFetch;
    });

    it("update-task awaits server sync", async () => {
      const o = new Orchestrator();
      const events: any[] = [];

      o.events.on("task-change", (e) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "update-task",
        payload: { task: { ...sampleTask, prompt: "updated" } },
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

      o.events.on("task-change", (e) => events.push(e));

      const origFetch = (globalThis as any).fetch;

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await o.handleWorkerMessage(fakeDb() as any, {
        type: "update-task",
        payload: { task: { ...sampleTask, prompt: "updated" } },
      });

      // Task NOT saved locally — no event fires
      expect(events).toHaveLength(0);
      (globalThis as any).fetch = origFetch;
    });
  });

  describe("isScheduledTask flag logic", () => {
    it("_schedulerTriggeredGroups determines isScheduledTask for a given groupId", () => {
      const o = new Orchestrator();

      o._schedulerTriggeredGroups.add("br:main");
      expect(o._schedulerTriggeredGroups.has("br:main")).toBe(true);
      expect(o._schedulerTriggeredGroups.has("br:other")).toBe(false);

      o._schedulerTriggeredGroups.delete("br:main");
      expect(o._schedulerTriggeredGroups.has("br:main")).toBe(false);
    });
  });
});
