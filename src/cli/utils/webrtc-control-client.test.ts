import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

import {
  ensureWebRtcPolyfill,
  CliWebRtcControlClient,
  getOrCreateCliPeerId,
  renewCliPeerId,
  readCliPeerId,
  getIpcFilePath,
  writeIpcFile,
  clearIpcFile,
  CliWebRtcListener,
  resolveListenerIpc,
  sendCommandViaIpc,
  getIpcSocketPath,
} from "./webrtc-control-client.js";

describe("src/cli/utils/webrtc-control-client.ts", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(
      os.tmpdir(),
      "test-webrtc-peer-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2),
    );
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  it("initializes WebRTC polyfill in Node environment", async () => {
    const ok = await ensureWebRtcPolyfill();
    expect(ok).toBe(true);
    expect((globalThis as any).RTCPeerConnection).toBeDefined();
  });

  it("constructs CliWebRtcControlClient with default options", () => {
    const client = new CliWebRtcControlClient({
      host: "127.0.0.1",
      port: 8888,
      peerId: "cli-test-peer",
      cacheDir: tempDir,
    });

    expect(client.cliPeerId).toBe("cli-test-peer");
    expect(client.host).toBe("127.0.0.1");
    expect(client.port).toBe(8888);
    expect(client.path).toBe("/");
  });

  it("creates, reads, and renews CLI peer IDs via helper functions", () => {
    expect(readCliPeerId(tempDir)).toBe("");

    const id1 = getOrCreateCliPeerId(undefined, tempDir);
    expect(id1).toMatch(/^cli-[0-9a-z]+$/);
    expect(readCliPeerId(tempDir)).toBe(id1);

    // Subsequent call returns same
    const id2 = getOrCreateCliPeerId(undefined, tempDir);
    expect(id2).toBe(id1);

    // Renewal generates new ID
    const id3 = renewCliPeerId(undefined, tempDir);
    expect(id3).not.toBe(id1);
    expect(readCliPeerId(tempDir)).toBe(id3);

    // Custom renewal
    const custom = renewCliPeerId("my-special-peer", tempDir);
    expect(custom).toBe("my-special-peer");
    expect(readCliPeerId(tempDir)).toBe("my-special-peer");
  });

  it("CliWebRtcControlClient uses the stored persistent peer ID", () => {
    const client = new CliWebRtcControlClient({ cacheDir: tempDir });
    expect(client.cliPeerId).toMatch(/^cli-[0-9a-z]+$/);
    const client2 = new CliWebRtcControlClient({ cacheDir: tempDir });
    expect(client2.cliPeerId).toBe(client.cliPeerId);
  });

  it("CliWebRtcControlClient respects an explicit --peer-id override", () => {
    const client = new CliWebRtcControlClient({
      cacheDir: tempDir,
      peerId: "cli-my-custom-id",
    });
    expect(client.cliPeerId).toBe("cli-my-custom-id");
  });

  it("CliWebRtcControlClient.listClients returns empty array when no listener is active", async () => {
    const client = new CliWebRtcControlClient({ cacheDir: tempDir });
    const clients = await client.listClients();
    expect(clients).toEqual([]);
  });

  it("CliWebRtcControlClient.listClients retrieves connected clients from listener IPC socket", async () => {
    const http = await import("node:http");
    const { getIpcSocketPath } = await import("./webrtc-control-client.js");
    const socketPath = getIpcSocketPath(tempDir);

    fs.mkdirSync(tempDir, { recursive: true });
    const mockClients = [
      {
        clientId: "browser-peer-1",
        peerId: "browser-peer-1",
        deviceLabel: "Chrome Browser",
        capabilities: ["webrtc", "peerjs"],
        version: "1.0.0",
      },
    ];

    const server = http.createServer((req, res) => {
      if (req.method === "GET" && req.url === "/ping") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.method === "GET" && req.url === "/clients") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, clients: mockClients }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise((resolve) => server.listen(socketPath, resolve as any));

    try {
      const client = new CliWebRtcControlClient({ cacheDir: tempDir });
      const clients = await client.listClients();
      expect(clients).toEqual(mockClients);
    } finally {
      await new Promise((resolve) => server.close(resolve as any));
    }
  });
});

