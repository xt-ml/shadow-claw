import JSZip from "jszip";

import { effect } from "../../effect.js";

import { getDb } from "../../db/db.js";
import { exportChatData } from "../../db/exportChatData.js";
import { importChatData } from "../../db/importChatData.js";
import { readGroupFileBytes } from "../../storage/readGroupFileBytes.js";
import { downloadGroupFile } from "../../storage/downloadGroupFile.js";

import { fileViewerStore } from "../../stores/file-viewer.js";
import { orchestratorStore } from "../../stores/orchestrator.js";

import { shouldInlineAttachmentInChat } from "../../message-attachments.js";
import { renderMarkdown } from "../../markdown.js";

import { showError, showInfo, showSuccess, showWarning } from "../../toast.js";
import {
  MessageAttachment,
  StoredMessage,
  ThinkingLogEntry,
  ToolActivity,
} from "../../types.js";
import type { ShadowClawDatabase } from "../../types.js";
import {
  escapeHtml,
  formatDateForFilename,
  formatTimestamp,
} from "../../utils.js";

import "../shadow-claw-page-header/shadow-claw-page-header.js";
import ShadowClawElement from "../shadow-claw-element.js";

const AUTO_SCROLL_THRESHOLD = 80;
const elementName = "shadow-claw-chat";

