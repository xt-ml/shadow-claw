/**
 * ShadowClaw — Browser Chat Channel
 *
 * Bridges the UI chat component with the orchestrator.
 */

import type {
  Channel,
  ChannelDisplayCallback,
  ChannelMessageCallback,
  ChannelTypingCallback,
  InboundMessage,
} from "../types.js";

import { DEFAULT_GROUP_ID } from "../config.js";
import { ulid } from "../ulid.js";

export class BrowserChatChannel implements Channel {
  type: Channel["type"];
  messageCallback: ChannelMessageCallback | null;
  typingCallback: ChannelTypingCallback | null;
  displayCallback: ChannelDisplayCallback | null;
  activeGroupId: string;

  constructor() {
    this.type = "browser";
    this.messageCallback = null;
    this.typingCallback = null;
    this.displayCallback = null;

    this.activeGroupId = DEFAULT_GROUP_ID;
  }

  start() {
    // No-op — browser chat is always "started"
  }

  stop() {
    // No-op
  }

  /**
   * Called by the UI when the user submits a message.
   */
  submit(text: string, groupId?: string) {
    const gid = groupId || this.activeGroupId;
    const msg: InboundMessage = {
      id: ulid(),
      groupId: gid,
      sender: "You",
      content: text,
      timestamp: Date.now(),
      channel: "browser",
    };

    this.messageCallback?.(msg);
  }

  /**
   * Send a response to the browser chat UI for display.
   */
  async send(groupId: string, text: string) {
    this.displayCallback?.(groupId, text, true);
  }

  /**
   * Show/hide typing indicator in the UI.
   */
  setTyping(groupId: string, typing: boolean) {
    this.typingCallback?.(groupId, typing);
  }

  /**
   * Register callback for inbound messages (from UI → orchestrator).
   */
  onMessage(callback: ChannelMessageCallback) {
    this.messageCallback = callback;
  }

  /**
   * Register callback for typing indicator changes.
   */
  onTyping(callback: ChannelTypingCallback) {
    this.typingCallback = callback;
  }

  /**
   * Register callback for displaying messages in the UI.
   */
  onDisplay(callback: ChannelDisplayCallback) {
    this.displayCallback = callback;
  }

  /**
   * Set the currently active group (for UI tab switching).
   */
  setActiveGroup(groupId: string) {
    this.activeGroupId = groupId;
  }

  /**
   * Get the currently active group.
   */
  getActiveGroup(): string {
    return this.activeGroupId;
  }
}
