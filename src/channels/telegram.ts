import type {
  Channel,
  ChannelMessageCallback,
  InboundMessage,
  MessageAttachment,
} from "../types.js";

import {
  TELEGRAM_API_BASE,
  TELEGRAM_MAX_LENGTH,
  TELEGRAM_POLL_TIMEOUT,
  TELEGRAM_PROXY_BASE,
} from "../config.js";

const TELEGRAM_POLL_RETRY_MIN_MS = 1_000;
const TELEGRAM_POLL_RETRY_MAX_MS = 60_000;

export type TelegramFileReader = (
  groupId: string,
  path: string,
) => Promise<Blob | null>;

export class TelegramChannel implements Channel {
  type: Channel["type"] = "telegram";
  token = "";
  registeredChatIds: Set<string> = new Set();
  offset = 0;
  abortController: AbortController | null = null;
  messageCallback: ChannelMessageCallback | null = null;
  running = false;
  useProxy = false;
  pollRetryDelayMs = TELEGRAM_POLL_RETRY_MIN_MS;
  pollSessionId = 0;
  fileReader: TelegramFileReader | null = null;

  configure(token: string, chatIds: string[], useProxy = false): void {
    this.token = token.trim();
    this.registeredChatIds = new Set(
      chatIds.map((chatId) => chatId.trim()).filter(Boolean),
    );
    this.useProxy = !!useProxy;
  }

  registerChatId(chatId: string): void {
    const normalized = chatId.trim();
    if (!normalized) {
      return;
    }

    this.registeredChatIds.add(normalized);
  }

  start(): void {
    if (!this.token || this.running) {
      return;
    }

    this.running = true;
    this.resetPollBackoff();
    const sessionId = ++this.pollSessionId;
    const controller = new AbortController();
    this.abortController = controller;
    void this.poll(sessionId, controller);
  }

  stop(): void {
    this.running = false;
    this.resetPollBackoff();
    this.pollSessionId += 1;
    this.abortController?.abort();
    this.abortController = null;
  }

  async send(groupId: string, text: string): Promise<void> {
    const chatId = groupId.replace(/^tg:/, "");

    // Extract and send inline images and documents as Telegram attachments
    const { remainingText, attachments } = extractMarkdownAttachments(text);

    for (const att of attachments) {
      if (this.fileReader) {
        try {
          const blob = await this.fileReader(groupId, att.path);
          if (blob && blob.size > 0) {
            const lowerPath = att.path.toLowerCase();
            const isImage =
              lowerPath.endsWith(".png") ||
              lowerPath.endsWith(".jpg") ||
              lowerPath.endsWith(".jpeg") ||
              lowerPath.endsWith(".gif") ||
              lowerPath.endsWith(".webp");

            if (isImage) {
              await this.sendPhoto(chatId, blob, att.alt, att.path);
            } else {
              await this.sendDocument(chatId, blob, att.alt, att.path);
            }

            continue;
          }
        } catch (err) {
          console.warn(
            `TelegramChannel: failed to read file ${att.path}:`,
            err,
          );
        }
      }

      // Fallback: send the markdown as text if file reader is unavailable
      await this.apiCall("sendMessage", {
        chat_id: chatId,
        text: `[${att.alt}] (file: ${att.path})`,
      });
    }

    // Send remaining text if any
    const trimmed = remainingText.trim();
    if (trimmed) {
      const chunks = splitText(trimmed, TELEGRAM_MAX_LENGTH);
      for (const chunk of chunks) {
        await this.apiCall("sendMessage", {
          chat_id: chatId,
          text: chunk,
        });
      }
    }
  }

