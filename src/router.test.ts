import { jest } from "@jest/globals";

import { Router } from "./router.js";
import { ChannelRegistry } from "./channels/channel-registry.js";

describe("Router", () => {
  function mockChannel(type: string): any {
    return {
      type,
      start: jest.fn(),
      stop: jest.fn(),
      send: jest.fn(),
      setTyping: jest.fn(),
      onMessage: jest.fn(),
    };
  }

  it("sends through configured channel", async () => {
    const registry = new ChannelRegistry();
    const channel = mockChannel("browser");
    registry.register("br:", channel, "Browser");
    const router = new Router(registry);

    await router.send("br:main", "hello");
    router.setTyping("br:main", true);

    expect(channel.send).toHaveBeenCalledWith("br:main", "hello");

    expect(channel.setTyping).toHaveBeenCalledWith("br:main", true);
  });

  it("routes prefixed groupIds to the matching channel", async () => {
    const registry = new ChannelRegistry();
    const browserChannel = mockChannel("browser");
    const externalChannel = mockChannel("external");
    registry.register("br:", browserChannel, "Browser");
    registry.register("ext:", externalChannel, "External");
    const router = new Router(registry);

    await router.send("ext:C12345", "hello external");
    router.setTyping("ext:C12345", true);

    expect(externalChannel.send).toHaveBeenCalledWith(
      "ext:C12345",
      "hello external",
    );
    expect(externalChannel.setTyping).toHaveBeenCalledWith("ext:C12345", true);

    // browser channel should NOT have been called
    expect(browserChannel.send).not.toHaveBeenCalled();
    expect(browserChannel.setTyping).not.toHaveBeenCalled();
  });

  it("routes br: prefixed groupIds to browser channel when multiple channels registered", async () => {
    const registry = new ChannelRegistry();
    const browserChannel = mockChannel("browser");
    const externalChannel = mockChannel("external");
    registry.register("br:", browserChannel, "Browser");
    registry.register("ext:", externalChannel, "External");
    const router = new Router(registry);

    await router.send("br:main", "hello browser");

    expect(browserChannel.send).toHaveBeenCalledWith(
      "br:main",
      "hello browser",
    );
    expect(externalChannel.send).not.toHaveBeenCalled();
  });

  it("warns and skips send for unknown channel prefix", async () => {
    const registry = new ChannelRegistry();
    const browserChannel = mockChannel("browser");
    registry.register("br:", browserChannel, "Browser");
    const router = new Router(registry);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await router.send("irc:channel", "hello");

    expect(browserChannel.send).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
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
