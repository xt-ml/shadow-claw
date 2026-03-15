import { jest } from "@jest/globals";

import { BrowserChatChannel } from "./browser-chat.mjs";

describe("BrowserChatChannel", () => {
  it("submits messages to callback", () => {
    const ch = new BrowserChatChannel();
    const seen = [];
    ch.onMessage((m) => seen.push(m));

    ch.submit("hello", "br:abc");

    expect(seen).toHaveLength(1);

    expect(seen[0].groupId).toBe("br:abc");

    expect(seen[0].sender).toBe("You");

    expect(seen[0].content).toBe("hello");

    expect(seen[0].channel).toBe("browser");
  });

  it("uses active group when submit groupId is omitted", () => {
    const ch = new BrowserChatChannel();
    let payload;
    ch.onMessage((m) => {
      payload = m;
    });

    ch.setActiveGroup("br:custom");
    ch.submit("msg");

    expect(payload.groupId).toBe("br:custom");

    expect(ch.getActiveGroup()).toBe("br:custom");
  });

  it("forwards display and typing callbacks", async () => {
    const ch = new BrowserChatChannel();
    const display = jest.fn();
    const typing = jest.fn();

    ch.onDisplay(display);
    ch.onTyping(typing);

    await ch.send("br:g", "hi");
    ch.setTyping("br:g", true);

    expect(display).toHaveBeenCalledWith("br:g", "hi", true);

    expect(typing).toHaveBeenCalledWith("br:g", true);
  });
});
