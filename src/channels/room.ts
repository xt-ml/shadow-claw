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

import { roomIdFromGroupId } from "../db/rooms.js";

import type {
  Channel,
  ChannelMessageCallback,
  ChannelTypingCallback,
  InboundMessage,
  MessageAttachment,
} from "../types.js";

import type { RoomManager } from "./room-manager.js";

export class RoomChannel implements Channel {
  type: Channel["type"] = "room";

  running = false;
  messageCallback: ChannelMessageCallback | null = null;
  typingCallback: ChannelTypingCallback | null = null;

  private _manager: RoomManager | null = null;

  /** Wire the room manager used for transport. */
  setManager(manager: RoomManager): void {
    this._manager = manager;
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
    this._manager.broadcast(roomId, text, attachments);
  }

  setTyping(_groupId: string, _typing: boolean): void {
    // Typing presence within rooms is not propagated in this version.
  }

  onMessage(callback: ChannelMessageCallback): void {
    this.messageCallback = callback;
  }

  onTyping(callback: ChannelTypingCallback): void {
    this.typingCallback = callback;
  }

  /** Deliver an inbound room message (called by the {@link RoomManager}). */
  deliverInbound(msg: InboundMessage): void {
    this.messageCallback?.(msg);
  }
}
