/**
 * ShadowClaw — Server-Side WebRTC Peer & A2A Bridge
 *
 * Enables the ShadowClaw server to act as a first-class WebRTC peer using
 * node-datachannel. Can connect to local or remote PeerJS signaling servers,
 * communicate directly with browser clients, other ShadowClaw servers,
 * and CLI tools over RTCDataChannels.
 */

import { getPeerClass } from "./webrtc.js";
import { ulid } from "../utils/ulid.js";
import type {
  ControlMessage,
  CommandExecutePayload,
  CommandResultPayload,
} from "./control-plane-types.js";

export interface ServerPeerOptions {
  peerId?: string;
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
  verbose?: boolean;
  handlers?: Record<string, (args: any) => Promise<any> | any>;
}

export class ServerPeer {
  private _peerId: string;
  private _host: string;
  private _port: number;
  private _path: string;
  private _secure: boolean;
  private _verbose: boolean;
  private _peer: any = null;
  private _connections: Map<string, any> = new Map();
  private _pendingCommands: Map<
    string,
    {
      resolve: (val: any) => void;
      reject: (err: any) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();
  private _handlers: Map<string, (args: any) => Promise<any> | any> = new Map();
  private _isOpen = false;

  constructor(options: ServerPeerOptions = {}) {
    this._peerId = options.peerId || `server-${ulid().toLowerCase()}`;
    this._host = options.host || "127.0.0.1";
    this._port = options.port || 8888;
    this._path = options.path || "/";
    this._secure = options.secure ?? false;
    this._verbose = options.verbose ?? false;

    if (options.handlers) {
      for (const [action, fn] of Object.entries(options.handlers)) {
        this._handlers.set(action, fn);
      }
    }
  }

  public get peerId(): string {
    return this._peerId;
  }

  public get isOpen(): boolean {
    return this._isOpen;
  }

  private log(msg: string): void {
    if (this._verbose) {
      console.log(`[server-peer] ${msg}`);
    }
  }

  public async start(): Promise<string> {
    const Peer = await getPeerClass();

    return new Promise((resolve, reject) => {
      try {
        const peer = new Peer(this._peerId, {
          host: this._host,
          port: this._port,
          path: this._path,
          secure: this._secure,
        });

        this._peer = peer;

        peer.on("open", (id: string) => {
          this._peerId = id;
          this._isOpen = true;
          this.log(`Server peer opened with ID: ${id}`);
          resolve(id);
        });

        peer.on("connection", (conn: any) => {
          this._setupConnection(conn);
        });

        peer.on("error", (err: any) => {
          this.log(`Server peer error: ${err.message || String(err)}`);
          if (!this._isOpen) {
            reject(err);
          }
        });

        peer.on("close", () => {
          this._isOpen = false;
          this._connections.clear();
          this.log("Server peer closed");
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private _setupConnection(conn: any): void {
    const remotePeerId = conn.peer;

    conn.on("open", () => {
      this._connections.set(remotePeerId, conn);
      this.log(`DataChannel connected with peer: ${remotePeerId}`);
    });

    conn.on("data", (data: any) => {
      this._handleData(remotePeerId, conn, data);
    });

    conn.on("close", () => {
      this._connections.delete(remotePeerId);
      this.log(`DataChannel closed for peer: ${remotePeerId}`);
    });

    conn.on("error", (err: any) => {
      this.log(`DataChannel error with ${remotePeerId}: ${err.message}`);
    });
  }

  private async _handleData(
    _remotePeerId: string,
    conn: any,
    rawData: any,
  ): Promise<void> {
    let msg: any = rawData;
    if (typeof rawData === "string") {
      try {
        msg = JSON.parse(rawData);
      } catch {
        return;
      }
    }

    if (!msg || typeof msg !== "object") {
      return;
    }

    // Handle Control Plane execute commands
    if (msg.type === "command:execute") {
      const payload = msg.payload as CommandExecutePayload;
      const { commandId, action, args } = payload || {};

      const handler = this._handlers.get(action);
      if (!handler) {
        const result: ControlMessage = {
          id: ulid(),
          type: "command:result",
          replyTo: msg.id,
          payload: {
            commandId,
            success: false,
            error: `Unknown action: ${action}`,
          } as CommandResultPayload,
        };
        conn.send(result);
        return;
      }

      try {
        const data = await handler(args);
        const result: ControlMessage = {
          id: ulid(),
          type: "command:result",
          replyTo: msg.id,
          payload: {
            commandId,
            success: true,
            data,
          } as CommandResultPayload,
        };
        conn.send(result);
      } catch (err: any) {
        const result: ControlMessage = {
          id: ulid(),
          type: "command:result",
          replyTo: msg.id,
          payload: {
            commandId,
            success: false,
            error: err.message || String(err),
          } as CommandResultPayload,
        };
        conn.send(result);
      }
      return;
    }

    // Handle Control Plane command result responses
    if (msg.type === "command:result") {
      const res = msg.payload as CommandResultPayload;
      if (res?.commandId && this._pendingCommands.has(res.commandId)) {
        const pending = this._pendingCommands.get(res.commandId)!;
        clearTimeout(pending.timeout);
        this._pendingCommands.delete(res.commandId);
        pending.resolve(res);
      }
      return;
    }
  }

  public isPeerConnected(remotePeerId: string): boolean {
    const conn = this._connections.get(remotePeerId);
    return !!conn && (conn.open || conn._open);
  }

  public getConnectedPeers(): string[] {
    return Array.from(this._connections.keys());
  }

  public async sendCommand(
    remotePeerId: string,
    action: string,
    args: Record<string, unknown> = {},
    timeoutMs: number = 30_000,
  ): Promise<CommandResultPayload> {
    if (!this._peer || !this._isOpen) {
      throw new Error("Server peer is not running");
    }

    let conn = this._connections.get(remotePeerId);
    if (!conn || !conn.open) {
      conn = this._peer.connect(remotePeerId, {
        reliable: true,
        serialization: "binary",
      });
      this._setupConnection(conn);

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(
          () => {
            reject(
              new Error(
                `Connection to peer ${remotePeerId} timed out after ${timeoutMs}ms`,
              ),
            );
          },
          Math.min(10_000, timeoutMs),
        );

        conn.on("open", () => {
          clearTimeout(t);
          resolve();
        });
        conn.on("error", (err: any) => {
          clearTimeout(t);
          reject(err);
        });
      });
    }

    const commandId = ulid();
    const commandPayload: CommandExecutePayload = {
      commandId,
      action: action as any,
      args,
    };

    const message: ControlMessage = {
      id: ulid(),
      type: "command:execute",
      payload: commandPayload,
    };

    return new Promise<CommandResultPayload>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingCommands.delete(commandId);
        reject(
          new Error(
            `Command ${action} to peer ${remotePeerId} timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      this._pendingCommands.set(commandId, { resolve, reject, timeout });

      try {
        conn.send(message);
      } catch (err) {
        clearTimeout(timeout);
        this._pendingCommands.delete(commandId);
        reject(err);
      }
    });
  }

  public close(): void {
    this._isOpen = false;
    for (const [, pending] of this._pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Server peer closed"));
    }
    this._pendingCommands.clear();

    for (const conn of this._connections.values()) {
      try {
        conn.close();
      } catch (_) {}
    }
    this._connections.clear();

    if (this._peer) {
      try {
        this._peer.destroy();
      } catch (_) {}
      this._peer = null;
    }
  }
}