describe("IPC socket helpers", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(
      os.tmpdir(),
      "test-webrtc-ipc-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2),
    );
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  it("getIpcFilePath returns the .sock path inside cacheDir", () => {
    const p = getIpcFilePath(tempDir);
    expect(p).toBe(path.join(tempDir, "webrtc-ipc.sock"));
  });

  it("writeIpcFile is a no-op (socket file is created by the server)", () => {
    expect(() => writeIpcFile("/some/path.sock", tempDir)).not.toThrow();
    expect(fs.existsSync(getIpcFilePath(tempDir))).toBe(false);
  });

  it("clearIpcFile removes the socket file if it exists", () => {
    const sockPath = getIpcFilePath(tempDir);
    fs.writeFileSync(sockPath, "");
    expect(fs.existsSync(sockPath)).toBe(true);
    clearIpcFile(tempDir);
    expect(fs.existsSync(sockPath)).toBe(false);
  });

  it("clearIpcFile does not throw if socket file does not exist", () => {
    expect(() => clearIpcFile(tempDir)).not.toThrow();
  });
});

describe("CliWebRtcListener", () => {
  let tempDir: string;
  let logSpy: any;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    tempDir = path.join(
      os.tmpdir(),
      "test-webrtc-listener-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2),
    );
  });

  afterEach(() => {
    logSpy?.mockRestore();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  it("constructs CliWebRtcListener with defaults and assigns a cli- peer ID", () => {
    const listener = new CliWebRtcListener({ cacheDir: tempDir });
    expect(listener.cliPeerId).toMatch(/^cli-[0-9a-z]+$/);
    expect(listener.host).toBe("127.0.0.1");
    expect(listener.port).toBe(8888);
    expect(listener.path).toBe("/");
    expect(listener.secure).toBe(false);
    expect(listener.trustedPeerIds).toBeInstanceOf(Set);
    expect(listener.trustedPeerIds.size).toBe(0);
  });

  it("constructs CliWebRtcListener with a fixed peer ID", () => {
    const listener = new CliWebRtcListener({
      cacheDir: tempDir,
      peerId: "cli-fixed-peer",
    });
    expect(listener.cliPeerId).toBe("cli-fixed-peer");
  });

  it("populates trustedPeerIds from options", () => {
    const listener = new CliWebRtcListener({
      cacheDir: tempDir,
      trustedPeerIds: ["browser-peer-1", "browser-peer-2"],
    });
    expect(listener.trustedPeerIds.has("browser-peer-1")).toBe(true);
    expect(listener.trustedPeerIds.has("browser-peer-2")).toBe(true);
    expect(listener.trustedPeerIds.size).toBe(2);
  });

  it("_isTrusted returns true for any peer when trustedPeerIds is empty", () => {
    const listener = new CliWebRtcListener({ cacheDir: tempDir });
    expect(listener._isTrusted("any-random-peer")).toBe(true);
    expect(listener._isTrusted("cli-abc")).toBe(true);
  });

  it("_isTrusted returns true only for listed peers when trustedPeerIds is set", () => {
    const listener = new CliWebRtcListener({
      cacheDir: tempDir,
      trustedPeerIds: ["browser-abc"],
    });
    expect(listener._isTrusted("browser-abc")).toBe(true);
    expect(listener._isTrusted("browser-xyz")).toBe(false);
    expect(listener._isTrusted("")).toBe(false);
  });

  it("_isTrusted supports wildcard suffix matching", () => {
    const listener = new CliWebRtcListener({
      cacheDir: tempDir,
      trustedPeerIds: ["browser-*"],
    });
    expect(listener._isTrusted("browser-abc")).toBe(true);
    expect(listener._isTrusted("browser-123")).toBe(true);
    expect(listener._isTrusted("other-peer")).toBe(false);
  });

  it("close() before start() does not throw", () => {
    const listener = new CliWebRtcListener({ cacheDir: tempDir });
    expect(() => listener.close()).not.toThrow();
  });

  it("renewPeerId generates a fresh peer ID on construction", () => {
    const listener1 = new CliWebRtcListener({ cacheDir: tempDir });
    const listener2 = new CliWebRtcListener({
      cacheDir: tempDir,
      renewPeerId: true,
    });
    expect(listener2.cliPeerId).not.toBe(listener1.cliPeerId);
  });

  it("_scheduleReconnect implements exponential backoff and tracks attempts", () => {
    const listener = new CliWebRtcListener({ cacheDir: tempDir });
    listener._running = true;
    const mockPeer = {
      destroyed: false,
      reconnect: jest.fn(),
    };
    listener._peer = mockPeer;

    expect(listener._reconnectAttempts).toBe(0);
    expect(listener._reconnectTimer).toBeNull();

    // First schedule
    listener._scheduleReconnect();
    expect(listener._reconnectAttempts).toBe(1);
    expect(listener._reconnectTimer).not.toBeNull();

    // Scheduling again while timer is active is a no-op
    listener._scheduleReconnect();
    expect(listener._reconnectAttempts).toBe(1);

    // Closing clears timer and resets attempts
    listener.close();
    expect(listener._reconnectAttempts).toBe(0);
    expect(listener._reconnectTimer).toBeNull();
  });

  it("_handleCommand passes remotePeerId and conn in context", async () => {
    let capturedContext: any = null;
    const listener = new CliWebRtcListener({
      cacheDir: tempDir,
      handlers: {
        "test-action": async (_args: any, context: any) => {
          capturedContext = context;
          return { done: true };
        },
      },
    });

    const mockConn = {
      send: jest.fn(),
    };

    await listener._handleCommand(mockConn, "remote-peer-42", {
      payload: {
        commandId: "cmd-1",
        action: "test-action",
        args: { foo: "bar" },
      },
    });

    expect(mockConn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "command:result",
        payload: expect.objectContaining({
          commandId: "cmd-1",
          success: true,
          data: { done: true },
        }),
      }),
    );
    expect(capturedContext).toEqual({
      remotePeerId: "remote-peer-42",
      conn: mockConn,
    });
  });

  it("_setupConnection processes A2A SendMessage requests", async () => {
    const listener = new CliWebRtcListener({
      cacheDir: tempDir,
      handlers: {
        "send-message": async (args: any) => ({
          reply: `A2A Echo: ${args.text}`,
        }),
      },
    });

    let dataHandler: ((data: any) => void) | null = null;
    const mockConn = {
      on: jest.fn((event: string, handler: any) => {
        if (event === "data") dataHandler = handler;
      }),
      send: jest.fn(),
    };

    listener._setupConnection(mockConn, "a2a-peer-1");
    expect(dataHandler).not.toBeNull();

    await dataHandler!({
      jsonrpc: "2.0",
      id: "req-123",
      method: "SendMessage",
      params: {
        message: {
          parts: [{ text: "Hello from A2A" }],
        },
      },
    });

    expect(mockConn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonrpc: "2.0",
        id: "req-123",
        result: expect.objectContaining({
          role: "ROLE_AGENT",
          parts: [{ text: "A2A Echo: Hello from A2A" }],
        }),
      }),
    );
  });

  it("CliWebRtcControlClient.sendFile reads file and sends send-file command", async () => {
    const client = new CliWebRtcControlClient({ cacheDir: tempDir });
    const sendSpy = jest
      .spyOn(client, "sendCommand")
      .mockResolvedValueOnce({ success: true, data: { status: "received" } });

    const filePath = path.join(tempDir, "sample.txt");
    fs.writeFileSync(filePath, "test file content", "utf8");

    const result = await client.sendFile("target-peer", filePath, {
      prompt: "Inspect this file",
    });

    expect(result.success).toBe(true);
    expect(sendSpy).toHaveBeenCalledWith(
      "target-peer",
      "send-file",
      expect.objectContaining({
        fileName: "sample.txt",
        data: Buffer.from("test file content").toString("base64"),
        fileSize: 17,
        prompt: "Inspect this file",
      }),
      120000,
    );
  });

  it("CliWebRtcControlClient.listClients returns empty array when no IPC or IPC error", async () => {
    const client = new CliWebRtcControlClient({ cacheDir: tempDir });
    const empty = await client.listClients();
    expect(empty).toEqual([]);

    // With invalid IPC socket
    writeIpcFile("/tmp/non-existent-sock-" + Date.now(), tempDir);
    const emptyWithIpc = await client.listClients();
    expect(emptyWithIpc).toEqual([]);
    clearIpcFile(tempDir);
  });

  it("CliWebRtcControlClient.sendFile throws when file does not exist or is directory", async () => {
    const client = new CliWebRtcControlClient({ cacheDir: tempDir });
    await expect(client.sendFile("peer-1", "/not/found.txt")).rejects.toThrow(
      "File not found",
    );
    await expect(client.sendFile("peer-1", tempDir)).rejects.toThrow(
      "Cannot send directory",
    );
  });

  it("CliWebRtcListener._setupConnection handles open, agent cards, invalid JSON, close, and error", async () => {
    const listener = new CliWebRtcListener({
      cacheDir: tempDir,
      trustedPeerIds: ["trusted-peer", "prefix-*"],
    });

    expect(listener._isTrusted("trusted-peer")).toBe(true);
    expect(listener._isTrusted("prefix-abc")).toBe(true);
    expect(listener._isTrusted("untrusted-peer")).toBe(false);

    const handlers: Record<string, Function> = {};
    const mockConn = {
      on: jest.fn((event: string, handler: Function) => {
        handlers[event] = handler;
      }),
      send: jest.fn(),
      close: jest.fn(),
    };

    listener._setupConnection(mockConn, "trusted-peer");

    // open event
    handlers["open"]();
    expect(mockConn.send).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GetAgentCard" }),
    );

    // data: invalid string
    await handlers["data"]("invalid-json");

    // data: card result
    await handlers["data"]({ result: { name: "Remote Agent" } });

    // data: GetAgentCard request
    await handlers["data"]({ method: "GetAgentCard", id: "card-req-1" });
    expect(mockConn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "card-req-1",
        result: expect.objectContaining({ name: "ShadowClaw CLI" }),
      }),
    );

    // error event
    handlers["error"](new Error("conn err"));

    // close event
    handlers["close"]();
  });

  it("CliWebRtcListener._handleCommand handles errors and unknown actions", async () => {
    const listener = new CliWebRtcListener({
      cacheDir: tempDir,
      handlers: {
        "failing-action": async () => {
          throw new Error("Action failure");
        },
      },
    });

    const mockConn = { send: jest.fn() };

    // Failing action
    await listener._handleCommand(mockConn, "peer-1", {
      payload: { commandId: "cmd-err", action: "failing-action", args: {} },
    });
    expect(mockConn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "command:result",
        payload: expect.objectContaining({
          commandId: "cmd-err",
          success: false,
          error: "Action failure",
        }),
      }),
    );

    // Unknown action
    await listener._handleCommand(mockConn, "peer-1", {
      payload: { commandId: "cmd-unk", action: "unknown-action", args: {} },
    });
    expect(mockConn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "command:result",
        payload: expect.objectContaining({
          commandId: "cmd-unk",
          success: false,
          error: "Unknown action: unknown-action",
        }),
      }),
    );
  });
});

