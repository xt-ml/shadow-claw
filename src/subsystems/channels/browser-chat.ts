/**
 * ShadowClaw — Browser Chat Channel
 *
 * Bridges the UI chat component with the orchestrator.
 */

import type { MessageAttachment } from "../../content/types.js";
import type {
  Channel,
  ChannelDisplayCallback,
  ChannelMessageCallback,
  ChannelTypingCallback,
  InboundMessage,
} from "./types.js";
import type { A2UIAction } from "../../ui/a2ui.js";

import { DEFAULT_GROUP_ID } from "../../config/config.js";
import { ulid } from "../../utils/ulid.js";

export class BrowserChatChannel implements Channel {
  activeGroupId: string;
  displayCallback: ChannelDisplayCallback | null;
  messageCallback: ChannelMessageCallback | null;
  type: Channel["type"];
  typingCallback: ChannelTypingCallback | null;

  constructor() {
    this.type = "browser";
    this.messageCallback = null;
    this.typingCallback = null;
    this.displayCallback = null;

    this.activeGroupId = DEFAULT_GROUP_ID;
  }

  /**
   * Get the currently active group.
   */
  getActiveGroup(): string {
    return this.activeGroupId;
  }

  /**
   * Register callback for displaying messages in the UI.
   */
  onDisplay(callback: ChannelDisplayCallback) {
    this.displayCallback = callback;
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
   * Set the currently active group (for UI tab switching).
   */
  setActiveGroup(groupId: string) {
    this.activeGroupId = groupId;
  }

  /**
   * Show/hide typing indicator in the UI.
   */
  setTyping(groupId: string, typing: boolean) {
    this.typingCallback?.(groupId, typing);
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
  submit(
    text: string,
    groupId?: string,
    attachments: MessageAttachment[] = [],
    a2uiAction?: A2UIAction,
  ) {
    const gid = groupId || this.activeGroupId;
    const msg: InboundMessage = {
      id: ulid(),
      groupId: gid,
      sender: "You",
      content: text,
      timestamp: Date.now(),
      channel: "browser",
      attachments,
      a2uiAction,
    };

    this.messageCallback?.(msg);
  }

  /**
   * Send a response to the browser chat UI for display.
   */
  async send(
    groupId: string,
    text: string,
    _attachments?: MessageAttachment[],
  ) {
    this.displayCallback?.(groupId, text, true);
  }
}
