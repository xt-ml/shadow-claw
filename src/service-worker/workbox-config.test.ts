import { beforeAll, describe, expect, it } from "@jest/globals";

type WorkboxConfigShape = {
  navigateFallback?: string;
  navigateFallbackAllowlist?: RegExp[];
  runtimeCaching: Array<{
    urlPattern: (ctx: { url: URL }) => boolean;
  }>;
};

let workboxConfig: WorkboxConfigShape;

beforeAll(async () => {
  const imported = (await import("./workbox-config.cjs")) as
    | WorkboxConfigShape
    | { default: WorkboxConfigShape };
  workboxConfig =
    "default" in imported ? imported.default : (imported as WorkboxConfigShape);
});

describe("workbox runtime caching rules", () => {
  it("uses index.html as the navigation fallback", () => {
    expect(workboxConfig.navigateFallback).toBe("/index.html");
  });

  it("allows SPA navigation fallback for app routes", () => {
    const allowlist = workboxConfig.navigateFallbackAllowlist ?? [];

    expect(allowlist.some((pattern) => pattern.test("/"))).toBe(true);
    expect(
      allowlist.some((pattern) => pattern.test("/files/br-main/README.md")),
    ).toBe(true);
    expect(
      allowlist.some((pattern) => pattern.test("/pages/br-main/index.md")),
    ).toBe(true);
    expect(allowlist.some((pattern) => pattern.test("/settings"))).toBe(true);
    expect(allowlist.some((pattern) => pattern.test("/chat/br-main/"))).toBe(
      true,
    );
  });

  it("does not allow SPA navigation fallback for non-app routes", () => {
    const allowlist = workboxConfig.navigateFallbackAllowlist ?? [];

    expect(allowlist.some((pattern) => pattern.test("/proxy"))).toBe(false);
    expect(allowlist.some((pattern) => pattern.test("/assets/icon.png"))).toBe(
      false,
    );
  });

  it("does not cache same-origin telegram proxy requests", () => {
    const matcher = workboxConfig.runtimeCaching[1]?.urlPattern;

    expect(
      matcher({
        url: new URL(
          "http://localhost:8888/telegram/bot123456:getUpdates?offset=0&timeout=30",
        ),
      }),
    ).toBe(false);
  });

  it("still caches regular same-origin app assets", () => {
    const matcher = workboxConfig.runtimeCaching[1]?.urlPattern;

    expect(
      matcher({
        url: new URL("http://localhost:8888/index.js"),
      }),
    ).toBe(true);
  });
});