  async sendPhoto(
    chatId: string,
    blob: Blob,
    caption: string,
    filename: string,
  ): Promise<void> {
    const basename = filename.split("/").pop() || "image.png";
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("photo", blob, basename);
    if (caption) {
      formData.append("caption", caption);
    }

    const res = await fetch(this.buildMethodUrl("sendPhoto"), {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();

      throw new Error(`Telegram sendPhoto failed: ${res.status} ${text}`);
    }
  }

  async sendDocument(
    chatId: string,
    blob: Blob,
    caption: string,
    filename: string,
  ): Promise<void> {
    const basename = filename.split("/").pop() || "document.file";
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", blob, basename);
    if (caption) {
      formData.append("caption", caption);
    }

    const res = await fetch(this.buildMethodUrl("sendDocument"), {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();

      throw new Error(`Telegram sendDocument failed: ${res.status} ${text}`);
    }
  }

  setTyping(groupId: string, typing: boolean): void {
    if (!typing) {
      return;
    }

    const chatId = groupId.replace(/^tg:/, "");
    void this.apiCall("sendChatAction", {
      chat_id: chatId,
      action: "typing",
    }).catch(() => {});
  }

  onMessage(callback: ChannelMessageCallback): void {
    this.messageCallback = callback;
  }

  isConfigured(): boolean {
    return this.token.length > 0;
  }

  async poll(sessionId: number, controller: AbortController): Promise<void> {
    while (
      this.running &&
      this.pollSessionId === sessionId &&
      !controller.signal.aborted
    ) {
      try {
        const res = await fetch(
          this.buildMethodUrl(
            `getUpdates?offset=${this.offset}&timeout=${TELEGRAM_POLL_TIMEOUT}`,
          ),
          { signal: controller.signal },
        );

        if (!res.ok) {
          console.error(`Telegram poll error: HTTP ${res.status}`);
          await this.waitForRetry(this.nextPollRetryDelay());

          continue;
        }

        const data = (await res.json()) as TelegramApiResponse;
        if (!data.ok || !Array.isArray(data.result)) {
          await this.waitForRetry(this.nextPollRetryDelay());

          continue;
        }

        this.resetPollBackoff();

        for (const update of data.result) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          break;
        }

        console.error("Telegram poll error:", error);
        await this.waitForRetry(this.nextPollRetryDelay());
      }
    }
  }

  nextPollRetryDelay(): number {
    const delay = this.pollRetryDelayMs;
    this.pollRetryDelayMs = Math.min(
      this.pollRetryDelayMs * 2,
      TELEGRAM_POLL_RETRY_MAX_MS,
    );

    return delay;
  }

  resetPollBackoff(): void {
    this.pollRetryDelayMs = TELEGRAM_POLL_RETRY_MIN_MS;
  }

  async waitForRetry(ms: number): Promise<void> {
    await sleep(ms);
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const msg = update.message;
    if (!msg) {
      return;
    }

    const chatId = String(msg.chat.id);

    if (msg.text === "/chatid") {
      void this.apiCall("sendMessage", {
        chat_id: chatId,
        text: `Chat ID: ${chatId}\nRegister this ID in ShadowClaw settings.`,
      }).catch(console.error);

      return;
    }

    if (msg.text === "/ping") {
      void this.apiCall("sendMessage", {
        chat_id: chatId,
        text: "Pong! ShadowClaw is running.",
      }).catch(console.error);

      return;
    }

    if (!this.registeredChatIds.has(chatId)) {
      return;
    }

    const attachments = await this.extractAttachments(msg);
    const textContent = `${msg.text || msg.caption || ""}`.trim();

    const content =
      textContent ||
      (msg.photo?.length ? "[Photo]" : null) ||
      (msg.voice ? "[Voice message]" : null) ||
      (msg.video ? "[Video]" : null) ||
      (msg.audio ? "[Audio]" : null) ||
      (msg.animation ? "[Animation]" : null) ||
      (msg.document
        ? `[Document: ${msg.document.file_name || "unnamed"}]`
        : null) ||
      (msg.sticker ? `[Sticker: ${msg.sticker.emoji || ""}]` : null) ||
      (msg.location
        ? `[Location: ${msg.location.latitude}, ${msg.location.longitude}]`
        : null) ||
      (msg.contact ? `[Contact: ${msg.contact.first_name}]` : null) ||
      "[Unsupported message type]";

    const senderName =
      msg.from?.first_name ||
      msg.from?.username ||
      String(msg.from?.id || "Unknown");

    const inbound: InboundMessage = {
      id: String(msg.message_id),
      groupId: `tg:${chatId}`,
      sender: senderName,
      content,
      timestamp: msg.date * 1000,
      channel: "telegram",
      attachments,
    };

    this.messageCallback?.(inbound);
  }

  async apiCall<T = unknown>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(this.buildMethodUrl(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();

      throw new Error(`Telegram API ${method} failed: ${res.status} ${text}`);
    }

    return (await res.json()) as T;
  }

  buildMethodUrl(methodOrPath: string): string {
    const normalized = methodOrPath.replace(/^\/+/, "");
    const base = this.useProxy ? TELEGRAM_PROXY_BASE : TELEGRAM_API_BASE;

    return `${base}${this.token}/${normalized}`;
  }

  buildFileUrl(filePath: string): string {
    const normalizedPath = filePath
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const base = this.useProxy
      ? "/telegram/file/bot"
      : "https://api.telegram.org/file/bot";

    return `${base}${this.token}/${normalizedPath}`;
  }

  async extractAttachments(msg: TelegramMessage): Promise<MessageAttachment[]> {
    const descriptors: TelegramFileDescriptor[] = [];

    const largestPhoto = Array.isArray(msg.photo) ? msg.photo.at(-1) : null;
    if (largestPhoto?.file_id) {
      descriptors.push({
        id: largestPhoto.file_id,
        fileName: `photo-${msg.message_id}.png`,
        mimeType: "image/png",
        previewDisposition: "inline",
      });
    }

    if (msg.document?.file_id) {
      descriptors.push({
        id: msg.document.file_id,
        fileName: msg.document.file_name || `document-${msg.message_id}`,
        mimeType: msg.document.mime_type,
      });
    }

    if (msg.video?.file_id) {
      descriptors.push({
        id: msg.video.file_id,
        fileName: msg.video.file_name || `video-${msg.message_id}.mp4`,
        mimeType: msg.video.mime_type || "video/mp4",
      });
    }

    if (msg.audio?.file_id) {
      descriptors.push({
        id: msg.audio.file_id,
        fileName: msg.audio.file_name || `audio-${msg.message_id}.mp3`,
        mimeType: msg.audio.mime_type || "audio/mpeg",
      });
    }

    if (msg.voice?.file_id) {
      descriptors.push({
        id: msg.voice.file_id,
        fileName: `voice-${msg.message_id}.ogg`,
        mimeType: msg.voice.mime_type || "audio/ogg",
      });
    }

    if (msg.animation?.file_id) {
      descriptors.push({
        id: msg.animation.file_id,
        fileName: msg.animation.file_name || `animation-${msg.message_id}.mp4`,
        mimeType: msg.animation.mime_type || "video/mp4",
      });
    }

    if (msg.sticker?.file_id) {
      descriptors.push({
        id: msg.sticker.file_id,
        fileName: `sticker-${msg.message_id}.${inferStickerExtension(msg.sticker)}`,
        mimeType: msg.sticker.is_animated
          ? "application/x-tgsticker"
          : msg.sticker.is_video
            ? "video/webm"
            : "image/webp",
      });
    }

    const attachments: MessageAttachment[] = [];
    for (const descriptor of descriptors) {
      const fileInfo = await this.fetchTelegramFileInfo(descriptor.id);
      attachments.push({
        id: descriptor.id,
        fileName: descriptor.fileName,
        mimeType: descriptor.mimeType,
        size: fileInfo.file_size,
        previewDisposition: descriptor.previewDisposition,
        source: {
          kind: "remote-url",
          url: this.buildFileUrl(fileInfo.file_path),
        },
      });
    }

    return attachments;
  }

  async fetchTelegramFileInfo(fileId: string): Promise<TelegramFileInfo> {
    const response = await this.apiCall<TelegramFileApiResponse>("getFile", {
      file_id: fileId,
    });

    if (!response.ok || !response.result?.file_path) {
      throw new Error(`Telegram getFile failed for attachment ${fileId}`);
    }

    return response.result;
  }
}

function splitText(text: string, max: number): string[] {
  if (text.length <= max) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= max) {
      chunks.push(remaining);

      break;
    }

