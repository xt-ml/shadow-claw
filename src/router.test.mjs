import { jest } from "@jest/globals";

import { Router } from "./router.mjs";

describe("Router", () => {
  it("sends through configured channel", async () => {
    const channel = { send: jest.fn(), setTyping: jest.fn() };
    const router = new Router(channel);

    await router.send("br:main", "hello");
    router.setTyping("br:main", true);

    expect(channel.send).toHaveBeenCalledWith("br:main", "hello");

    expect(channel.setTyping).toHaveBeenCalledWith("br:main", true);
  });

  it("formats outbound and xml payloads", () => {
    expect(Router.formatOutbound("hi<internal>x</internal>")).toBe("hi");

    const xml = Router.formatMessagesXml([
      { sender: "A&B", timestamp: 0, content: '<ok>"' },
    ]);

    expect(xml).toContain("A&amp;B");

    expect(xml).toContain("&lt;ok&gt;&quot;");
  });
});
