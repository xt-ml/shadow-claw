import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { jest } from "@jest/globals";
import {
  startIpcServer,
  runWebRtcListenCommand,
  createDefaultWebRtcHandlers,
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
      } finally {
        process.exitCode = exitCodeBefore;
        startSpy.mockRestore();
        logSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });

  describe("createDefaultWebRtcHandlers", () => {
    it("handles send-message and invokes the agent runner", async () => {
      const mockRunAgent = jest.fn(async (prompt: string, _opts: any) => ({
        success: true,
        response: "Agent reply: " + prompt,
        model: "mock-model",
        provider: "mock-provider",
      }));

      const handlers = createDefaultWebRtcHandlers({
        cacheDir: tmpDir,
        runAgent: mockRunAgent as any,
        peerId: "cli-test-peer",
      });

      expect(handlers["send-message"]).toBeDefined();
      const result = await handlers["send-message"](
        { text: "Hello Agent B" },
        { remotePeerId: "cli-peer-a" },
      );

      expect(mockRunAgent).toHaveBeenCalledWith(
        "Hello Agent B",
        expect.objectContaining({
          group: "peer:cli-peer-a",
        }),
      );
      expect(result.success).toBe(true);
      expect(result.reply).toBe("Agent reply: Hello Agent B");
      expect(result.text).toBe("Agent reply: Hello Agent B");
    });

    it("throws error on send-message when text is missing", async () => {
      const handlers = createDefaultWebRtcHandlers({
        cacheDir: tmpDir,
      });

      await expect(handlers["send-message"]({})).rejects.toThrow(
        /Missing text or prompt/,
      );
    });

    it("returns queued message when agent is disabled (--no-agent)", async () => {
      const handlers = createDefaultWebRtcHandlers({
        cacheDir: tmpDir,
        agent: false,
      });

      const result = await handlers["send-message"]({ text: "Hello" });
      expect(result.success).toBe(true);
      expect(result.queued).toBe(true);
    });

    it("handles send-file, saves file to transfers dir, and returns metadata", async () => {
      const handlers = createDefaultWebRtcHandlers({
        cacheDir: tmpDir,
        peerId: "cli-test-peer",
      });

      const content = "Hello from transferred file!";
      const base64Data = Buffer.from(content).toString("base64");

      const result = await handlers["send-file"](
        {
          fileName: "notes.txt",
          data: base64Data,
          fileSize: content.length,
          mimeType: "text/plain",
        },
        { remotePeerId: "cli-peer-a" },
      );

      expect(result.success).toBe(true);
      expect(result.fileName).toBe("notes.txt");
      expect(result.size).toBe(content.length);
      expect(fs.existsSync(result.path)).toBe(true);
      expect(fs.readFileSync(result.path, "utf8")).toBe(content);
    });

    it("handles send-file with accompanying prompt and runs agent", async () => {
      const mockRunAgent = jest.fn(async (_prompt: string, _opts: any) => ({
        success: true,
        response: "Summary: analysis of file completed.",
      }));

      const handlers = createDefaultWebRtcHandlers({
        cacheDir: tmpDir,
        runAgent: mockRunAgent as any,
        peerId: "cli-test-peer",
      });

      const content = "data 1, 2, 3";
      const result = await handlers["send-file"](
        {
          fileName: "data.csv",
          data: Buffer.from(content).toString("base64"),
          prompt: "Please summarize this dataset.",
        },
        { remotePeerId: "cli-peer-a" },
      );

      expect(result.success).toBe(true);
      expect(result.reply).toBe("Summary: analysis of file completed.");
      expect(mockRunAgent).toHaveBeenCalledWith(
        expect.stringContaining("data.csv"),
        expect.objectContaining({
          group: "peer:cli-peer-a",
        }),
      );
    });

    it("handles ping and returns peer identity", async () => {
      const handlers = createDefaultWebRtcHandlers({
        cacheDir: tmpDir,
        peerId: "cli-custom-peer",
      });

      const result = await handlers["ping"]();
      expect(result.ok).toBe(true);
      expect(result.peerId).toBe("cli-custom-peer");
    });
  });
});