describe("resolveListenerIpc and sendCommandViaIpc", () => {
  let tempDir: string;
  let http: typeof import("node:http");

  beforeEach(async () => {
    http = await import("node:http");
    tempDir = path.join(
      os.tmpdir(),
      "test-webrtc-ipc-func-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2),
    );
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  it("resolveListenerIpc returns null when socket does not exist", async () => {
    const res = await resolveListenerIpc(tempDir);
    expect(res).toBeNull();
  });

  it("resolveListenerIpc returns socketPath when /ping returns 200, and null when /ping errors", async () => {
    const socketPath = getIpcSocketPath(tempDir);
    let pingStatus = 200;
    const server = http.createServer((req, res) => {
      if (req.url === "/ping") {
        res.writeHead(pingStatus);
        res.end(JSON.stringify({ ok: true }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise((resolve) => server.listen(socketPath, resolve as any));
    try {
      const resOk = await resolveListenerIpc(tempDir);
      expect(resOk).toEqual({ socketPath });

      pingStatus = 500;
      const resFail = await resolveListenerIpc(tempDir);
      expect(resFail).toBeNull();
    } finally {
      await new Promise((resolve) => server.close(resolve as any));
    }
  });

  it("sendCommandViaIpc sends command to IPC socket and handles success, failure, and bad JSON", async () => {
    const socketPath = getIpcSocketPath(tempDir);
    let responseStatus = 200;
    let responseBody: string = JSON.stringify({ ok: true, data: "pong" });

    const server = http.createServer((req, res) => {
      if (req.method === "POST" && req.url === "/command") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          res.writeHead(responseStatus, { "Content-Type": "application/json" });
          res.end(responseBody);
        });
      }
    });

    await new Promise((resolve) => server.listen(socketPath, resolve as any));
    try {
      // 1. Success
      const res = await sendCommandViaIpc(
        { socketPath },
        "target-peer-1",
        "ping",
        { val: 1 },
        5000,
      );
      expect(res).toEqual({ ok: true, data: "pong" });

      // 2. HTTP error with error message
      responseStatus = 400;
      responseBody = JSON.stringify({ error: "Invalid target peer" });
      await expect(
        sendCommandViaIpc(
          { socketPath },
          "target-peer-1",
          "bad-action",
          {},
          5000,
        ),
      ).rejects.toThrow("Invalid target peer");

      // 3. Bad JSON
      responseStatus = 200;
      responseBody = "not valid json";
      await expect(
        sendCommandViaIpc({ socketPath }, "target-peer-1", "ping", {}, 5000),
      ).rejects.toThrow("Bad IPC response");
    } finally {
      await new Promise((resolve) => server.close(resolve as any));
    }
  });
});

describe("CliWebRtcControlClient sendCommand and sendFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(
      os.tmpdir(),
      "test-webrtc-client-cmd-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2),
    );
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  it("sendCommand uses IPC when listener socket is active", async () => {
    const http = await import("node:http");
    const socketPath = getIpcSocketPath(tempDir);
    const server = http.createServer((req, res) => {
      if (req.url === "/ping") {
        res.writeHead(200);
        res.end("ok");
        return;
      }
      if (req.method === "POST" && req.url === "/command") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, result: "ipc-done" }));
        return;
      }
    });

    await new Promise((resolve) => server.listen(socketPath, resolve as any));
    try {
      const client = new CliWebRtcControlClient({ cacheDir: tempDir });
      const res = await client.sendCommand("target-1", "action-1", { a: 1 });
      expect(res).toEqual({ success: true, result: "ipc-done" });
    } finally {
      await new Promise((resolve) => server.close(resolve as any));
    }
  });

  it("sendCommand connects via WebRTC peer when IPC is inactive", async () => {
    const client = new CliWebRtcControlClient({ cacheDir: tempDir });
    const handlers: Record<string, Function> = {};
    const mockConn = {
      on: jest.fn((evt: string, fn: Function) => {
        handlers[evt] = fn;
      }),
      send: jest.fn(),
      close: jest.fn(),
    };
    const mockPeer = {
      connect: jest.fn().mockReturnValue(mockConn),
      destroy: jest.fn(),
    };
    (client as any)._getPeer = jest.fn().mockResolvedValue(mockPeer);

    const promise = client.sendCommand("peer-x", "run", { arg: 123 });
    for (let i = 0; i < 20 && !handlers["open"]; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    // Simulate open
    handlers["open"]();
    expect(mockConn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "command:execute",
        payload: expect.objectContaining({ action: "run" }),
      }),
    );

    // Simulate GetAgentCard message received
    handlers["data"]({ method: "GetAgentCard", id: "card-msg-1" });
    expect(mockConn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "card-msg-1",
        result: expect.objectContaining({ name: "ShadowClaw CLI" }),
      }),
    );

    // Simulate result data
    handlers["data"]({
      type: "command:result",
      payload: { success: true, output: "finished" },
    });

    const res = await promise;
    expect(res).toEqual({ success: true, output: "finished" });
    expect(mockConn.close).toHaveBeenCalled();
  });

  it("sendCommand rejects when connection receives error or error payload", async () => {
    const client = new CliWebRtcControlClient({ cacheDir: tempDir });
    let handlers: Record<string, Function> = {};
    const mockConn = {
      on: jest.fn((evt: string, fn: Function) => {
        handlers[evt] = fn;
      }),
      send: jest.fn(),
      close: jest.fn(),
    };
    const mockPeer = {
      connect: jest.fn().mockReturnValue(mockConn),
      destroy: jest.fn(),
    };
    (client as any)._getPeer = jest.fn().mockResolvedValue(mockPeer);

    // 1. Error payload
    const p1 = client.sendCommand("peer-x", "fail-action", {});
    for (let i = 0; i < 20 && !handlers["open"]; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    handlers["open"]();
    handlers["data"]({
      type: "command:result",
      payload: { error: "Remote execution failed" },
    });
    await expect(p1).rejects.toThrow("Remote execution failed");

    // 2. Connection error
    handlers = {};
    const p2 = client.sendCommand("peer-x", "err-action", {});
    for (let i = 0; i < 20 && !handlers["error"]; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    handlers["error"](new Error("Peer disconnected abruptly"));
    await expect(p2).rejects.toThrow(
      "WebRTC connection error to peer 'peer-x': Peer disconnected abruptly",
    );
  });

  it("sendFile validates file existence and directory before sending", async () => {
    const client = new CliWebRtcControlClient({ cacheDir: tempDir });

    // Non-existent file
    await expect(
      client.sendFile("peer-x", "/non/existent/file.bin"),
    ).rejects.toThrow("File not found");

    // Directory
    await expect(client.sendFile("peer-x", tempDir)).rejects.toThrow(
      "Cannot send directory",
    );

    // Valid file
    const filePath = path.join(tempDir, "sample.txt");
    fs.writeFileSync(filePath, "test content", "utf8");
    client.sendCommand = jest.fn().mockResolvedValue({ success: true });

    const res = await client.sendFile("peer-x", filePath, {
      prompt: "Analyze this",
    });
    expect(res).toEqual({ success: true });
    expect(client.sendCommand).toHaveBeenCalledWith(
      "peer-x",
      "send-file",
      expect.objectContaining({
        fileName: "sample.txt",
        prompt: "Analyze this",
      }),
      120000,
    );

    // client.close destroys peer if present
    client.peer = { destroy: jest.fn() } as any;
    client.close();
    expect(client.peer).toBeNull();
  });
});

