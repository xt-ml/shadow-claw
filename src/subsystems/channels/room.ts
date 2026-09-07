/**
 * ShadowClaw — Room Channel
 *
 * Thin {@link Channel} adapter for multi-party rooms. Outbound messages are
 * broadcast to all room members via the {@link RoomManager} (which delegates
 * transport to the PeerJS mesh with host-relay fallback). Inbound messages are
 * delivered by the manager back through this channel's registered callback so
 * they flow into the orchestrator's normal enqueue path.
 *
 * - Prefix: `room:`
 * - groupId format: `room:<roomId>`
 */

import { roomIdFromGroupId } from "../../db/rooms.js";

import type { MessageAttachment } from "../../content/types.js";
import type {
  Channel,
  ChannelMessageCallback,
  ChannelTypingCallback,
  InboundMessage,
} from "./types.js";

import type { PeerJsChannel } from "./peerjs.js";
import type { RoomManager } from "./room-manager.js";

export class RoomChannel implements Channel {
  messageCallback: ChannelMessageCallback | null = null;

  running = false;
  type: Channel["type"] = "room";
  typingCallback: ChannelTypingCallback | null = null;

  private _manager: RoomManager | null = null;
  private _peerjs: PeerJsChannel | null = null;

  /** Deliver an inbound room message (called by the {@link RoomManager}). */
  deliverInbound(msg: InboundMessage): void {
    this.messageCallback?.(msg);
  }

  onMessage(callback: ChannelMessageCallback): void {
    this.messageCallback = callback;
  }

  onTyping(callback: ChannelTypingCallback): void {
    this.typingCallback = callback;
  }

  /** Wire the room manager used for transport. */
  setManager(manager: RoomManager): void {
    this._manager = manager;
  }

  /** Wire the PeerJS channel used for WebRTC file streaming. */
  setPeerJs(peerjs: PeerJsChannel): void {
    this._peerjs = peerjs;
  }

  setTyping(_groupId: string, _typing: boolean): void {
    // Typing presence within rooms is not propagated in this version.
  }

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  async send(
    groupId: string,
    text: string,
    attachments?: MessageAttachment[],
  ): Promise<void> {
    if (!this._manager) {
      return;
    }

    const roomId = roomIdFromGroupId(groupId);

    if (attachments && attachments.length > 0 && this._peerjs) {
      const room = this._manager.get(roomId);
      if (room) {
        await this._peerjs.sendAttachmentsToRoom(room, groupId, attachments);
      }
    }

    this._manager.broadcast(roomId, text, attachments);
  }
}
