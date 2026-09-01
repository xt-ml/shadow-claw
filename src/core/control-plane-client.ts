/**
 * ShadowClaw — Browser Control Plane Client
 *
 * Supports dual transport:
 * 1. "sse" (default): HTTP Server-Sent Events (GET /api/control/events) for
 *    server-to-client commands + HTTP POST (/api/control/messages) for client-to-server.
 *    Highly proxy-, CDN-, and firewall-compatible.
 * 2. "websocket": Full-duplex WebSocket connection to `/ws/control`.
 */

import type {
  ControlMessage,
  ClientRegisterPayload,
  HeartbeatPayload,
  CommandExecutePayload,
  CommandResultPayload,
  ControlPlaneTransport,
} from "../server/control-plane-types.js";
import { ulid } from "../utils/ulid.js";

export type CommandHandler = (args: any) => Promise<any> | any;

export interface ControlPlaneClientOptions {
  transport?: ControlPlaneTransport;
  url?: string;
  httpUrl?: string;
  token?: string;
  clientId: string;
  deviceLabel?: string;
  capabilities?: string[];
  version?: string;
  peerId?: string;
  heartbeatIntervalMs?: number;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  handlers?: Record<string, CommandHandler>;
  WebSocketClass?: any;
  EventSourceClass?: any;
  fetchFn?: typeof fetch;
}

export class ControlPlaneClient {
  private _transport: ControlPlaneTransport;
  private _url: string;
  private _httpUrl: string;
  private _token?: string;
  private _clientId: string;
  private _peerId?: string;
  private _deviceLabel: string;
  private _capabilities: string[];
  private _version: string;
  private _heartbeatIntervalMs: number;
  private _reconnectDelayMs: number;
  private _maxReconnectDelayMs: number;
  private _handlers: Map<string, CommandHandler>;
  private _WebSocketClass: any;
  private _EventSourceClass: any;
  private _fetchFn: typeof fetch;

  private _ws: WebSocket | null = null;
  private _es: any = null;
  private _heartbeatTimer: any = null;
  private _reconnectTimer: any = null;
  private _currentReconnectDelay: number;
  private _isDestroyed: boolean = false;
  private _state: "disconnected" | "connecting" | "connected" = "disconnected";

  constructor(options: ControlPlaneClientOptions) {
    this._transport = options.transport || "sse";
    this._clientId = options.clientId;
    this._peerId = options.peerId;
    this._deviceLabel = options.deviceLabel || "ShadowClaw Browser Client";
    this._capabilities = options.capabilities || ["webmcp", "opfs", "push"];
    this._version = options.version || "1.23.4";
    this._token = options.token;
    this._heartbeatIntervalMs = options.heartbeatIntervalMs || 10000;
    this._reconnectDelayMs = options.reconnectDelayMs || 1000;
    this._maxReconnectDelayMs = options.maxReconnectDelayMs || 30000;
    this._currentReconnectDelay = this._reconnectDelayMs;
    this._handlers = new Map();

    this._WebSocketClass =
      options.WebSocketClass ||
      (typeof WebSocket !== "undefined" ? WebSocket : null);
    this._EventSourceClass =
      options.EventSourceClass ||
      (typeof EventSource !== "undefined" ? EventSource : null);
    this._fetchFn =
      options.fetchFn ||
      (typeof fetch !== "undefined"
        ? fetch.bind(globalThis)
        : ((() => Promise.reject(new Error("fetch not available"))) as any));

    if (options.handlers) {
      for (const [action, handler] of Object.entries(options.handlers)) {
        this.registerHandler(action, handler);
      }
    }

    const loc = typeof location !== "undefined" ? location : null;
    const origin = loc
      ? `${loc.protocol}//${loc.host}`
      : "http://127.0.0.1:8888";
    const wsOrigin = loc
      ? `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}`
      : "ws://127.0.0.1:8888";

    this._url = options.url || `${wsOrigin}/ws/control`;
    this._httpUrl = options.httpUrl || origin;
  }

  public get transport(): ControlPlaneTransport {
    return this._transport;
  }

  public registerHandler(action: string, handler: CommandHandler): void {
    this._handlers.set(action, handler);
  }

  public unregisterHandler(action: string): void {
    this._handlers.delete(action);
  }

  public getState(): "disconnected" | "connecting" | "connected" {
    return this._state;
  }

  public connect(): void {
    if (
      this._isDestroyed ||
      this._state === "connected" ||
      this._state === "connecting"
    ) {
      return;
    }

    if (this._transport === "websocket") {
      this._connectWebSocket();
    } else {
      this._connectSse();
    }
  }

  private _connectWebSocket(): void {
    if (!this._WebSocketClass) {
      console.warn(
        "[ControlPlaneClient] WebSocket not supported in this environment",
      );
      return;
    }

    this._state = "connecting";
    const wsUrl = new URL(this._url, "ws://127.0.0.1:8888");
    if (this._token) {
      wsUrl.searchParams.set("token", this._token);
    }

    try {
      const ws = new this._WebSocketClass(wsUrl.toString());
      this._ws = ws;

      ws.onopen = () => {
        this._state = "connected";
        this._currentReconnectDelay = this._reconnectDelayMs;
        this._sendRegister();
        this._startHeartbeat();
      };

      ws.onmessage = (event: MessageEvent) => {
        this._handleMessage(event.data);
      };

      ws.onclose = () => {
        this._cleanupConnection();
        if (!this._isDestroyed) {
          this._scheduleReconnect();
        }
      };

      ws.onerror = (err: any) => {
        console.warn("[ControlPlaneClient] WebSocket error:", err);
      };
    } catch (err) {
      console.warn(
        "[ControlPlaneClient] Failed to establish WebSocket connection:",
        err,
      );
      this._cleanupConnection();
      this._scheduleReconnect();
    }
  }