describe("CliWebRtcListener lifecycle and RPC handling", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(
      os.tmpdir(),
      "test-webrtc-listener-adv-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2),
    );
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  it("_scheduleReconnect handles running and non-running states", () => {
    const listener = new CliWebRtcListener({ cacheDir: tempDir });
    (listener as any)._running = false;
    (listener as any)._scheduleReconnect();
    expect((listener as any)._reconnectTimer).toBeNull();

    (listener as any)._running = true;
    (listener as any)._scheduleReconnect();
    expect((listener as any)._reconnectTimer).not.toBeNull();
    expect((listener as any)._reconnectAttempts).toBe(1);

    // Calling again while timer exists does not reschedule
    (listener as any)._scheduleReconnect();
    expect((listener as any)._reconnectAttempts).toBe(1);

    // cleanup
    listener.close();
    expect((listener as any)._reconnectTimer).toBeNull();
    expect((listener as any)._running).toBe(false);
  });

  it("_setupConnection handles SendMessage A2A RPC with send-message and prompt handlers", async () => {
    const listener = new CliWebRtcListener({
      cacheDir: tempDir,
      handlers: {
        "send-message": async (args: any) => {
          return { reply: `Echo: ${args.text}` };
        },
      },
    });

    const handlers: Record<string, Function> = {};
    const mockConn = {
      on: jest.fn((evt: string, fn: Function) => {
        handlers[evt] = fn;
      }),
      send: jest.fn(),
      close: jest.fn(),
    };

    listener._setupConnection(mockConn, "remote-a2a-peer");

    // SendMessage request
    await handlers["data"]({
      jsonrpc: "2.0",
      id: "a2a-msg-1",
      method: "SendMessage",
      params: {
        message: {
          parts: [{ text: "Hello A2A" }],
        },
        contextId: "ctx-1",
      },
    });

    expect(mockConn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "a2a-msg-1",
        result: expect.objectContaining({
          role: "ROLE_AGENT",
          parts: [{ text: "Echo: Hello A2A" }],
        }),
      }),
    );

    // SendMessage failure handling
    listener.handlers["send-message"] = async () => {
      throw new Error("RPC handling crashed");
    };

    await handlers["data"]({
      jsonrpc: "2.0",
      id: "a2a-msg-2",
      method: "SendMessage",
      params: {
        message: {
          parts: [{ text: "Break it" }],
        },
      },
    });

    expect(mockConn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "a2a-msg-2",
        error: expect.objectContaining({
          code: -32603,
          message: "RPC handling crashed",
        }),
      }),
    );
  });

  it("_setupConnection handles command:execute messages", async () => {
    const listener = new CliWebRtcListener({
      cacheDir: tempDir,
      handlers: {
        hello: async () => ({ msg: "world" }),
      },
    });
    const handlers: Record<string, Function> = {};
    const mockConn = {
      on: jest.fn((evt: string, fn: Function) => {
        handlers[evt] = fn;
      }),
      send: jest.fn(),
      close: jest.fn(),
    };
    listener._setupConnection(mockConn, "remote-cmd-peer");
    await handlers["data"]({
      type: "command:execute",
      payload: { commandId: "cmd-1", action: "hello", args: {} },
    });
    expect(mockConn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "command:result",
        payload: expect.objectContaining({
          success: true,
          data: { msg: "world" },
        }),
      }),
    );
  });

  it("close() closes active connections, clears state and destroys peer", () => {
    const listener = new CliWebRtcListener({ cacheDir: tempDir });
    const mockConn1 = { close: jest.fn() };
    const mockConn2 = { close: jest.fn() };
    const mockPeer = { destroy: jest.fn() };

    (listener as any)._connections.set("p1", mockConn1);
    (listener as any)._connections.set("p2", mockConn2);
    (listener as any)._peerCards.set("p1", { name: "Card 1" });
    (listener as any)._peer = mockPeer;
    (listener as any)._running = true;

    listener.close();

    expect(mockConn1.close).toHaveBeenCalled();
    expect(mockConn2.close).toHaveBeenCalled();
    expect(mockPeer.destroy).toHaveBeenCalled();
    expect((listener as any)._connections.size).toBe(0);
    expect((listener as any)._peerCards.size).toBe(0);
    expect((listener as any)._peer).toBeNull();
    expect((listener as any)._running).toBe(false);
  });
});
