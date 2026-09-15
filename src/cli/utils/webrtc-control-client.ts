import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { ulid } from "../../utils/ulid.js";

export interface WebRtcClientOptions {
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
  rejectUnauthorized?: boolean;
  cacheDir?: string;
  peerId?: string;
  renewPeerId?: boolean;
}

export interface WebRtcListenerOptions extends WebRtcClientOptions {
  verbose?: boolean;
  handlers?: Record<string, (args: any) => Promise<any> | any>;
  trustedPeerIds?: string[];
  renewPeerId?: boolean;
}

export interface IpcEndpoint {
  socketPath?: string;
  port?: any;
}

export function getIpcSocketPath(cacheDir?: string): string {
  const dir =
    cacheDir ||
    (process.env.SHADOWCLAW_CACHE_DIR || "").trim() ||
    path.join(process.cwd(), ".cache");
  return path.join(dir, "webrtc-ipc.sock");
}

export function getIpcFilePath(cacheDir?: string): string {
  return getIpcSocketPath(cacheDir);
}

export function writeIpcFile(_socketPath: string, _cacheDir?: string): void {
  // Kept for API compatibility; callers pass the socket path.
}

export function clearIpcFile(cacheDir?: string): void {
  try {
    fs.unlinkSync(getIpcSocketPath(cacheDir));
  } catch (_) {}
}

/**
 * Returns the socket path if a live listener is reachable, else null.
 */
export async function resolveListenerIpc(
  cacheDir?: string,
): Promise<{ socketPath: string } | null> {
  const socketPath = getIpcSocketPath(cacheDir);
  try {
    if (!fs.existsSync(socketPath)) return null;

    // Verify the socket actually responds
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        { socketPath, path: "/ping", method: "GET" },
        (res) => {
          res.resume();
          res.statusCode === 200
            ? resolve()
            : reject(new Error(`status ${res.statusCode}`));
        },
      );
      req.setTimeout(1000, () => {
        req.destroy();
        reject(new Error("timeout"));
      });
      req.on("error", reject);
      req.end();
    });

    return { socketPath };
  } catch (_) {
    return null;
  }
}

/**
 * Send a command to a running listener via its Unix socket.
 */
export function sendCommandViaIpc(
  ipc: IpcEndpoint,
  targetPeerId: string,
  action: string,
  args: any,
  timeoutMs: number,
): Promise<any> {
  const socketPath = ipc.socketPath || ipc.port;
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ targetPeerId, action, args, timeoutMs });
    const req = http.request(
      {
        socketPath,
        path: "/command",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              resolve(parsed);
            } else {
              reject(new Error(parsed?.error || `IPC error ${res.statusCode}`));
            }
          } catch (_) {
            reject(new Error(`Bad IPC response: ${data}`));
          }
        });
      },
    );
    req.setTimeout(timeoutMs + 2000, () => {
      req.destroy();
      reject(new Error("IPC request timed out"));
    });
    req.on("error", (err) =>
      reject(new Error(`IPC connection failed: ${err.message}`)),
    );
    req.write(body);
    req.end();
  });
}

export function getCliPeerIdFilePath(cacheDir?: string): string {
  const dir =
    cacheDir ||
    (process.env.SHADOWCLAW_CACHE_DIR || "").trim() ||
    path.join(process.cwd(), ".cache");
  return path.join(dir, "cli-peer-id");
}

export function readCliPeerId(cacheDir?: string): string {
  if (process.env.SHADOWCLAW_CLI_PEER_ID) {
    return process.env.SHADOWCLAW_CLI_PEER_ID.trim();
  }
  const filePath = getCliPeerIdFilePath(cacheDir);
  try {
    if (fs.existsSync(filePath)) {
      const stored = fs.readFileSync(filePath, "utf8").trim();
      if (stored) {
        return stored;
      }
    }
  } catch (_) {}
  return "";
}

export function renewCliPeerId(customId?: string, cacheDir?: string): string {
  const filePath = getCliPeerIdFilePath(cacheDir);
  const dir = path.dirname(filePath);
  const newId =
    customId && typeof customId === "string" && customId.trim()
      ? customId.trim()
      : `cli-${ulid().toLowerCase()}`;

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, newId + "\n", "utf8");
  } catch (_) {}

  return newId;
}

