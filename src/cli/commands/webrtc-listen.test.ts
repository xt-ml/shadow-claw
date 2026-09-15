import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { jest } from "@jest/globals";
import {
  startIpcServer,
  runWebRtcListenCommand,
  type WebRtcListenerLike,
} from "./webrtc-listen.js";

describe("webrtc-listen command", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-webrtc-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  });

  function makeRequest(
    socketPath: string,
    options: { method: string; path: string; body?: any },
  ): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath,
          path: options.path,
          method: options.method,
          headers: options.body ? { "Content-Type": "application/json" } : {},
        },
        (res) => {
          let buf = "";
          res.on("data", (chunk) => (buf += chunk));
          res.on("end", () => {
            let data: any = buf;
            try {
              data = JSON.parse(buf);
            } catch (_) {}
            resolve({ status: res.statusCode || 0, data });
          });
        },
      );
      req.on("error", reject);
      if (options.body) {
        req.write(
          typeof options.body === "string"
            ? options.body
            : JSON.stringify(options.body),
        );
      }
      req.end();
    });
  }

  describe("startIpcServer", () => {
    it("handles GET /ping and returns ok with peerId", async () => {
      const mockListener: WebRtcListenerLike = {
        cliPeerId: "cli-test-peer-123",
        _connections: new Map(),
        _peerCards: new Map(),
        _pendingIpc: new Map(),
      };

      const server = await startIpcServer(mockListener, tmpDir);
      try {
        const socketPath = path.join(tmpDir, "webrtc-ipc.sock");
        const res = await makeRequest(socketPath, {
          method: "GET",
          path: "/ping",
        });
        expect(res.status).toBe(200);
        expect(res.data).toEqual({ ok: true, peerId: "cli-test-peer-123" });
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    it("handles GET /clients and lists connected peers", async () => {
      const mockListener: WebRtcListenerLike = {
        cliPeerId: "cli-test-peer-123",
        _connections: new Map([["peer-abc", {} as any]]),
        _peerCards: new Map([
          ["peer-abc", { name: "Test Browser", capabilities: ["chat"] }],
        ]),
        _pendingIpc: new Map(),
      };

      const server = await startIpcServer(mockListener, tmpDir);
      try {
        const socketPath = path.join(tmpDir, "webrtc-ipc.sock");
        const res = await makeRequest(socketPath, {
          method: "GET",
          path: "/clients",
        });
        expect(res.status).toBe(200);
        expect(res.data.ok).toBe(true);
        expect(res.data.clients).toHaveLength(1);
        expect(res.data.clients[0].peerId).toBe("peer-abc");
        expect(res.data.clients[0].deviceLabel).toBe("Test Browser");
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    it("handles POST /command error when targetPeerId is missing", async () => {
      const mockListener: WebRtcListenerLike = {
        cliPeerId: "cli-test-peer-123",
        _connections: new Map(),
        _peerCards: new Map(),
        _pendingIpc: new Map(),
      };

      const server = await startIpcServer(mockListener, tmpDir);
      try {
        const socketPath = path.join(tmpDir, "webrtc-ipc.sock");
        const res = await makeRequest(socketPath, {
          method: "POST",
          path: "/command",
          body: { action: "ping" },
        });
        expect(res.status).toBe(400);
        expect(res.data.error).toMatch(/targetPeerId is required/);
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    it("handles POST /command error when peer is not connected", async () => {
      const mockListener: WebRtcListenerLike = {
        cliPeerId: "cli-test-peer-123",
        _connections: new Map(),
        _peerCards: new Map(),
        _pendingIpc: new Map(),
      };

      const server = await startIpcServer(mockListener, tmpDir);
      try {
        const socketPath = path.join(tmpDir, "webrtc-ipc.sock");
        const res = await makeRequest(socketPath, {
          method: "POST",
          path: "/command",
          body: { targetPeerId: "unknown-peer", action: "ping" },
        });
        expect(res.status).toBe(503);
        expect(res.data.error).toMatch(/No DataChannel open to peer/);
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    it("executes command via DataChannel and returns result", async () => {
      let sentMsg: any = null;
      const fakeConn = {
        send: jest.fn((msg) => {
          sentMsg = msg;
          // Simulate peer responding asynchronously
          setTimeout(() => {
            const cb = mockListener._pendingIpc.get(
              (msg as any).payload.commandId,
            );
            if (cb) {
              cb({ output: "command output response" });
            }
          }, 10);
        }),
      };

      const mockListener: WebRtcListenerLike = {
        cliPeerId: "cli-test-peer-123",
        _connections: new Map([["peer-1", fakeConn as any]]),
        _peerCards: new Map(),
        _pendingIpc: new Map(),
      };

      const server = await startIpcServer(mockListener, tmpDir);
      try {
        const socketPath = path.join(tmpDir, "webrtc-ipc.sock");
        const res = await makeRequest(socketPath, {
          method: "POST",
          path: "/command",
          body: {
            targetPeerId: "peer-1",
            action: "run",
            args: { cmd: "echo test" },
          },
        });
        expect(res.status).toBe(200);
        expect(res.data).toEqual({ output: "command output response" });
        expect(fakeConn.send).toHaveBeenCalled();
        expect(sentMsg.payload.action).toBe("run");
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    it("returns 404 for unknown endpoints", async () => {
      const mockListener: WebRtcListenerLike = {
        cliPeerId: "cli-test-peer-123",
        _connections: new Map(),
        _peerCards: new Map(),
        _pendingIpc: new Map(),
      };

      const server = await startIpcServer(mockListener, tmpDir);
      try {
        const socketPath = path.join(tmpDir, "webrtc-ipc.sock");
        const res = await makeRequest(socketPath, {
          method: "GET",
          path: "/not-found",
        });
        expect(res.status).toBe(404);
      } finally {
        await new Promise((r) => server.close(r));
      }
    });
  });

  describe("runWebRtcListenCommand", () => {
    it("handles error gracefully when listener fails to start", async () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { CliWebRtcListener } =
        await import("../utils/webrtc-control-client.js");
      const startSpy = jest
        .spyOn(CliWebRtcListener.prototype, "start")
        .mockRejectedValue(new Error("Signaling connection refused"));

      const exitCodeBefore = process.exitCode;
      try {
        await runWebRtcListenCommand({
          cacheDir: tmpDir,
          port: 9999,
          host: "127.0.0.1",
        });
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "Error starting WebRTC listener: Signaling connection refused",
          ),
        );
        expect(process.exitCode).toBe(1);
      } finally {
        process.exitCode = exitCodeBefore;
        startSpy.mockRestore();
        logSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });
});
