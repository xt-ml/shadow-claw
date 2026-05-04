import { shouldBypassFetchProxy } from "./fetch-proxy-rules.js";

describe("shouldBypassFetchProxy", () => {
  it("bypasses direct Telegram Bot API requests", () => {
    const requestUrl = new URL(
      "https://api.telegram.org/bot123456:getUpdates?offset=0&timeout=30",
    );

    expect(shouldBypassFetchProxy(requestUrl, "http://localhost:8888")).toBe(
      true,
    );
  });

  it("does not bypass unrelated cross-origin requests", () => {
    const requestUrl = new URL("https://example.com/api/weather");

    expect(shouldBypassFetchProxy(requestUrl, "http://localhost:8888")).toBe(
      false,
    );
  });

  it("bypasses loopback real share target HTML endpoint", () => {
    const requestUrl = new URL(
      "http://localhost:8888/shadow-claw/share/share-target.html",
    );

    expect(shouldBypassFetchProxy(requestUrl, "http://localhost:9999")).toBe(
      true,
    );
  });
});