export function getOrCreateCliPeerId(
  customId?: string,
  cacheDir?: string,
): string {
  if (customId && typeof customId === "string" && customId.trim()) {
    return customId.trim();
  }
  if (process.env.SHADOWCLAW_CLI_PEER_ID) {
    return process.env.SHADOWCLAW_CLI_PEER_ID.trim();
  }
  const existing = readCliPeerId(cacheDir);
  if (existing) {
    return existing;
  }
  return renewCliPeerId(undefined, cacheDir);
}

export async function ensureWebRtcPolyfill(): Promise<boolean> {
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as any).RTCPeerConnection !== "undefined"
  ) {
    return true;
  }

  try {
    const wrtc = await import("node-datachannel/polyfill" as any);
    if (wrtc && wrtc.RTCPeerConnection) {
      Object.assign(globalThis, {
        RTCPeerConnection: wrtc.RTCPeerConnection,
        RTCSessionDescription: wrtc.RTCSessionDescription,
        RTCIceCandidate: wrtc.RTCIceCandidate,
      });
      return true;
    }
  } catch (err: any) {
    console.warn(
      "[webrtc-cli] Failed to load node-datachannel polyfill:",
      err?.message || String(err),
    );
  }
  return false;
}

export class CliWebRtcControlClient {
  host: string;
  port: number;
  path: string;
  secure: boolean;
  rejectUnauthorized: boolean;
  peer: any;
  cacheDir?: string;
  cliPeerId: string;

  constructor(options: WebRtcClientOptions = {}) {
    this.host = options.host || process.env.SHADOWCLAW_HOST || "127.0.0.1";
    this.port =
      options.port || parseInt(process.env.SHADOWCLAW_PORT || "8888", 10);
    this.path = options.path || "/";
    this.secure = options.secure ?? false;
    this.rejectUnauthorized = options.rejectUnauthorized ?? false;
    this.peer = null;
    this.cacheDir = options.cacheDir;
    this.cliPeerId =
      options.peerId && options.peerId.trim()
        ? options.peerId.trim()
        : getOrCreateCliPeerId(undefined, options.cacheDir);
  }

  async _getPeer(): Promise<any> {
    if (this.peer && !this.peer.destroyed) {
      return this.peer;
    }

    await ensureWebRtcPolyfill();
    const mod = await import("peerjs" as any);
    const Peer = mod.default?.Peer || mod.default || mod.Peer;

    return new Promise((resolve, reject) => {
      const peerConfig: any = {
        host: this.host,
        port: this.port,
        path: this.path,
        secure: this.secure,
      };

      if (this.secure) {
        peerConfig.config = { iceServers: [] };
        peerConfig.wsOptions = { rejectUnauthorized: this.rejectUnauthorized };
      }

      const peer = new Peer(this.cliPeerId, peerConfig);

      this.peer = peer;

      peer.on("open", () => {
        resolve(peer);
      });

      peer.on("error", (err: any) => {
        reject(new Error(`PeerJS error: ${err.type || err.message || err}`));
      });
    });
  }

