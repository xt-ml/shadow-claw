import { jest } from "@jest/globals";
import { ChannelRegistry } from "./channel-registry.js";

describe("ChannelRegistry", () => {
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

  it("registers and finds a channel by prefix", () => {
    const registry = new ChannelRegistry();
    const ch = mockChannel("browser");
    registry.register("br:", ch, "Browser");

    expect(registry.find("br:main")).toBe(ch);
  });

  it("returns null for unregistered prefix", () => {
    const registry = new ChannelRegistry();
    expect(registry.find("irc:channel")).toBeNull();
  });

  it("matches the longest prefix first", () => {
    const registry = new ChannelRegistry();
    const ext = mockChannel("external");
    const extBot = mockChannel("external-bot");
    registry.register("ext:", ext, "Ext");
    registry.register("ext-bot:", extBot, "ExtBot");

    expect(registry.find("ext-bot:123")).toBe(extBot);
    expect(registry.find("ext:456")).toBe(ext);
  });

  it("lists all registered prefixes", () => {
    const registry = new ChannelRegistry();
    registry.register("br:", mockChannel("browser"), "Browser");
    registry.register("tg:", mockChannel("telegram"), "Telegram");

    const prefixes = registry.prefixes();
    expect(prefixes).toContain("br:");
    expect(prefixes).toContain("tg:");
    expect(prefixes).toHaveLength(2);
  });

  it("returns a badge label for a registered prefix", () => {
    const registry = new ChannelRegistry();
    registry.register("br:", mockChannel("browser"), "Browser");
    registry.register("ext:", mockChannel("external"), "External");

    expect(registry.getBadge("ext:C123")).toBe("External");
    expect(registry.getBadge("br:main")).toBe("Browser");
  });

  it("uses the prefix as the default badge when none is provided", () => {
    const registry = new ChannelRegistry();
    registry.register("im:", mockChannel("imessage"));

    expect(registry.getBadge("im:chat-123")).toBe("im");
  });

  it("returns empty string badge for unregistered prefix", () => {
    const registry = new ChannelRegistry();
    expect(registry.getBadge("irc:foo")).toBe("");
  });

  it("returns channel type metadata for a registered prefix", () => {
    const registry = new ChannelRegistry();
    registry.register("tg:", mockChannel("telegram"), {
      badge: "Telegram",
      autoTrigger: false,
    });

    expect(registry.getChannelType("tg:123")).toBe("telegram");
  });

  it("tracks whether a channel auto-triggers", () => {
    const registry = new ChannelRegistry();
    registry.register("br:", mockChannel("browser"), {
      badge: "Browser",
      autoTrigger: true,
    });
    registry.register("tg:", mockChannel("telegram"), {
      badge: "Telegram",
      autoTrigger: false,
    });

    expect(registry.shouldAutoTrigger("br:main")).toBe(true);
    expect(registry.shouldAutoTrigger("tg:123")).toBe(false);
    expect(registry.shouldAutoTrigger("irc:foo")).toBe(false);
  });

  it("can get a channel by its prefix directly", () => {
    const registry = new ChannelRegistry();
    const ch = mockChannel("browser");
    registry.register("br:", ch, "Browser");

    expect(registry.get("br:")).toBe(ch);
    expect(registry.get("nope:")).toBeUndefined();
  });

  it("starts and stops all registered channels", () => {
    const registry = new ChannelRegistry();
    const a = mockChannel("a");
    const b = mockChannel("b");
    registry.register("a:", a, "A");
    registry.register("b:", b, "B");

    registry.startAll();
    expect(a.start).toHaveBeenCalled();
    expect(b.start).toHaveBeenCalled();

    registry.stopAll();
    expect(a.stop).toHaveBeenCalled();
    expect(b.stop).toHaveBeenCalled();
  });

  it("wires onMessage to all channels", () => {
    const registry = new ChannelRegistry();
    const a = mockChannel("a");
    const b = mockChannel("b");
    registry.register("a:", a, "A");
    registry.register("b:", b, "B");

    const handler = jest.fn();
    registry.onMessage(handler as any);

    expect(a.onMessage).toHaveBeenCalledWith(handler);
    expect(b.onMessage).toHaveBeenCalledWith(handler);
  });
});
