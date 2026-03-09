// @ts-ignore
import JSZip from "jszip";

import { exportChatData } from "../db/exportChatData.mjs";
import { getDb } from "../db/db.mjs";
import { importChatData } from "../db/importChatData.mjs";

import { effect } from "../effect.mjs";
import { renderMarkdown } from "../markdown.mjs";

import { fileViewerStore } from "../stores/file-viewer.mjs";
import { orchestratorStore } from "../stores/orchestrator.mjs";

import { formatDateForFilename, formatTimestamp } from "../utils.mjs";
import { showError, showInfo, showSuccess, showWarning } from "../toast.mjs";

import "./shadow-claw-page-header.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 * @typedef {import("../stores/file-viewer.mjs").FileInfo} FileInfo
 * @typedef {import("../stores/orchestrator.mjs").ToolActivity} ToolActivity
 * @typedef {import("../types.mjs").StoredMessage} StoredMessage
 * @typedef {import("../types.mjs").ThinkingLogEntry} ThinkingLogEntry
 */

export class ShadowClawChat extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    /** @type {ShadowClawDatabase | null} */
    this.db = null;
    /** @type {Array<() => void>} */
    this.cleanups = [];
  }

  static getTemplate() {
    return `
      <style>
        :host {
          display: flex;
          flex: 1;
          min-height: 0;
        }

        .chat {
          display: flex;
          flex: 1;
          flex-direction: column;
          min-height: 0;
        }

        .chat__status {
          align-items: center;
          display: inline-flex;
          gap: 0.375rem;
          min-height: 1.5rem;
        }

        .chat__status-indicator {
          color: var(--shadow-claw-success-color);
          font-size: 0.875rem;
          line-height: 1;
        }

        .chat__status-indicator--thinking,
        .chat__status-indicator--responding {
          color: var(--shadow-claw-warning-color);
        }

        .chat__status-indicator--error {
          color: var(--shadow-claw-error-color);
        }

        .chat__action-btn {
          background-color: var(--shadow-claw-bg-tertiary);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          border-radius: var(--shadow-claw-radius-m);
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0.5rem 0.75rem;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .chat__action-btn:hover,
        .chat__action-btn:focus-visible {
          background-color: var(--shadow-claw-bg-secondary);
          border-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-text-primary);
          outline: none;
        }

        .chat__body {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 0.75rem;
          min-height: 0;
          overflow: hidden;
          padding: 0.75rem;
        }

        .chat__tool-activity {
          align-items: center;
          color: var(--shadow-claw-accent-primary);
          display: none;
          font-size: 0.75rem;
          font-style: italic;
          gap: 0.375rem;
          min-height: 1.25rem;
          padding: 0.25rem 0.25rem 0;
        }

        .chat__tool-activity--active {
          display: flex;
        }

        .chat__activity-log {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: 0.375rem;
          color: var(--shadow-claw-text-tertiary);
          display: none;
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.6875rem;
          max-height: 6.25rem;
          overflow-y: auto;
          padding: 0.5rem 0.75rem;
        }

        .chat__activity-log--active {
          display: block;
        }

        .chat__messages {
          background-color: var(--shadow-claw-bg-secondary);
          border: 0.0625rem solid var(--shadow-claw-bg-tertiary);
          border-radius: var(--shadow-claw-radius-l);
          box-shadow: inset var(--shadow-claw-shadow-sm);
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 0.75rem;
        }

        .chat__message {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 0.75rem;
        }

        .chat__message-header {
          align-items: baseline;
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.125rem;
        }

        .chat__message-sender {
          color: var(--shadow-claw-text-tertiary);
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.03125rem;
          text-transform: uppercase;
        }

        .chat__message-timestamp {
          color: var(--shadow-claw-text-tertiary);
          font-size: 0.625rem;
        }

        .chat__message-content {
          background-color: var(--shadow-claw-bg-primary);
          border: 0.0625rem solid transparent;
          border-left: 0.25rem solid var(--shadow-claw-accent-primary);
          border-radius: var(--shadow-claw-radius-m);
          font-size: 0.875rem;
          line-height: 1.5;
          overflow-wrap: anywhere;
          padding: 0.75rem 1rem;
        }

        .chat__message--user .chat__message-content {
          background-color: var(--shadow-claw-accent-primary);
          border-left-color: var(--shadow-claw-accent-hover);
          color: var(--shadow-claw-on-primary);
        }

        .chat__message-content p {
          margin-bottom: 0.5rem;
        }

        .chat__message-content p:last-child {
          margin-bottom: 0;
        }

        .chat__message-content pre {
          background: var(--shadow-claw-bg-secondary);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          border-radius: var(--shadow-claw-radius-m);
          margin: 0.75rem 0;
          overflow-x: auto;
          padding: 0;
        }

        .chat__message-content pre code.hljs {
          background-color: transparent;
          border-radius: 0.375rem;
          color: var(--shadow-claw-text-primary);
          display: block;
          font-size: 0.8125rem;
          line-height: 1.6;
          margin: 0;
          padding: 0.75rem;
        }

        .chat__message-content code {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: 0.1875rem;
          color: var(--shadow-claw-text-primary);
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
          padding: 0.125rem 0.375rem;
        }

        .chat__message-content code.hljs {
          background: transparent;
          color: var(--shadow-claw-text-primary);
          padding: 0;
        }

        .chat__message-content ul,
        .chat__message-content ol {
          margin-bottom: 0.5rem;
          padding-left: 1.5rem;
        }

        .chat__message-content li {
          margin-bottom: 0.25rem;
        }

        .chat__message-content li:last-child,
        .chat__message-content ul:last-child,
        .chat__message-content ol:last-child {
          margin-bottom: 0;
        }

        .chat__message-content li input[type="checkbox"] {
          accent-color: var(--shadow-claw-accent-primary);
          cursor: pointer;
          margin-right: 0.5rem;
          vertical-align: middle;
        }

        .chat__message-content blockquote {
          border-left: 0.25rem solid var(--shadow-claw-border-color);
          color: var(--shadow-claw-text-secondary);
          font-style: italic;
          margin: 0.5rem 0;
          padding-left: 0.75rem;
        }

        .chat__message-content hr {
          border: 0;
          border-top: 0.0625rem solid var(--shadow-claw-border-color);
          margin: 0.75rem 0;
        }

        .chat__message--user .chat__message-content a,
        .chat__message--user .chat__message-content a:visited {
          color: #ffffff;
          opacity: 0.9;
          text-decoration: underline;
          text-underline-offset: 0.125rem;
        }

        .chat__message--user .chat__message-content a:hover {
          color: #ffffff;
          opacity: 1;
        }

        .chat__input-area {
          display: flex;
          gap: 0.5rem;
        }

        .chat__input-wrapper {
          background-color: var(--shadow-claw-bg-primary);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          border-radius: var(--shadow-claw-radius-l);
          box-shadow: var(--shadow-claw-shadow-sm);
          display: flex;
          flex: 1;
          transition: all 0.15s;
        }

        .chat__input-wrapper:focus-within {
          border-color: var(--shadow-claw-accent-primary);
          box-shadow: 0 0 0 0.125rem var(--shadow-claw-bg-tertiary);
        }

        .chat__input {
          background: transparent;
          border: none;
          color: var(--shadow-claw-text-primary);
          flex: 1;
          font-family: var(--shadow-claw-font-sans);
          font-size: 0.875rem;
          max-height: 6.25rem;
          min-height: 2.5rem;
          overflow-y: auto;
          padding: 0.625rem 0.75rem;
          resize: none;
        }

        .chat__input::placeholder {
          color: var(--shadow-claw-text-tertiary);
        }

        .chat__input:focus {
          outline: none;
        }

        .chat__send-btn {
          background-color: var(--shadow-claw-accent-primary);
          border: none;
          border-radius: var(--shadow-claw-radius-l);
          color: var(--shadow-claw-on-primary);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          min-height: 2.5rem;
          min-width: 4.5rem;
          padding: 0.625rem 1rem;
          transition: background-color 0.15s;
          white-space: nowrap;
        }

        .chat__send-btn:hover,
        .chat__send-btn:focus-visible {
          background-color: var(--shadow-claw-accent-hover);
          outline: none;
        }

        .chat__send-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .chat__restore-input {
          display: none;
        }

        .chat__file-modal {
          align-items: center;
          background-color: rgba(0, 0, 0, 0.5);
          display: none;
          inset: 0;
          justify-content: center;
          position: fixed;
          z-index: 1000;
        }

        .chat__file-modal--active {
          display: flex;
        }

        .chat__modal-content {
          background-color: var(--shadow-claw-bg-primary);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          border-radius: var(--shadow-claw-radius-l);
          box-shadow: var(--shadow-claw-shadow-lg);
          display: flex;
          flex-direction: column;
          height: min(80vh, 45rem);
          max-width: 56rem;
          width: calc(100vw - 1.5rem);
        }

        .chat__modal-header {
          align-items: center;
          border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 1rem;
        }

        .chat__modal-title {
          font-size: 0.875rem;
          font-weight: 600;
          margin: 0;
        }

        .chat__modal-close-btn {
          background: transparent;
          border: none;
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 1.25rem;
          min-height: 2rem;
          min-width: 2rem;
        }

        .chat__modal-body {
          flex: 1;
          overflow: auto;
          padding: 1rem;
        }

        .chat__file-content {
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
          margin: 0;
          white-space: pre-wrap;
          word-break: break-all;
        }

        @media (min-width: 48rem) {
          .chat__body {
            padding: 1rem;
          }

          .chat__messages {
            padding: 1rem;
          }

          .chat__send-btn {
            padding: 0.625rem 1.25rem;
          }
        }
      </style>

      <section class="chat" aria-label="Chat">
        <shadow-claw-page-header icon="💬" title="Chat">
          <div slot="status" class="chat__status" aria-live="polite">
            <span class="chat__status-indicator" aria-hidden="true">●</span>
            <span class="chat__status-text">Ready</span>
          </div>
          <button slot="actions" class="chat__action-btn" data-action="download-chat" type="button">💾 Backup</button>
          <button slot="actions" class="chat__action-btn" data-action="restore-chat" type="button">♻️ Restore</button>
          <button slot="actions" class="chat__action-btn" data-action="compact-chat" type="button">📦 Compact</button>
          <button slot="actions" class="chat__action-btn" data-action="clear-chat" type="button">🗑️ Clear Chat</button>
        </shadow-claw-page-header>

        <div class="chat__body">
          <div class="chat__tool-activity" aria-live="polite">⚙️ Working...</div>
          <div class="chat__activity-log" aria-live="polite"></div>
          <div class="chat__messages" role="log" aria-live="polite" aria-label="Conversation messages"></div>
          <div class="chat__input-area">
            <div class="chat__input-wrapper">
              <textarea
                class="chat__input"
                placeholder="Type a message..."
                rows="1"
                aria-label="Message input"
              ></textarea>
            </div>
            <button class="chat__send-btn" data-action="send-message" type="button">Send</button>
          </div>
        </div>

        <input class="chat__restore-input" type="file" accept=".zip,application/zip" />

        <div class="chat__file-modal" role="dialog" aria-modal="true" aria-label="File viewer">
          <div class="chat__modal-content">
            <div class="chat__modal-header">
              <h3 class="chat__modal-title">File: name.txt</h3>
              <button class="chat__modal-close-btn" type="button" aria-label="Close file viewer">&times;</button>
            </div>
            <div class="chat__modal-body">
              <pre class="chat__file-content"></pre>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  connectedCallback() {
    const db = getDb();

    if (!db) {
      throw new Error(
        "shadow-claw-chat cannot get the db on connectedCallback",
      );
    }

    this.db = db;
    this.render();
    this.bindEventListeners();
    this.setupEffects();
  }

  disconnectedCallback() {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
  }

  render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const template = document.createElement("template");
    template.innerHTML = ShadowClawChat.getTemplate();

    root.innerHTML = "";
    root.appendChild(template.content.cloneNode(true));
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const chatInput = root.querySelector(".chat__input");
    if (chatInput instanceof HTMLTextAreaElement) {
      chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          this.sendMessage();
        }
      });
    }

    root
      .querySelector('[data-action="send-message"]')
      ?.addEventListener("click", () => this.sendMessage());

    root
      .querySelector('[data-action="compact-chat"]')
      ?.addEventListener("click", () => this.handleCompactChat());

    root
      .querySelector('[data-action="clear-chat"]')
      ?.addEventListener("click", () => this.handleClearChat());

    root
      .querySelector('[data-action="download-chat"]')
      ?.addEventListener("click", () => this.downloadChat());

    root
      .querySelector('[data-action="restore-chat"]')
      ?.addEventListener("click", () => {
        const restoreInput = root.querySelector(".chat__restore-input");
        if (restoreInput instanceof HTMLInputElement) {
          restoreInput.click();
        }
      });

    root
      .querySelector(".chat__restore-input")
      ?.addEventListener("change", (e) => {
        if (e.target instanceof HTMLInputElement) {
          this.restoreChat(e.target);
        }
      });

    root
      .querySelector(".chat__modal-close-btn")
      ?.addEventListener("click", () => fileViewerStore.closeFile());
  }

  setupEffects() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    this.cleanups.push(
      effect(() => {
        /** @type {StoredMessage[]} */
        const messages = orchestratorStore.messages;
        const container = root.querySelector(".chat__messages");

        if (!(container instanceof HTMLElement)) {
          return;
        }

        container.innerHTML = "";

        messages.forEach((msg) => {
          const messageType = msg.isFromMe ? "assistant" : "user";
          const assistantName =
            localStorage.getItem("assistantName") || "rover";
          const sender = msg.isFromMe ? assistantName : msg.sender || "You";

          const msgDiv = document.createElement("article");
          msgDiv.className = `chat__message chat__message--${messageType}`;

          const timestamp = msg.timestamp ? formatTimestamp(msg.timestamp) : "";

          msgDiv.innerHTML = `
            <div class="chat__message-header">
              <div class="chat__message-sender">${this.escapeHtml(sender)}</div>
              <div class="chat__message-timestamp">${this.escapeHtml(timestamp)}</div>
            </div>
            <div class="chat__message-content">${renderMarkdown(msg.content)}</div>
          `;

          container.appendChild(msgDiv);
        });

        container.scrollTop = container.scrollHeight;
      }),
    );

    this.cleanups.push(
      effect(() => {
        /** @type {ToolActivity | null} */
        const activity = orchestratorStore.toolActivity;
        const toolEl = root.querySelector(".chat__tool-activity");

        if (!(toolEl instanceof HTMLElement)) {
          return;
        }

        if (activity) {
          toolEl.classList.add("chat__tool-activity--active");
          toolEl.textContent = `⚙️ Using ${activity.tool}...`;
        } else {
          toolEl.classList.remove("chat__tool-activity--active");
          toolEl.textContent = "⚙️ Working...";
        }
      }),
    );

    this.cleanups.push(
      effect(() => {
        /** @type {ThinkingLogEntry[]} */
        const log = orchestratorStore.activityLog;
        const logEl = root.querySelector(".chat__activity-log");

        if (!(logEl instanceof HTMLElement)) {
          return;
        }

        if (log.length > 0) {
          logEl.classList.add("chat__activity-log--active");
          logEl.innerHTML = log
            .map(
              (entry) =>
                `<div>[${this.escapeHtml(entry.level)}] ${this.escapeHtml(entry.label || "")}: ${this.escapeHtml(entry.message)}</div>`,
            )
            .join("");

          logEl.scrollTop = logEl.scrollHeight;
        } else {
          logEl.classList.remove("chat__activity-log--active");
          logEl.innerHTML = "";
        }
      }),
    );

    this.cleanups.push(
      effect(() => {
        /** @type {FileInfo | null} */
        const file = fileViewerStore.file;
        const modal = root.querySelector(".chat__file-modal");

        if (!(modal instanceof HTMLElement)) {
          return;
        }

        if (file) {
          modal.classList.add("chat__file-modal--active");

          const title = modal.querySelector(".chat__modal-title");
          const content = modal.querySelector(".chat__file-content");

          if (title instanceof HTMLElement) {
            title.textContent = `File: ${file.name}`;
          }

          if (content instanceof HTMLElement) {
            content.textContent = file.content;
          }
        } else {
          modal.classList.remove("chat__file-modal--active");
        }
      }),
    );

    this.cleanups.push(
      effect(() => {
        const state = orchestratorStore.state;
        const statusText = root.querySelector(".chat__status-text");
        const statusIndicator = root.querySelector(".chat__status-indicator");

        if (
          !(statusText instanceof HTMLElement) ||
          !(statusIndicator instanceof HTMLElement)
        ) {
          return;
        }

        statusIndicator.classList.remove(
          "chat__status-indicator--thinking",
          "chat__status-indicator--responding",
          "chat__status-indicator--error",
        );

        if (state === "thinking" || state === "responding") {
          statusIndicator.classList.add(`chat__status-indicator--${state}`);
        }

        if (state === "error") {
          statusIndicator.classList.add("chat__status-indicator--error");
        }

        statusText.textContent = state.charAt(0).toUpperCase() + state.slice(1);
      }),
    );

    this.cleanups.push(
      effect(() => {
        const state = orchestratorStore.state;
        const sendButton = root.querySelector('[data-action="send-message"]');

        if (sendButton instanceof HTMLButtonElement) {
          sendButton.disabled = state === "thinking" || state === "responding";
        }
      }),
    );

    this.cleanups.push(
      effect(() => {
        const error = orchestratorStore.error;

        if (error) {
          showError(error, 6000);
          orchestratorStore.clearError();
        }
      }),
    );
  }

  async sendMessage() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(".chat__input");
    if (!(input instanceof HTMLTextAreaElement)) {
      return;
    }

    const message = input.value.trim();

    if (!message) {
      return;
    }

    if (!orchestratorStore.ready) {
      showWarning("ShadowClaw is still initializing. Please try again.", 3500);

      return;
    }

    input.value = "";

    try {
      orchestratorStore.sendMessage(message);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Error sending message: ${errorMsg}`, 6000);
    }
  }

  async handleCompactChat() {
    if (!this.db) {
      return;
    }

    if (
      !confirm(
        "This will summarize the conversation to reduce token usage. The summary replaces the current history. Continue?",
      )
    ) {
      return;
    }

    try {
      await orchestratorStore.compactContext(this.db);
      showInfo("Compacting context...", 2500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to compact chat: ${errorMsg}`, 6000);
    }
  }

  async handleClearChat() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const container = root.querySelector(".chat__messages");
    if (container instanceof HTMLElement) {
      container.innerHTML = "";
    }

    try {
      await orchestratorStore.newSession();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn("Failed to clear session:", errorMsg);
    }
  }

  async downloadChat() {
    if (!this.db) {
      return;
    }

    try {
      const groupId = orchestratorStore.activeGroupId;
      const chatData = await exportChatData(this.db, groupId);
      if (!chatData) {
        showError("Failed to export chat data", 6000);

        return;
      }

      const zip = new JSZip();
      zip.file("chat-data.json", JSON.stringify(chatData, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `chat-${formatDateForFilename()}.zip`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess("Chat backup downloaded", 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to download chat: ${message}`, 6000);
    }
  }

  /**
   * @param {HTMLInputElement} input
   */
  async restoreChat(input) {
    if (!this.db) {
      return;
    }

    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.endsWith(".zip")) {
      showWarning("Please select a .zip file", 3500);
      input.value = "";

      return;
    }

    try {
      const zip = await JSZip.loadAsync(file);
      const dataFile = zip.file("chat-data.json");

      if (!dataFile) {
        showError("Invalid chat file: missing chat-data.json", 6000);
        input.value = "";

        return;
      }

      const jsonString = await dataFile.async("string");
      const chatData = JSON.parse(jsonString);

      if (!chatData.messages || !Array.isArray(chatData.messages)) {
        showError("Invalid chat file: missing messages array", 6000);
        input.value = "";

        return;
      }

      const groupId = orchestratorStore.activeGroupId;
      await importChatData(this.db, groupId, chatData);
      await orchestratorStore.loadHistory();

      showSuccess("Chat restored successfully", 3500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to restore chat: ${errorMsg}`, 6000);
    } finally {
      input.value = "";
    }
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;

    return div.innerHTML;
  }
}

customElements.define("shadow-claw-chat", ShadowClawChat);
