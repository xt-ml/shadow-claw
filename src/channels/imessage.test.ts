import { jest } from "@jest/globals";

import { IMessageChannel } from "./imessage.js";

describe("IMessageChannel", () => {
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
});
