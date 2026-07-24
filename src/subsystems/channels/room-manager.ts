/**
 * ShadowClaw — Room Manager (multi-party PeerJS conversations)
 *
 * Coordinates a hybrid room topology on top of the existing 1:1
 * {@link PeerJsChannel} transport:
 *
 * - The room **host** runs a star for signaling, roster and membership
 *   (`room/join`, `room/roster`, `room/leave`, `room/invite`).
 * - Actual chat traffic (`room/message`) flows peer-to-peer over the **mesh**,
 *   falling back to **host relay** (`room/relay`) when a direct connection to a
 *   recipient is not available.
 *
 * The manager owns no socket of its own — it delegates all transport to an
 * injected {@link RoomTransport} so it can be unit-tested in isolation. Trigger
 * (@mention) detection is intentionally left to the orchestrator's existing
 * enqueue logic; this layer only delivers inbound messages.
 */

import { Signal } from "signal-polyfill";

import { ulid } from "../../utils/ulid.js";
import { roomGroupId } from "../../db/rooms.js";

import type { MessageAttachment } from "../../content/types.js";
import type { InboundMessage, RoomMember, RoomMeta } from "./types.js";
import type { A2UIAction, A2UIEnvelope } from "../../ui/a2ui.js";

import type {
  A2AJsonRpcNotification,
  RoomA2UIEnvelope,
  RoomA2UIActionEnvelope,
  RoomInvitePayload,
  RoomJoinPayload,
  RoomLeavePayload,
  RoomMessageEnvelope,
  RoomRelayPayload,
  RoomRosterPayload,
} from "./peer-protocol.js";

import { ROOM_METHOD } from "./peer-protocol.js";

/** Build the `[A2UI ACTION]` prompt that drives owner-side action processing. */
import { formatA2UIActionPrompt } from "../../ui/a2ui.js";

/** Transport surface the {@link RoomManager} depends on. */
export interface RoomTransport {
  /** The local peer ID. */
  readonly myPeerId: string;
  /** Send a JSON-RPC notification to a single peer. Returns true if dispatched. */
  sendToPeer(peerId: string, notification: A2AJsonRpcNotification): boolean;
  /** Whether a direct, open connection to the peer currently exists. */
  isConnected(peerId: string): boolean;
  /** Best-effort: ensure an outbound connection to the peer is opened. */
  connectToPeer(peerId: string): void;
}

export interface RoomManagerOptions {
  transport: RoomTransport;
  /** Resolve the local member identity used when creating/joining rooms. */
  getLocalMember: () => RoomMember;
  /** Deliver an inbound room chat message to the orchestrator. */
  onMessage: (msg: InboundMessage) => void;
  /** Deliver an inbound room invitation (e.g. to a notification / dialog). */
  onInvite?: (invite: RoomInvitePayload) => void;
  /** Persist (insert or replace) a room record. */
  persistRoom?: (room: RoomMeta) => void;
  /** Remove a persisted room record. */
  removeRoom?: (roomId: string) => void;
}

/** Max remembered message ids per room for cross-path de-duplication. */
const MAX_SEEN_PER_ROOM = 500;

function notification(method: string, params: unknown): A2AJsonRpcNotification {
  return { jsonrpc: "2.0", method, params };
}

export class RoomManager {
  // ---------------------------------------------------------------------------
  // Inbound dispatch
  // ---------------------------------------------------------------------------

  /**
   * Returns true if the method is a room protocol method this manager handles.
   */
  static isRoomMethod(method: string): boolean {
    return (
      method === ROOM_METHOD.JOIN ||
      method === ROOM_METHOD.ROSTER ||
      method === ROOM_METHOD.LEAVE ||
      method === ROOM_METHOD.MESSAGE ||
      method === ROOM_METHOD.INVITE ||
      method === ROOM_METHOD.RELAY ||
      method === ROOM_METHOD.A2UI ||
      method === ROOM_METHOD.A2UI_ACTION
    );
  }

  /** Reactive snapshot of joined rooms for the UI. */
  readonly roomsSignal = new Signal.State<RoomMeta[]>([]);
  private readonly _opts: RoomManagerOptions;

  /** Joined rooms keyed by bare room id. */
  private readonly _rooms = new Map<string, RoomMeta>();

  /** Per-room set of seen message ids (insertion-ordered for trimming). */
  private readonly _seen = new Map<string, Set<string>>();