export class ShadowClawChat extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawChat.componentPath}/${elementName}.css`;
  static template = `${ShadowClawChat.componentPath}/${elementName}.html`;

  #db: ShadowClawDatabase | null;
  #isNearBottom: boolean;
  #attachmentObjectUrls: Set<string>;

  cleanups: Array<() => void>;

  constructor() {
    super();

    this.#isNearBottom = true;
    this.#attachmentObjectUrls = new Set();
    this.cleanups = [];
    this.#db = null;
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.#db = await getDb();

    this.dispatchTerminalSlotReady();

    this.setupEffects();
    this.bindEventListeners();
  }

  disconnectedCallback() {
    this.revokeAttachmentObjectUrls();
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
  }

  revokeAttachmentObjectUrls() {
    for (const objectUrl of this.#attachmentObjectUrls) {
      URL.revokeObjectURL(objectUrl);
    }

    this.#attachmentObjectUrls.clear();
  }

  dispatchTerminalSlotReady() {
    this.dispatchEvent(
      new CustomEvent("shadow-claw-terminal-slot-ready", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const messagesEl = root.querySelector(".chat__messages");
    if (messagesEl instanceof HTMLElement) {
      messagesEl.addEventListener("scroll", () => {
        const { scrollTop, scrollHeight, clientHeight } = messagesEl;
        this.#isNearBottom =
          scrollHeight - scrollTop - clientHeight < AUTO_SCROLL_THRESHOLD;
      });

      messagesEl.addEventListener("click", (event) => {
        void this.handleMessageLinkClick(event);
      });

      const resizeObserver = new ResizeObserver(() => {
        if (this.#isNearBottom) {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      });
      resizeObserver.observe(messagesEl);
      this.cleanups.push(() => resizeObserver.disconnect());
    }

    const chatInput = root.querySelector(".chat__input");
    if (chatInput instanceof HTMLTextAreaElement) {
      chatInput.addEventListener("keydown", (event) => {
        // Enter (without Shift) sends the message
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          this.sendMessage();
        }

        // Ctrl+Enter / Cmd+Enter also sends (alternative shortcut)
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
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
      .querySelector('[data-action="stop-chat"]')
      ?.addEventListener("click", () => this.handleStopChat());

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
  }

  async handleMessageLinkClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest("a");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const href = link.getAttribute("href") || "";
    const filePath = this.resolveWorkspaceLinkPath(href);
    if (!filePath || !this.#db) {
      return;
    }

    event.preventDefault();

    try {
      await fileViewerStore.openFile(
        this.#db,
        filePath,
        orchestratorStore.activeGroupId,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to open linked file: ${message}`, 5000);
    }
  }

  resolveWorkspaceLinkPath(href: string): string | null {
    const trimmed = href.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith("#")) {
      return null;
    }

    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) || trimmed.startsWith("//")) {
      return null;
    }

    let normalized = trimmed.split(/[?#]/, 1)[0].replace(/\\/g, "/");
    normalized = normalized.replace(/^\/+/, "");
    normalized = normalized.replace(/^\.\//, "");

    if (!normalized) {
      return null;
    }

    const parts = normalized.split("/").filter(Boolean);
    if (parts.some((part) => part === "..")) {
      return null;
    }

    return parts.join("/");
  }

  /**
   * Inject a clipboard button into a message article that copies the raw
   * message text (plain text / markdown source) to the clipboard.
   */
  injectMessageCopyButton(article: HTMLElement, rawText: string) {
    if (article.querySelector(".chat__msg-copy-btn")) {
      return;
    }

    const content = article.querySelector(".chat__message-content");
    if (!content) {
      return;
    }

    const btn = document.createElement("button");
    btn.className = "chat__msg-copy-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Copy message to clipboard");

    btn.innerHTML = `
      <svg
        fill="none"
        stroke-width="1.5"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;

    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(rawText);

        btn.classList.add("chat__msg-copy-btn--copied");
        btn.setAttribute("aria-label", "Copied!");

        setTimeout(() => {
          btn.classList.remove("chat__msg-copy-btn--copied");

          btn.setAttribute("aria-label", "Copy message to clipboard");
        }, 1500);
      } catch {
        btn.setAttribute("aria-label", "Copy failed");

        setTimeout(() => {
          btn.setAttribute("aria-label", "Copy message to clipboard");
        }, 1500);
      }
    });

    content.appendChild(btn);
  }

  /**
   * Inject a "Copy" button into every <pre> block inside the given container.
   * Each button copies the text content of the sibling <code> element.
   */
  injectCopyButtons(container: HTMLElement) {
    const preBlocks = container.querySelectorAll("pre");

    preBlocks.forEach((pre) => {
      // Avoid duplicates if the effect re-runs on the same DOM
      if (pre.querySelector(".chat__code-copy-btn")) {
        return;
      }

      const btn = document.createElement("button");
      btn.className = "chat__code-copy-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Copy code to clipboard");
      btn.textContent = "📋 Copy";

      btn.addEventListener("click", async () => {
        const code = pre.querySelector("code");
        const text = code ? code.textContent || "" : pre.textContent || "";

        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = "✅ Copied";
          btn.classList.add("chat__code-copy-btn--copied");

          setTimeout(() => {
            btn.textContent = "📋 Copy";
            btn.classList.remove("chat__code-copy-btn--copied");
          }, 1500);
        } catch {
          // Fallback for environments where clipboard API is unavailable
          btn.textContent = "⚠️ Failed";

          setTimeout(() => {
            btn.textContent = "📋 Copy";
          }, 1500);
        }
      });

      pre.appendChild(btn);
    });
  }

  /**
   * Format a token count for human-readable display (e.g. 1234 → "1,234").
   */
  formatTokenCount(n: number): string {
    return typeof n === "number" ? n.toLocaleString("en-US") : "–";
  }

  /**
   * Set up reactive effects for the chat component.
   */
  setupEffects() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    this.cleanups.push(
      effect(() => {
        const messages = orchestratorStore.messages as StoredMessage[];
        const streamingText = orchestratorStore.streamingText as string | null;
        const container = root.querySelector(".chat__messages");

        if (!(container instanceof HTMLElement)) {
          return;
        }

        const shouldScroll = this.#isNearBottom;
        const distanceFromBottom = shouldScroll
          ? 0
          : container.scrollHeight -
            container.scrollTop -
            container.clientHeight;

        this.revokeAttachmentObjectUrls();
        container.innerHTML = "";

        // Render messages sequentially to ensure order and proper awaiting
        const renderMessages = async () => {
          for (const msg of messages) {
            const messageType = msg.isFromMe ? "assistant" : "user";
            const assistantName = localStorage.getItem("assistantName") || "k9";
            const sender = msg.isFromMe ? assistantName : msg.sender || "You";

            const msgDiv = document.createElement("article");
            msgDiv.className = `chat__message chat__message--${messageType}`;

            const timestamp = msg.timestamp
              ? formatTimestamp(msg.timestamp)
              : "";

            const renderedContent = await renderMarkdown(msg.content, {
              breaks: true,
            });

            msgDiv.innerHTML = `
              <div class="chat__message-header">
                <div class="chat__message-sender">${escapeHtml(sender)}</div>
                <div class="chat__message-timestamp">${escapeHtml(timestamp)}</div>
              </div>
            `;

            const contentEl = document.createElement("div");
            contentEl.className = "chat__message-content";
            if (msg.content) {
              contentEl.innerHTML = renderedContent;
              await this.resolveImagePaths(msg.groupId, contentEl);
            }

            const attachmentsEl = await this.renderMessageAttachments(msg);
            if (attachmentsEl) {
              contentEl.appendChild(attachmentsEl);
            }

            msgDiv.appendChild(contentEl);

            container.appendChild(msgDiv);

            if (msg.content) {
              this.injectMessageCopyButton(msgDiv, msg.content);
            }

            if (contentEl instanceof HTMLElement && msg.content) {
              this.injectCopyButtons(contentEl);
            }
          }
        };

        renderMessages().then(async () => {
          if (typeof streamingText === "string" && streamingText.length > 0) {
            const assistantName = localStorage.getItem("assistantName") || "k9";

            const streamDiv = document.createElement("article");
            streamDiv.className =
              "chat__message chat__message--assistant chat__message--streaming";

            const renderedContent = await renderMarkdown(streamingText, {
              breaks: true,
            });

            streamDiv.innerHTML = `
              <div class="chat__message-header">
                <div class="chat__message-sender">${escapeHtml(assistantName)}</div>
                <div class="chat__message-timestamp">streaming…</div>
              </div>
              <div class="chat__message-content">
                ${renderedContent}
                <span
                  aria-hidden="true"
                  class="chat__streaming-cursor"
                >
                </span>
              </div>
            `;

            container.appendChild(streamDiv);

            if (streamingText) {
              this.injectMessageCopyButton(streamDiv, streamingText);
            }

            // Inject copy buttons and resolve images for any code blocks already streamed
            const contentEl = streamDiv.querySelector(".chat__message-content");
            if (contentEl instanceof HTMLElement) {
              await this.resolveImagePaths(
                orchestratorStore.activeGroupId,
                contentEl,
              );
              this.injectCopyButtons(contentEl);
            }
          }

          if (shouldScroll) {
            container.scrollTop = container.scrollHeight;
          } else {
            container.scrollTop =
              container.scrollHeight -
              container.clientHeight -
              distanceFromBottom;
          }
        });
      }),
    );

    this.cleanups.push(
      effect(() => {
        const usage = orchestratorStore.tokenUsage;
        const usageEl = root.querySelector(".chat__token-usage");

        if (!(usageEl instanceof HTMLElement)) {
          return;
        }

        if (usage && (usage.inputTokens || usage.outputTokens)) {
          usageEl.classList.add("chat__token-usage--visible");
          usageEl.innerHTML =
            `<span>⬆ ${this.formatTokenCount(usage.inputTokens)} in</span>` +
            `<span>⬇ ${this.formatTokenCount(usage.outputTokens)} out</span>` +
            `<span>Σ ${this.formatTokenCount(usage.totalTokens)}</span>`;
        } else {
          usageEl.classList.remove("chat__token-usage--visible");
          usageEl.innerHTML = "";
        }
      }),
    );

    this.cleanups.push(
      effect(() => {
        const ctx = orchestratorStore.contextUsage;
        const ctxEl = root.querySelector(".chat__context-usage");

        if (!(ctxEl instanceof HTMLElement)) {
          return;
        }

        if (ctx && ctx.contextLimit > 0) {
          const pct = Math.min(ctx.usagePercent, 100);
          const level = pct > 80 ? "high" : pct > 50 ? "medium" : "low";

          ctxEl.classList.add("chat__context-usage--visible");
          ctxEl.innerHTML =
            `<span>${this.formatTokenCount(ctx.estimatedTokens)} / ${this.formatTokenCount(ctx.contextLimit)}</span>` +
            `<div class="chat__context-bar">` +
            `<div class="chat__context-bar-fill chat__context-bar-fill--${level}" style="width:${pct}%"></div>` +
            `</div>` +
            `<span>${pct.toFixed(0)}%</span>` +
            (ctx.truncatedCount > 0
              ? `<span>(${ctx.truncatedCount} msgs trimmed)</span>`
              : "");
        } else {
          ctxEl.classList.remove("chat__context-usage--visible");
          ctxEl.innerHTML = "";
        }
      }),
    );

    this.cleanups.push(
      effect(() => {
        const activity = orchestratorStore.toolActivity as ToolActivity | null;
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
        const progress = orchestratorStore.modelDownloadProgress;
        const progressEl = root.querySelector(".chat__model-progress");
        const labelEl = root.querySelector(".chat__model-progress-label");
        const barEl = root.querySelector(".chat__model-progress-bar");

        if (
          !(progressEl instanceof HTMLElement) ||
          !(labelEl instanceof HTMLElement) ||
          !(barEl instanceof HTMLElement)
        ) {
          return;
        }

        if (!progress) {
          progressEl.classList.remove("chat__model-progress--active");
          labelEl.textContent = "Preparing Prompt API model...";
          barEl.style.width = "0%";

          return;
        }

        const normalized =
          typeof progress.progress === "number"
            ? Math.max(0, Math.min(1, progress.progress))
            : 0;
        const percent = Math.round(normalized * 100);

        progressEl.classList.add("chat__model-progress--active");
        labelEl.textContent =
          progress.message || `Downloading Prompt API model... ${percent}%`;
        barEl.style.width = `${percent}%`;
      }),
    );

    this.cleanups.push(
      effect(() => {
        const log = orchestratorStore.activityLog as ThinkingLogEntry[];
        const logEl = root.querySelector(".chat__activity-log");

        if (!(logEl instanceof HTMLElement)) {
          return;
        }

        if (log.length > 0) {
          logEl.classList.add("chat__activity-log--active");
          logEl.innerHTML = log
            .map(
              (entry) =>
                `<div>[${escapeHtml(entry.level)}] ${escapeHtml(entry.label || "")}: ${escapeHtml(entry.message)}</div>`,
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
        const stopButton = root.querySelector('[data-action="stop-chat"]');
        const isProcessing = state === "thinking" || state === "responding";

        if (sendButton instanceof HTMLButtonElement) {
          sendButton.disabled = isProcessing;
        }

        if (stopButton instanceof HTMLButtonElement) {
          stopButton.disabled = !isProcessing;
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

  async renderMessageAttachments(
    msg: StoredMessage,
  ): Promise<HTMLElement | null> {
    if (!Array.isArray(msg.attachments) || msg.attachments.length === 0) {
      return null;
    }

    const wrap = document.createElement("div");
    wrap.className = "chat__attachments";

    for (const attachment of msg.attachments) {
      const card = document.createElement("section");
      card.className = "chat__attachment";

      if (shouldInlineAttachmentInChat(attachment) && attachment.path) {
        const preview = await this.renderInlineAttachmentPreview(
          msg,
          attachment,
        );
        if (preview) {
          card.appendChild(preview);
        }
      }

      const meta = document.createElement("div");
      meta.className = "chat__attachment-meta";

      const title = document.createElement("button");
      title.className = "chat__attachment-title";
      title.type = "button";
      title.textContent = attachment.fileName;
      title.disabled = !attachment.path || !this.#db;
      title.addEventListener("click", () => {
        void this.openAttachment(msg.groupId, attachment);
      });

      meta.appendChild(title);

      const subtitle = document.createElement("div");
      subtitle.className = "chat__attachment-subtitle";
      subtitle.textContent = this.formatAttachmentSubtitle(attachment);
      meta.appendChild(subtitle);

      const actions = document.createElement("div");
      actions.className = "chat__attachment-actions";

      if (attachment.path && this.#db) {
        const openBtn = document.createElement("button");
        openBtn.className = "chat__attachment-action";
        openBtn.type = "button";
        openBtn.textContent = "Open";
        openBtn.addEventListener("click", () => {
          void this.openAttachment(msg.groupId, attachment);
        });
        actions.appendChild(openBtn);

        const downloadBtn = document.createElement("button");
        downloadBtn.className = "chat__attachment-action";
        downloadBtn.type = "button";
        downloadBtn.textContent = "Download";
        downloadBtn.addEventListener("click", () => {
          void this.downloadAttachment(msg.groupId, attachment);
        });
        actions.appendChild(downloadBtn);
      }

      meta.appendChild(actions);
      card.appendChild(meta);
      wrap.appendChild(card);
    }

    return wrap;
  }

  async renderInlineAttachmentPreview(
    msg: StoredMessage,
    attachment: MessageAttachment,
  ): Promise<HTMLElement | null> {
    if (!this.#db || !attachment.path) {
      return null;
    }

    try {
      const bytes = await readGroupFileBytes(
        this.#db,
        msg.groupId,
        attachment.path,
      );
      const blobBytes = new Uint8Array(bytes.byteLength);
      blobBytes.set(bytes);
      const blob = new Blob([blobBytes], {
        type: attachment.mimeType || "image/png",
      });
      const objectUrl = URL.createObjectURL(blob);
      this.#attachmentObjectUrls.add(objectUrl);

      const previewButton = document.createElement("button");
      previewButton.className = "chat__attachment-preview-btn";
      previewButton.type = "button";
      previewButton.setAttribute("aria-label", `Open ${attachment.fileName}`);
      previewButton.addEventListener("click", () => {
        void this.openAttachment(msg.groupId, attachment);
      });

      const image = document.createElement("img");
      image.className = "chat__attachment-preview";
      image.alt = attachment.fileName;
      image.src = objectUrl;
      previewButton.appendChild(image);

      return previewButton;
    } catch (err) {
      const error = document.createElement("div");
      error.className = "chat__attachment-preview-error";
      error.textContent =
        err instanceof Error ? err.message : "Attachment preview unavailable.";

      return error;
    }
  }

  async resolveImagePaths(groupId: string, container: HTMLElement) {
    if (!this.#db) {
      return;
    }

    const imgs = Array.from(container.querySelectorAll("img"));
    for (const img of imgs) {
      const src = img.getAttribute("src");
      if (
        src &&
        !src.startsWith("http") &&
        !src.startsWith("data:") &&
        !src.startsWith("blob:")
      ) {
        try {
          const bytes = await readGroupFileBytes(this.#db, groupId, src);
          const blobBytes = new Uint8Array(bytes.byteLength);
          blobBytes.set(bytes);

          const lowerSrc = src.toLowerCase();

          if (lowerSrc.endsWith(".pdf")) {
            const viewer = document.createElement(
              "shadow-claw-pdf-viewer",
            ) as any;

            viewer.file = {
              name: src.split("/").pop() || "document.pdf",
              binaryContent: blobBytes,
            };

            img.replaceWith(viewer);
          } else {
            let mimeType = "image/png";
            if (lowerSrc.endsWith(".jpg") || lowerSrc.endsWith(".jpeg")) {
              mimeType = "image/jpeg";
            } else if (lowerSrc.endsWith(".gif")) {
              mimeType = "image/gif";
            } else if (lowerSrc.endsWith(".webp")) {
              mimeType = "image/webp";
            } else if (lowerSrc.endsWith(".svg")) {
              mimeType = "image/svg+xml";
            }

            const blob = new Blob([blobBytes], { type: mimeType });
            const objectUrl = URL.createObjectURL(blob);

            this.#attachmentObjectUrls.add(objectUrl);

            img.src = objectUrl;
          }
        } catch (e) {
          console.warn(`Failed to load inline image: ${src}`, e);
        }
      }
    }
  }

  formatAttachmentSubtitle(attachment: MessageAttachment): string {
    const parts: string[] = [];
    if (attachment.mimeType) {
      parts.push(attachment.mimeType);
    }

    if (typeof attachment.size === "number") {
      parts.push(this.formatAttachmentSize(attachment.size));
    }

    return parts.join(" · ") || "Attachment";
  }

  formatAttachmentSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  async openAttachment(groupId: string, attachment: MessageAttachment) {
    if (!this.#db || !attachment.path) {
      return;
    }

    try {
      await fileViewerStore.openFile(this.#db, attachment.path, groupId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to open attachment: ${message}`, 5000);
    }
  }

  async downloadAttachment(groupId: string, attachment: MessageAttachment) {
    if (!this.#db || !attachment.path) {
      return;
    }

    try {
      await downloadGroupFile(this.#db, groupId, attachment.path);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to download attachment: ${message}`, 5000);
    }
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

    // Resume auto-scroll so the user sees their own message and the response
    this.#isNearBottom = true;

    try {
      orchestratorStore.sendMessage(message);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Error sending message: ${errorMsg}`, 6000);
    }
  }

  async handleCompactChat() {
    if (!this.#db) {
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
      await orchestratorStore.compactContext(this.#db);

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

    if (!this.#db) {
      return;
    }

    const container = root.querySelector(".chat__messages");
    if (container instanceof HTMLElement) {
      container.innerHTML = "";
    }

    try {
      await orchestratorStore.newSession(this.#db);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn("Failed to clear session:", errorMsg);
    }
  }

  async handleStopChat() {
    try {
      orchestratorStore.stopCurrentRequest();
      showInfo("Stopped current request", 2200);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to stop request: ${errorMsg}`, 6000);
    }
  }

  async downloadChat() {
    if (!this.#db) {
      return;
    }

    try {
      const groupId = orchestratorStore.activeGroupId;
      const chatData = await exportChatData(this.#db, groupId);
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

  async restoreChat(input: HTMLInputElement) {
    if (!this.#db) {
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
      await importChatData(this.#db, groupId, chatData);
      await orchestratorStore.loadHistory();

      showSuccess("Chat restored successfully", 3500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      showError(`Failed to restore chat: ${errorMsg}`, 6000);
    } finally {
      input.value = "";
    }
  }
}

customElements.define(elementName, ShadowClawChat);
