/**
 * ShadowClaw CLI — `webrtc listen` command
 *
 * Registers the CLI as a live PeerJS peer on the signaling server so that
 * browser tabs can initiate WebRTC DataChannel connections to the CLI without
 * needing a control-plane (SSE/WebSocket) connection.
 *
 * Also starts a local IPC HTTP server on a Unix domain socket
 * (.cache/webrtc-ipc.sock) so that concurrent `send --transport webrtc`
 * invocations can route through the already-established DataChannel instead
 * of trying to register the same peer ID a second time.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {
  CliWebRtcListener,
  getOrCreateCliPeerId,
  getIpcSocketPath,
  clearIpcFile,
} from "../utils/webrtc-control-client.js";
import { sanitizeAttachmentFileName } from "../../content/message-attachments.js";

export interface WebRtcListenOptions {
  host?: string;
  port?: number | string;
  path?: string;
  secure?: boolean;
  https?: boolean;
  insecure?: boolean;
  trustedPeer?: string | string[];
  peerId?: string;
  cacheDir?: string;
  renewPeerId?: boolean;
  verbose?: boolean;
  agent?: boolean;
  model?: string;
  provider?: string;
  apiKey?: string;
  systemPrompt?: string;
  systemPromptFile?: string;
  tools?: string;
  workspace?: string;
  transfersDir?: string;
  allowInternet?: boolean;
  handlers?: Record<string, (args: any, context?: any) => Promise<any> | any>;
  runAgent?: (prompt: string, options?: any) => Promise<any>;
}

export function createDefaultWebRtcHandlers(
  options: WebRtcListenOptions = {},
): Record<string, (args?: any, context?: any) => Promise<any> | any> {
  const isAgentEnabled = options.agent !== false;
  const workspaceDir =
    options.workspace ||
    options.cacheDir ||
    (process.env.SHADOWCLAW_CACHE_DIR || "").trim() ||
    path.join(process.cwd(), ".cache");
  const transfersDir =
    options.transfersDir || path.join(workspaceDir, "transfers");

  const handlers: Record<
    string,
    (args?: any, context?: any) => Promise<any> | any
  > = {
    "send-message": async (args: any, context?: any) => {
      const text = args?.text ?? args?.prompt ?? args?.message;
      if (!text || typeof text !== "string" || !text.trim()) {
        throw new Error("Missing text or prompt parameter");
      }

      const remotePeerId = context?.remotePeerId || "remote";
      const targetGroupId = args.groupId || `peer:${remotePeerId}`;

      if (!isAgentEnabled) {
        if (options.verbose) {
          console.log(
            `[webrtc-listen] Message received from ${remotePeerId} (agent disabled): "${text.trim()}"`,
          );
        }
        return {
          success: true,
          queued: true,
          groupId: targetGroupId,
          text: "Message received (agent disabled)",
        };
      }

      if (options.verbose) {
        console.log(
          `[webrtc-listen] Prompt from ${remotePeerId}: "${text.length > 80 ? text.slice(0, 77) + "..." : text}"`,
        );
      }

      const runAgentFn =
        options.runAgent ||
        (async (promptText: string, runOpts: any) => {
          const { runAgentRun } = await import("./agent.js");
          return runAgentRun(promptText, runOpts);
        });

      const agentResult = await runAgentFn(text.trim(), {
        workspace: options.workspace,
        cacheDir: options.cacheDir,
        model: options.model,
        provider: options.provider,
        apiKey: options.apiKey,
        systemPrompt: options.systemPrompt,
        systemPromptFile: options.systemPromptFile,
        tools: options.tools,
        allowInternet: options.allowInternet,
        group: targetGroupId,
        quiet: !options.verbose,
        stream: false,
      });

      if (!agentResult?.success) {
        throw new Error(agentResult?.error || "Agent execution failed");
      }

      return {
        success: true,
        reply: agentResult.response,
        text: agentResult.response,
        model: agentResult.model,
        provider: agentResult.provider,
        groupId: targetGroupId,
      };
    },

    prompt: async (args: any, context?: any) => {
      return handlers["send-message"](args, context);
    },

    "send-file": async (args: any, context?: any) => {
      const { fileName, data, prompt, groupId } = args || {};
      if (!fileName || typeof fileName !== "string" || !data) {
        throw new Error("Missing fileName or data in send-file args");
      }

      const safeName = sanitizeAttachmentFileName(fileName);
      await fs.promises.mkdir(transfersDir, { recursive: true });

      const targetPath = path.join(transfersDir, safeName);
      const fileBuf = Buffer.isBuffer(data)
        ? data
        : Buffer.from(data, "base64");
      await fs.promises.writeFile(targetPath, fileBuf);

      const remotePeerId = context?.remotePeerId || "remote";
      const targetGroupId = groupId || `peer:${remotePeerId}`;

      if (options.verbose) {
        console.log(
          `[webrtc-listen] Saved file "${safeName}" (${fileBuf.length} bytes) to ${targetPath}`,
        );
      }

      let reply: string | undefined;
      if (
        prompt &&
        typeof prompt === "string" &&
        prompt.trim() &&
        isAgentEnabled
      ) {
        const runAgentFn =
          options.runAgent ||
          (async (promptText: string, runOpts: any) => {
            const { runAgentRun } = await import("./agent.js");
            return runAgentRun(promptText, runOpts);
          });

        const agentPrompt = `[Attached file: ${safeName} (${fileBuf.length} bytes) saved at ${targetPath}]\n\n${prompt.trim()}`;
        const agentResult = await runAgentFn(agentPrompt, {
          workspace: options.workspace,
          cacheDir: options.cacheDir,
          model: options.model,
          provider: options.provider,
          apiKey: options.apiKey,
          systemPrompt: options.systemPrompt,
          systemPromptFile: options.systemPromptFile,
          tools: options.tools,
          allowInternet: options.allowInternet,
          group: targetGroupId,
          quiet: !options.verbose,
          stream: false,
        });

        if (agentResult?.success) {
          reply = agentResult.response;
        }
      }

      return {
        success: true,
        fileName: safeName,
        path: targetPath,
        size: fileBuf.length,
        reply,
        text: reply,
      };
    },

    "transfer-file": async (args: any, context?: any) => {
      return handlers["send-file"](args, context);
    },

    "list-tools": async () => {
      try {
        const { TOOL_DEFINITIONS } =
          await import("../../subsystems/tools/index.js");
        return {
          tools: TOOL_DEFINITIONS.map((t) => t.name),
        };
      } catch (_) {
        return { tools: [] };
      }
    },

    ping: async (_args?: any) => {
      return {
        ok: true,
        peerId: options.peerId || "",
        timestamp: Date.now(),
      };
    },
  };

  return handlers;
}

export interface WebRtcListenerLike {
  cliPeerId: string;
  _connections: Map<string, any>;
  _peerCards?: Map<string, any>;
  _pendingIpc: Map<string, (payload: any) => void>;
  _setupConnection?: (conn: any, remotePeerId: string) => void;
  start?: () => Promise<void>;
  close?: () => void;
}

export function startIpcServer(
  listener: WebRtcListenerLike,
  cacheDir?: string,
): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const socketPath = getIpcSocketPath(cacheDir);

    // Remove stale socket from a previous run
    try {
      fs.unlinkSync(socketPath);
    } catch (_) {}

    // Ensure .cache dir exists
    try {
      fs.mkdirSync(path.dirname(socketPath), { recursive: true });
    } catch (_) {}

    const server = http.createServer(async (req, res) => {
      // Health check
      if (req.method === "GET" && req.url === "/ping") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, peerId: listener.cliPeerId }));
        return;
      }

      // List connected WebRTC peers
      if (req.method === "GET" && req.url === "/clients") {
        const connectedPeers = Array.from(listener._connections.keys());
        const clients = connectedPeers.map((peerId) => {
          const card = listener._peerCards?.get(peerId);
          return {
            clientId: peerId,
            peerId,
            deviceLabel: card?.name || `Browser Peer (${peerId})`,
            capabilities: card?.capabilities || ["webrtc", "peerjs"],
            version: card?.version || "1.0.0",
            transport: "webrtc",
            connectedAt: Date.now(),
            lastSeen: Date.now(),
          };
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, clients }));
        return;
      }

      // Forward command over the established DataChannel
      if (req.method === "POST" && req.url === "/command") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          try {
            const { targetPeerId, action, args, timeoutMs } = JSON.parse(body);

            if (!targetPeerId) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "targetPeerId is required" }));
              return;
            }

            const conn = listener._connections.get(targetPeerId);
            if (!conn) {
              const connectedPeers = Array.from(listener._connections.keys());
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error:
                    `No DataChannel open to peer "${targetPeerId}". ` +
                    `Make sure the browser has connected to this listener first.` +
                    (connectedPeers.length
                      ? ` Connected peers: ${connectedPeers.join(", ")}`
                      : " No peers are currently connected."),
                }),
              );
              return;
            }

            const commandId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const message = {
              id: commandId,
              type: "command:execute",
              payload: { commandId, action, args: args || {} },
            };

            const result = await new Promise((cmdResolve, cmdReject) => {
              const timer = setTimeout(() => {
                listener._pendingIpc.delete(commandId);
                cmdReject(
                  new Error(
                    `Command "${action}" timed out after ${timeoutMs || 30000}ms`,
                  ),
                );
              }, timeoutMs || 30000);

              listener._pendingIpc.set(commandId, (payload) => {
                clearTimeout(timer);
                cmdResolve(payload);
              });

              try {
                conn.send(message);
              } catch (err) {
                clearTimeout(timer);
                listener._pendingIpc.delete(commandId);
                cmdReject(err);
              }
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(socketPath, () => {
      console.log(`[webrtc-listen] IPC socket: ${socketPath}`);
      resolve(server);
    });

    server.on("error", reject);
  });
}

export async function runWebRtcListenCommand(
  options: WebRtcListenOptions = {},
): Promise<void> {
  const host = options.host || process.env.SHADOWCLAW_HOST || "127.0.0.1";
  const port = options.port
    ? parseInt(String(options.port), 10)
    : parseInt(process.env.SHADOWCLAW_PORT || "8888", 10);
  const peerPath = options.path || "/";
  const secure = Boolean(
    options.secure ||
    options.https ||
    ["1", "true", "yes"].includes(
      (process.env.SHADOWCLAW_HTTPS || "").toLowerCase().trim(),
    ),
  );
  // --insecure / -k: allow self-signed TLS certificates (default: true for dev)
  const rejectUnauthorized =
    options.insecure === false ||
    ["0", "false", "no"].includes(
      (process.env.SHADOWCLAW_TLS_REJECT_UNAUTHORIZED || "")
        .toLowerCase()
        .trim(),
    )
      ? true
      : false;
  const trustedPeerIds = options.trustedPeer
    ? Array.isArray(options.trustedPeer)
      ? options.trustedPeer
      : [options.trustedPeer]
    : [];

  const cliPeerId = getOrCreateCliPeerId(options.peerId, options.cacheDir);

  console.log(`WebRTC CLI Peer ID : ${cliPeerId}`);
  console.log(
    `Signaling server   : ${secure ? "wss" : "ws"}://${host}:${port}${peerPath}`,
  );
  if (secure && !rejectUnauthorized) {
    console.log(`TLS verification   : disabled (self-signed cert allowed)`);
  }
  if (trustedPeerIds.length > 0) {
    console.log(`Trusted peers      : ${trustedPeerIds.join(", ")}`);
  } else {
    console.log(
      `Trusted peers      : (any — add --trusted-peer <id> to restrict)`,
    );
  }
  console.log("");
  console.log("Add this CLI Peer ID as a trusted peer in the browser:");
  console.log(`  Settings → WebRTC/PeerJS → Trusted Peer IDs → "${cliPeerId}"`);
  console.log("");

  const defaultHandlers = createDefaultWebRtcHandlers({
    ...options,
    peerId: cliPeerId,
  });

  const combinedHandlers = {
    ...defaultHandlers,
    ...(options.handlers || {}),
  };

  const listener = new CliWebRtcListener({
    host,
    port,
    path: peerPath,
    secure,
    rejectUnauthorized,
    trustedPeerIds,
    peerId: options.peerId,
    cacheDir: options.cacheDir,
    renewPeerId: Boolean(options.renewPeerId),
    verbose: Boolean(options.verbose),
    handlers: combinedHandlers,
  });

  const pendingIpc = new Map<string, (payload: any) => void>();
  (listener as any)._pendingIpc = pendingIpc;

  // Intercept _setupConnection to wire up IPC command result handling
  const originalSetup = (listener as any)._setupConnection.bind(listener);
  (listener as any)._setupConnection = function (
    conn: any,
    remotePeerId: string,
  ) {
    originalSetup(conn, remotePeerId);
    conn.on("data", (rawData: any) => {
      let msg = rawData;
      if (typeof rawData === "string") {
        try {
          msg = JSON.parse(rawData);
        } catch (_) {
          return;
        }
      }
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "command:result") {
        const payload = msg.payload || {};
        const cb = pendingIpc.get(payload.commandId);
        if (cb) {
          pendingIpc.delete(payload.commandId);
          cb(payload);
        }
      }
    });
  };

  const shutdown = (ipcServer?: http.Server) => {
    console.log("\n[webrtc-listen] Shutting down…");
    clearIpcFile(options.cacheDir);
    if (ipcServer) {
      try {
        ipcServer.close();
      } catch (_) {}
    }
    listener.close();
    process.exit(0);
  };

  try {
    await listener.start();
    const ipcServer = await startIpcServer(listener as any, options.cacheDir);

    process.on("SIGINT", () => shutdown(ipcServer));
    process.on("SIGTERM", () => shutdown(ipcServer));

    console.log(
      `[webrtc-listen] Ready. Run commands with:\n` +
        `  node bin/cli.mjs send --transport webrtc --client <browser-peer-id> "message"`,
    );

    await new Promise(() => {}); // keep alive
  } catch (err: any) {
    clearIpcFile(options.cacheDir);
    console.error(`Error starting WebRTC listener: ${err.message}`);
    process.exitCode = 1;
  }
}
