import { jest } from "@jest/globals";
import {
  shouldConnectControlPlane,
  detectCapabilities,
  createDefaultControlPlaneClient,
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
  });
});