    let end = max;
    const lastNewline = remaining.lastIndexOf("\n", max);
    if (lastNewline > max * 0.5) {
      end = lastNewline;
    }

    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }

  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TelegramApiResponse {
  ok?: boolean;
  result?: TelegramUpdate[];
}

interface TelegramFileApiResponse {
  ok?: boolean;
  result?: TelegramFileInfo;
}

interface TelegramFileInfo {
  file_id: string;
  file_path: string;
  file_size?: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; first_name?: string; username?: string };
  date: number;
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string; width?: number; height?: number }>;
  voice?: { file_id: string; mime_type?: string };
  video?: { file_id: string; file_name?: string; mime_type?: string };
  audio?: { file_id: string; file_name?: string; mime_type?: string };
  animation?: { file_id: string; file_name?: string; mime_type?: string };
  document?: { file_id: string; file_name?: string; mime_type?: string };
  sticker?: {
    emoji?: string;
    file_id: string;
    is_animated?: boolean;
    is_video?: boolean;
  };
  location?: { latitude: number; longitude: number };
  contact?: { first_name: string };
}

interface TelegramFileDescriptor {
  id: string;
  fileName: string;
  mimeType?: string;
  previewDisposition?: "inline" | "file";
}

function inferStickerExtension(sticker: TelegramMessage["sticker"]): string {
  if (sticker?.is_animated) {
    return "tgs";
  }

  if (sticker?.is_video) {
    return "webm";
  }

  return "webp";
}

export function extractMarkdownAttachments(text: string): {
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

    // Only capture valid normalized workspace-relative paths.
    if (normalizedPath) {
      attachments.push({ alt, path: normalizedPath });
      // Remove the markdown from the text
      remainingText = remainingText.replace(match[0], "");
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
