/**
 * ShadowClaw — Browser Chat Channel
 * Bridges the UI chat component with the orchestrator.
 */

import { DEFAULT_GROUP_ID } from "../config.mjs";
import { ulid } from "../ulid.mjs";
import "../types.mjs"; // Import types

/**
 * @typedef {(msg: import('../types.mjs').InboundMessage) => void} MessageCallback
 * @typedef {(groupId: string, typing: boolean) => void} TypingCallback
 * @typedef {(groupId: string, text: string, isFromMe: boolean) => void} MessageDisplayCallback
 */

export class BrowserChatChannel {
  constructor() {
    /** @type {'browser'} */
    this.type = "browser";
    /** @type {MessageCallback|null} */
    this.messageCallback = null;
    /** @type {TypingCallback|null} */
    this.typingCallback = null;
    /** @type {MessageDisplayCallback|null} */
    this.displayCallback = null;
    /** @type {string} */
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
   *
   * @param {string} text
   * @param {string} [groupId]
   */
  submit(text, groupId) {
    const gid = groupId || this.activeGroupId;
    const msg = {
      id: ulid(),
      groupId: gid,
      sender: "You",
      content: text,
      timestamp: Date.now(),
      channel: /** @type {import('../types.mjs').ChannelType} */ ("browser"),
    };

    this.messageCallback?.(msg);
  }

  /**
   * Send a response to the browser chat UI for display.
   *
   * @param {string} groupId
   * @param {string} text
   *
   * @returns {Promise<void>}
   */
  async send(groupId, text) {
    this.displayCallback?.(groupId, text, true);
  }

  /**
   * Show/hide typing indicator in the UI.
   *
   * @param {string} groupId
   * @param {boolean} typing
   */
  setTyping(groupId, typing) {
    this.typingCallback?.(groupId, typing);
  }

  /**
   * Register callback for inbound messages (from UI → orchestrator).
   *
   * @param {MessageCallback} callback
   */
  onMessage(callback) {
    this.messageCallback = callback;
  }

  /**
   * Register callback for typing indicator changes.
   *
   * @param {TypingCallback} callback
   */
  onTyping(callback) {
    this.typingCallback = callback;
  }

  /**
   * Register callback for displaying messages in the UI.
   *
   * @param {MessageDisplayCallback} callback
   */
  onDisplay(callback) {
    this.displayCallback = callback;
  }

  /**
   * Set the currently active group (for UI tab switching).
   *
   * @param {string} groupId
   */
  setActiveGroup(groupId) {
    this.activeGroupId = groupId;
  }

  /**
   * Get the currently active group.
   *
   * @returns {string}
   */
  getActiveGroup() {
    return this.activeGroupId;
  }
}
