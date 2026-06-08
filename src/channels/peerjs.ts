import { Peer } from "peerjs";
import type { DataConnection, PeerError } from "peerjs";
import { Signal } from "signal-polyfill";

import type {
  Channel,
  ChannelMessageCallback,
  MessageAttachment,
} from "../types.js";

import {
  PEERJS_DEFAULT_HOST,
  PEERJS_DEFAULT_PATH,
  PEERJS_DEFAULT_PORT,
  PEERJS_DEFAULT_SECURE,
} from "../config.js";

import { getDb } from "../db/db.js";
import { readGroupFileBytes } from "../storage/readGroupFileBytes.js";
import { writeGroupFileBytes } from "../storage/writeGroupFileBytes.js";
import { computeSha256 } from "../crypto.js";
import { ulid } from "../ulid.js";

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

  /** Active data connections keyed by remote peer ID */
  connections: Map<string, DataConnection> = new Map();

  /** Signal of connected remote peer IDs */
  connectedPeersSignal = new Signal.State<string[]>([]);

  private peer: InstanceType<typeof Peer> | null = null;

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
      const db = await getDb();

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

      for (const att of allAttachments) {
        if (!att.path) {
          continue;
        }

        try {
          const bytes = await readGroupFileBytes(db, groupId, att.path);
          const hash = await computeSha256(bytes.buffer as ArrayBuffer);
          const basename = att.path.split("/").pop() || "attachment";
          const canonicalName = `${hash}_${basename}`;

          // Rename the file in the sender's workspace to the canonical name
          // so the sender's own markdown links remain valid.
          if (!pathRemap.has(att.path)) {
            await writeGroupFileBytes(db, groupId, canonicalName, bytes);
            pathRemap.set(att.path, canonicalName);
          }

          fileParts.push({
            kind: "file",
            // Use the canonical name so the receiver knows the exact filename
            name: canonicalName,
            mimeType: (att as any).mimeType || "application/octet-stream",
            data: await bytesToBase64(bytes),
          });
        } catch (err) {
          console.warn(`PeerJsChannel: failed to read file ${att.path}:`, err);
        }
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

  onMessage(callback: ChannelMessageCallback): void {
    this.messageCallback = callback;
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

  private _handleInboundData(remotePeerId: string, data: unknown): void {
    if (!data || typeof data !== "object") {
      return;
    }

    const msg = data as Record<string, unknown>;

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
    const db = await getDb();

    let text = "";
    const inboundAttachments: MessageAttachment[] = [];

    // Process file parts first (they should arrive first in the envelope),
    // then text. The sender has already:
    //   1. Computed the canonical `<hash>_<basename>` filename
    //   2. Saved the file under that canonical name in its own workspace
    //   3. Rewritten its markdown links to use the canonical name
    // So all we need to do here is save the file under `part.name` (the
    // canonical name) and the incoming text will already link to it correctly.
    for (const part of parts) {
      if (part.kind === "text" && typeof part.text === "string") {
        text += part.text;
      } else if (part.kind === "file" && part.data) {
        try {
          const bytes = await base64ToBytes(part.data);

          // part.name is already the canonical `<hash>_<basename>` string;
          // save it flat in the workspace root so markdown links resolve.
          const canonicalName =
            (part.name || "attachment").split("/").pop() || "attachment";

          await writeGroupFileBytes(db, groupId, canonicalName, bytes);

          inboundAttachments.push({
            fileName: canonicalName,
            mimeType: part.mimeType,
            path: canonicalName,
            size: bytes.length,
          });
        } catch (err) {
          console.warn(`PeerJsChannel: failed to save inbound file part`, err);
        }
      }
    }

    text = text.trim();
    if (!text && inboundAttachments.length === 0) {
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
        serialization: "json",
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

async function bytesToBase64(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(new Blob([bytes as any]));
  });
}

async function base64ToBytes(base64: string): Promise<Uint8Array> {
  const res = await fetch(`data:application/octet-stream;base64,${base64}`);
  const buf = await res.arrayBuffer();

  return new Uint8Array(buf);
}
