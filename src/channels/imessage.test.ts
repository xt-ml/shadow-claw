import { jest } from "@jest/globals";

import { IMessageChannel } from "./imessage.js";

describe("IMessageChannel", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("emits bridge messages for configured chats", () => {
    const channel = new IMessageChannel();
    const seen: any[] = [];

    channel.configure("https://bridge.example", "secret", ["chat-1"]);
    channel.onMessage((message) => seen.push(message));

    channel.handleIncomingMessage({
      guid: "guid-1",
      conversationId: "chat-1",
      sender: "Alex",
      body: "hello from iMessage",
      timestamp: 1_700_000_000,
    });

    expect(seen).toEqual([
      {
        id: "guid-1",
        groupId: "im:chat-1",
        sender: "Alex",
        content: "hello from iMessage",
        timestamp: 1_700_000_000_000,
        channel: "imessage",
      },
    ]);
  });

  it("deduplicates repeated bridge messages", () => {
    const channel = new IMessageChannel();
    const seen: any[] = [];

    channel.configure("https://bridge.example", "secret", []);
    channel.onMessage((message) => seen.push(message));

    const payload = {
      guid: "guid-2",
      conversationId: "chat-2",
      sender: "Alex",
      body: "same message",
    };

    channel.handleIncomingMessage(payload);
    channel.handleIncomingMessage(payload);

    expect(seen).toHaveLength(1);
  });

  it("ignores attachment-only messages and unregistered chats", () => {
    const channel = new IMessageChannel();
    const onMessage = jest.fn();

    channel.configure("https://bridge.example", "secret", ["allowed"]);
    channel.onMessage(onMessage);

    channel.handleIncomingMessage({
      guid: "guid-3",
      conversationId: "blocked",
      sender: "Alex",
      body: "hello",
    });

    channel.handleIncomingMessage({
      guid: "guid-4",
      conversationId: "allowed",
      sender: "Alex",
      body: "   ",
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it("sends markdown attachments as uploaded files plus remaining text", async () => {
    const channel = new IMessageChannel();
    channel.configure("https://bridge.example", "secret", ["chat-1"]);
    channel.apiMode = "legacy";
    channel.fileReader = jest
      .fn()
      .mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));

    const sendAttachment = jest
      .spyOn(channel, "sendAttachment")
      .mockResolvedValue();
    const requestJson = jest
      .spyOn(channel, "requestJson")
      .mockResolvedValue({ ok: true } as any);

    await channel.send(
      "im:chat-1",
      "Please review [lesson pdf](docs/lesson.pdf)",
    );

    expect(channel.fileReader).toHaveBeenCalledWith(
      "im:chat-1",
      "docs/lesson.pdf",
    );
    expect(sendAttachment).toHaveBeenCalledWith("chat-1", expect.any(Blob), {
      alt: "lesson pdf",
      path: "docs/lesson.pdf",
    });
    expect(requestJson).toHaveBeenCalledWith("/messages/send", {
      method: "POST",
      body: JSON.stringify({
        chatId: "chat-1",
        text: "Please review",
      }),
    });
  });

  it("falls back to text markers when attachment upload is unavailable", async () => {
    const channel = new IMessageChannel();
    channel.configure("https://bridge.example", "secret", ["chat-1"]);
    channel.apiMode = "legacy";

    const requestJson = jest
      .spyOn(channel, "requestJson")
      .mockResolvedValue({ ok: true } as any);

    await channel.send("im:chat-1", "![diagram](images/diagram.png)");

    expect(requestJson).toHaveBeenCalledWith("/messages/send", {
      method: "POST",
      body: JSON.stringify({
        chatId: "chat-1",
        text: "[diagram] (file: images/diagram.png)",
      }),
    });
  });

  it("normalizes markdown attachment paths before reading workspace files", async () => {
    const channel = new IMessageChannel();
    channel.configure("https://bridge.example", "secret", ["chat-1"]);
    channel.apiMode = "legacy";
    channel.fileReader = jest
      .fn()
      .mockResolvedValue(new Blob(["img"], { type: "image/png" }));

    const sendAttachment = jest
      .spyOn(channel, "sendAttachment")
      .mockResolvedValue();
    jest.spyOn(channel, "requestJson").mockResolvedValue({ ok: true } as any);

    await channel.send("im:chat-1", "![diagram]( /./images\\diagram.png )");

    expect(channel.fileReader).toHaveBeenCalledWith(
      "im:chat-1",
      "images/diagram.png",
    );
    expect(sendAttachment).toHaveBeenCalledWith("chat-1", expect.any(Blob), {
      alt: "diagram",
      path: "images/diagram.png",
    });
  });

  it("uses Beeper Desktop upload+send flow when /v1/info is available", async () => {
    const channel = new IMessageChannel();
    channel.configure("https://bridge.example", "secret", ["chat-1"]);
    channel.fileReader = jest
      .fn()
      .mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));

    const calls: Array<{ path: string; init: RequestInit }> = [];
    jest
      .spyOn(channel, "requestJson")
      .mockImplementation(async (path: string, init: RequestInit) => {
        calls.push({ path, init });

        if (path === "/v1/info") {
          return { version: "1.0.0" };
        }

        if (path === "/v1/assets/upload") {
          return { uploadID: "upload-123" };
        }

        if (path === "/v1/chats/chat-1/messages") {
          return { pendingMessageID: "m-1" };
        }

        throw new Error(`Unexpected path: ${path}`);
      });

    await channel.send(
      "im:chat-1",
      "Please review [lesson pdf](docs/lesson.pdf)",
    );

    expect(calls.some((call) => call.path === "/v1/info")).toBe(true);
    expect(calls.some((call) => call.path === "/v1/assets/upload")).toBe(true);
    expect(
      calls.filter((call) => call.path === "/v1/chats/chat-1/messages"),
    ).toHaveLength(2);
    expect(calls.some((call) => call.path === "/messages/send")).toBe(false);
  });

  it("falls back to legacy multipart when /v1/info is unavailable", async () => {
    const channel = new IMessageChannel();
    channel.configure("https://bridge.example", "secret", ["chat-1"]);
    channel.fileReader = jest
      .fn()
      .mockResolvedValue(new Blob(["img"], { type: "image/png" }));

    const calls: Array<{ path: string; init: RequestInit }> = [];
    jest
      .spyOn(channel, "requestJson")
      .mockImplementation(async (path: string, init: RequestInit) => {
        calls.push({ path, init });

        if (path === "/v1/info") {
          throw new Error("not found");
        }

        if (path === "/messages/send") {
          return { ok: true };
        }

        throw new Error(`Unexpected path: ${path}`);
      });

    await channel.send("im:chat-1", "![diagram](images/diagram.png)");

    expect(calls.some((call) => call.path === "/v1/info")).toBe(true);
    const legacySend = calls.find((call) => call.path === "/messages/send");
    expect(legacySend).toBeDefined();
    expect(legacySend?.init.body instanceof FormData).toBe(true);
  });
});
