import type {
  Channel,
  ChannelMessageCallback,
  InboundMessage,
} from "../types.js";

import {
  IMESSAGE_POLL_TIMEOUT,
  IMESSAGE_REQUEST_TIMEOUT_MS,
} from "../config.js";

const IMESSAGE_DEDUP_TTL_MS = 60_000;

export class IMessageChannel implements Channel {
  type: Channel["type"] = "imessage";
  serverUrl = "";
  apiKey = "";
  registeredChatIds: Set<string> = new Set();
  cursor: string | null = null;
  abortController: AbortController | null = null;
  messageCallback: ChannelMessageCallback | null = null;
  running = false;
  reconnectDelayMs = 1000;
  seenMessageIds: Map<string, number> = new Map();

  configure(serverUrl: string, apiKey: string, chatIds: string[]): void {
    this.serverUrl = normalizeBaseUrl(serverUrl);
    this.apiKey = apiKey.trim();
    this.registeredChatIds = new Set(
      chatIds.map((chatId) => chatId.trim()).filter(Boolean),
    );
    this.cursor = null;
  }

  start(): void {
    if (!this.isConfigured() || this.running) {
      return;
    }

    this.running = true;
    this.abortController = new AbortController();
    void this.poll();
  }

  stop(): void {
    this.running = false;
    this.abortController?.abort();
    this.abortController = null;
  }

  async send(groupId: string, text: string): Promise<void> {
    const chatId = groupId.replace(/^im:/, "");
    await this.requestJson("/messages/send", {
      method: "POST",
      body: JSON.stringify({ chatId, text }),
    });
  }

  setTyping(groupId: string, typing: boolean): void {
    if (!typing) {
      return;
    }

    const chatId = groupId.replace(/^im:/, "");
    void this.requestJson("/messages/typing", {
      method: "POST",
      body: JSON.stringify({ chatId, typing: true }),
    }).catch(() => {});
  }

  onMessage(callback: ChannelMessageCallback): void {
    this.messageCallback = callback;
  }

  isConfigured(): boolean {
    return this.serverUrl.length > 0;
  }

  async poll(): Promise<void> {
    while (
      this.running &&
      this.abortController &&
      !this.abortController.signal.aborted
    ) {
      try {
        const params = new URLSearchParams({
          timeout: String(IMESSAGE_POLL_TIMEOUT),
        });
        if (this.cursor) {
          params.set("cursor", this.cursor);
        }

        const response = (await this.requestJson(
          `/messages?${params.toString()}`,
          { method: "GET" },
          IMESSAGE_REQUEST_TIMEOUT_MS + 5000,
          this.abortController.signal,
        )) as IMessagePollResponse;

        this.reconnectDelayMs = 1000;
        this.handlePollResponse(response);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          break;
        }

        console.error("iMessage bridge poll error:", error);
        await sleep(this.reconnectDelayMs);
        this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 30_000);
      }
    }
  }

  handlePollResponse(response: IMessagePollResponse): void {
    if (response.nextCursor !== undefined && response.nextCursor !== null) {
      this.cursor = String(response.nextCursor);
    } else if (response.cursor !== undefined && response.cursor !== null) {
      this.cursor = String(response.cursor);
    }

    const messages = Array.isArray(response.messages) ? response.messages : [];
    for (const message of messages) {
      this.handleIncomingMessage(message);
    }
  }

  handleIncomingMessage(message: IMessageBridgeMessage): void {
    this.pruneSeenMessageIds();

    const chatId = String(
      message.chatId || message.conversationId || "",
    ).trim();
    if (!chatId) {
      return;
    }

    if (
      this.registeredChatIds.size > 0 &&
      !this.registeredChatIds.has(chatId)
    ) {
      return;
    }

    const content = `${message.text || message.body || ""}`.trim();
    if (!content) {
      return;
    }

    const id = `${message.id || message.guid || `${chatId}:${message.timestamp || message.createdAt || content}`}`;
    if (this.seenMessageIds.has(id)) {
      return;
    }

    this.seenMessageIds.set(id, Date.now());

    const inbound: InboundMessage = {
      id,
      groupId: `im:${chatId}`,
      sender: `${message.sender || message.handle || message.from || "iMessage"}`,
      content,
      timestamp: normalizeTimestamp(message.timestamp || message.createdAt),
      channel: "imessage",
    };

    this.messageCallback?.(inbound);
  }

  async requestJson(
    path: string,
    init: RequestInit,
    timeoutMs = IMESSAGE_REQUEST_TIMEOUT_MS,
    parentSignal?: AbortSignal,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    parentSignal?.addEventListener("abort", onAbort, { once: true });

    try {
      const headers = new Headers(init.headers);
      headers.set("Accept", "application/json");

      if (!headers.has("Content-Type") && init.body) {
        headers.set("Content-Type", "application/json");
      }

      if (this.apiKey) {
        headers.set("Authorization", `Bearer ${this.apiKey}`);
        headers.set("X-API-Key", this.apiKey);
      }

      const response = await fetch(`${this.serverUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();

        throw new Error(
          `iMessage bridge request failed: ${response.status} ${text}`,
        );
      }

      if (response.status === 204) {
        return { messages: [] };
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", onAbort);
    }
  }

  pruneSeenMessageIds(): void {
    const now = Date.now();
    for (const [id, seenAt] of this.seenMessageIds.entries()) {
      if (now - seenAt > IMESSAGE_DEDUP_TTL_MS) {
        this.seenMessageIds.delete(id);
      }
    }
  }
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return normalizeTimestamp(numeric);
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface IMessagePollResponse {
  messages?: IMessageBridgeMessage[];
  nextCursor?: string | number | null;
  cursor?: string | number | null;
}

interface IMessageBridgeMessage {
  id?: string;
  guid?: string;
  chatId?: string;
  conversationId?: string;
  sender?: string;
  handle?: string;
  from?: string;
  text?: string;
  body?: string;
  timestamp?: number | string;
  createdAt?: number | string;
}
