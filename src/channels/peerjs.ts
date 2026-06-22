import type { DataConnection, PeerError } from "peerjs";
import { Peer } from "peerjs";
import { Signal } from "signal-polyfill";

import {
  PEERJS_DEFAULT_HOST,
  PEERJS_DEFAULT_PATH,
  PEERJS_DEFAULT_PORT,
  PEERJS_DEFAULT_SECURE,
} from "../config.js";

import { getDb } from "../db/db.js";
import { readGroupFileBytes } from "../storage/readGroupFileBytes.js";
import { writeGroupFileBytes } from "../storage/writeGroupFileBytes.js";
import { groupFileExists } from "../storage/groupFileExists.js";

import type {
  Channel,
  ChannelMessageCallback,
  ChannelTypingCallback,
  MessageAttachment,
} from "../types.js";

import type { A2UIEnvelope, A2UIAction } from "../a2ui.js";

import { ulid } from "../utils/ulid.js";

// A2A Protocol imports
import type {
  AgentCard,
  A2AJsonRpcRequest,
  A2AJsonRpcResponse,
  A2AJsonRpcNotification,
  SendMessageRequest,
  AGUIEvent,
  TaskStatusUpdateEvent,
} from "./peer-protocol.js";

import {
  A2A_METHOD,
  AGUI_METHOD,
  A2A_STREAM_METHOD,
  A2A_ERROR_CODE,
  Role,
  TERMINAL_STATES,
  isJsonRpcRequest,
  isJsonRpcResponse,
} from "./peer-protocol.js";

import {
  buildAgentCard,
  createGetAgentCardRequest,
  createGetAgentCardResponse,
  parseAgentCardResponse,
  PeerCardStore,
} from "./peer-agent-card.js";

import { PeerTaskManager } from "./peer-task-manager.js";

/**
 * Module-level singleton so the chat UI can import and subscribe to it
 * directly without going through the non-reactive orchestratorStore.orchestrator chain.
 */
export const transferProgressSignal = new Signal.State<{
  count: number;
  total: number;
  direction: "send" | "receive";
} | null>(null);

export interface PeerJsServerConfig {
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
  iceServers?: RTCIceServer[];
}

/**
 * A PeerJS-based WebRTC data-channel messaging channel.
 *
 * - Prefix: `peer:`
 * - groupId format: `peer:<remote-peer-id>`
 * - Uses the public PeerJS cloud signaling server by default (no self-hosted
 *   server required). A custom signaling server can be passed via serverConfig.
 * - Trusted peer IDs: when non-empty, only accepts connections from listed IDs.
 *   When empty, accepts connections from any peer.
 */
export class PeerJsChannel implements Channel {
  type: Channel["type"] = "peerjs";

  myPeerId: string = "";
  trustedPeerIds: Set<string> = new Set();
  serverConfig: PeerJsServerConfig = {};

  running = false;
  messageCallback: ChannelMessageCallback | null = null;
  typingCallback: ChannelTypingCallback | null = null;

  /** Active data connections keyed by remote peer ID */
  connections: Map<string, DataConnection> = new Map();

  /** Signal of connected remote peer IDs */
  connectedPeersSignal = new Signal.State<string[]>([]);

  /** Maps inbound original canonical filenames to their locally renamed final filenames */
  private _inboundRemap = new Map<string, string>();

  /** Delegate to the module-level singleton for reactivity across components */
  readonly transferProgressSignal = transferProgressSignal;

  private peer: InstanceType<typeof Peer> | null = null;

  // A2A Protocol state
  /** Remote agent cards keyed by peer ID */
  readonly peerCards = new PeerCardStore();
  /** Local agent card (constructed on start) */
  private _localCard: AgentCard | null = null;
  /** Per-connection task managers keyed by remote peer ID */
  private _taskManagers = new Map<string, PeerTaskManager>();
  /** Pending JSON-RPC response callbacks keyed by request ID */
  private _pendingRequests = new Map<
    string,
    {
      resolve: (resp: A2AJsonRpcResponse) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  // Reconnection backoff state
  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly _RECONNECT_BASE_MS = 1000;
  private static readonly _RECONNECT_MAX_MS = 60_000;

  /** Callback invoked when a remote peer signals task completion */
  private _onTaskCompleteCallback: ((groupId: string) => void) | null = null;

  /** Handler for inbound multi-party room notifications (`room/*`). */
  private _roomNotificationHandler:
    | ((fromPeerId: string, method: string, params: unknown) => void)
    | null = null;

  constructor() {
    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("peerjs-dc-handle-chunk", (e: any) => {
        if (e?.detail?.chunkInfo) {
          // PeerJS dispatches `count` BEFORE incrementing it (0-indexed pre-increment),
          // so the actual number of received chunks is count + 1.
          const { count: rawCount, total } = e.detail.chunkInfo;
          const received = rawCount + 1;
          transferProgressSignal.set({
            count: received,
            total,
            direction: "receive",
          });

          if (received >= total) {
            setTimeout(() => transferProgressSignal.set(null), 1500);
          }
        }
      });
    }
  }