  /**
   * Owner of each shared A2UI surface, keyed by surfaceId. Populated when the
   * local peer broadcasts a surface it created, or when an inbound
   * `room/a2ui` createSurface broadcast is received. Used to enforce the
   * owner-authoritative model: only the surface owner's agent processes
   * actions and mutates the data model.
   */
  private readonly _surfaceOwners = new Map<string, string>();

  constructor(opts: RoomManagerOptions) {
    this._opts = opts;
  }

  // ---------------------------------------------------------------------------
  // Outbound messages
  // ---------------------------------------------------------------------------

  /**
   * Broadcast a chat message to every other room member. Uses mesh delivery
   * with host-relay fallback. Returns the message id used.
   */
  broadcast(
    roomId: string,
    text: string,
    attachments?: MessageAttachment[],
  ): string | null {
    const room = this._rooms.get(roomId);
    if (!room) {
      return null;
    }

    const me = this._opts.getLocalMember();
    const messageId = ulid();
    const envelope: RoomMessageEnvelope = {
      roomId,
      messageId,
      senderPeerId: me.peerId,
      senderAlias: me.alias,
      text,
      attachments: attachments?.map((a) => ({
        fileName: a.fileName,
        mimeType: a.mimeType,
        path: a.path,
        size: a.size,
      })),
    };

    // Remember our own id so an echo (e.g. host relay) is not re-delivered.
    this._markSeen(roomId, messageId);
    this._deliverToMembers(room, notification(ROOM_METHOD.MESSAGE, envelope));

    return messageId;
  }

  /**
   * Broadcast a locally produced A2UI surface envelope to every other room
   * member. Records the local peer as the surface owner so subsequent actions
   * route back here. Returns the broadcast id used (null if not a member).
   */
  broadcastA2UI(roomId: string, envelope: A2UIEnvelope): string | null {
    const room = this._rooms.get(roomId);
    if (!room) {
      return null;
    }

    const me = this._myPeerId;
    // The local peer authored this surface — record (or refresh) ownership.
    this._surfaceOwners.set(envelope.surfaceId, me);

    const broadcastId = ulid();
    const payload: RoomA2UIEnvelope = {
      roomId,
      broadcastId,
      ownerPeerId: me,
      senderPeerId: me,
      envelope,
    };

    this._markSeen(roomId, broadcastId);
    this._deliverToMembers(room, notification(ROOM_METHOD.A2UI, payload));

    return broadcastId;
  }

