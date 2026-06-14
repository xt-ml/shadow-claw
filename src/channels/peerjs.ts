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
    this._initPeer();
  }

  stop(): void {
    this.running = false;
    this.connections.forEach((conn) => {
      try {
        conn.close();
      } catch {
        // ignore
      }
    });
    this.connections.clear();
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

    // Wait for connection to be open if it just was created
    await this._waitForOpen(conn);

    try {
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

      const envelope = {
        jsonrpc: "2.0",
        method: "message/send",
        id: ulid(),
        params: {
          message: {
            role: "agent",
            parts,
          },
        },
      };

      conn.send(envelope);
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

    await this._waitForOpen(conn);

    try {
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

    await this._waitForOpen(conn);

    try {
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

    this.peer = new Peer(this.myPeerId, opts);

    this.peer.on("open", (id) => {
      console.log(
        `PeerJsChannel: connected to signaling server, peer ID: ${id}`,
      );
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
        console.log(
          "PeerJsChannel: disconnected from signaling server, reconnecting...",
        );
        try {
          (this.peer as any)?.reconnect?.();
        } catch {
          // ignore
        }
      }
    });

    this.peer.on("close", () => {
      console.log("PeerJsChannel: peer closed");
    });
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
    });

    conn.on("data", (data: unknown) => {
      this._handleInboundData(remotePeerId, data);
    });

    conn.on("close", () => {
      console.log(`PeerJsChannel: connection closed with ${remotePeerId}`);
      this.connections.delete(remotePeerId);
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

    // A2A JSON-RPC
    if (msg.jsonrpc === "2.0" && msg.method === "message/send") {
      const params = msg.params as any;
      if (!params || !params.message || !Array.isArray(params.message.parts)) {
        return;
      }

      this._processInboundA2AEnvelope(remotePeerId, params.message.parts).catch(
        (err) =>
          console.error(
            "PeerJsChannel: failed to process inbound A2A envelope",
            err,
          ),
      );
    }
  }

  private async _processInboundA2AEnvelope(
    remotePeerId: string,
    parts: any[],
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
   * already open, or if the connection never fires "open" (we try anyway).
   */
  private _waitForOpen(conn: DataConnection): Promise<void> {
    if ((conn as any).open) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 5000);
      const handler = () => {
        clearTimeout(timeout);
        resolve();
      };

      conn.on("open", handler);
    });
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
