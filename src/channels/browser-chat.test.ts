import { jest } from "@jest/globals";

import { BrowserChatChannel } from "./browser-chat.js";

describe("BrowserChatChannel", () => {
  it("submits messages to callback", () => {
    const ch = new BrowserChatChannel();
    const seen: any[] = [];

    ch.onMessage((m: any) => seen.push(m));

    ch.submit("hello", "br:abc");

    expect(seen).toHaveLength(1);

    expect(seen[0].groupId).toBe("br:abc");

    expect(seen[0].sender).toBe("You");

    expect(seen[0].content).toBe("hello");

    expect(seen[0].channel).toBe("browser");
  });

  it("uses active group when submit groupId is omitted", () => {
    const ch: any = new BrowserChatChannel();
    let payload: any;

    ch.onMessage((m: any) => {
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

    ch.onDisplay(display as any);
    ch.onTyping(typing as any);

    await ch.send("br:g", "hi");
    ch.setTyping("br:g", true);

    expect(display).toHaveBeenCalledWith("br:g", "hi", true);

    expect(typing).toHaveBeenCalledWith("br:g", true);
  });
});