  /**
   * Broadcast a user action fired on a shared surface to every other room
   * member. The surface owner's agent will process it (and broadcast the
   * resulting data-model update). Returns the broadcast id (null if not a
   * member).
   */
  broadcastA2UIAction(roomId: string, action: A2UIAction): string | null {
    const room = this._rooms.get(roomId);
    if (!room) {
      return null;
    }

    const me = this._opts.getLocalMember();
    const ownerPeerId = this._surfaceOwners.get(action.surfaceId) ?? "";
    const broadcastId = ulid();
    const payload: RoomA2UIActionEnvelope = {
      roomId,
      broadcastId,
      ownerPeerId,
      senderPeerId: me.peerId,
      senderAlias: me.alias,
      action,
    };

    this._markSeen(roomId, broadcastId);
    this._deliverToMembers(
      room,
      notification(ROOM_METHOD.A2UI_ACTION, payload),
    );

    return broadcastId;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle (host + member)
  // ---------------------------------------------------------------------------

  /** Create a new room hosted by the local peer. */
  createRoom(name: string): RoomMeta {
    const me = this._opts.getLocalMember();
    const room: RoomMeta = {
      roomId: ulid(),
      name,
      hostPeerId: me.peerId,
      members: [me],
      createdAt: Date.now(),
    };

    this._save(room);

    return room;
  }

  /** Get a joined room by id. */
  get(roomId: string): RoomMeta | null {
    return this._rooms.get(roomId) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Shared A2UI surfaces (owner-authoritative)
  // ---------------------------------------------------------------------------

  /** The peer that owns the given shared surface, if known locally. */
  getSurfaceOwner(surfaceId: string): string | undefined {
    return this._surfaceOwners.get(surfaceId);
  }

  /** Dispatch an inbound room notification received from {@link fromPeerId}. */
  handleNotification(
    fromPeerId: string,
    method: string,
    params: unknown,
  ): void {
    switch (method) {
      case ROOM_METHOD.JOIN:
        this._onJoin(fromPeerId, params as RoomJoinPayload);

        break;
      case ROOM_METHOD.ROSTER:
        this._onRoster(params as RoomRosterPayload);

        break;
      case ROOM_METHOD.LEAVE:
        this._onLeave(fromPeerId, params as RoomLeavePayload);

        break;
      case ROOM_METHOD.MESSAGE:
        this._onMessage(params as RoomMessageEnvelope);

        break;
      case ROOM_METHOD.INVITE:
        this._opts.onInvite?.(params as RoomInvitePayload);

        break;
      case ROOM_METHOD.RELAY:
        this._onRelay(params as RoomRelayPayload);

        break;
      case ROOM_METHOD.A2UI:
        this._onA2UI(params as RoomA2UIEnvelope);

        break;
      case ROOM_METHOD.A2UI_ACTION:
        this._onA2UIAction(params as RoomA2UIActionEnvelope);

        break;
    }
  }

  /** Invite a peer to a room (out-of-band, peer-to-peer). */
  invite(roomId: string, targetPeerId: string): boolean {
    const room = this._rooms.get(roomId);
    if (!room) {
      return false;
    }

    const me = this._opts.getLocalMember();
    const payload: RoomInvitePayload = {
      roomId,
      roomName: room.name,
      hostPeerId: room.hostPeerId,
      fromPeerId: me.peerId,
      fromAlias: me.alias,
    };

    const transport = this._opts.transport;
    transport.connectToPeer(targetPeerId);

    return transport.sendToPeer(
      targetPeerId,
      notification(ROOM_METHOD.INVITE, payload),
    );
  }

  /** Whether the local peer is the host of the given room. */
  isHost(roomId: string): boolean {
    const room = this._rooms.get(roomId);

    return !!room && room.hostPeerId === this._myPeerId;
  }

  /**
   * Join an existing room hosted by {@link hostPeerId}. Establishes a local
   * provisional roster (host + self) and sends a join request to the host; the
   * authoritative roster arrives via a `room/roster` notification.
   */
  joinRoom(roomId: string, hostPeerId: string, name: string): RoomMeta {
    const me = this._opts.getLocalMember();
    const existing = this._rooms.get(roomId);
    const room: RoomMeta = existing ?? {
      roomId,
      name,
      hostPeerId,
      members: [{ peerId: hostPeerId, alias: hostPeerId, kind: "agent" }, me],
      createdAt: Date.now(),
    };

    this._save(room);

    const transport = this._opts.transport;
    transport.connectToPeer(hostPeerId);
    const payload: RoomJoinPayload = { roomId, member: me };
    transport.sendToPeer(hostPeerId, notification(ROOM_METHOD.JOIN, payload));

    return room;
  }

  /**
   * Leave (member) or disband (host) a room. The host notifies all members that
   * the room is disbanded; a member notifies the host of its departure.
   */
  leaveRoom(roomId: string): void {
    const room = this._rooms.get(roomId);
    if (!room) {
      return;
    }

    const me = this._myPeerId;
    if (room.hostPeerId === me) {
      const payload: RoomLeavePayload = {
        roomId,
        peerId: me,
        disbanded: true,
      };
      this._deliverToMembers(room, notification(ROOM_METHOD.LEAVE, payload));
    } else {
      const payload: RoomLeavePayload = { roomId, peerId: me };
      this._opts.transport.sendToPeer(
        room.hostPeerId,
        notification(ROOM_METHOD.LEAVE, payload),
      );
    }

    this._rooms.delete(roomId);
    this._seen.delete(roomId);
    this._opts.removeRoom?.(roomId);
    this._publish();
  }

  /** All joined rooms. */
  list(): RoomMeta[] {
    return Array.from(this._rooms.values());
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Load persisted rooms at startup. */
  loadRooms(rooms: RoomMeta[]): void {
    this._rooms.clear();
    for (const room of rooms) {
      this._rooms.set(room.roomId, room);
    }

    this._publish();
  }

  // ---------------------------------------------------------------------------
  // Delivery helpers
  // ---------------------------------------------------------------------------

  private _broadcastRoster(room: RoomMeta): void {
    const payload: RoomRosterPayload = {
      roomId: room.roomId,
      name: room.name,
      hostPeerId: room.hostPeerId,
      members: room.members,
    };
    this._deliverToMembers(room, notification(ROOM_METHOD.ROSTER, payload));
  }

  /**
   * Deliver a notification to all room members except the local peer, using a
   * direct mesh connection where possible and host relay as a fallback.
   */
  private _deliverToMembers(
    room: RoomMeta,
    note: A2AJsonRpcNotification,
  ): void {
    const me = this._myPeerId;
    for (const member of room.members) {
      if (member.peerId === me) {
        continue;
      }

      this._deliverToPeer(room, member.peerId, note);
    }
  }

  private _deliverToPeer(
    room: RoomMeta,
    targetPeerId: string,
    note: A2AJsonRpcNotification,
  ): void {
    const transport = this._opts.transport;
    if (transport.isConnected(targetPeerId)) {
      transport.sendToPeer(targetPeerId, note);

      return;
    }

    // Not directly connected — relay via the host when possible.
    const me = this._myPeerId;
    if (
      room.hostPeerId !== me &&
      room.hostPeerId !== targetPeerId &&
      transport.isConnected(room.hostPeerId)
    ) {
      const relay: RoomRelayPayload = {
        roomId: room.roomId,
        targetPeerId,
        inner: note,
      };
      transport.sendToPeer(
        room.hostPeerId,
        notification(ROOM_METHOD.RELAY, relay),
      );
      // Opportunistically upgrade to a direct mesh link for next time.
      transport.connectToPeer(targetPeerId);

      return;
    }

    // Last resort: open a connection and attempt a direct send.
    transport.connectToPeer(targetPeerId);
    transport.sendToPeer(targetPeerId, note);
  }

  // ---------------------------------------------------------------------------
  // De-duplication
  // ---------------------------------------------------------------------------

  private _hasSeen(roomId: string, messageId: string): boolean {
    return this._seen.get(roomId)?.has(messageId) ?? false;
  }

  private _markSeen(roomId: string, messageId: string): void {
    let set = this._seen.get(roomId);
    if (!set) {
      set = new Set();
      this._seen.set(roomId, set);
    }

    set.add(messageId);
    if (set.size > MAX_SEEN_PER_ROOM) {
      // Drop the oldest entry (insertion order).
      const oldest = set.values().next().value;
      if (oldest !== undefined) {
        set.delete(oldest);
      }
    }
  }

  private get _myPeerId(): string {
    return this._opts.transport.myPeerId;
  }

  /**
   * Inbound shared A2UI surface broadcast. De-duplicate, record the surface
   * owner, then deliver the envelope to the local UI so the surface renders /
   * updates in lockstep with the rest of the room.
   */
  private _onA2UI(payload: RoomA2UIEnvelope): void {
    if (
      !payload ||
      typeof payload.roomId !== "string" ||
      typeof payload.broadcastId !== "string" ||
      !payload.envelope
    ) {
      return;
    }

    const room = this._rooms.get(payload.roomId);
    if (!room) {
      return; // Not a member of this room.
    }

    if (this._hasSeen(payload.roomId, payload.broadcastId)) {
      return;
    }

    this._markSeen(payload.roomId, payload.broadcastId);

    // Record ownership so any action we fire on this surface routes to its
    // authoritative owner. Never let an inbound broadcast claim ownership of a
    // surface we authored locally.
    const surfaceId = payload.envelope.surfaceId;
    if (this._surfaceOwners.get(surfaceId) !== this._myPeerId) {
      this._surfaceOwners.set(surfaceId, payload.ownerPeerId);
    }

    const inbound: InboundMessage = {
      id: payload.broadcastId,
      groupId: roomGroupId(payload.roomId),
      sender: payload.senderPeerId,
      content: "",
      timestamp: Date.now(),
      channel: "room",
      a2uiEnvelopes: [payload.envelope],
    };

    this._opts.onMessage(inbound);
  }

  /**
   * Inbound shared A2UI action. De-duplicate, then — only when the local peer
   * is the authoritative owner of the target surface — deliver a trigger
   * message so the owner's agent processes the action and broadcasts the
   * resulting data-model update. Non-owners ignore the action; their surface is
   * synchronized by the owner's subsequent `room/a2ui` broadcast.
   */
  private _onA2UIAction(payload: RoomA2UIActionEnvelope): void {
    if (
      !payload ||
      typeof payload.roomId !== "string" ||
      typeof payload.broadcastId !== "string" ||
      !payload.action
    ) {
      return;
    }

    const room = this._rooms.get(payload.roomId);
    if (!room) {
      return; // Not a member of this room.
    }

    if (this._hasSeen(payload.roomId, payload.broadcastId)) {
      return;
    }

    this._markSeen(payload.roomId, payload.broadcastId);

    // Owner-authoritative: only process actions for surfaces we locally own.
    // Trust our own ownership map over any self-reported `ownerPeerId`.
    if (this._surfaceOwners.get(payload.action.surfaceId) !== this._myPeerId) {
      return;
    }

    const inbound: InboundMessage = {
      id: payload.broadcastId,
      groupId: roomGroupId(payload.roomId),
      sender: payload.senderAlias || payload.senderPeerId,
      content: formatA2UIActionPrompt(payload.action, payload.senderAlias),
      timestamp: Date.now(),
      channel: "room",
      a2uiAction: payload.action,
    };

    this._opts.onMessage(inbound);
  }

  /** Host: a peer requested to join. Add to roster and broadcast it. */
  private _onJoin(fromPeerId: string, payload: RoomJoinPayload): void {
    if (!payload || typeof payload.roomId !== "string") {
      return;
    }

    const room = this._rooms.get(payload.roomId);
    if (!room || room.hostPeerId !== this._myPeerId) {
      return; // Only the host services join requests.
    }

    const member: RoomMember = payload.member ?? {
      peerId: fromPeerId,
      alias: fromPeerId,
      kind: "human",
    };
    // Trust the connection's peer id over any self-reported value.
    member.peerId = fromPeerId;

    const index = room.members.findIndex((m) => m.peerId === fromPeerId);
    if (index >= 0) {
      room.members[index] = member;
    } else {
      room.members.push(member);
    }

    this._save(room);
    this._broadcastRoster(room);
  }

  /** Leave/disband notification. */
  private _onLeave(fromPeerId: string, payload: RoomLeavePayload): void {
    if (!payload || typeof payload.roomId !== "string") {
      return;
    }

    const room = this._rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    if (payload.disbanded) {
      // Host disbanded the room for everyone.
      this._rooms.delete(payload.roomId);
      this._seen.delete(payload.roomId);
      this._opts.removeRoom?.(payload.roomId);
      this._publish();

      return;
    }

    // Host receives a member's departure: drop them and re-broadcast roster.
    if (room.hostPeerId === this._myPeerId) {
      room.members = room.members.filter(
        (m) => m.peerId !== (payload.peerId || fromPeerId),
      );
      this._save(room);
      this._broadcastRoster(room);
    }
  }

  /** Inbound chat message — de-duplicate then deliver to the orchestrator. */
  private _onMessage(envelope: RoomMessageEnvelope): void {
    if (
      !envelope ||
      typeof envelope.roomId !== "string" ||
      typeof envelope.messageId !== "string"
    ) {
      return;
    }

    const room = this._rooms.get(envelope.roomId);
    if (!room) {
      return; // Not a member of this room.
    }

    if (this._hasSeen(envelope.roomId, envelope.messageId)) {
      return;
    }

    this._markSeen(envelope.roomId, envelope.messageId);

    const inbound: InboundMessage = {
      id: envelope.messageId,
      groupId: roomGroupId(envelope.roomId),
      sender: envelope.senderAlias || envelope.senderPeerId,
      content: envelope.text ?? "",
      timestamp: Date.now(),
      channel: "room",
      attachments: envelope.attachments?.map((a) => ({
        fileName: a.fileName,
        mimeType: a.mimeType,
        path: a.path,
        size: a.size,
      })),
    };

    this._opts.onMessage(inbound);
  }

  /** Host: forward a relayed notification to its intended target. */
  private _onRelay(payload: RoomRelayPayload): void {
    if (
      !payload ||
      typeof payload.targetPeerId !== "string" ||
      !payload.inner
    ) {
      return;
    }

    // Only relay for rooms we host.
    if (!this.isHost(payload.roomId)) {
      return;
    }

    this._opts.transport.sendToPeer(payload.targetPeerId, payload.inner);
  }

  /** Member: authoritative roster received from the host. */
  private _onRoster(payload: RoomRosterPayload): void {
    if (!payload || typeof payload.roomId !== "string") {
      return;
    }

    const existing = this._rooms.get(payload.roomId);
    const room: RoomMeta = {
      roomId: payload.roomId,
      name: payload.name ?? existing?.name ?? payload.roomId,
      hostPeerId: payload.hostPeerId,
      members: Array.isArray(payload.members) ? payload.members : [],
      createdAt: existing?.createdAt ?? Date.now(),
    };

    this._save(room);
  }

  private _publish(): void {
    this.roomsSignal.set(this.list());
  }

  private _save(room: RoomMeta): void {
    this._rooms.set(room.roomId, room);
    this._opts.persistRoom?.(room);
    this._publish();
  }
}