  private _connectSse(): void {
    if (!this._EventSourceClass) {
      if (typeof process === "undefined" || !process.env?.JEST_WORKER_ID) {
        console.warn(
          "[ControlPlaneClient] EventSource not supported in this environment",
        );
      }
      return;
    }

    this._state = "connecting";
    const sseUrl = new URL("/api/control/events", this._httpUrl);
    sseUrl.searchParams.set("clientId", this._clientId);
    if (this._token) {
      sseUrl.searchParams.set("token", this._token);
    }

    try {
      const es = new this._EventSourceClass(sseUrl.toString());
      this._es = es;

      es.onopen = () => {
        this._state = "connected";
        this._currentReconnectDelay = this._reconnectDelayMs;
        this._sendRegister();
        this._startHeartbeat();
      };

      if (typeof es.addEventListener === "function") {
        es.addEventListener("command:execute", (event: MessageEvent) => {
          this._handleMessage(event.data);
        });
      }

      es.onmessage = (event: MessageEvent) => {
        this._handleMessage(event.data);
      };

      es.onerror = (err: any) => {
        console.warn("[ControlPlaneClient] SSE connection error:", err);
        this._cleanupConnection();
        if (!this._isDestroyed) {
          this._scheduleReconnect();
        }
      };
    } catch (err) {
      console.warn(
        "[ControlPlaneClient] Failed to establish SSE connection:",
        err,
      );
      this._cleanupConnection();
      this._scheduleReconnect();
    }
  }

  public disconnect(): void {
    this._isDestroyed = true;
    this._cleanupConnection();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  private _cleanupConnection(): void {
    this._state = "disconnected";
    this._stopHeartbeat();
    if (this._ws) {
      try {
        this._ws.close();
      } catch (_) {}
      this._ws = null;
    }
    if (this._es) {
      try {
        this._es.close();
      } catch (_) {}
      this._es = null;
    }
  }

  private _scheduleReconnect(): void {
    if (this._reconnectTimer || this._isDestroyed) {
      return;
    }

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this._isDestroyed) {
        this.connect();
      }
    }, this._currentReconnectDelay);

    this._currentReconnectDelay = Math.min(
      this._currentReconnectDelay * 1.5,
      this._maxReconnectDelayMs,
    );
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      this._sendHeartbeat();
    }, this._heartbeatIntervalMs);
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private _sendRegister(): void {
    const payload: ClientRegisterPayload = {
      clientId: this._clientId,
      deviceLabel: this._deviceLabel,
      capabilities: this._capabilities,
      version: this._version,
      transport: this._transport,
      peerId: this._peerId,
    };
    this._sendMessage({
      id: ulid(),
      type: "client:register",
      payload,
    });
  }

  private _sendHeartbeat(): void {
    const payload: HeartbeatPayload = {
      clientId: this._clientId,
      timestamp: Date.now(),
    };
    this._sendMessage({
      id: ulid(),
      type: "client:heartbeat",
      payload,
    });
  }

  private _sendMessage(msg: ControlMessage): void {
    if (this._transport === "websocket") {
      if (
        this._ws &&
        (this._ws.readyState === 1 ||
          this._ws.readyState === (this._WebSocketClass as any)?.OPEN)
      ) {
        this._ws.send(JSON.stringify(msg));
      }
      return;
    }

    // SSE Mode: send messages to server via HTTP POST /api/control/messages
    const messagesUrl = new URL("/api/control/messages", this._httpUrl);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this._token) {
      headers["x-control-token"] = this._token;
      headers["Authorization"] = `Bearer ${this._token}`;
    }

    const fetchOptions: any = {
      method: "POST",
      headers,
      body: JSON.stringify(msg),
    };

    const host = messagesUrl.hostname.toLowerCase();
    const isLoopback =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]";
    const isPrivate = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host);

    if (isLoopback) {
      fetchOptions.targetAddressSpace = "loopback";
    } else if (isPrivate) {
      fetchOptions.targetAddressSpace = "private";
    }

    this._fetchFn(messagesUrl.toString(), fetchOptions).catch((err) => {
      console.warn(
        "[ControlPlaneClient] Failed to send message via HTTP POST:",
        err,
      );
    });
  }

  private async _handleMessage(dataStr: string): Promise<void> {
    if (!dataStr || typeof dataStr !== "string") {
      return;
    }

    let msg: ControlMessage;
    try {
      msg = JSON.parse(dataStr);
    } catch {
      return;
    }

    if (msg.type === "command:execute") {
      const payload = msg.payload as CommandExecutePayload;
      const { commandId, action, args } = payload;

      const handler = this._handlers.get(action);
      if (!handler) {
        this._sendMessage({
          id: ulid(),
          type: "command:result",
          replyTo: msg.id,
          payload: {
            commandId,
            success: false,
            error: `Unknown action: ${action}`,
          } as CommandResultPayload,
        });
        return;
      }

      try {
        const result = await handler(args);
        this._sendMessage({
          id: ulid(),
          type: "command:result",
          replyTo: msg.id,
          payload: {
            commandId,
            success: true,
            data: result,
          } as CommandResultPayload,
        });
      } catch (err: any) {
        this._sendMessage({
          id: ulid(),
          type: "command:result",
          replyTo: msg.id,
          payload: {
            commandId,
            success: false,
            error: err.message || String(err),
          } as CommandResultPayload,
        });
      }
    }
  }
}
