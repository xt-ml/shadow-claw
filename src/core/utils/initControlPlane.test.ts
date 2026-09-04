import { jest } from "@jest/globals";
import {
  shouldConnectControlPlane,
  detectCapabilities,
  createDefaultControlPlaneClient,
  executeClientControlCommand,
  getControlPlaneServerUrl,
  getActiveControlPlaneClient,
  stopControlPlaneClient,
} from "./initControlPlane.js";

describe("initControlPlane", () => {
  const origWebSocket = globalThis.WebSocket;
  const origEventSource = (globalThis as any).EventSource;

  beforeAll(() => {
    (globalThis as any).WebSocket = class MockWS {} as any;
  });

  afterAll(() => {
    globalThis.WebSocket = origWebSocket;
    (globalThis as any).EventSource = origEventSource;
  });
  describe("shouldConnectControlPlane", () => {
    it("returns false for file: protocol", () => {
      expect(
        shouldConnectControlPlane({
          protocol: "file:",
          hostname: "localhost",
        }),
      ).toBe(false);
    });

    it("returns true for web-hosted domains including static hosts and custom servers", () => {
      expect(
        shouldConnectControlPlane({
          protocol: "https:",
          hostname: "user.github.io",
        }),
      ).toBe(true);

      expect(
        shouldConnectControlPlane({
          protocol: "http:",
          hostname: "127.0.0.1",
        }),
      ).toBe(true);

      expect(
        shouldConnectControlPlane({
          protocol: "https:",
          hostname: "my-shadowclaw-server.internal",
        }),
      ).toBe(true);
    });

    it("returns false when meta[name=shadowclaw-static-only] is present", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "shadowclaw-static-only");
      document.head.appendChild(meta);

      expect(
        shouldConnectControlPlane({
          protocol: "http:",
          hostname: "localhost",
        }),
      ).toBe(false);

      meta.remove();
    });
  });

  describe("getControlPlaneServerUrl additional cases", () => {
    it("derives http and ws URL from currentLoc when not static host and no customUrl", () => {
      localStorage.removeItem("control_plane_url");
      const urls = getControlPlaneServerUrl({
        protocol: "http:",
        host: "app.internal:8080",
        hostname: "app.internal",
      });
      expect(urls.httpUrl).toBe("http://app.internal:8080");
      expect(urls.wsUrl).toBe("ws://app.internal:8080/ws/control");
    });
  });

  describe("detectCapabilities", () => {
    it("detects available browser capabilities", () => {
      const capabilities = detectCapabilities();
      expect(Array.isArray(capabilities)).toBe(true);
    });
  });

  describe("isControlPlaneEnabled", () => {
    it("returns false by default (opt-in)", async () => {
      const { isControlPlaneEnabled } = await import("./initControlPlane.js");
      expect(await isControlPlaneEnabled()).toBe(false);
    });

    it("respects localStorage override", async () => {
      const { isControlPlaneEnabled } = await import("./initControlPlane.js");
      localStorage.setItem("control_plane_enabled", "true");
      expect(await isControlPlaneEnabled()).toBe(true);
      localStorage.removeItem("control_plane_enabled");
    });
  });

  describe("getControlPlaneServerUrl", () => {
    afterEach(() => {
      localStorage.removeItem("control_plane_url");
    });

    it("defaults to 127.0.0.1 on static hosts like github.io", async () => {
      const { getControlPlaneServerUrl } =
        await import("./initControlPlane.js");

      const urls = getControlPlaneServerUrl({
        protocol: "https:",
        hostname: "xt-ml.github.io",
        host: "xt-ml.github.io",
      });

      expect(urls.httpUrl).toBe("http://127.0.0.1:8888");
      expect(urls.wsUrl).toBe("ws://127.0.0.1:8888/ws/control");
    });

    it("respects configured custom server URL from localStorage", async () => {
      const { getControlPlaneServerUrl } =
        await import("./initControlPlane.js");

      localStorage.setItem(
        "control_plane_url",
        "https://my-server.example.com",
      );

      const urls = getControlPlaneServerUrl();
      expect(urls.httpUrl).toBe("https://my-server.example.com");
      expect(urls.wsUrl).toBe("wss://my-server.example.com/ws/control");
    });
  });

  describe("getOrCreateControlPlaneClientId", () => {
    afterEach(() => {
      localStorage.removeItem("control_plane_client_id");
    });

    it("generates a persistent non-empty client ID and stores in localStorage", async () => {
      const { getOrCreateControlPlaneClientId } =
        await import("./initControlPlane.js");
      localStorage.removeItem("control_plane_client_id");

      const id1 = getOrCreateControlPlaneClientId();
      expect(typeof id1).toBe("string");
      expect(id1.length).toBeGreaterThan(0);
      expect(localStorage.getItem("control_plane_client_id")).toBe(id1);

      // Subsequent call returns the exact same ID
      const id2 = getOrCreateControlPlaneClientId();
      expect(id2).toBe(id1);
    });

    it("respects pre-existing client ID in localStorage", async () => {
      const { getOrCreateControlPlaneClientId } =
        await import("./initControlPlane.js");
      localStorage.setItem("control_plane_client_id", "my-custom-client-123");

      const id = getOrCreateControlPlaneClientId();
      expect(id).toBe("my-custom-client-123");
    });
  });

  describe("createDefaultControlPlaneClient", () => {
    afterEach(async () => {
      const { stopControlPlaneClient } = await import("./initControlPlane.js");
      stopControlPlaneClient();
      localStorage.removeItem("control_plane_client_id");
    });

    it("creates and connects a ControlPlaneClient with orchestrator handlers", () => {
      const mockOrchestrator: any = {
        submitMessage: jest.fn(),
        state: "idle",
      };

      const client = createDefaultControlPlaneClient({
        orchestrator: mockOrchestrator,
        clientId: "test-client-init",
        autoConnect: false,
      });

      expect(client).toBeDefined();
      expect(client.getState()).toBe("disconnected");
    });

    it("generates a non-empty clientId automatically when not provided in options", async () => {
      const client = createDefaultControlPlaneClient({
        autoConnect: false,
      });

      expect(client).toBeDefined();
      // Should have generated and saved a client ID
      const savedId = localStorage.getItem("control_plane_client_id");
      expect(savedId).toBeTruthy();
      expect(savedId?.length).toBeGreaterThan(0);
    });

    it("cleans up existing active client when re-created", async () => {
      const { getActiveControlPlaneClient } =
        await import("./initControlPlane.js");

      const client1 = createDefaultControlPlaneClient({ autoConnect: false });
      expect(getActiveControlPlaneClient()).toBe(client1);

      const client2 = createDefaultControlPlaneClient({ autoConnect: false });
      expect(getActiveControlPlaneClient()).toBe(client2);
      expect(client1.getState()).toBe("disconnected");
    });

    it("handles send-message with browserChat and submitMessage", async () => {
      const mockSubmit = jest.fn();
      const mockOrchestrator: any = {
        browserChat: {
          submit: mockSubmit,
        },
      };

      const client = createDefaultControlPlaneClient({
        orchestrator: mockOrchestrator,
        autoConnect: false,
      });

      const handler = (client as any)._handlers.get("send-message");
      expect(handler).toBeDefined();

      const result = await handler({ text: "Hello CLI", groupId: "br:main" });
      expect(result).toEqual({ queued: true, groupId: "br:main" });
      expect(mockSubmit).toHaveBeenCalledWith("Hello CLI", "br:main");
    });

    it("handles read-state", async () => {
      const mockOrchestrator: any = {
        activeGroupId: "br:custom",
        state: "responding",
      };

      const client = createDefaultControlPlaneClient({
        orchestrator: mockOrchestrator,
        autoConnect: false,
      });

      const handler = (client as any)._handlers.get("read-state");
      expect(handler).toBeDefined();

      const stateResult = await handler();
      expect(stateResult.activeGroupId).toBe("br:custom");
      expect(stateResult.state).toBe("responding");
    });

    it("handles list-tasks and filters by groupId when specified", async () => {
      const { openDatabase } = await import("../../db/openDatabase.js");
      const { saveTask } = await import("../../db/saveTask.js");
      const db = await openDatabase();

      await saveTask(db, {
        id: "task-1",
        groupId: "br:main",
        name: "Main task",
        prompt: "Do main work",
        enabled: true,
        createdAt: Date.now(),
        lastRun: null,
      });

      await saveTask(db, {
        id: "task-2",
        groupId: "peer:cli-123",
        name: "Peer task",
        prompt: "Do peer work",
        enabled: true,
        createdAt: Date.now(),
        lastRun: null,
      });

      const client = createDefaultControlPlaneClient({
        autoConnect: false,
      });

      const handler = (client as any)._handlers.get("list-tasks");
      expect(handler).toBeDefined();

      // All tasks
      const allResult = await handler({});
      expect(allResult.tasks.some((t: any) => t.id === "task-1")).toBe(true);
      expect(allResult.tasks.some((t: any) => t.id === "task-2")).toBe(true);

      // Filtered by groupId
      const filteredResult = await handler({ groupId: "br:main" });
      expect(
        filteredResult.tasks.every((t: any) => t.groupId === "br:main"),
      ).toBe(true);
      expect(filteredResult.tasks.some((t: any) => t.id === "task-1")).toBe(
        true,
      );
      expect(filteredResult.tasks.some((t: any) => t.id === "task-2")).toBe(
        false,
      );
    });

    it("handles list-tools returning discoverable tool definitions", async () => {
      const client = createDefaultControlPlaneClient({
        autoConnect: false,
      });

      const handler = (client as any)._handlers.get("list-tools");
      expect(handler).toBeDefined();

      const result = await handler({});
      expect(result).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
      const bashTool = result.tools.find((t: any) => t.name === "bash");
      expect(bashTool).toBeDefined();
      expect(bashTool.name).toBe("bash");
      expect(bashTool.inputSchema).toBeDefined();
    });

    it("handles invoke-tool via modelContext if present", async () => {
      const mockExecute = (jest.fn() as any).mockResolvedValue({
        output: "hello world",
      });
      const origDescriptor = Object.getOwnPropertyDescriptor(
        document,
        "modelContext",
      );
      Object.defineProperty(document, "modelContext", {
        value: {
          getTools: (jest.fn() as any).mockResolvedValue([
            {
              name: "custom_echo",
              execute: mockExecute,
            },
          ]),
        },
        configurable: true,
        writable: true,
      });

      const client = createDefaultControlPlaneClient({
        autoConnect: false,
      });

      const handler = (client as any)._handlers.get("invoke-tool");
      expect(handler).toBeDefined();

      const result = await handler({
        toolName: "custom_echo",
        input: { text: "hello" },
      });

      expect(result).toEqual({ result: { output: "hello world" } });
      expect(mockExecute).toHaveBeenCalledWith({ text: "hello" });

      if (origDescriptor) {
        Object.defineProperty(document, "modelContext", origDescriptor);
      } else {
        delete (document as any).modelContext;
      }
    });

    it("handles executeClientControlCommand send-message and validation", async () => {
      const mockSubmit = jest.fn();
      const mockSubmitMessage = jest.fn();

      // Missing text
      await expect(
        executeClientControlCommand("send-message", {}),
      ).rejects.toThrow("Missing text parameter");

      // browserChat.submit
      const res1 = await executeClientControlCommand(
        "send-message",
        { text: "msg1", groupId: "br:main" },
        { orchestrator: { browserChat: { submit: mockSubmit } } as any },
      );
      expect(res1).toEqual({ queued: true, groupId: "br:main" });
      expect(mockSubmit).toHaveBeenCalledWith("msg1", "br:main");

      // submitMessage
      const res2 = await executeClientControlCommand(
        "send-message",
        { text: "msg2", groupId: "br:group2" },
        { orchestrator: { submitMessage: mockSubmitMessage } as any },
      );
      expect(res2).toEqual({ queued: true, groupId: "br:group2" });
      expect(mockSubmitMessage).toHaveBeenCalledWith("msg2", "br:group2");
    });

    it("handles executeClientControlCommand read-state", async () => {
      const res = await executeClientControlCommand(
        "read-state",
        {},
        {
          orchestrator: {
            state: "thinking",
            activeGroupId: "br:main",
          } as any,
        },
      );
      expect(res.state).toBe("thinking");
      expect(res.activeGroupId).toBe("br:main");
      expect(res.clientId).toBeDefined();
    });

    it("handles executeClientControlCommand invoke-tool with worker fallback and errors", async () => {
      const origDocMC = Object.getOwnPropertyDescriptor(
        document,
        "modelContext",
      );
      const origNavMC = Object.getOwnPropertyDescriptor(
        navigator,
        "modelContext",
      );
      delete (document as any).modelContext;
      delete (navigator as any).modelContext;

      let workerHandler: any;
      const mockWorker: any = {
        addEventListener: jest.fn((event: string, handler: any) => {
          if (event === "message") {
            workerHandler = handler;
          }
        }),
        removeEventListener: jest.fn(),
        postMessage: jest.fn((msg: any) => {
          setTimeout(() => {
            if (msg.payload.name === "failing_tool") {
              workerHandler({
                data: {
                  type: "execute-tool-result",
                  callId: msg.callId,
                  error: "Tool internal failure",
                },
              });
            } else {
              workerHandler({
                data: {
                  type: "execute-tool-result",
                  callId: msg.callId,
                  result: "Worker executed " + msg.payload.name,
                },
              });
            }
          }, 0);
        }),
      };

      try {
        // Successful worker execution
        const successRes = await executeClientControlCommand(
          "invoke-tool",
          { toolName: "read_file", input: { path: "hello.txt" } },
          {
            orchestrator: {
              agentWorker: mockWorker,
              activeGroupId: "br:main",
            } as any,
          },
        );
        expect(successRes).toEqual({ result: "Worker executed read_file" });

        // Failing worker execution
        await expect(
          executeClientControlCommand(
            "invoke-tool",
            { toolName: "failing_tool", input: {} },
            {
              orchestrator: {
                agentWorker: mockWorker,
                activeGroupId: "br:main",
              } as any,
            },
          ),
        ).rejects.toThrow("Tool internal failure");

        // No context or worker
        await expect(
          executeClientControlCommand(
            "invoke-tool",
            { toolName: "read_file" },
            { orchestrator: {} as any },
          ),
        ).rejects.toThrow("could not be executed");
      } finally {
        if (origDocMC)
          Object.defineProperty(document, "modelContext", origDocMC);
        if (origNavMC)
          Object.defineProperty(navigator, "modelContext", origNavMC);
      }
    });

    it("throws error for unknown command action", async () => {
      await expect(
        executeClientControlCommand("unknown-action-xyz", {}),
      ).rejects.toThrow("Unknown action 'unknown-action-xyz'");
    });

    it("handles executeClientControlCommand trigger-backup", async () => {
      const origFetch = globalThis.fetch;
      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        text: async () => "ok",
        json: async () => ({ success: true }),
      });

      const { getDb } = await import("../../db/db.js");
      const db = await getDb();
      const { getGroupDir } = await import("../../storage/getGroupDir.js");
      const groupDir = await getGroupDir(db, "br:main");
      const fh = await groupDir.getFileHandle("backup-sample.txt", {
        create: true,
      });
      const writable = await (fh as any).createWritable();
      await writable.write(new TextEncoder().encode("sample data"));
      await writable.close();

      try {
        const res = await executeClientControlCommand(
          "trigger-backup",
          { groupId: "br:main", token: "test-token" },
          {},
        );
        expect(res).toBeDefined();
        expect(res.success).toBe(true);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it("handles invoke-tool with executeTool and invoke fallbacks on modelContext", async () => {
      // Missing toolName parameter
      await expect(
        executeClientControlCommand("invoke-tool", {}),
      ).rejects.toThrow("Missing toolName parameter");

      const origDocMC = Object.getOwnPropertyDescriptor(
        document,
        "modelContext",
      );
      const origNavMC = Object.getOwnPropertyDescriptor(
        navigator,
        "modelContext",
      );
      delete (navigator as any).modelContext;

      // ctx.executeTool
      const mockExecuteTool = (jest.fn() as any).mockResolvedValue("exec-res");
      Object.defineProperty(document, "modelContext", {
        value: {
          executeTool: mockExecuteTool,
        },
        configurable: true,
      });

      const resExec = await executeClientControlCommand(
        "invoke-tool",
        { toolName: "t_exec", input: { a: 1 } },
        {},
      );
      expect(resExec).toEqual({ result: "exec-res" });

      // ctx.invoke
      const mockInvoke = (jest.fn() as any).mockResolvedValue("invoke-res");
      Object.defineProperty(document, "modelContext", {
        value: {
          invoke: mockInvoke,
        },
        configurable: true,
      });

      const resInv = await executeClientControlCommand(
        "invoke-tool",
        { toolName: "t_inv", input: { b: 2 } },
        {},
      );
      expect(resInv).toEqual({ result: "invoke-res" });

      if (origDocMC) Object.defineProperty(document, "modelContext", origDocMC);
      if (origNavMC)
        Object.defineProperty(navigator, "modelContext", origNavMC);
    });

    it("handles native Chromium WebMCP invoke-tool passing ModelContextTool to executeTool", async () => {
      const origDocMC = Object.getOwnPropertyDescriptor(
        document,
        "modelContext",
      );
      const origNavMC = Object.getOwnPropertyDescriptor(
        navigator,
        "modelContext",
      );
      delete (navigator as any).modelContext;

      const nativeModelContextTool = {
        name: "list_files",
        description: "List files and directories",
        inputSchema: '{"type":"object"}',
        title: "list_files",
        origin: "http://localhost:8888",
        window: globalThis.window,
      };

      const mockExecuteTool = (jest.fn() as any).mockImplementation(
        async (tool: any, _inputArgsJson: string) => {
          // Native Chromium strictly requires the tool object from getTools()
          if (tool !== nativeModelContextTool) {
            throw new TypeError(
              "Failed to execute 'executeTool' on 'ModelContext': parameter 1 is not of type 'ModelContextTool'",
            );
          }
          return `.agents/ MEMORY.md index.html -/`;
        },
      );

      Object.defineProperty(document, "modelContext", {
        value: {
          getTools: (jest.fn() as any).mockResolvedValue([
            nativeModelContextTool,
          ]),
          executeTool: mockExecuteTool,
        },
        configurable: true,
      });

      try {
        const res = await executeClientControlCommand(
          "invoke-tool",
          { toolName: "list_files", input: {} },
          {},
        );

        expect(res).toEqual({
          result: ".agents/ MEMORY.md index.html -/",
        });
        expect(mockExecuteTool).toHaveBeenCalledWith(
          nativeModelContextTool,
          "{}",
        );
      } finally {
        if (origDocMC)
          Object.defineProperty(document, "modelContext", origDocMC);
        if (origNavMC)
          Object.defineProperty(navigator, "modelContext", origNavMC);
      }
    });

    it("refuses to execute tool when tool is not registered on client or not enabled in active conversation", async () => {
      const origDocMC = Object.getOwnPropertyDescriptor(
        document,
        "modelContext",
      );
      const origNavMC = Object.getOwnPropertyDescriptor(
        navigator,
        "modelContext",
      );
      delete (navigator as any).modelContext;

      Object.defineProperty(document, "modelContext", {
        value: {
          getTools: (jest.fn() as any).mockResolvedValue([
            {
              name: "list_files",
              description: "List files",
              inputSchema: "{}",
            },
          ]),
          executeTool: jest.fn(),
        },
        configurable: true,
      });

      try {
        // 1. Client has WebMCP tools registered, but ask_user is not among them
        await expect(
          executeClientControlCommand("invoke-tool", { toolName: "ask_user" }),
        ).rejects.toThrow(
          "Tool 'ask_user' is not enabled or registered on this client.",
        );

        // 2. Conversation group has restricted toolTags
        const { orchestratorStore } =
          await import("../../stores/orchestrator.js");
        const groupsSpy = jest
          .spyOn(orchestratorStore, "groups", "get")
          .mockReturnValue([
            { groupId: "br:restricted", toolTags: ["read_file"] } as any,
          ]);

        try {
          await expect(
            executeClientControlCommand(
              "invoke-tool",
              { toolName: "write_file", groupId: "br:restricted" },
              { orchestrator: { activeGroupId: "br:restricted" } as any },
            ),
          ).rejects.toThrow(
            "Tool 'write_file' is not enabled in the active conversation (br:restricted).",
          );
        } finally {
          groupsSpy.mockRestore();
        }
      } finally {
        if (origDocMC)
          Object.defineProperty(document, "modelContext", origDocMC);
        if (origNavMC)
          Object.defineProperty(navigator, "modelContext", origNavMC);
      }
    });

    it("falls back to worker when modelContext executeTool throws", async () => {
      const origDocMC = Object.getOwnPropertyDescriptor(
        document,
        "modelContext",
      );
      delete (document as any).modelContext;

      let workerHandler: any;
      const mockWorker: any = {
        addEventListener: jest.fn((event: string, handler: any) => {
          if (event === "message") {
            workerHandler = handler;
          }
        }),
        removeEventListener: jest.fn(),
        postMessage: jest.fn((msg: any) => {
          setTimeout(() => {
            workerHandler({
              data: {
                type: "execute-tool-result",
                callId: msg.callId,
                result: "worker result for " + msg.payload.name,
              },
            });
          }, 0);
        }),
      };

      // Define modelContext where executeTool throws
      Object.defineProperty(document, "modelContext", {
        value: {
          getTools: (jest.fn() as any).mockResolvedValue([]),
          executeTool: (jest.fn() as any).mockRejectedValue(
            new Error("Native runtime fault"),
          ),
        },
        configurable: true,
      });

      try {
        const res = await executeClientControlCommand(
          "invoke-tool",
          { toolName: "list_files", input: { path: "docs" } },
          {
            orchestrator: {
              agentWorker: mockWorker,
              activeGroupId: "br:main",
            } as any,
          },
        );

        expect(res).toEqual({
          result: "worker result for list_files",
        });
      } finally {
        if (origDocMC)
          Object.defineProperty(document, "modelContext", origDocMC);
      }
    });

    it("handles send-message when orchestrator is not ready", async () => {
      const { orchestratorStore } =
        await import("../../stores/orchestrator.js");
      const origSend = orchestratorStore.sendMessage;
      (orchestratorStore as any).sendMessage = undefined;
      try {
        const res = await executeClientControlCommand(
          "send-message",
          { text: "test" },
          { orchestrator: null as any },
        );
        expect(res.queued).toBe(false);
        expect(res.error).toBe("Orchestrator not ready");
      } finally {
        (orchestratorStore as any).sendMessage = origSend;
      }
    });

    it("reads transport from localStorage in createDefaultControlPlaneClient", () => {
      localStorage.setItem("control_plane_transport", "websocket");
      const client = createDefaultControlPlaneClient({ autoConnect: false });
      expect((client as any).transport).toBe("websocket");
      localStorage.removeItem("control_plane_transport");
    });

    it("manages active client lifecycle and autoConnect", () => {
      stopControlPlaneClient();
      expect(getActiveControlPlaneClient()).toBeNull();

      const client = createDefaultControlPlaneClient({ autoConnect: true });
      expect(getActiveControlPlaneClient()).toBe(client);

      stopControlPlaneClient();
      expect(getActiveControlPlaneClient()).toBeNull();
    });
  });
});
