import { jest } from "@jest/globals";

import { RoomChannel } from "./room.js";
import type { InboundMessage } from "./types.js";

function makeManager() {
  return {
    broadcast: jest.fn(),
  };
}

describe("RoomChannel", () => {
  it("has type 'room' and starts/stops", () => {
    const channel = new RoomChannel();
    expect(channel.type).toBe("room");
    expect(channel.running).toBe(false);
    channel.start();
    expect(channel.running).toBe(true);
    channel.stop();
    expect(channel.running).toBe(false);
  });

  it("broadcasts outbound messages via the manager using the bare room id", async () => {
    const channel = new RoomChannel();
    const manager = makeManager();
    channel.setManager(manager as any);

    const attachments = [{ fileName: "a.txt", path: "a.txt" }];
    await channel.send("room:abc", "hello", attachments);

    expect(manager.broadcast).toHaveBeenCalledWith("abc", "hello", attachments);
  });

  it("does nothing on send when no manager is wired", async () => {
    const channel = new RoomChannel();
    await expect(channel.send("room:abc", "hi")).resolves.toBeUndefined();
  });

  it("delivers inbound messages to the registered callback", () => {
    const channel = new RoomChannel();
    const received: InboundMessage[] = [];
    channel.onMessage((m) => received.push(m));

    const msg: InboundMessage = {
      id: "1",
      groupId: "room:abc",
      sender: "Carol",
      content: "hey",
      timestamp: 1,
      channel: "room",
    };
    channel.deliverInbound(msg);

    expect(received).toEqual([msg]);
  });
});