  async sendCommand(
    targetPeerId: string,
    action: string,
    args: any = {},
    timeoutMs: number = 30000,
  ): Promise<any> {
    const ipc = await resolveListenerIpc(this.cacheDir);
    if (ipc) {
      return sendCommandViaIpc(ipc, targetPeerId, action, args, timeoutMs);
    }

    const peer = await this._getPeer();

    return new Promise((resolve, reject) => {
      let timeoutTimer: NodeJS.Timeout | null = null;
      let conn: any = null;

      const cleanup = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (conn) {
          try {
            conn.close();
          } catch (_) {}
        }
        if (this.peer) {
          try {
            this.peer.destroy();
          } catch (_) {}
          this.peer = null;
        }
      };

      timeoutTimer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `WebRTC command '${action}' to peer '${targetPeerId}' timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      try {
        conn = peer.connect(targetPeerId, {
          reliable: true,
          serialization: "binary",
        });

        conn.on("open", () => {
          const commandId = ulid();
          const message = {
            id: ulid(),
            type: "command:execute",
            payload: {
              commandId,
              action,
              args,
            },
          };
          conn.send(message);
        });

        conn.on("data", (rawData: any) => {
          let msg = rawData;
          if (typeof rawData === "string") {
            try {
              msg = JSON.parse(rawData);
            } catch (_) {}
          }

          if (msg && msg.method === "GetAgentCard" && msg.id) {
            try {
              conn.send({
                jsonrpc: "2.0",
                id: msg.id,
                result: {
                  name: "ShadowClaw CLI",
                  description: "ShadowClaw Command Line Interface",
                  version: "1.0.0",
                },
              });
            } catch (_) {}
            return;
          }

          if (msg && msg.type === "command:result") {
            cleanup();
            if (msg.payload?.error) {
              reject(new Error(msg.payload.error));
            } else {
              resolve(msg.payload);
            }
          }
        });

        conn.on("error", (err: any) => {
          cleanup();
          reject(
            new Error(
              `WebRTC connection error to peer '${targetPeerId}': ${err.message || String(err)}`,
            ),
          );
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  }

  async listClients(): Promise<any[]> {
    const ipc = await resolveListenerIpc(this.cacheDir);
    if (!ipc) {
      return [];
    }

    const socketPath = ipc.socketPath;
    return new Promise((resolve) => {
      const req = http.request(
        { socketPath, path: "/clients", method: "GET" },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.clients || []);
            } catch (_) {
              resolve([]);
            }
          });
        },
      );
      req.setTimeout(2000, () => {
        req.destroy();
        resolve([]);
      });
      req.on("error", () => resolve([]));
      req.end();
    });
  }

  close(): void {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (_) {}
      this.peer = null;
    }
  }
}

export class CliWebRtcListener {
  static _RECONNECT_BASE_MS = 1000;
  static _RECONNECT_MAX_MS = 30000;

  host: string;
  port: number;
  path: string;
  secure: boolean;
  rejectUnauthorized: boolean;
  cacheDir?: string;
  verbose: boolean;
  handlers: Record<string, (args: any) => Promise<any> | any>;
  trustedPeerIds: Set<string>;
  cliPeerId: string;
  _peer: any;
  _connections: Map<string, any>;
  _peerCards: Map<string, any>;
  _running: boolean;
  _reconnectAttempts: number;
  _reconnectTimer: NodeJS.Timeout | null;

  constructor(options: WebRtcListenerOptions = {}) {
    this.host = options.host || process.env.SHADOWCLAW_HOST || "127.0.0.1";
    this.port =
      options.port || parseInt(process.env.SHADOWCLAW_PORT || "8888", 10);
    this.path = options.path || "/";
    this.secure = options.secure ?? false;
    this.rejectUnauthorized = options.rejectUnauthorized ?? false;
    this.cacheDir = options.cacheDir;
    this.verbose = options.verbose ?? false;
    this.handlers = options.handlers || {};
    this.trustedPeerIds = new Set(
      (options.trustedPeerIds || []).map((id) => id.trim()).filter(Boolean),
    );
    this.cliPeerId = options.renewPeerId
      ? renewCliPeerId(options.peerId, options.cacheDir)
      : getOrCreateCliPeerId(options.peerId, options.cacheDir);

    this._peer = null;
    this._connections = new Map();
    this._peerCards = new Map();
    this._running = false;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
  }

  _log(msg: string): void {
    if (this.verbose) {
      console.log(`[webrtc-listen] ${msg}`);
    }
  }

  _isTrusted(remotePeerId: string): boolean {
    if (this.trustedPeerIds.size === 0) return true;
    if (this.trustedPeerIds.has(remotePeerId)) return true;
    for (const t of this.trustedPeerIds) {
      if (t.endsWith("*") && remotePeerId.startsWith(t.slice(0, -1)))
        return true;
    }
    return false;
  }

  _scheduleReconnect(): void {
    if (!this._running || this._reconnectTimer !== null) {
      return;
    }

    const delay = Math.min(
      CliWebRtcListener._RECONNECT_BASE_MS *
        Math.pow(2, this._reconnectAttempts),
      CliWebRtcListener._RECONNECT_MAX_MS,
    );

    this._reconnectAttempts++;

    console.log(
      `[webrtc-listen] Disconnected from signaling server — reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this._reconnectAttempts})…`,
    );

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this._running || !this._peer || this._peer.destroyed) {
        return;
      }

      try {
        this._peer.reconnect();
      } catch {
        this._scheduleReconnect();
      }
    }, delay);
  }

  async _handleCommand(
    conn: any,
    _remotePeerId: string,
    msg: any,
  ): Promise<void> {
    const payload = msg.payload || {};
    const { commandId, action, args } = payload;

    const handler = this.handlers[action];
    if (!handler) {
      conn.send({
        id: ulid(),
        type: "command:result",
        payload: {
          commandId,
          success: false,
          error: `Unknown action: ${action}`,
        },
      });
      return;
    }

    try {
      const data = await handler(args || {});
      conn.send({
        id: ulid(),
        type: "command:result",
        payload: { commandId, success: true, data },
      });
    } catch (err: any) {
      conn.send({
        id: ulid(),
        type: "command:result",
        payload: {
          commandId,
          success: false,
          error: err?.message || String(err),
        },
      });
    }
  }

  _setupConnection(conn: any, remotePeerId: string): void {
    conn.on("open", () => {
      this._connections.set(remotePeerId, conn);
      console.log(
        `[webrtc-listen] Connection opened from peer: ${remotePeerId}`,
      );

      try {
        conn.send({
          jsonrpc: "2.0",
          id: ulid(),
          method: "GetAgentCard",
          params: {},
        });
      } catch (_) {}
    });

    conn.on("data", async (rawData: any) => {
      let msg = rawData;
      if (typeof rawData === "string") {
        try {
          msg = JSON.parse(rawData);
        } catch (_) {
          return;
        }
      }
      if (!msg || typeof msg !== "object") return;

      if (msg.result && typeof msg.result === "object" && msg.result.name) {
        this._peerCards.set(remotePeerId, msg.result);
        return;
      }

      if (msg.method === "GetAgentCard" && msg.id) {
        try {
          conn.send({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              name: "ShadowClaw CLI",
              description: "ShadowClaw Command Line Interface",
              version: "1.0.0",
              capabilities: ["cli", "webrtc", "control"],
            },
          });
        } catch (_) {}
        return;
      }

      if (msg.type === "command:execute") {
        await this._handleCommand(conn, remotePeerId, msg);
      }
    });

    conn.on("close", () => {
      this._connections.delete(remotePeerId);
      this._peerCards.delete(remotePeerId);
      console.log(
        `[webrtc-listen] Connection closed from peer: ${remotePeerId}`,
      );
    });

    conn.on("error", (err: any) => {
      this._connections.delete(remotePeerId);
      this._peerCards.delete(remotePeerId);
      console.error(
        `[webrtc-listen] Connection error from ${remotePeerId}: ${err?.message || err}`,
      );
    });
  }

  async start(): Promise<string> {
    await ensureWebRtcPolyfill();
    const mod = await import("peerjs" as any);
    const Peer = mod.default?.Peer || mod.default || mod.Peer;

    return new Promise((resolve, reject) => {
      let isOpened = false;

      const peerConfig: any = {
        host: this.host,
        port: this.port,
        path: this.path,
        secure: this.secure,
      };

      if (this.secure) {
        peerConfig.config = { iceServers: [] };
        peerConfig.wsOptions = { rejectUnauthorized: this.rejectUnauthorized };
      }

      const peer = new Peer(this.cliPeerId, peerConfig);

      this._peer = peer;
      this._running = true;

      peer.on("open", (id: string) => {
        isOpened = true;
        this._reconnectAttempts = 0;
        if (this._reconnectTimer !== null) {
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = null;
        }

        console.log(
          `[webrtc-listen] Registered on signaling server as peer: ${id}`,
        );
        console.log(
          `[webrtc-listen] Waiting for connections from browser peers…`,
        );
        resolve(id);
      });

      peer.on("connection", (conn: any) => {
        const remotePeerId = conn.peer;

        if (!this._isTrusted(remotePeerId)) {
          console.warn(
            `[webrtc-listen] Rejecting untrusted peer: ${remotePeerId}`,
          );
          try {
            conn.close();
          } catch (_) {}
          return;
        }

        this._setupConnection(conn, remotePeerId);
      });

      peer.on("error", (err: any) => {
        if (!this._running) return;
        const errStr = err?.type || err?.message || String(err);
        console.error(`[webrtc-listen] PeerJS error: ${errStr}`);
        if (!isOpened) {
          reject(new Error(`PeerJS error: ${errStr}`));
        } else if (!peer.open) {
          this._scheduleReconnect();
        }
      });

      peer.on("disconnected", () => {
        if (this._running) {
          this._scheduleReconnect();
        }
      });

      peer.on("close", () => {
        this._running = false;
        if (this._reconnectTimer !== null) {
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = null;
        }
        console.log("[webrtc-listen] Peer closed.");
      });
    });
  }

  close(): void {
    this._running = false;
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectAttempts = 0;

    for (const conn of this._connections.values()) {
      try {
        conn.close();
      } catch (_) {}
    }
    this._connections.clear();
    this._peerCards.clear();

    if (this._peer) {
      try {
        this._peer.destroy();
      } catch (_) {}
      this._peer = null;
    }
  }
}
