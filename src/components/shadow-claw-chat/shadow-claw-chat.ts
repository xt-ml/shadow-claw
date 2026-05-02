import JSZip from "jszip";

import { CONFIG_KEYS } from "../../config.js";
import {
  formatModelAttachmentCapabilitySummary,
  getAttachmentCategory,
  getModelAttachmentCapabilities,
} from "../../attachment-capabilities.js";
import { effect } from "../../effect.js";

import { getDb } from "../../db/db.js";
import { exportChatData } from "../../db/exportChatData.js";
import { importChatData } from "../../db/importChatData.js";
import { getConfig } from "../../db/getConfig.js";
import { setConfig } from "../../db/setConfig.js";
import { readGroupFileBytes } from "../../storage/readGroupFileBytes.js";
import { downloadGroupFile } from "../../storage/downloadGroupFile.js";

import { chatUiStore } from "../../stores/chat-ui.js";
import { fileViewerStore } from "../../stores/file-viewer.js";
import { orchestratorStore } from "../../stores/orchestrator.js";

import {
  inferAttachmentMimeType,
  shouldInlineAttachmentInChat,
} from "../../message-attachments.js";
import { renderMarkdown } from "../../markdown.js";

import { showError, showInfo, showSuccess, showWarning } from "../../toast.js";
import {
  AppDialogOptions,
  MessageAttachment,
  MessageAttachmentSource,
  StoredMessage,
  ThinkingLogEntry,
  ToolActivity,
} from "../../types.js";
import type { ShadowClawDatabase } from "../../types.js";
import { formatDateForFilename, formatTimestamp } from "../../utils.js";

import "../shadow-claw-page-header/shadow-claw-page-header.js";
import ShadowClawElement from "../shadow-claw-element.js";

const AUTO_SCROLL_THRESHOLD = 80;
const INLINE_ATTACHMENT_MAX_BYTES = 128 * 1024;
const INLINE_ATTACHMENT_TOTAL_CHAR_BUDGET = 80_000;
const DEFAULT_CHAT_INPUT_HEIGHT_PX = 40;
const MIN_CHAT_INPUT_HEIGHT_PX = 40;
const MAX_CHAT_INPUT_HEIGHT_PX = 280;

type QueuedAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  source: MessageAttachmentSource;
};

type MessageDraftPayload = {
  text: string;
  attachments: MessageAttachment[];
};

const elementName = "shadow-claw-chat";

