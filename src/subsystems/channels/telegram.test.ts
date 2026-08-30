import { jest } from "@jest/globals";

import { extractMarkdownAttachments, TelegramChannel } from "./telegram.js";

describe("TelegramChannel", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("emits inbound messages for registered chats", async () => {
    const channel = new TelegramChannel();
    const seen: any[] = [];

    channel.configure("token", ["123"]);
    channel.onMessage((message) => seen.push(message));

    await channel.handleUpdate({
      update_id: 10,
      message: {
        message_id: 77,
        chat: { id: 123, type: "private" },
        from: { id: 1, first_name: "Sam" },
        date: 1_700_000_000,
        text: "hello",
      },
    });

    expect(seen).toEqual([
      {
        id: "77",
        groupId: "tg:123",
        sender: "Sam",
        content: "hello",
        timestamp: 1_700_000_000_000,
        channel: "telegram",
        attachments: [],
      },
    ]);
  });

  it("ignores unregistered chats except helper commands", async () => {
    const channel = new TelegramChannel();
    const apiCall = jest
      .spyOn(channel, "apiCall")
      .mockResolvedValue({ ok: true } as any);
    const onMessage = jest.fn();

    channel.configure("token", []);
    channel.onMessage(onMessage);

    await channel.handleUpdate({
      update_id: 11,
      message: {
        message_id: 78,
        chat: { id: 555, type: "private" },
        date: 1_700_000_000,
        text: "/chatid",
      },
    });

    await channel.handleUpdate({
      update_id: 12,
      message: {
        message_id: 79,
        chat: { id: 555, type: "private" },
        date: 1_700_000_000,
        text: "hello",
      },
    });

    expect(apiCall).toHaveBeenCalledWith("sendMessage", {
      chat_id: "555",
      text: "Chat ID: 555\nRegister this ID in ShadowClaw settings.",
    });
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("splits long outbound messages", async () => {
    const channel = new TelegramChannel();
    const apiCall = jest
      .spyOn(channel, "apiCall")
      .mockResolvedValue({ ok: true } as any);

    await channel.send("tg:123", `${"a".repeat(4096)}b`);

    expect(apiCall).toHaveBeenCalledTimes(2);
    expect(apiCall).toHaveBeenNthCalledWith(1, "sendMessage", {
      chat_id: "123",
      text: "a".repeat(4096),
    });
    expect(apiCall).toHaveBeenNthCalledWith(2, "sendMessage", {
      chat_id: "123",
      text: "b",
    });
  });

  it("builds direct Telegram API URLs by default", () => {
    const channel = new TelegramChannel();

    channel.configure("token", ["123"]);

    expect(channel.buildMethodUrl("getMe")).toBe(
      "https://api.telegram.org/bottoken/getMe",
    );
  });

  it("builds same-origin Telegram proxy URLs when enabled", () => {
    const channel = new TelegramChannel();

    channel.configure("token", ["123"], true);

    expect(channel.buildMethodUrl("getMe")).toBe("/telegram/bottoken/getMe");
  });

  it("extracts Telegram attachments with remote file sources", async () => {
    const channel = new TelegramChannel();
    jest.spyOn(channel, "apiCall").mockResolvedValue({
      ok: true,
      result: {
        file_id: "file-1",
        file_path: "photos/file_1.png",
        file_size: 123,
      },
    } as any);

    channel.configure("token", ["123"]);

    const seen: any[] = [];
    channel.onMessage((message) => seen.push(message));

    await channel.handleUpdate({
      update_id: 13,
      message: {
        message_id: 80,
        chat: { id: 123, type: "private" },
        from: { id: 1, first_name: "Sam" },
        date: 1_700_000_000,
        caption: "look",
        photo: [{ file_id: "file-1" }],
      },
    });

    expect(seen[0].content).toBe("look");
    expect(seen[0].attachments).toEqual([
      {
        id: "file-1",
        fileName: "photo-80.png",
        mimeType: "image/png",
        size: 123,
        previewDisposition: "inline",
        source: {
          kind: "remote-url",
          url: "https://api.telegram.org/file/bottoken/photos/file_1.png",
        },
      },
    ]);
  });

  it("labels photo-only messages as photo instead of unsupported", async () => {
    const channel = new TelegramChannel();
    jest.spyOn(channel, "apiCall").mockResolvedValue({
      ok: true,
      result: {
        file_id: "file-1",
        file_path: "photos/file_1.jpg",
      },
    } as any);

    channel.configure("token", ["123"]);

    const seen: any[] = [];
    channel.onMessage((message) => seen.push(message));

    await channel.handleUpdate({
      update_id: 14,
      message: {
        message_id: 81,
        chat: { id: 123, type: "private" },
        from: { id: 1, first_name: "Sam" },
        date: 1_700_000_000,
        photo: [{ file_id: "file-1" }],
      },
    });

    expect(seen[0].content).toBe("[Photo]");
  });

  it("uses exponential backoff for repeated poll failures", async () => {
    const channel = new TelegramChannel();
    const retryDelays: number[] = [];
    let resolveDone: (() => void) | null = null;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    channel.configure("token", ["123"]);

    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    jest
      .spyOn(channel, "waitForRetry")
      .mockImplementation(async (ms: number) => {
        retryDelays.push(ms);

        if (retryDelays.length >= 3) {
          channel.stop();
          resolveDone?.();
        }
      });

    channel.start();
    await done;

    expect(retryDelays).toEqual([1000, 2000, 4000]);
  });

  it("resets poll backoff after a successful poll", async () => {
    const channel = new TelegramChannel();
    const retryDelays: number[] = [];
    let resolveDone: (() => void) | null = null;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    channel.configure("token", ["123"]);

    const fetchMock = jest.spyOn(globalThis, "fetch");
    fetchMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: [] }),
      } as Response)
      .mockRejectedValue(new Error("offline again"));

    jest
      .spyOn(channel, "waitForRetry")
      .mockImplementation(async (ms: number) => {
        retryDelays.push(ms);

        if (retryDelays.length >= 2) {
          channel.stop();
          resolveDone?.();
        }
      });

    channel.start();
    await done;

    expect(retryDelays).toEqual([1000, 1000]);
  });

  it("normalizes markdown attachment paths", () => {
    const result = extractMarkdownAttachments(
      "Here ![img]( /assets\\key-images\\TheLamb-NT-Jesus.png )",
    );

    expect(result.attachments).toEqual([
      {
        alt: "img",
        path: "assets/key-images/TheLamb-NT-Jesus.png",
      },
    ]);
    expect(result.remainingText).toContain("Here");
  });

  it("ignores non-workspace and unsafe markdown links", () => {
    const result = extractMarkdownAttachments(
      "[web](https://example.com/a.png) [bad](../secrets.png) [mail](mailto:test@example.com)",
    );

    expect(result.attachments).toEqual([]);
    expect(result.remainingText).toContain("https://example.com/a.png");
    expect(result.remainingText).toContain("../secrets.png");
    expect(result.remainingText).toContain("mailto:test@example.com");
  });

  it("caps poll retry delay at one minute", () => {
    const channel = new TelegramChannel();
    const delays = Array.from({ length: 8 }, () =>
      channel.nextPollRetryDelay(),
    );

    expect(delays).toEqual([
      1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000,
    ]);
  });

  it("prevents stale poll loops from continuing after restart", async () => {
    const channel = new TelegramChannel();
    let fetchCalls = 0;
    let restarted = false;
    let resolveSecondCall: (() => void) | null = null;
    const secondCallSeen = new Promise<void>((resolve) => {
      resolveSecondCall = resolve;
    });

    channel.configure("token", ["123"], true);

    jest.spyOn(globalThis, "fetch").mockImplementation(async () => {
      fetchCalls += 1;

      if (fetchCalls === 1) {
        throw new Error("proxy offline");
      }

      if (fetchCalls === 2) {
        resolveSecondCall?.();
      }

      // Hold subsequent poll request open so call count stays stable.

      return new Promise<Response>(() => {});
    });

    jest.spyOn(channel, "waitForRetry").mockImplementation(async () => {
      if (restarted) {
        return;
      }

      restarted = true;
      channel.stop();
      channel.start();
    });

    channel.start();
    await secondCallSeen;
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchCalls).toBe(2);
    channel.stop();
  });

  it("handles /ping helper command", async () => {
    const channel = new TelegramChannel();
    const apiCall = jest
      .spyOn(channel, "apiCall")
      .mockResolvedValue({ ok: true } as any);

    channel.configure("token", ["123"]);

    await channel.handleUpdate({
      update_id: 20,
      message: {
        message_id: 99,
        chat: { id: 123, type: "private" },
        date: 1_700_000_000,
        text: "/ping",
      },
    });

    expect(apiCall).toHaveBeenCalledWith("sendMessage", {
      chat_id: "123",
      text: "Pong! ShadowClaw is running.",
    });
  });

  it("handles voice, video, audio, document, sticker, location, and contact messages", async () => {
    const channel = new TelegramChannel();
    jest.spyOn(channel, "apiCall").mockResolvedValue({
      ok: true,
      result: { file_id: "fid", file_path: "path/file.dat" },
    } as any);

    channel.configure("token", ["123"]);
    const messagesSeen: any[] = [];
    channel.onMessage((m) => messagesSeen.push(m));

    // Voice
    await channel.handleUpdate({
      update_id: 21,
      message: {
        message_id: 101,
        chat: { id: 123, type: "private" },
        date: 1_700_000_000,
        voice: { file_id: "voice-1", mime_type: "audio/ogg" },
      },
    });
    expect(messagesSeen[0].content).toBe("[Voice message]");

    // Video
    await channel.handleUpdate({
      update_id: 22,
      message: {
        message_id: 102,
        chat: { id: 123, type: "private" },
        date: 1_700_000_000,
        video: { file_id: "vid-1", file_name: "movie.mp4" },
      },
    });
    expect(messagesSeen[1].content).toBe("[Video]");

    // Audio
    await channel.handleUpdate({
      update_id: 23,
      message: {
        message_id: 103,
        chat: { id: 123, type: "private" },
        date: 1_700_000_000,
        audio: { file_id: "aud-1", file_name: "song.mp3" },
      },
    });
    expect(messagesSeen[2].content).toBe("[Audio]");

    // Document
    await channel.handleUpdate({
      update_id: 24,
      message: {
        message_id: 104,
        chat: { id: 123, type: "private" },
        date: 1_700_000_000,
        document: { file_id: "doc-1", file_name: "report.pdf" },
      },
    });
    expect(messagesSeen[3].content).toBe("[Document: report.pdf]");

    // Sticker
    await channel.handleUpdate({
      update_id: 25,
      message: {
        message_id: 105,
        chat: { id: 123, type: "private" },
        date: 1_700_000_000,
        sticker: { file_id: "stk-1", emoji: "🚀", is_animated: true },
      },
    });
    expect(messagesSeen[4].content).toBe("[Sticker: 🚀]");

    // Location
    await channel.handleUpdate({
      update_id: 26,
      message: {
        message_id: 106,
        chat: { id: 123, type: "private" },
        date: 1_700_000_000,
        location: { latitude: 37.7749, longitude: -122.4194 },
      },
    });
    expect(messagesSeen[5].content).toBe("[Location: 37.7749, -122.4194]");

    // Contact
    await channel.handleUpdate({
      update_id: 27,
      message: {
        message_id: 107,
        chat: { id: 123, type: "private" },
        date: 1_700_000_000,
        contact: { first_name: "Jane" },
      },
    });
    expect(messagesSeen[6].content).toBe("[Contact: Jane]");
  });

  it("sets typing status via sendChatAction", () => {
    const channel = new TelegramChannel();
    channel.configure("token", ["123"]);
    const apiCall = jest
      .spyOn(channel, "apiCall")
      .mockResolvedValue({ ok: true } as any);

    channel.setTyping("tg:123", true);
    expect(apiCall).toHaveBeenCalledWith("sendChatAction", {
      chat_id: "123",
      action: "typing",
    });

    channel.setTyping("tg:123", false);
    expect(apiCall).toHaveBeenCalledTimes(1);
  });

  it("sends photos and documents via sendPhoto / sendDocument when fileReader provides blobs", async () => {
    const channel = new TelegramChannel();
    channel.configure("token", ["123"]);

    channel.fileReader = jest
      .fn<any>()
      .mockImplementation(async (_gid, path) => {
        if (path.endsWith(".png")) {
          return new Blob(["png-data"], { type: "image/png" });
        }
        return new Blob(["pdf-data"], { type: "application/pdf" });
      });

    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await channel.send(
      "tg:123",
      "Look at ![photo](images/pic.png) and [doc](docs/file.pdf) please",
    );

    expect(channel.fileReader).toHaveBeenCalledWith("tg:123", "images/pic.png");
    expect(channel.fileReader).toHaveBeenCalledWith("tg:123", "docs/file.pdf");
    expect(
      fetchSpy.mock.calls.some((c: any) => String(c[0]).includes("sendPhoto")),
    ).toBe(true);
    expect(
      fetchSpy.mock.calls.some((c: any) =>
        String(c[0]).includes("sendDocument"),
      ),
    ).toBe(true);
    expect(
      fetchSpy.mock.calls.some((c: any) =>
        String(c[0]).includes("sendMessage"),
      ),
    ).toBe(true);
  });
});
