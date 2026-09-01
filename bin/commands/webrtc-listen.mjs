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
 * No port selection, no TCP, no collision.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {
  CliWebRtcListener,
  getOrCreateCliPeerId,
  getIpcSocketPath,
  clearIpcFile,
} from "../utils/webrtc-control-client.mjs";

function startIpcServer(listener, cacheDir) {
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
          } catch (err) {
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

export async function runWebRtcListenCommand(options = {}) {
  const host = options.host || process.env.SHADOWCLAW_HOST || "127.0.0.1";
  const port = options.port
    ? parseInt(options.port, 10)
    : parseInt(process.env.SHADOWCLAW_PORT || "8888", 10);
  const peerPath = options.path || "/";
  const secure = Boolean(options.secure);
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

  const listener = new CliWebRtcListener({
    host,
    port,
    path: peerPath,
    secure,
    trustedPeerIds,
    peerId: options.peerId,
    cacheDir: options.cacheDir,
    renewPeerId: Boolean(options.renewPeerId),
    verbose: Boolean(options.verbose),
  });

  // Map for pending IPC-dispatched commands awaiting DataChannel responses
  listener._pendingIpc = new Map();

  // Intercept _setupConnection to wire up IPC command result handling
  const originalSetup = listener._setupConnection.bind(listener);
  listener._setupConnection = function (conn, remotePeerId) {
    originalSetup(conn, remotePeerId);
    conn.on("data", (rawData) => {
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
        const cb = listener._pendingIpc.get(payload.commandId);
        if (cb) {
          listener._pendingIpc.delete(payload.commandId);
          cb(payload);
        }
      }
    });
  };

  const shutdown = (ipcServer) => {
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
    const ipcServer = await startIpcServer(listener, options.cacheDir);

    process.on("SIGINT", () => shutdown(ipcServer));
    process.on("SIGTERM", () => shutdown(ipcServer));

    console.log(
      `[webrtc-listen] Ready. Run commands with:\n` +
        `  node bin/cli.mjs send --transport webrtc --client <browser-peer-id> "message"`,
    );

    await new Promise(() => {}); // keep alive
  } catch (err) {
    clearIpcFile(options.cacheDir);
    console.error(`Error starting WebRTC listener: ${err.message}`);
    process.exitCode = 1;
  }
}