  /**
   * Track outbound send progress by polling RTCDataChannel.bufferedAmount.
   * Resolves when all queued data has been flushed to the network.
   */
  private _trackSendProgress(
    conn: DataConnection,
    totalBytes: number,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const rawDc = (conn as any)._dc as RTCDataChannel | undefined;
      if (!rawDc || totalBytes === 0) {
        this.transferProgressSignal.set(null);
        resolve();

        return;
      }

      this.transferProgressSignal.set({
        count: 0,
        total: totalBytes,
        direction: "send",
      });

      const poll = setInterval(() => {
        const buffered = rawDc.bufferedAmount;
        const sent = Math.max(0, totalBytes - buffered);
        this.transferProgressSignal.set({
          count: sent,
          total: totalBytes,
          direction: "send",
        });

        if (buffered === 0) {
          clearInterval(poll);
          this.transferProgressSignal.set({
            count: totalBytes,
            total: totalBytes,
            direction: "send",
          });
          setTimeout(() => this.transferProgressSignal.set(null), 1500);
          resolve();
        }
      }, 80);
    });
  }

  private _updateConnectedPeersSignal(): void {
    this.connectedPeersSignal.set(Array.from(this.connections.keys()));
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  configure(
    myPeerId: string,
    trustedPeerIds: string[],
    serverConfig: PeerJsServerConfig = {},
  ): void {
    this.myPeerId = myPeerId.trim();
    this.trustedPeerIds = new Set(
      trustedPeerIds.map((id) => id.trim()).filter(Boolean),
    );
    this.serverConfig = serverConfig;
  }

  isConfigured(): boolean {
    return this.myPeerId.length > 0;
  }

  start(): void {
    if (!this.isConfigured() || this.running) {
      return;
    }

    this.running = true;
    this._localCard = buildAgentCard({
      peerId: this.myPeerId,
      name: this.myPeerId,
      description: "ShadowClaw AI assistant",
      streaming: true,
    });
    this._initPeer();
  }

  stop(): void {
    this.running = false;
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    this._reconnectAttempts = 0;
    this.connections.forEach((conn) => {
      try {
        conn.close();
      } catch {
        // ignore
      }
    });
    this.connections.clear();
    this.peerCards.clear();
    this._taskManagers.clear();
    this._pendingRequests.forEach(({ timer }) => clearTimeout(timer));
    this._pendingRequests.clear();
    this._updateConnectedPeersSignal();

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }

      this.peer = null;
    }
  }

  async send(
    groupId: string,
    text: string,
    attachments?: MessageAttachment[],
  ): Promise<void> {
    const remotePeerId = groupId.replace(/^peer:/, "");
    const conn = this._getOrOpenConnection(remotePeerId);

    if (!conn) {
      console.warn(
        `PeerJsChannel: no connection available for ${remotePeerId}`,
      );

      return;
    }

    try {
      // Wait for connection to be open if it just was created
      await this._waitForOpen(conn);

      // Extract markdown local links from the outgoing text
      const { attachments: markdownAttachments } =
        extractMarkdownAttachments(text);

      const allAttachments: { path: string; mimeType?: string }[] = [
        ...(attachments || []).filter(
          (a): a is MessageAttachment & { path: string } => !!a.path,
        ),
        ...markdownAttachments.map((ma) => ({
          path: ma.path,
          mimeType: "application/octet-stream",
        })),
      ];

      // Build a map of oldPath -> canonical hash-prefixed basename.
      // The sender is responsible for computing the canonical name so both
      // sides end up with the same filename in their workspaces.
      const pathRemap = new Map<string, string>();
      const fileParts: any[] = [];

      try {
        const db = await getDb();
        for (const att of allAttachments) {
          if (!att.path) {
            continue;
          }

          try {
            const bytes = await readGroupFileBytes(db, groupId, att.path);
            const canonicalName = att.path;

            if (!pathRemap.has(att.path)) {
              pathRemap.set(att.path, canonicalName);
            }

            const mimeType =
              (att as any).mimeType || "application/octet-stream";

            // Send the header
            conn.send({
              type: "__file_header",
              name: canonicalName,
              mimeType,
              size: bytes.length,
            });

            // Send the raw binary buffer so PeerJS chunks it natively.
            // We start tracking progress before the send call so the UI
            // shows immediately rather than after the first chunk.
            const trackPromise = this._trackSendProgress(conn, bytes.length);
            conn.send(bytes.buffer);
            await trackPromise;

            // Prepare the metadata part for the A2A envelope
            fileParts.push({
              kind: "file",
              name: canonicalName,
              mimeType,
              size: bytes.length,
            });
          } catch (err) {
            console.warn(
              `PeerJsChannel: failed to process file ${att.path}:`,
              err,
            );
          }
        }
      } catch (err) {
        console.error("PeerJsChannel: failed to access DB", err);
      }

      // Rewrite the outgoing text so links point to the canonical names
      let outText = text;
      for (const [oldPath, canonicalName] of pathRemap) {
        const escapedOld = oldPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        outText = outText.replace(
          new RegExp(`(!?\\[.*?\\])\\(${escapedOld}\\)`, "g"),
          `$1(${canonicalName})`,
        );
      }

      // File parts go first so the receiver processes them before text
      const parts = [...fileParts, { kind: "text", text: outText }];

      // Use A2A SendMessage (JSON-RPC request with id) so the remote peer's
      // task manager tracks the conversation lifecycle and can signal completion.
      const requestId = ulid();
      const envelope: A2AJsonRpcRequest = {
        jsonrpc: "2.0",
        id: requestId,
        method: A2A_METHOD.SEND_MESSAGE,
        params: {
          message: {
            messageId: ulid(),
            role: Role.AGENT,
            parts,
          },
        } satisfies SendMessageRequest,
      };

      conn.send(envelope);

      // Register pending request so we can process the task response
      this._registerPendingRequest(requestId, (_response) => {
        // Response contains the task state — no action needed here,
        // the remote peer's task manager handles lifecycle.
      });
    } catch (err) {
      console.error(`PeerJsChannel: send failed for ${remotePeerId}:`, err);
      window.dispatchEvent(
        new CustomEvent("shadow-claw-peer-error", {
          detail: {
            remotePeerId,
            error: err instanceof Error ? err.message : String(err),
          },
        }),
      );
    }
  }

  setTyping(groupId: string, typing: boolean): void {
    const remotePeerId = groupId.replace(/^peer:/, "");
    const conn = this.connections.get(remotePeerId);
    if (!conn) {
      return;
    }

    try {
      conn.send({ type: "typing", typing });
    } catch {
      // silently ignore typing send errors
    }
  }

  /**
   * Send an A2UI surface envelope to a peer as a `kind: "a2ui"` A2A part.
   */
  async sendA2UI(groupId: string, envelope: A2UIEnvelope): Promise<void> {
    const remotePeerId = groupId.replace(/^peer:/, "");
    const conn = this._getOrOpenConnection(remotePeerId);

    if (!conn) {
      console.warn(
        `PeerJsChannel.sendA2UI: no connection available for ${remotePeerId}`,
      );

      return;
    }

    try {
      await this._waitForOpen(conn);

      const a2uiEnvelopeObj = {
        jsonrpc: "2.0",
        method: "message/send",
        id: ulid(),
        params: {
          message: {
            role: "agent",
            parts: [{ kind: "a2ui", envelope }],
          },
        },
      };
      conn.send(a2uiEnvelopeObj);
    } catch (err) {
      console.error(`PeerJsChannel.sendA2UI: failed for ${remotePeerId}:`, err);
    }
  }

  /**
   * Send an A2UI action back to the peer (fired when the local user interacts
   * with a rendered surface — e.g. clicks a Button).
   */
  async sendA2UIAction(groupId: string, action: A2UIAction): Promise<void> {
    const remotePeerId = groupId.replace(/^peer:/, "");
    const conn = this._getOrOpenConnection(remotePeerId);

    if (!conn) {
      console.warn(
        `PeerJsChannel.sendA2UIAction: no connection available for ${remotePeerId}`,
      );

      return;
    }

    try {
      await this._waitForOpen(conn);

      const actionEnvelope = {
        jsonrpc: "2.0",
        method: "message/send",
        id: ulid(),
        params: {
          message: {
            role: "user",
            parts: [{ kind: "a2ui-action", action }],
          },
        },
      };
      conn.send(actionEnvelope);
    } catch (err) {
      console.error(
        `PeerJsChannel.sendA2UIAction: failed for ${remotePeerId}:`,
        err,
      );
    }
  }

  onMessage(callback: ChannelMessageCallback): void {
    this.messageCallback = callback;
  }

  onTyping(callback: ChannelTypingCallback): void {
    this.typingCallback = callback;
  }

  /**
   * Register a callback invoked when a remote peer sends a terminal
   * task status update (COMPLETED, FAILED, CANCELED). This allows the
   * orchestrator to suppress further auto-triggers for that conversation.
   */
  onTaskComplete(callback: (groupId: string) => void): void {
    this._onTaskCompleteCallback = callback;
  }

  // ---------------------------------------------------------------------------
  // Multi-party room transport
  // ---------------------------------------------------------------------------

  /**
   * Register the handler for inbound `room/*` JSON-RPC notifications. The
   * {@link RoomManager} uses this to receive join/roster/leave/message/invite/
   * relay traffic carried over the existing DataChannel.
   */
  setRoomNotificationHandler(
    handler: (fromPeerId: string, method: string, params: unknown) => void,
  ): void {
    this._roomNotificationHandler = handler;
  }

  /** Whether a direct, open DataConnection to the peer currently exists. */
  isPeerConnected(peerId: string): boolean {
    const conn = this.connections.get(peerId);

    return !!conn && !!(conn as any).open;
  }

  /** Best-effort: ensure an outbound connection to the peer is opened. */
  connectPeer(peerId: string): void {
    this._getOrOpenConnection(peerId);
  }

  /**
   * Send a JSON-RPC notification object to a single peer. If the connection is
   * still opening, the send is deferred until it opens. Returns true when the
   * send was dispatched or queued, false when no connection could be created.
   */
  sendRoomNotification(peerId: string, notification: unknown): boolean {
    const conn = this._getOrOpenConnection(peerId);
    if (!conn) {
      return false;
    }

    if ((conn as any).open) {
      try {
        conn.send(notification);

        return true;
      } catch (err) {
        console.error(
          `PeerJsChannel: failed to send room notification to ${peerId}:`,
          err,
        );

        return false;
      }
    }

    // Connection still opening — flush once it is ready.
    this._waitForOpen(conn)
      .then(() => {
        try {
          conn.send(notification);
        } catch (err) {
          console.error(
            `PeerJsChannel: failed to flush room notification to ${peerId}:`,
            err,
          );
        }
      })
      .catch(() => {
        // Connection failed to open; nothing more to do.
      });

    return true;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _initPeer(): void {
    const opts: Record<string, unknown> = {};

    // Only override defaults when explicitly configured
    const host = this.serverConfig.host ?? PEERJS_DEFAULT_HOST;
    const port = this.serverConfig.port ?? PEERJS_DEFAULT_PORT;
    const path = this.serverConfig.path ?? PEERJS_DEFAULT_PATH;
    const secure = this.serverConfig.secure ?? PEERJS_DEFAULT_SECURE;

    opts.host = host;
    opts.port = port;
    opts.path = path;
    opts.secure = secure;
    opts.debug = 3; // Verbose PeerJS logging for connection diagnostics

    // ICE servers for WebRTC connectivity (STUN for NAT traversal)
    const iceServers: RTCIceServer[] = this.serverConfig.iceServers ?? [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
    opts.config = { iceServers };

    this.peer = new Peer(this.myPeerId, opts);

    this.peer.on("open", (id) => {
      console.log(
        `PeerJsChannel: connected to signaling server, peer ID: ${id}`,
      );
      // Reset backoff on successful connection
      this._reconnectAttempts = 0;
    });

    this.peer.on("connection", (conn: DataConnection) => {
      this._handleIncomingConnection(conn);
    });

    this.peer.on("error", (err: PeerError<string>) => {
      console.error(`PeerJsChannel: peer error [${err.type}]:`, err.message);

      if (err.type === "peer-unavailable" || err.type === "unavailable-id") {
        window.dispatchEvent(
          new CustomEvent("shadow-claw-peer-error", {
            detail: {
              error: err.message,
            },
          }),
        );
      }

      // Recoverable errors — don't stop the channel
      if (
        err.type === "peer-unavailable" ||
        err.type === "network" ||
        err.type === "disconnected"
      ) {
        return;
      }

      // Non-recoverable
      if (err.type === "unavailable-id") {
        console.warn(
          "PeerJsChannel: peer ID is already in use. Stop the channel and reconfigure.",
        );
      }
    });

    this.peer.on("disconnected", () => {
      if (this.running) {
        this._scheduleReconnect();
      }
    });

    this.peer.on("close", () => {
      console.log("PeerJsChannel: peer closed");
    });
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   * Delay doubles each attempt: 1s, 2s, 4s, 8s, ... up to 60s max.
   */
  private _scheduleReconnect(): void {
    if (this._reconnectTimer !== null) {
      return; // Already scheduled
    }

    const delay = Math.min(
      PeerJsChannel._RECONNECT_BASE_MS * Math.pow(2, this._reconnectAttempts),
      PeerJsChannel._RECONNECT_MAX_MS,
    );

    this._reconnectAttempts++;

    console.log(
      `PeerJsChannel: disconnected from signaling server, reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this._reconnectAttempts})`,
    );

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this.running) {
        return;
      }

      try {
        (this.peer as any)?.reconnect?.();
      } catch {
        // If reconnect throws, schedule another attempt
        this._scheduleReconnect();
      }
    }, delay);
  }

  private _handleIncomingConnection(conn: DataConnection): void {
    const remotePeerId = conn.peer;

    // Reject untrusted peers when a trusted list is configured
    if (
      this.trustedPeerIds.size > 0 &&
      !this.trustedPeerIds.has(remotePeerId)
    ) {
      console.warn(
        `PeerJsChannel: rejecting connection from untrusted peer: ${remotePeerId}`,
      );
      try {
        conn.close();
      } catch {
        // ignore
      }

      return;
    }

    // Register the connection
    this.connections.set(remotePeerId, conn);
    this._updateConnectedPeersSignal();

    conn.on("open", () => {
      console.log(`PeerJsChannel: connection opened with ${remotePeerId}`);
      this._exchangeAgentCards(remotePeerId, conn);
    });

    conn.on("data", (data: unknown) => {
      this._handleInboundData(remotePeerId, data);
    });

    conn.on("close", () => {
      console.log(`PeerJsChannel: connection closed with ${remotePeerId}`);
      this.connections.delete(remotePeerId);
      this.peerCards.delete(remotePeerId);
      this._taskManagers.delete(remotePeerId);
      this._updateConnectedPeersSignal();
    });

    conn.on("error", (err: Error) => {
      console.error(
        `PeerJsChannel: connection error with ${remotePeerId}:`,
        err,
      );
      this.connections.delete(remotePeerId);
      this._updateConnectedPeersSignal();
      window.dispatchEvent(
        new CustomEvent("shadow-claw-peer-error", {
          detail: {
            remotePeerId,
            error: err.message,
          },
        }),
      );
    });

    conn.on("iceStateChanged", (state: string) => {
      if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {
        console.warn(
          `PeerJsChannel: ICE state changed to ${state} for ${remotePeerId}`,
        );
        this.connections.delete(remotePeerId);
        this._updateConnectedPeersSignal();
      }
    });
  }

  private _pendingInboundFile: {
    name: string;
    mimeType: string;
    size: number;
  } | null = null;

  private _handleInboundData(remotePeerId: string, data: unknown): void {
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      if (this._pendingInboundFile) {
        const canonicalName = this._pendingInboundFile.name;
        const groupId = `peer:${remotePeerId}`;
        const bytes = new Uint8Array(data as ArrayBuffer);

        getDb().then(async (db) => {
          let finalName = canonicalName;
          let counter = 1;

          while (await groupFileExists(db, groupId, finalName)) {
            const lastDotIndex = canonicalName.lastIndexOf(".");
            const hasExt =
              lastDotIndex > 0 && lastDotIndex < canonicalName.length - 1;

            if (hasExt) {
              const base = canonicalName.substring(0, lastDotIndex);
              const ext = canonicalName.substring(lastDotIndex);
              finalName = `${base} (${counter})${ext}`;
            } else {
              finalName = `${canonicalName} (${counter})`;
            }

            counter++;
          }

          if (finalName !== canonicalName) {
            this._inboundRemap.set(canonicalName, finalName);
          }

          writeGroupFileBytes(db, groupId, finalName, bytes).catch((err) => {
            console.error(
              "PeerJsChannel: failed to write inbound file bytes",
              err,
            );
          });
        });

        this._pendingInboundFile = null;
      }

      return;
    }

    if (!data || typeof data !== "object") {
      return;
    }

    const msg = data as Record<string, unknown>;

    if (msg.type === "__file_header") {
      this._pendingInboundFile = {
        name: msg.name as string,
        mimeType: msg.mimeType as string,
        size: msg.size as number,
      };

      return;
    }

    if (msg.type === "typing") {
      this.typingCallback?.(`peer:${remotePeerId}`, !!msg.typing);

      return;
    }

    // Support legacy { type: "chat", text }
    if (msg.type === "chat") {
      const text = typeof msg.text === "string" ? msg.text.trim() : "";
      if (text) {
        this.messageCallback?.({
          id: ulid(),
          groupId: `peer:${remotePeerId}`,
          sender: remotePeerId,
          content: text,
          timestamp: Date.now(),
          channel: "peerjs",
        });
      }

      return;
    }

    // A2A JSON-RPC 2.0 dispatch
    if (msg.jsonrpc === "2.0") {
      this._handleA2AJsonRpc(remotePeerId, msg as Record<string, unknown>);

      return;
    }
  }

  /**
   * Dispatch an inbound JSON-RPC 2.0 message (request, response, or notification).
   */
  private _handleA2AJsonRpc(
    remotePeerId: string,
    msg: Record<string, unknown>,
  ): void {
    // Response to a pending request (e.g., GetAgentCard response)
    if (isJsonRpcResponse(msg)) {
      const pending = this._pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this._pendingRequests.delete(msg.id);
        pending.resolve(msg as A2AJsonRpcResponse);
      }

      return;
    }

    const method = msg.method as string | undefined;
    if (!method) {
      return;
    }

    // Multi-party room notifications (`room/*`) — forward to the RoomManager.
    if (method.startsWith("room/")) {
      this._roomNotificationHandler?.(remotePeerId, method, msg.params);

      return;
    }

    // JSON-RPC Request (has id — expects a response)
    if (isJsonRpcRequest(msg)) {
      switch (method) {
        case A2A_METHOD.GET_AGENT_CARD:
          this._handleGetAgentCard(remotePeerId, msg as A2AJsonRpcRequest);

          break;
        case A2A_METHOD.SEND_MESSAGE:
          this._handleA2ASendMessage(remotePeerId, msg as A2AJsonRpcRequest);

          break;
        case A2A_METHOD.CANCEL_TASK:
          this._handleA2ACancelTask(remotePeerId, msg as A2AJsonRpcRequest);

          break;
        case A2A_METHOD.GET_TASK:
          this._handleA2AGetTask(remotePeerId, msg as A2AJsonRpcRequest);

          break;
        default:
          // Legacy "message/send" (existing format) — process as before
          if (method === "message/send") {
            const params = msg.params as any;
            if (params?.message?.parts && Array.isArray(params.message.parts)) {
              this._processInboundA2AEnvelope(
                remotePeerId,
                params.message.parts,
              ).catch((err) =>
                console.error(
                  "PeerJsChannel: failed to process inbound A2A envelope",
                  err,
                ),
              );
            }
          } else {
            this._sendJsonRpcError(remotePeerId, msg.id as string, {
              code: A2A_ERROR_CODE.METHOD_NOT_FOUND,
              message: `Method not found: ${method}`,
            });
          }
      }

      return;
    }

    // JSON-RPC Notification (no id — no response expected)
    switch (method) {
      case AGUI_METHOD.EVENT:
        this._handleAGUIEventNotification(remotePeerId, msg.params);

        break;
      case A2A_STREAM_METHOD.STATUS_UPDATE:
        this._handleTaskStatusNotification(remotePeerId, msg.params);

        break;
      case A2A_STREAM_METHOD.ARTIFACT_UPDATE:
        // Future: handle artifact streaming notifications

        break;
      case "message/send":
        // Legacy notification format (no id)
        {
          const params = msg.params as any;
          if (params?.message?.parts && Array.isArray(params.message.parts)) {
            this._processInboundA2AEnvelope(
              remotePeerId,
              params.message.parts,
            ).catch((err) =>
              console.error(
                "PeerJsChannel: failed to process inbound A2A envelope",
                err,
              ),
            );
          }
        }

        break;
    }
  }

  private async _processInboundA2AEnvelope(
    remotePeerId: string,
    parts: any[],
    taskId?: string,
    contextId?: string,
  ): Promise<void> {
    const groupId = `peer:${remotePeerId}`;

    let text = "";
    const inboundAttachments: MessageAttachment[] = [];
    const a2uiEnvelopes: A2UIEnvelope[] = [];
    let a2uiAction: A2UIAction | undefined;

    // The sender has already transmitted the raw binary buffers sequentially and
    // saved them into OPFS in `_handleInboundData`. Here we just compile the metadata
    // for the chat UI.
    for (const part of parts) {
      if (part.kind === "text" && typeof part.text === "string") {
        text += part.text;
      } else if (part.kind === "file") {
        let rawPath = part.name || "attachment";

        if (this._inboundRemap.has(rawPath)) {
          const remappedName = this._inboundRemap.get(rawPath)!;

          // Rewrite the text to use the remapped name
          const escapedOld = rawPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          text = text.replace(
            new RegExp(`(!?\\[.*?\\])\\(${escapedOld}\\)`, "g"),
            `$1(${remappedName})`,
          );

          this._inboundRemap.delete(rawPath);
          rawPath = remappedName;
        }

        const fileName = rawPath.split("/").pop() || "attachment";

        inboundAttachments.push({
          fileName,
          mimeType: part.mimeType,
          path: rawPath,
          size: part.size || 0,
        });
      } else if (part.kind === "a2ui" && part.envelope) {
        a2uiEnvelopes.push(part.envelope as A2UIEnvelope);
      } else if (part.kind === "a2ui-action" && part.action) {
        a2uiAction = part.action as A2UIAction;
      }
    }

    text = text.trim();

    // Only suppress the callback if there is truly nothing to deliver.
    if (
      !text &&
      inboundAttachments.length === 0 &&
      a2uiEnvelopes.length === 0 &&
      !a2uiAction
    ) {
      return;
    }

    this.messageCallback?.({
      id: ulid(),
      groupId,
      sender: remotePeerId,
      content: text,
      timestamp: Date.now(),
      channel: "peerjs",
      attachments:
        inboundAttachments.length > 0 ? inboundAttachments : undefined,
      a2uiEnvelopes: a2uiEnvelopes.length > 0 ? a2uiEnvelopes : undefined,
      a2uiAction,
      taskId,
      contextId,
    });
  }

  /**
   * Returns an existing open DataConnection for the given remote peer ID,
   * or initiates a new outbound connection.
   */
  private _getOrOpenConnection(remotePeerId: string): DataConnection | null {
    const existing = this.connections.get(remotePeerId);
    if (existing) {
      return existing;
    }

    if (!this.peer) {
      return null;
    }

    try {
      const conn = this.peer.connect(remotePeerId, {
        reliable: true,
        serialization: "binary",
      });

      // PeerJS returns undefined if the peer is disconnected/destroyed
      if (!conn) {
        return null;
      }

      this._handleIncomingConnection(conn);

      return conn;
    } catch (err) {
      console.error(
        `PeerJsChannel: failed to connect to ${remotePeerId}:`,
        err,
      );

      return null;
    }
  }

  /**
   * Waits up to 5s for a DataConnection to open. Resolves immediately if
   * already open. Rejects if the connection errors or the timeout fires
   * without the connection opening.
   */
  private _waitForOpen(conn: DataConnection): Promise<void> {
    if ((conn as any).open) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection open timeout (5s)"));
      }, 5000);

      const openHandler = () => {
        clearTimeout(timeout);
        resolve();
      };

      const errorHandler = (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      };

      conn.on("open", openHandler);
      conn.on("error", errorHandler);
    });
  }

  // ---------------------------------------------------------------------------
  // A2A Protocol Handlers
  // ---------------------------------------------------------------------------

  /**
   * Exchange agent cards on connection open.
   * Sends our card request and stores the remote peer's card.
   */
  private _exchangeAgentCards(
    remotePeerId: string,
    conn: DataConnection,
  ): void {
    if (!this._localCard) {
      return;
    }

    const request = createGetAgentCardRequest();
    conn.send(request);

    // Register pending request for the response
    this._registerPendingRequest(request.id, (response) => {
      const card = parseAgentCardResponse(response);
      if (card) {
        this.peerCards.set(remotePeerId, card);
        console.log(
          `PeerJsChannel: received AgentCard from ${remotePeerId}: "${card.name}"`,
        );
      }
    });
  }

  /**
   * Handle GetAgentCard request — respond with our local card.
   */
  private _handleGetAgentCard(
    remotePeerId: string,
    request: A2AJsonRpcRequest,
  ): void {
    if (!this._localCard) {
      this._sendJsonRpcError(remotePeerId, request.id, {
        code: A2A_ERROR_CODE.INTERNAL_ERROR,
        message: "Agent card not available",
      });

      return;
    }

    const response = createGetAgentCardResponse(request.id, this._localCard);
    const conn = this.connections.get(remotePeerId);
    if (conn) {
      conn.send(response);
    }
  }

  /**
   * Handle A2A SendMessage request — route through task manager.
   */
  private _handleA2ASendMessage(
    remotePeerId: string,
    request: A2AJsonRpcRequest,
  ): void {
    const params = request.params as SendMessageRequest | undefined;
    if (!params?.message) {
      this._sendJsonRpcError(remotePeerId, request.id, {
        code: A2A_ERROR_CODE.INVALID_PARAMS,
        message: "Missing message in SendMessage params",
      });

      return;
    }

    // Get or create task manager for this peer
    let taskManager = this._taskManagers.get(remotePeerId);
    if (!taskManager) {
      taskManager = new PeerTaskManager();
      this._taskManagers.set(remotePeerId, taskManager);

      // Wire up task events to emit over the DataChannel
      taskManager.on((event) => {
        this._forwardTaskEvent(remotePeerId, event);
      });
    }

    // Process through task manager
    const response = taskManager.handleSendMessage(params);

    // Send JSON-RPC response with task state
    const conn = this.connections.get(remotePeerId);
    if (conn) {
      const rpcResponse: A2AJsonRpcResponse = {
        jsonrpc: "2.0",
        id: request.id,
        result: response,
      };
      conn.send(rpcResponse);
    }

    // Also deliver the message content to the existing chat UI
    if (params.message.parts && Array.isArray(params.message.parts)) {
      this._processInboundA2AEnvelope(
        remotePeerId,
        params.message.parts,
        response.task?.id,
        response.task?.contextId,
      ).catch((err) =>
        console.error("PeerJsChannel: failed to process A2A SendMessage", err),
      );
    }
  }

  /**
   * Handle A2A CancelTask request.
   */
  private _handleA2ACancelTask(
    remotePeerId: string,
    request: A2AJsonRpcRequest,
  ): void {
    const params = request.params as { taskId?: string } | undefined;
    if (!params?.taskId) {
      this._sendJsonRpcError(remotePeerId, request.id, {
        code: A2A_ERROR_CODE.INVALID_PARAMS,
        message: "Missing taskId in CancelTask params",
      });

      return;
    }

    const taskManager = this._taskManagers.get(remotePeerId);
    if (!taskManager) {
      this._sendJsonRpcError(remotePeerId, request.id, {
        code: A2A_ERROR_CODE.TASK_NOT_FOUND,
        message: `Task not found: ${params.taskId}`,
      });

      return;
    }

    const success = taskManager.cancelTask(params.taskId);
    if (!success) {
      this._sendJsonRpcError(remotePeerId, request.id, {
        code: A2A_ERROR_CODE.TASK_NOT_CANCELABLE,
        message: `Task not cancelable: ${params.taskId}`,
      });

      return;
    }

    const conn = this.connections.get(remotePeerId);
    if (conn) {
      const task = taskManager.getTask(params.taskId);
      const rpcResponse: A2AJsonRpcResponse = {
        jsonrpc: "2.0",
        id: request.id,
        result: { task },
      };
      conn.send(rpcResponse);
    }
  }

  /**
   * Handle A2A GetTask request.
   */
  private _handleA2AGetTask(
    remotePeerId: string,
    request: A2AJsonRpcRequest,
  ): void {
    const params = request.params as { taskId?: string } | undefined;
    if (!params?.taskId) {
      this._sendJsonRpcError(remotePeerId, request.id, {
        code: A2A_ERROR_CODE.INVALID_PARAMS,
        message: "Missing taskId in GetTask params",
      });

      return;
    }

    const taskManager = this._taskManagers.get(remotePeerId);
    const task = taskManager?.getTask(params.taskId);
    if (!task) {
      this._sendJsonRpcError(remotePeerId, request.id, {
        code: A2A_ERROR_CODE.TASK_NOT_FOUND,
        message: `Task not found: ${params.taskId}`,
      });

      return;
    }

    const conn = this.connections.get(remotePeerId);
    if (conn) {
      const rpcResponse: A2AJsonRpcResponse = {
        jsonrpc: "2.0",
        id: request.id,
        result: { task },
      };
      conn.send(rpcResponse);
    }
  }

  /**
   * Handle an inbound AG-UI event notification from a remote peer.
   */
  private _handleAGUIEventNotification(
    remotePeerId: string,
    params: unknown,
  ): void {
    if (!params || typeof params !== "object") {
      return;
    }

    const event = params as AGUIEvent;

    // Dispatch a DOM event so UI components can react
    window.dispatchEvent(
      new CustomEvent("shadow-claw-agui-event", {
        detail: { remotePeerId, event },
      }),
    );
  }

  /**
   * Handle an inbound task status update notification.
   */
  private _handleTaskStatusNotification(
    remotePeerId: string,
    params: unknown,
  ): void {
    if (!params || typeof params !== "object") {
      return;
    }

    const statusUpdate = params as TaskStatusUpdateEvent;

    // If the remote peer signaled a terminal state, notify the orchestrator
    // so it can suppress further auto-triggers for this conversation.
    if (
      statusUpdate.status?.state &&
      TERMINAL_STATES.has(statusUpdate.status.state as any)
    ) {
      const groupId = `peer:${remotePeerId}`;
      this._onTaskCompleteCallback?.(groupId);
    }

    window.dispatchEvent(
      new CustomEvent("shadow-claw-task-status", {
        detail: { remotePeerId, ...statusUpdate },
      }),
    );
  }

  /**
   * Forward task manager events over the DataChannel as notifications.
   */
  private _forwardTaskEvent(
    remotePeerId: string,
    event: {
      type: string;
      taskId: string;
      contextId: string;
      payload: unknown;
    },
  ): void {
    const conn = this.connections.get(remotePeerId);
    if (!conn) {
      return;
    }

    let method: string;
    switch (event.type) {
      case "statusUpdate":
        method = A2A_STREAM_METHOD.STATUS_UPDATE;

        break;
      case "artifactUpdate":
        method = A2A_STREAM_METHOD.ARTIFACT_UPDATE;

        break;
      case "aguiEvent":
        method = AGUI_METHOD.EVENT;

        break;
      default:
        return;
    }

    const notification: A2AJsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params: event.payload,
    };

    try {
      conn.send(notification);
    } catch (err) {
      console.error(
        `PeerJsChannel: failed to forward ${event.type} to ${remotePeerId}:`,
        err,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // JSON-RPC Helpers
  // ---------------------------------------------------------------------------

  /**
   * Send a JSON-RPC error response to a remote peer.
   */
  private _sendJsonRpcError(
    remotePeerId: string,
    requestId: string,
    error: { code: number; message: string; data?: unknown[] },
  ): void {
    const conn = this.connections.get(remotePeerId);
    if (!conn) {
      return;
    }

    const response: A2AJsonRpcResponse = {
      jsonrpc: "2.0",
      id: requestId,
      error,
    };

    try {
      conn.send(response);
    } catch {
      // Ignore send errors for error responses
    }
  }

  /**
   * Register a pending JSON-RPC request (with 10s timeout).
   */
  private _registerPendingRequest(
    requestId: string,
    callback: (response: A2AJsonRpcResponse) => void,
  ): void {
    const timer = setTimeout(() => {
      this._pendingRequests.delete(requestId);
      console.warn(
        `PeerJsChannel: JSON-RPC request ${requestId} timed out (10s)`,
      );
    }, 10_000);

    this._pendingRequests.set(requestId, {
      resolve: callback,
      timer,
    });
  }

  /**
   * Get the task manager for a peer (creates one if needed).
   */
  getTaskManager(remotePeerId: string): PeerTaskManager {
    let tm = this._taskManagers.get(remotePeerId);
    if (!tm) {
      tm = new PeerTaskManager();
      this._taskManagers.set(remotePeerId, tm);
      tm.on((event) => {
        this._forwardTaskEvent(remotePeerId, event);
      });
    }

    return tm;
  }

  /**
   * Mark the active task for a peer groupId as COMPLETED.
   * Sends a terminal `tasks/statusUpdate` notification to the remote peer,
   * signaling that no further responses are expected.
   *
   * @returns true if a task was completed, false if no active task exists.
   */
  completeActiveTask(groupId: string): boolean {
    const remotePeerId = groupId.replace(/^peer:/, "");
    const tm = this._taskManagers.get(remotePeerId);
    if (!tm) {
      return false;
    }

    const activeTasks = tm.getActiveTasks();
    if (activeTasks.length === 0) {
      return false;
    }

    // Complete the most recent active task
    const task = activeTasks[activeTasks.length - 1];
    tm.markWorking(task.id);
    tm.markCompleted(task.id);

    return true;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractMarkdownAttachments(text: string): {
  remainingText: string;
  attachments: { alt: string; path: string }[];
} {
  const attachments: { alt: string; path: string }[] = [];
  const regex = /!?\[([^\]]*)\]\(([^)]+)\)/g;

  let match;
  let remainingText = text;

  // Find all matches
  while ((match = regex.exec(text)) !== null) {
    const alt = match[1];
    const path = (match[2] || "").trim();

    const normalizedPath = normalizeAttachmentPath(path);

    if (normalizedPath) {
      attachments.push({ alt, path: normalizedPath });
    }
  }

  return { remainingText, attachments };
}

function normalizeAttachmentPath(path: string): string | null {
  if (!path) {
    return null;
  }

  const trimmed = path.trim();

  // Ignore URI schemes (https:, data:, mailto:, etc.) and protocol-relative URLs.
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) || trimmed.startsWith("//")) {
    return null;
  }

  const normalized = trimmed
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");

  if (!normalized) {
    return null;
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((seg) => seg === "..")) {
    return null;
  }

  return segments.join("/");
}
