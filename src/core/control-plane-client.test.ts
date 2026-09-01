import { jest } from "@jest/globals";
import {
  ControlPlaneClient,
  type CommandHandler,
} from "./control-plane-client.js";
import type {
  ControlMessage,
  CommandExecutePayload,
  CommandResultPayload,
} from "../server/control-plane-types.js";

// Mock WebSocket implementation for client testing
class MockClientWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: MockClientWebSocket[] = [];
  url: string;
  readyState: number = 0; // CONNECTING
  sentMessages: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockClientWebSocket.CONNECTING;
    MockClientWebSocket.instances.push(this);
    setTimeout(() => {
      if (this.readyState === MockClientWebSocket.CONNECTING) {
        this.readyState = MockClientWebSocket.OPEN;
        this.onopen?.();
      }
    }, 10);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockClientWebSocket.CLOSED;
    this.onclose?.();
  }

  // Helper for test to simulate server messages
  receiveMessageFromServer(msg: ControlMessage) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

// Mock EventSource implementation for SSE client testing
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((err: any) => void) | null = null;
  listeners: Map<string, ((event: { data: string }) => void)[]> = new Map();
  closed: boolean = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    setTimeout(() => {
      if (!this.closed) {
        this.onopen?.();
      }
    }, 10);
  }

  addEventListener(event: string, handler: (e: { data: string }) => void) {
    const list = this.listeners.get(event) || [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  close() {
    this.closed = true;
  }

  // Helper for test to simulate server event
  receiveEvent(type: string, data: any) {
    const dataStr = typeof data === "string" ? data : JSON.stringify(data);
    const handlers = this.listeners.get(type) || [];
    for (const h of handlers) {
      h({ data: dataStr });
    }
    if (type === "message") {
      this.onmessage?.({ data: dataStr });
    }
  }
}

describe("control-plane-client", () => {
  let mockFetch: jest.Mock<any>;
  let postedRequests: Array<{ url: string; body: any; headers: any }>;

  beforeEach(() => {
    MockClientWebSocket.instances = [];
    MockEventSource.instances = [];
    postedRequests = [];
    mockFetch = jest.fn(async (url: string, opts: any) => {
      postedRequests.push({
        url,
        body: JSON.parse(opts.body),
        headers: opts.headers,
      });
      return { ok: true, json: async () => ({ status: "received" }) };
    }) as any;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("SSE Transport (Default)", () => {
    it("connects via EventSource and sends registration over HTTP POST", async () => {
      const client = new ControlPlaneClient({
        clientId: "sse-client-1",
        deviceLabel: "SSE Device",
        capabilities: ["opfs", "webmcp"],
        EventSourceClass: MockEventSource as any,
        fetchFn: mockFetch as any,
      });

      expect(client.transport).toBe("sse");
      client.connect();

      expect(MockEventSource.instances).toHaveLength(1);
      const es = MockEventSource.instances[0];
      expect(es.url).toContain("/api/control/events");
      expect(es.url).toContain("clientId=sse-client-1");

      // Advance timers to trigger onopen
      jest.advanceTimersByTime(15);
      expect(client.getState()).toBe("connected");

      // Verify registration POST
      expect(postedRequests).toHaveLength(1);
      expect(postedRequests[0].body.type).toBe("client:register");
      expect(postedRequests[0].body.payload.clientId).toBe("sse-client-1");
      expect(postedRequests[0].body.payload.transport).toBe("sse");

      client.disconnect();
      expect(client.getState()).toBe("disconnected");
      expect(es.closed).toBe(true);
    });

    it("sends periodic heartbeats over HTTP POST in SSE mode", async () => {
      const client = new ControlPlaneClient({
        clientId: "sse-client-hb",
        heartbeatIntervalMs: 10000,
        EventSourceClass: MockEventSource as any,
        fetchFn: mockFetch as any,
      });

      client.connect();
      jest.advanceTimersByTime(15); // open -> register
      expect(postedRequests).toHaveLength(1);

      // Advance 10s
      jest.advanceTimersByTime(10000);
      expect(postedRequests).toHaveLength(2);
      expect(postedRequests[1].body.type).toBe("client:heartbeat");

      // Advance another 10s
      jest.advanceTimersByTime(10000);
      expect(postedRequests).toHaveLength(3);

      client.disconnect();
    });

    it("executes command from SSE stream and posts result back", async () => {
      const mockHandler = jest.fn(async (args: any) => ({
        echo: args.input,
      }));

      const client = new ControlPlaneClient({
        clientId: "sse-client-cmd",
        EventSourceClass: MockEventSource as any,
        fetchFn: mockFetch as any,
        handlers: {
          "echo-command": mockHandler,
        },
      });

      client.connect();
      const es = MockEventSource.instances[0];
      jest.advanceTimersByTime(15);

      const cmdMsg: ControlMessage = {
        id: "cmd-msg-1",
        type: "command:execute",
        payload: {
          commandId: "cmd-id-123",
          action: "echo-command" as any,
          args: { input: "hello sse" },
        } as CommandExecutePayload,
      };

      es.receiveEvent("command:execute", cmdMsg);

      await Promise.resolve();

      expect(mockHandler).toHaveBeenCalledWith({ input: "hello sse" });
      expect(postedRequests).toHaveLength(2); // register + result
      const resultPost = postedRequests[1];
      expect(resultPost.body.type).toBe("command:result");
      expect(resultPost.body.replyTo).toBe("cmd-msg-1");
      expect(resultPost.body.payload.commandId).toBe("cmd-id-123");
      expect(resultPost.body.payload.success).toBe(true);
      expect(resultPost.body.payload.data).toEqual({ echo: "hello sse" });

      client.disconnect();
    });
  });

  describe("WebSocket Transport (Opt-in)", () => {
    it("connects and registers client with server", async () => {
      const client = new ControlPlaneClient({
        transport: "websocket",
        url: "ws://127.0.0.1:8888/ws/control",
        token: "secret-token",
        clientId: "client-test-1",
        deviceLabel: "Test Device",
        capabilities: ["webmcp", "opfs"],
        WebSocketClass: MockClientWebSocket as any,
      });

      expect(client.transport).toBe("websocket");
      client.connect();
      expect(MockClientWebSocket.instances).toHaveLength(1);
      const ws = MockClientWebSocket.instances[0];

      // Trigger onopen
      jest.advanceTimersByTime(15);
      expect(client.getState()).toBe("connected");

      // Verify client:register was sent
      expect(ws.sentMessages).toHaveLength(1);
      const regMsg: ControlMessage = JSON.parse(ws.sentMessages[0]);
      expect(regMsg.type).toBe("client:register");
      expect(regMsg.payload).toEqual({
        clientId: "client-test-1",
        deviceLabel: "Test Device",
        capabilities: ["webmcp", "opfs"],
        version: "1.23.4",
        transport: "websocket",
      });

      client.disconnect();
      expect(client.getState()).toBe("disconnected");
    });

    it("sends periodic heartbeats while connected in WebSocket mode", async () => {
      const client = new ControlPlaneClient({
        transport: "websocket",
        url: "ws://127.0.0.1:8888/ws/control",
        clientId: "client-test-hb",
        heartbeatIntervalMs: 10000,
        WebSocketClass: MockClientWebSocket as any,
      });

      client.connect();
      const ws = MockClientWebSocket.instances[0];
      jest.advanceTimersByTime(15); // open

      expect(ws.sentMessages).toHaveLength(1); // register

      // Advance 10s -> heartbeat 1
      jest.advanceTimersByTime(10000);
      expect(ws.sentMessages).toHaveLength(2);
      const hb1: ControlMessage = JSON.parse(ws.sentMessages[1]);
      expect(hb1.type).toBe("client:heartbeat");

      // Advance another 10s -> heartbeat 2
      jest.advanceTimersByTime(10000);
      expect(ws.sentMessages).toHaveLength(3);

      client.disconnect();
    });

    it("executes registered command handlers and returns result over WebSocket", async () => {
      const mockHandler: CommandHandler = jest.fn(async (_args: any) => ({
        tasks: [{ id: "t1" }],
      }));

      const client = new ControlPlaneClient({
        transport: "websocket",
        url: "ws://127.0.0.1:8888/ws/control",
        clientId: "client-test-cmd",
        WebSocketClass: MockClientWebSocket as any,
        handlers: {
          "list-tasks": mockHandler,
        },
      });

      client.connect();
      const ws = MockClientWebSocket.instances[0];
      jest.advanceTimersByTime(15);

      // Simulate server sending command:execute
      const cmdMsg: ControlMessage = {
        id: "srv-cmd-1",
        type: "command:execute",
        payload: {
          commandId: "cmd-ulid-1",
          action: "list-tasks",
          args: { filter: "enabled" },
        } as CommandExecutePayload,
      };

      ws.receiveMessageFromServer(cmdMsg);

      // Allow handler promise to resolve
      await Promise.resolve();

      expect(mockHandler).toHaveBeenCalledWith({ filter: "enabled" });

      // Client sends command:result
      expect(ws.sentMessages).toHaveLength(2); // register + result
      const resultMsg: ControlMessage = JSON.parse(ws.sentMessages[1]);
      expect(resultMsg.type).toBe("command:result");
      expect(resultMsg.replyTo).toBe("srv-cmd-1");
      const payload = resultMsg.payload as CommandResultPayload;
      expect(payload.commandId).toBe("cmd-ulid-1");
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual({ tasks: [{ id: "t1" }] });

      client.disconnect();
    });

    it("returns error result when handler throws in WebSocket mode", async () => {
      const client = new ControlPlaneClient({
        transport: "websocket",
        url: "ws://127.0.0.1:8888/ws/control",
        clientId: "client-test-err",
        WebSocketClass: MockClientWebSocket as any,
        handlers: {
          "failing-action": async () => {
            throw new Error("Something went wrong");
          },
        },
      });

      client.connect();
      const ws = MockClientWebSocket.instances[0];
      jest.advanceTimersByTime(15);

      ws.receiveMessageFromServer({
        id: "srv-cmd-2",
        type: "command:execute",
        payload: {
          commandId: "cmd-ulid-2",
          action: "failing-action" as any,
          args: {},
        } as unknown as CommandExecutePayload,
      });

      await Promise.resolve();

      const resultMsg: ControlMessage = JSON.parse(ws.sentMessages[1]);
      expect(resultMsg.type).toBe("command:result");
      const payload = resultMsg.payload as CommandResultPayload;
      expect(payload.success).toBe(false);
      expect(payload.error).toContain("Something went wrong");

      client.disconnect();
    });

    it("auto-reconnects when connection is lost", async () => {
      const client = new ControlPlaneClient({
        transport: "websocket",
        url: "ws://127.0.0.1:8888/ws/control",
        clientId: "client-test-reconnect",
        reconnectDelayMs: 500,
        WebSocketClass: MockClientWebSocket as any,
      });

      client.connect();
      expect(MockClientWebSocket.instances).toHaveLength(1);
      const ws1 = MockClientWebSocket.instances[0];
      jest.advanceTimersByTime(15); // open
      expect(client.getState()).toBe("connected");

      // Simulate unexpected disconnect
      ws1.close();
      expect(client.getState()).toBe("disconnected");

      // Advance reconnect timer
      jest.advanceTimersByTime(500);

      // New WebSocket instance created
      expect(MockClientWebSocket.instances).toHaveLength(2);
      jest.advanceTimersByTime(15); // open ws2
      expect(client.getState()).toBe("connected");
      const ws2 = MockClientWebSocket.instances[1];
      expect(ws2.sentMessages).toHaveLength(1); // Re-registers on connect

      client.disconnect();
    });
  });
});
