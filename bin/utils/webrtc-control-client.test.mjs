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
} from "./webrtc-control-client.mjs";

describe("webrtc-control-client", () => {
  let tempDir;

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
    expect(globalThis.RTCPeerConnection).toBeDefined();
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
    // Should auto-create and persist a cli-* ID
    expect(client.cliPeerId).toMatch(/^cli-[0-9a-z]+$/);
    // A second instance in the same dir reuses the same ID
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
    const { getIpcSocketPath } = await import("./webrtc-control-client.mjs");
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

    await new Promise((resolve) => server.listen(socketPath, resolve));

    try {
      const client = new CliWebRtcControlClient({ cacheDir: tempDir });
      const clients = await client.listClients();
      expect(clients).toEqual(mockClients);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe("IPC socket helpers", () => {
  let tempDir;

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
    // No file should be created
    expect(fs.existsSync(getIpcFilePath(tempDir))).toBe(false);
  });

  it("clearIpcFile removes the socket file if it exists", () => {
    const sockPath = getIpcFilePath(tempDir);
    // Create a dummy socket file to simulate a running listener
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
  let tempDir;
  let CliWebRtcListener;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      "test-webrtc-listener-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2),
    );
    // Dynamic import to pick up after initial module load
    ({ CliWebRtcListener } = await import("./webrtc-control-client.mjs"));
  });

  afterEach(() => {
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
});