export class ShadowClawChat extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawChat.componentPath}/${elementName}.css`;
  static template = `${ShadowClawChat.componentPath}/${elementName}.html`;

  #db: ShadowClawDatabase | null;
  #renderVersion: number;
  #streamRenderVersion: number;
  #suppressScrollTracking: boolean;
  #userScrollEpoch: number;
  #responseAutoFollow: boolean;
  #dragDepth: number;
  #queuedAttachments: QueuedAttachment[];

  constructor() {
    super();

    chatUiStore.reset();
    this.#db = null;
    this.#renderVersion = 0;
    this.#streamRenderVersion = 0;
    this.#suppressScrollTracking = false;
    this.#userScrollEpoch = 0;
    this.#responseAutoFollow = true;
    this.#dragDepth = 0;
    this.#queuedAttachments = [];
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.#db = await getDb();
    await this.restoreInputAreaHeight();

    this.dispatchTerminalSlotReady();

    this.setupEffects();
    this.bindEventListeners();
  }

  disconnectedCallback() {
    chatUiStore.revokeAttachmentObjectUrls();
    chatUiStore.resetNearBottom();
    super.disconnectedCallback();
  }

  revokeAttachmentObjectUrls() {
    chatUiStore.revokeAttachmentObjectUrls();
  }

  dispatchTerminalSlotReady() {
    this.dispatchEvent(
      new CustomEvent("shadow-claw-terminal-slot-ready", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  isLatestRender(version: number): boolean {
    return version === this.#renderVersion;
  }

  isContainerNearBottom(container: HTMLElement): boolean {
    const { scrollTop, scrollHeight, clientHeight } = container;

    return scrollHeight - scrollTop - clientHeight < AUTO_SCROLL_THRESHOLD;
  }

  getContainerDistanceFromBottom(container: HTMLElement): number {
    return Math.max(
      0,
      container.scrollHeight - container.scrollTop - container.clientHeight,
    );
  }

  persistGroupScrollState(container: HTMLElement): void {
    const groupId = orchestratorStore.activeGroupId;
    const nearBottom = this.isContainerNearBottom(container);
    const distanceFromBottom = nearBottom
      ? 0
      : this.getContainerDistanceFromBottom(container);

    chatUiStore.setGroupScrollState(groupId, distanceFromBottom, nearBottom);
  }

  scrollMessagesToBottomIfNeeded() {
    const messagesEl = this.shadowRoot?.querySelector(".chat__messages");
    if (!(messagesEl instanceof HTMLElement)) {
      return;
    }

    if (!chatUiStore.isNearBottom) {
      return;
    }

    this.setMessagesScrollTop(messagesEl, messagesEl.scrollHeight);
    chatUiStore.setNearBottom(this.isContainerNearBottom(messagesEl));
    this.persistGroupScrollState(messagesEl);
  }

  setMessagesScrollTop(container: HTMLElement, value: number) {
    this.#suppressScrollTracking = true;
    container.scrollTop = value;
    requestAnimationFrame(() => {
      this.#suppressScrollTracking = false;
    });
  }

  shouldAutoFollow(container: HTMLElement): boolean {
    const state = orchestratorStore.state;
    const isResponseActive = state === "thinking" || state === "responding";
    const nearBottom = this.isContainerNearBottom(container);

    if (!isResponseActive) {
      this.#responseAutoFollow = true;

      return chatUiStore.nearBottomSnapshot || nearBottom;
    }

    if (nearBottom) {
      this.#responseAutoFollow = true;
    }

    return this.#responseAutoFollow;
  }

  scheduleBottomSnap(version: number) {
    const snap = () => {
      if (!this.isLatestRender(version)) {
        return;
      }

      this.scrollMessagesToBottomIfNeeded();
    };

    requestAnimationFrame(() => {
      snap();
      requestAnimationFrame(snap);
    });

    setTimeout(snap, 120);
  }

  getMessagesContainer(): HTMLElement | null {
    const container = this.shadowRoot?.querySelector(".chat__messages");

    return container instanceof HTMLElement ? container : null;
  }

  removeStreamingBubble(container: HTMLElement) {
    container.querySelector(".chat__message--streaming")?.remove();
  }

  async renderStreamingBubble(streamingText: string | null) {
    const version = ++this.#streamRenderVersion;
    const container = this.getMessagesContainer();
    if (!container) {
      return;
    }

    const shouldKeepBottom = this.shouldAutoFollow(container);

    if (!(typeof streamingText === "string" && streamingText.length > 0)) {
      this.removeStreamingBubble(container);

      return;
    }

    let streamDiv = container.querySelector(
      ".chat__message--streaming",
    ) as HTMLElement | null;
    let contentEl: HTMLElement | null = null;

    if (!streamDiv) {
      const assistantName = localStorage.getItem("assistantName") || "k9";

      streamDiv = document.createElement("article");
      streamDiv.className =
        "chat__message chat__message--assistant chat__message--streaming";

      const headerEl = document.createElement("div");
      headerEl.className = "chat__message-header";

      const senderEl = document.createElement("div");
      senderEl.className = "chat__message-sender";
      senderEl.textContent = assistantName;

      const timestampEl = document.createElement("div");
      timestampEl.className = "chat__message-timestamp";
      timestampEl.textContent = "streaming…";

      headerEl.append(senderEl, timestampEl);

      contentEl = document.createElement("div");
      contentEl.className = "chat__message-content";

      streamDiv.append(headerEl, contentEl);
      container.appendChild(streamDiv);
    } else {
      contentEl = streamDiv.querySelector(".chat__message-content");
      if (!(contentEl instanceof HTMLElement)) {
        return;
      }
    }

    const renderedContent = await renderMarkdown(streamingText, {
      breaks: true,
    });
    if (version !== this.#streamRenderVersion) {
      return;
    }

    // Intentional HTML insertion: markdown renderer output.
    contentEl.innerHTML = renderedContent;

    const cursorEl = document.createElement("span");
    cursorEl.setAttribute("aria-hidden", "true");
    cursorEl.className = "chat__streaming-cursor";
    contentEl.append(cursorEl);

    streamDiv.querySelector(".chat__msg-copy-btn")?.remove();
    this.injectMessageCopyButton(streamDiv, streamingText);
    this.injectCopyButtons(contentEl);

    if (shouldKeepBottom) {
      this.setMessagesScrollTop(container, container.scrollHeight);
      chatUiStore.setNearBottom(this.isContainerNearBottom(container));
      this.persistGroupScrollState(container);
    }
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const messagesEl = root.querySelector(".chat__messages");
    if (messagesEl instanceof HTMLElement) {
      messagesEl.addEventListener("scroll", () => {
        if (!this.#suppressScrollTracking) {
          this.#userScrollEpoch += 1;
          if (!this.isContainerNearBottom(messagesEl)) {
            this.#responseAutoFollow = false;
          }
        }

        chatUiStore.setNearBottom(this.isContainerNearBottom(messagesEl));
        this.persistGroupScrollState(messagesEl);
      });

      messagesEl.addEventListener("click", (event) => {
        void this.handleMessageLinkClick(event);
      });

      const resizeObserver = new ResizeObserver(() => {
        if (this.shouldAutoFollow(messagesEl)) {
          this.setMessagesScrollTop(messagesEl, messagesEl.scrollHeight);
          this.persistGroupScrollState(messagesEl);
        }
      });
      resizeObserver.observe(messagesEl);
      this.addCleanup(() => resizeObserver.disconnect());
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

    const inputArea = root.querySelector(".chat__input-area");
    const inputResizeHandle = root.querySelector(".chat__input-resize-handle");
    if (
      inputArea instanceof HTMLElement &&
      inputResizeHandle instanceof HTMLElement
    ) {
      this.bindInputResizeEvents(inputArea, inputResizeHandle);
    }

    root
      .querySelector('[data-action="send-message"]')
      ?.addEventListener("click", () => this.sendMessage());

    root
      .querySelector('[data-action="attach-files"]')
      ?.addEventListener("click", () => {
        const attachmentInput = root.querySelector(".chat__attachment-input");
        if (attachmentInput instanceof HTMLInputElement) {
          // Clear value first so selecting the same file(s) again still fires change.
          attachmentInput.value = "";
          attachmentInput.click();
        }
      });

    root
      .querySelector(".chat__attachment-input")
      ?.addEventListener("change", (event) => {
        if (event.target instanceof HTMLInputElement) {
          void this.queueSelectedFiles(event.target);
        }
      });

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

    const chatBody = root.querySelector(".chat__body");
    if (chatBody instanceof HTMLElement) {
      chatBody.addEventListener("dragenter", (event) => {
        if (!this.hasDroppableData(event.dataTransfer)) {
          return;
        }

        event.preventDefault();
        this.#dragDepth += 1;
        this.setDropOverlayVisible(true);
      });

      chatBody.addEventListener("dragover", (event) => {
        if (!this.hasDroppableData(event.dataTransfer)) {
          return;
        }

        event.preventDefault();
      });

      chatBody.addEventListener("dragleave", (event) => {
        if (!this.hasDroppableData(event.dataTransfer)) {
          return;
        }

        event.preventDefault();
        this.#dragDepth = Math.max(0, this.#dragDepth - 1);

        if (this.#dragDepth === 0) {
          this.setDropOverlayVisible(false);
        }
      });

      chatBody.addEventListener("drop", (event) => {
        if (!this.hasDroppableData(event.dataTransfer)) {
          return;
        }

        event.preventDefault();
        this.#dragDepth = 0;
        this.setDropOverlayVisible(false);
        void this.queueDroppedData(event.dataTransfer);
      });
    }
  }

  clampInputAreaHeight(px: number): number {
    const viewportMax = Math.floor(window.innerHeight * 0.45);

    return Math.max(
      MIN_CHAT_INPUT_HEIGHT_PX,
      Math.min(Math.max(MIN_CHAT_INPUT_HEIGHT_PX, viewportMax), px),
    );
  }

  isCollapsedInputAreaHeight(px: number): boolean {
    return px <= DEFAULT_CHAT_INPUT_HEIGHT_PX + 1;
  }

  setInputAreaHeight(inputArea: HTMLElement, px: number): void {
    const clamped = this.clampInputAreaHeight(px);

    if (this.isCollapsedInputAreaHeight(clamped)) {
      this.resetInputAreaHeight(inputArea);

      return;
    }

    inputArea.classList.add("chat__input-area--resized");
    inputArea.style.setProperty("--chat-input-area-height", `${clamped}px`);
  }

  resetInputAreaHeight(inputArea: HTMLElement): void {
    inputArea.classList.remove("chat__input-area--resized");
    inputArea.style.removeProperty("--chat-input-area-height");
  }

  async persistInputAreaHeight(px: number): Promise<void> {
    if (!this.#db) {
      return;
    }

    try {
      await setConfig(this.#db, CONFIG_KEYS.CHAT_INPUT_AREA_HEIGHT, px);
    } catch {
      // Ignore persistence failures so input remains usable when storage is unavailable.
    }
  }

  async restoreInputAreaHeight(): Promise<void> {
    const inputArea = this.shadowRoot?.querySelector(".chat__input-area");
    if (!(inputArea instanceof HTMLElement)) {
      return;
    }

    try {
      const saved = this.#db
        ? await getConfig(this.#db, CONFIG_KEYS.CHAT_INPUT_AREA_HEIGHT)
        : undefined;

      if (typeof saved === "number" && Number.isFinite(saved) && saved > 0) {
        if (this.isCollapsedInputAreaHeight(saved)) {
          this.resetInputAreaHeight(inputArea);
        } else {
          this.setInputAreaHeight(inputArea, saved);
        }
      }
    } catch {
      // Keep default input height when config retrieval fails.
    }
  }

  bindInputResizeEvents(inputArea: HTMLElement, handle: HTMLElement): void {
    handle.setAttribute("tabindex", "0");
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "horizontal");
    handle.setAttribute("aria-label", "Resize chat input area");

    const getCurrentHeight = () => {
      const currentHeight = parseFloat(
        inputArea.style.getPropertyValue("--chat-input-area-height"),
      );

      return Number.isFinite(currentHeight) && currentHeight > 0
        ? currentHeight
        : DEFAULT_CHAT_INPUT_HEIGHT_PX;
    };

    const updateAria = () => {
      const max = this.clampInputAreaHeight(Number.MAX_SAFE_INTEGER);
      const current = Math.round(this.clampInputAreaHeight(getCurrentHeight()));
      handle.setAttribute("aria-valuemin", String(MIN_CHAT_INPUT_HEIGHT_PX));
      handle.setAttribute("aria-valuemax", String(Math.round(max)));
      handle.setAttribute("aria-valuenow", String(current));
    };

    let activePointerId: number | null = null;
    let startY = 0;
    let startHeight = 0;

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      const delta = startY - event.clientY;
      const nextHeight = startHeight + delta;
      this.setInputAreaHeight(inputArea, nextHeight);
      updateAria();
    };

    const stopResize = () => {
      if (activePointerId === null) {
        return;
      }

      activePointerId = null;
      handle.classList.remove("active");
      document.removeEventListener("pointermove", onPointerMove);

      const value = parseFloat(
        inputArea.style.getPropertyValue("--chat-input-area-height"),
      );
      if (Number.isFinite(value) && value > 0) {
        void this.persistInputAreaHeight(value);
      } else {
        void this.persistInputAreaHeight(0);
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      stopResize();
    };

    handle.addEventListener("pointerdown", (event: PointerEvent) => {
      if (
        event.pointerType === "mouse" &&
        event.button !== 0 &&
        event.button !== -1
      ) {
        return;
      }

      const wrapper = inputArea.querySelector(".chat__input-wrapper");
      if (!(wrapper instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      activePointerId = event.pointerId;
      startY = event.clientY;

      // Ensure class is present before measuring to stabilize layout shifts
      inputArea.classList.add("chat__input-area--resized");

      const currentHeight = parseFloat(
        inputArea.style.getPropertyValue("--chat-input-area-height"),
      );
      startHeight =
        Number.isFinite(currentHeight) && currentHeight > 0
          ? currentHeight
          : wrapper.getBoundingClientRect().height ||
            DEFAULT_CHAT_INPUT_HEIGHT_PX;

      handle.classList.add("active");
      handle.setPointerCapture(event.pointerId);
      document.addEventListener("pointermove", onPointerMove);
    });

    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", stopResize);
    handle.addEventListener("dblclick", () => {
      this.resetInputAreaHeight(inputArea);
      void this.persistInputAreaHeight(0);
      updateAria();
      this.scrollMessagesToBottomIfNeeded();
    });

    handle.addEventListener("keydown", (event: KeyboardEvent) => {
      const step = event.shiftKey ? 32 : 12;
      const current = getCurrentHeight();
      let next: number | null = null;

      if (event.key === "ArrowUp") {
        next = current + step;
      } else if (event.key === "ArrowDown") {
        next = current - step;
      } else if (event.key === "Home") {
        next = MIN_CHAT_INPUT_HEIGHT_PX;
      } else if (event.key === "End") {
        next = this.clampInputAreaHeight(Number.MAX_SAFE_INTEGER);
      }

      if (next === null) {
        return;
      }

      event.preventDefault();
      this.setInputAreaHeight(inputArea, next);
      updateAria();
      const live = parseFloat(
        inputArea.style.getPropertyValue("--chat-input-area-height"),
      );
      void this.persistInputAreaHeight(
        Number.isFinite(live) && live > 0 ? this.clampInputAreaHeight(live) : 0,
      );
      this.scrollMessagesToBottomIfNeeded();
    });

    updateAria();

    this.addCleanup(() => {
      stopResize();
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", stopResize);
    });
  }

  hasDroppableData(dataTransfer: DataTransfer | null): boolean {
    if (!dataTransfer) {
      return false;
    }

    if (dataTransfer.files.length > 0) {
      return true;
    }

    const types = Array.from(dataTransfer.types || []);

    return (
      types.includes("Files") ||
      types.includes("application/x-moz-file") ||
      types.includes("text/plain")
    );
  }

  setDropOverlayVisible(visible: boolean) {
    const overlay = this.shadowRoot?.querySelector("[data-drop-overlay]");
    if (!(overlay instanceof HTMLElement)) {
      return;
    }

    overlay.hidden = !visible;
  }

  async queueDroppedData(dataTransfer: DataTransfer | null) {
    if (!dataTransfer) {
      return;
    }

    const next = this.buildQueuedAttachmentsFromFiles(
      Array.from(dataTransfer.files || []),
    );

    const droppedText = await this.readDroppedPlainText(dataTransfer);
    if (droppedText) {
      const normalized = droppedText.trim();
      if (normalized) {
        const textBlob = new Blob([normalized], { type: "text/plain" });
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          fileName: `dropped-text-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`,
          mimeType: "text/plain",
          size: textBlob.size,
          source: {
            kind: "local-file",
            file: textBlob,
          },
        });
      }
    }

    if (next.length === 0) {
      return;
    }

    this.#queuedAttachments = [...this.#queuedAttachments, ...next];
    this.renderQueuedAttachments();
    showInfo(
      `Queued ${next.length} attachment${next.length === 1 ? "" : "s"}.`,
      2200,
    );
  }

  async readDroppedPlainText(dataTransfer: DataTransfer): Promise<string> {
    const item = Array.from(dataTransfer.items || []).find(
      (entry) => entry.kind === "string" && entry.type === "text/plain",
    );

    if (!item) {
      return "";
    }

    return await new Promise<string>((resolve) => {
      item.getAsString((value) => {
        resolve(value || "");
      });
    });
  }

  buildQueuedAttachmentsFromFiles(files: File[]): QueuedAttachment[] {
    return files.map((file) => {
      const fileName = file.name || "attachment.bin";

      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        fileName,
        mimeType: inferAttachmentMimeType(fileName, file.type || ""),
        size: file.size,
        source: {
          kind: "local-file",
          file,
        },
      };
    });
  }

  async queueSelectedFiles(input: HTMLInputElement) {
    const files = Array.from(input.files || []);
    if (files.length === 0) {
      input.value = "";

      return;
    }

    const next = this.buildQueuedAttachmentsFromFiles(files);
    this.#queuedAttachments = [...this.#queuedAttachments, ...next];
    this.renderQueuedAttachments();

    showInfo(
      `Queued ${next.length} attachment${next.length === 1 ? "" : "s"}.`,
      2200,
    );

    input.value = "";
  }

  renderQueuedAttachments() {
    const container = this.shadowRoot?.querySelector(
      ".chat__pending-attachments",
    );
    if (!(container instanceof HTMLElement)) {
      return;
    }

    if (this.#queuedAttachments.length === 0) {
      container.hidden = true;
      container.replaceChildren();

      return;
    }

    const modelId = (orchestratorStore.orchestrator?.model || "").toLowerCase();
    const capabilities = getModelAttachmentCapabilities(modelId);

    container.hidden = false;
    const fragment = document.createDocumentFragment();
    for (const attachment of this.#queuedAttachments) {
      const chip = document.createElement("div");
      chip.className = "chat__pending-attachment";

      const icon = document.createElement("span");
      icon.className = "chat__attachment-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = this.getAttachmentIcon(attachment.mimeType);

      const meta = document.createElement("div");
      meta.className = "chat__pending-attachment-meta";

      const name = document.createElement("span");
      name.className = "chat__pending-attachment-name";
      name.textContent = attachment.fileName;

      const detail = document.createElement("span");
      detail.className = "chat__pending-attachment-detail";
      detail.textContent = `${attachment.mimeType} · ${this.formatAttachmentSize(attachment.size)}`;

      meta.append(name, detail);

      // Transport badge: indicates how this file will reach the model.
      const transportLabel = this.getAttachmentTransportLabel(
        attachment.mimeType,
        attachment.fileName,
        capabilities,
      );
      const badge = document.createElement("span");
      badge.className = `chat__transport-badge chat__transport-badge--${transportLabel}`;
      badge.setAttribute("aria-label", `Transport: ${transportLabel}`);
      badge.textContent = transportLabel;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chat__pending-attachment-remove";
      remove.setAttribute("aria-label", `Remove ${attachment.fileName}`);
      remove.textContent = "x";
      remove.addEventListener("click", () => {
        this.#queuedAttachments = this.#queuedAttachments.filter(
          (candidate) => candidate.id !== attachment.id,
        );
        this.renderQueuedAttachments();
      });

      chip.append(icon, meta, badge, remove);
      fragment.appendChild(chip);
    }

    container.replaceChildren(fragment);
  }

  /**
   * Compute how an attachment will be transported to the model:
   * - "text"     → will be read and inlined as plain text
   * - "native"   → sent as a native multimodal block (image/audio/document)
   * - "fallback" → sent as a reference text marker only
   */
  getAttachmentTransportLabel(
    mimeType: string,
    fileName: string,
    capabilities: ReturnType<typeof getModelAttachmentCapabilities>,
  ): "text" | "native" | "fallback" {
    const category = getAttachmentCategory(mimeType, fileName);

    if (category === "text") {
      return "text";
    }

    if (
      category === "image" &&
      (capabilities.images || capabilities.routerByFeatures)
    ) {
      return "native";
    }

    if (
      category === "audio" &&
      (capabilities.audio || capabilities.routerByFeatures)
    ) {
      return "native";
    }

    if (
      category === "document" &&
      (capabilities.documents || capabilities.routerByFeatures)
    ) {
      return "native";
    }

    return "fallback";
  }

  isInlineTextMimeType(mimeType: string): boolean {
    const normalized = mimeType.toLowerCase();
    if (normalized.startsWith("text/")) {
      return true;
    }

    return (
      normalized === "application/json" ||
      normalized === "application/xml" ||
      normalized === "application/javascript"
    );
  }

  inferAttachmentModelSupport(attachments: MessageAttachment[] = []) {
    const orchestrator = orchestratorStore.orchestrator;
    const modelId = orchestrator?.model?.toLowerCase() || "";
    const capabilities = getModelAttachmentCapabilities(modelId);

    return attachments.every((attachment) => {
      const mimeType = (attachment.mimeType || "").toLowerCase();
      if (this.isInlineTextMimeType(mimeType)) {
        return true;
      }

      if (mimeType.startsWith("image/")) {
        return capabilities.images || capabilities.routerByFeatures;
      }

      if (mimeType.startsWith("audio/")) {
        return capabilities.audio || capabilities.routerByFeatures;
      }

      if (mimeType.startsWith("video/")) {
        return capabilities.video || capabilities.routerByFeatures;
      }

      return false;
    });
  }

  renderAttachmentCapabilitySummary() {
    const summaryEl = this.shadowRoot?.querySelector(
      ".chat__attachment-capabilities",
    );
    if (!(summaryEl instanceof HTMLElement)) {
      return;
    }

    const modelId = orchestratorStore.orchestrator?.model || "";
    if (!modelId) {
      summaryEl.textContent = "";

      return;
    }

    summaryEl.textContent = `Model attachment support: ${formatModelAttachmentCapabilitySummary(modelId)}`;
  }

  async showAttachmentDialog(options: AppDialogOptions): Promise<boolean> {
    const requestDialog = globalThis.window?.shadowclaw?.requestDialog;
    if (typeof requestDialog === "function") {
      return await requestDialog(options);
    }

    if ((options.mode || "confirm") === "info") {
      showWarning(options.message, 4500);

      return true;
    }

    return confirm(`${options.title}\n\n${options.message}`);
  }

  async buildMessageDraftPayload(
    message: string,
  ): Promise<MessageDraftPayload | null> {
    const trimmedMessage = message.trim();
    const attachments: MessageAttachment[] = this.#queuedAttachments.map(
      (attachment) => {
        const previewDisposition: "inline" | "file" =
          attachment.mimeType === "image/png" ? "inline" : "file";

        return {
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          source: attachment.source,
          previewDisposition,
        };
      },
    );

    if (attachments.length === 0) {
      return {
        text: trimmedMessage,
        attachments,
      };
    }

    const binaryCount = attachments.filter(
      (attachment) => !this.isInlineTextMimeType(attachment.mimeType || ""),
    ).length;

    if (binaryCount > 0 && !this.inferAttachmentModelSupport(attachments)) {
      const proceed = await this.showAttachmentDialog({
        mode: "confirm",
        title: "Limited Attachment Support",
        message:
          "The selected model may not natively read binary attachments (images/audio/video/docs). Files will still be attached to chat history, but responses might be limited.",
        confirmLabel: "Send Anyway",
        cancelLabel: "Cancel",
        details: [
          "Try a multimodal model for best binary-file results.",
          "Text files are inlined automatically when they are reasonably small.",
        ],
      });
      if (!proceed) {
        return null;
      }
    }

    const attachmentLines = attachments.map((attachment) => {
      return `- ${attachment.fileName} (${attachment.mimeType || "application/octet-stream"}, ${this.formatAttachmentSize(attachment.size || 0)})`;
    });

    const inlineSections: string[] = [];
    let inlineCharBudget = 0;
    for (const attachment of this.#queuedAttachments) {
      if (!this.isInlineTextMimeType(attachment.mimeType)) {
        continue;
      }

      if (attachment.size > INLINE_ATTACHMENT_MAX_BYTES) {
        inlineSections.push(
          `File: ${attachment.fileName}\nSkipped inline content because the file is larger than ${this.formatAttachmentSize(INLINE_ATTACHMENT_MAX_BYTES)}.`,
        );

        continue;
      }

      if (attachment.source.kind !== "local-file") {
        continue;
      }

      const text = await attachment.source.file.text();
      inlineCharBudget += text.length;
      if (inlineCharBudget > INLINE_ATTACHMENT_TOTAL_CHAR_BUDGET) {
        await this.showAttachmentDialog({
          mode: "info",
          title: "Attachment Context Too Large",
          message:
            "The dropped text content exceeds the safe prompt budget. Remove some files or send them in smaller batches.",
          details: [
            `Current inline text budget: ${INLINE_ATTACHMENT_TOTAL_CHAR_BUDGET.toLocaleString()} characters`,
            "Large text blobs can degrade response quality and exhaust context.",
          ],
          confirmLabel: "OK",
        });

        return null;
      }

      inlineSections.push(`File: ${attachment.fileName}\n${text}`);
    }

    const prefix = trimmedMessage ? `${trimmedMessage}\n\n` : "";
    const manifest = `Attached files:\n${attachmentLines.join("\n")}`;
    const inlineBlock =
      inlineSections.length > 0
        ? `\n\nAttached text excerpts:\n\n${inlineSections.join("\n\n---\n\n")}`
        : "";

    return {
      text: `${prefix}${manifest}${inlineBlock}`,
      attachments,
    };
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

    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke-width", "1.5");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("viewBox", "0 0 24 24");

    const path = document.createElementNS(svgNs, "path");
    path.setAttribute(
      "d",
      "M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75",
    );
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");

    svg.append(path);
    btn.append(svg);

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

    this.addCleanup(
      effect(() => {
        const renderVersion = ++this.#renderVersion;
        const activeGroupId = orchestratorStore.activeGroupId;
        const messages = orchestratorStore.messages as StoredMessage[];
        const container = root.querySelector(".chat__messages");

        if (!(container instanceof HTMLElement)) {
          return;
        }

        const savedScrollState = chatUiStore.getGroupScrollState(activeGroupId);
        if (savedScrollState) {
          chatUiStore.setNearBottom(savedScrollState.nearBottom);
        } else {
          chatUiStore.setNearBottom(true);
        }

        const shouldScroll = this.shouldAutoFollow(container);
        const userScrollEpochAtRenderStart = this.#userScrollEpoch;
        const distanceFromBottom = shouldScroll
          ? 0
          : (savedScrollState?.distanceFromBottom ??
            this.getContainerDistanceFromBottom(container));

        this.revokeAttachmentObjectUrls();
        container.replaceChildren();

        // Render messages sequentially to ensure order and proper awaiting
        const renderMessages = async () => {
          for (const msg of messages) {
            if (!this.isLatestRender(renderVersion)) {
              return false;
            }

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

            const headerEl = document.createElement("div");
            headerEl.className = "chat__message-header";

            const senderEl = document.createElement("div");
            senderEl.className = "chat__message-sender";
            senderEl.textContent = sender;

            const timestampEl = document.createElement("div");
            timestampEl.className = "chat__message-timestamp";
            timestampEl.textContent = timestamp;

            headerEl.append(senderEl, timestampEl);
            msgDiv.append(headerEl);

            const contentEl = document.createElement("div");
            contentEl.className = "chat__message-content";
            if (msg.content) {
              // Intentional HTML insertion: markdown renderer output.
              contentEl.innerHTML = renderedContent;
              await this.resolveImagePaths(msg.groupId, contentEl);
              if (!this.isLatestRender(renderVersion)) {
                return false;
              }
            }

            const attachmentsEl = await this.renderMessageAttachments(msg);
            if (attachmentsEl) {
              contentEl.appendChild(attachmentsEl);
            }

            msgDiv.appendChild(contentEl);

            container.appendChild(msgDiv);

            if (shouldScroll) {
              this.setMessagesScrollTop(container, container.scrollHeight);
              this.persistGroupScrollState(container);
            }

            if (msg.content) {
              this.injectMessageCopyButton(msgDiv, msg.content);
            }

            if (contentEl instanceof HTMLElement && msg.content) {
              this.injectCopyButtons(contentEl);
            }
          }

          return true;
        };

        renderMessages().then(async (renderCompleted) => {
          if (!renderCompleted || !this.isLatestRender(renderVersion)) {
            return;
          }

          const userScrolledDuringRender =
            this.#userScrollEpoch !== userScrollEpochAtRenderStart;
          const shouldScrollNow = this.shouldAutoFollow(container);

          if (shouldScrollNow) {
            this.setMessagesScrollTop(container, container.scrollHeight);
            chatUiStore.setNearBottom(this.isContainerNearBottom(container));
            this.persistGroupScrollState(container);
            this.scheduleBottomSnap(renderVersion);
          } else if (!userScrolledDuringRender) {
            this.setMessagesScrollTop(
              container,
              container.scrollHeight -
                container.clientHeight -
                distanceFromBottom,
            );
            chatUiStore.setNearBottom(this.isContainerNearBottom(container));
            this.persistGroupScrollState(container);
          } else {
            chatUiStore.setNearBottom(this.isContainerNearBottom(container));
            this.persistGroupScrollState(container);
          }
        });
      }),
    );

    this.addCleanup(
      effect(() => {
        const streamingText = orchestratorStore.streamingText as string | null;
        void this.renderStreamingBubble(streamingText);
      }),
    );

    this.addCleanup(
      effect(() => {
        void orchestratorStore.ready;
        void orchestratorStore.state;
        this.renderAttachmentCapabilitySummary();
      }),
    );

    this.addCleanup(
      effect(() => {
        const usage = orchestratorStore.tokenUsage;
        const usageEl = root.querySelector(".chat__token-usage");

        if (!(usageEl instanceof HTMLElement)) {
          return;
        }

        if (usage && (usage.inputTokens || usage.outputTokens)) {
          usageEl.classList.add("chat__token-usage--visible");
          const inEl = document.createElement("span");
          inEl.textContent = `⬆ ${this.formatTokenCount(usage.inputTokens)} in`;

          const outEl = document.createElement("span");
          outEl.textContent = `⬇ ${this.formatTokenCount(usage.outputTokens)} out`;

          const totalEl = document.createElement("span");
          totalEl.textContent = `Σ ${this.formatTokenCount(usage.totalTokens)}`;

          usageEl.replaceChildren(inEl, outEl, totalEl);
        } else {
          usageEl.classList.remove("chat__token-usage--visible");
          usageEl.replaceChildren();
        }
      }),
    );

    this.addCleanup(
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
          const countEl = document.createElement("span");
          countEl.textContent = `${this.formatTokenCount(ctx.estimatedTokens)} / ${this.formatTokenCount(ctx.contextLimit)}`;

          const barWrap = document.createElement("div");
          barWrap.className = "chat__context-bar";

          const barFill = document.createElement("div");
          barFill.className = `chat__context-bar-fill chat__context-bar-fill--${level}`;
          barFill.style.width = `${pct}%`;
          barWrap.append(barFill);

          const pctEl = document.createElement("span");
          pctEl.textContent = `${pct.toFixed(0)}%`;

          const children: Node[] = [countEl, barWrap, pctEl];
          if (ctx.truncatedCount > 0) {
            const trimmedEl = document.createElement("span");
            trimmedEl.textContent = `(${ctx.truncatedCount} msgs trimmed)`;
            children.push(trimmedEl);
          }

          ctxEl.replaceChildren(...children);
        } else {
          ctxEl.classList.remove("chat__context-usage--visible");
          ctxEl.replaceChildren();
        }
      }),
    );

    this.addCleanup(
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

    this.addCleanup(
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

    this.addCleanup(
      effect(() => {
        const log = orchestratorStore.activityLog as ThinkingLogEntry[];
        const logEl = root.querySelector(".chat__activity-log");

        if (!(logEl instanceof HTMLElement)) {
          return;
        }

        if (log.length > 0) {
          logEl.classList.add("chat__activity-log--active");
          const fragment = document.createDocumentFragment();
          log.forEach((entry) => {
            const entryEl = document.createElement("div");
            entryEl.textContent = `[${entry.level}] ${entry.label || ""}: ${entry.message}`;
            fragment.append(entryEl);
          });
          logEl.replaceChildren(fragment);

          logEl.scrollTop = logEl.scrollHeight;
        } else {
          logEl.classList.remove("chat__activity-log--active");
          logEl.replaceChildren();
        }
      }),
    );

    this.addCleanup(
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

    this.addCleanup(
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

    this.addCleanup(
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

      const identity = document.createElement("div");
      identity.className = "chat__attachment-identity";

      const icon = document.createElement("span");
      icon.className = "chat__attachment-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = this.getAttachmentIcon(attachment.mimeType || "");

      const title = document.createElement("button");
      title.className = "chat__attachment-title";
      title.type = "button";
      title.textContent = attachment.fileName;
      title.disabled = !attachment.path || !this.#db;
      title.addEventListener("click", () => {
        void this.openAttachment(msg.groupId, attachment);
      });

      identity.append(icon, title);
      meta.appendChild(identity);

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
      chatUiStore.registerAttachmentObjectUrl(objectUrl);

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

            chatUiStore.registerAttachmentObjectUrl(objectUrl);

            img.addEventListener(
              "load",
              () => this.scrollMessagesToBottomIfNeeded(),
              { once: true },
            );
            img.src = objectUrl;
          }
        } catch (e) {
          console.warn(`Failed to load inline image: ${src}`, e);
        }
      }
    }

    const links = Array.from(container.querySelectorAll("a[href]"));
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      const filePath = this.resolveWorkspaceLinkPath(href);
      if (!filePath || !filePath.toLowerCase().endsWith(".pdf")) {
        continue;
      }

      try {
        const bytes = await readGroupFileBytes(this.#db, groupId, filePath);
        const blobBytes = new Uint8Array(bytes.byteLength);
        blobBytes.set(bytes);

        const viewer = document.createElement("shadow-claw-pdf-viewer") as any;
        viewer.file = {
          name: filePath.split("/").pop() || "document.pdf",
          binaryContent: blobBytes,
        };

        link.insertAdjacentElement("afterend", viewer);
        requestAnimationFrame(() => this.scrollMessagesToBottomIfNeeded());
        setTimeout(() => this.scrollMessagesToBottomIfNeeded(), 120);
      } catch (e) {
        console.warn(`Failed to load inline PDF: ${filePath}`, e);
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

  getAttachmentIcon(mimeType = ""): string {
    const normalized = mimeType.toLowerCase();
    if (normalized.startsWith("image/")) {
      return "IMG";
    }

    if (normalized.startsWith("video/")) {
      return "VID";
    }

    if (normalized.startsWith("audio/")) {
      return "AUD";
    }

    if (normalized.includes("pdf")) {
      return "PDF";
    }

    if (normalized.startsWith("text/") || normalized.includes("json")) {
      return "TXT";
    }

    if (normalized.includes("zip") || normalized.includes("tar")) {
      return "ZIP";
    }

    return "BIN";
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

    if (!message && this.#queuedAttachments.length === 0) {
      return;
    }

    if (!orchestratorStore.ready) {
      showWarning("ShadowClaw is still initializing. Please try again.", 3500);

      return;
    }

    try {
      const payload = await this.buildMessageDraftPayload(message);
      if (!payload) {
        return;
      }

      input.value = "";

      // Resume auto-scroll so the user sees their own message and the response
      this.#responseAutoFollow = true;
      chatUiStore.setNearBottom(true);

      orchestratorStore.sendMessage(payload.text, payload.attachments);
      this.#queuedAttachments = [];
      this.renderQueuedAttachments();
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
      container.replaceChildren();
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
