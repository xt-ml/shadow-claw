import { beforeAll, describe, expect, it } from "@jest/globals";

type WorkboxConfigShape = {
  globPatterns?: string[];
  navigateFallback?: string;
  navigateFallbackAllowlist?: RegExp[];
  runtimeCaching: Array<{
    urlPattern: (ctx: { url: URL; sameOrigin?: boolean }) => boolean;
    handler: string;
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
    expect(workboxConfig.navigateFallback).toBe("index.html");
  });

  it("allows SPA navigation fallback for app routes", () => {
    const allowlist = workboxConfig.navigateFallbackAllowlist ?? [];

    expect(allowlist.some((pattern) => pattern.test("/"))).toBe(true);
    expect(
      allowlist.some((pattern) => pattern.test("/files/main/README.md")),
    ).toBe(true);
    expect(
      allowlist.some((pattern) => pattern.test("/pages/main/index.md")),
    ).toBe(true);
    expect(allowlist.some((pattern) => pattern.test("/settings"))).toBe(true);
    expect(allowlist.some((pattern) => pattern.test("/chat/main/"))).toBe(true);
  });

  it("does not allow SPA navigation fallback for non-app routes", () => {
    const allowlist = workboxConfig.navigateFallbackAllowlist ?? [];

    expect(allowlist.some((pattern) => pattern.test("/proxy"))).toBe(false);
    expect(allowlist.some((pattern) => pattern.test("/assets/icon.png"))).toBe(
      false,
    );
  });

  it("does not match Hugging Face or CDN model downloads in runtimeCaching (deferring directly to native network/CacheStorage)", () => {
    for (const rule of workboxConfig.runtimeCaching) {
      expect(
        rule.urlPattern({
          url: new URL(
            "https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX-GQA/resolve/main/onnx/model_quantized.onnx_data",
          ),
        }),
      ).toBe(false);

      expect(
        rule.urlPattern({
          url: new URL(
            "https://us.aws.cdn.hf.co/onnx-community/gemma-3-1b-it-ONNX-GQA/resolve/main/onnx/model_quantized.onnx_data",
          ),
        }),
      ).toBe(false);

      expect(
        rule.urlPattern({
          url: new URL("https://huggingface.co/google/gemma-2-2b-it.litertlm"),
        }),
      ).toBe(false);

      expect(
        rule.urlPattern({
          url: new URL(
            "https://hf-mirror.com/onnx-community/Qwen3-0.6B-ONNX/resolve/main/model_q4.onnx",
          ),
        }),
      ).toBe(false);
    }
  });

  it("does not cache same-origin telegram proxy requests", () => {
    const matcher = workboxConfig.runtimeCaching[0]?.urlPattern;

    expect(
      matcher({
        url: new URL(
          "http://localhost:8888/telegram/bot123456:getUpdates?offset=0&timeout=30",
        ),
      }),
    ).toBe(false);
  });

  it("does not cache control plane endpoints regardless of origin", () => {
    const matcher = workboxConfig.runtimeCaching[0]?.urlPattern;

    expect(
      matcher({
        url: new URL("https://10.9.8.226:8888/api/control/events"),
        sameOrigin: true,
      }),
    ).toBe(false);

    expect(
      matcher({
        url: new URL("https://192.168.1.50:8888/api/control/health"),
        sameOrigin: true,
      }),
    ).toBe(false);

    expect(
      matcher({
        url: new URL("https://172.20.0.5:8888/api/control/messages"),
        sameOrigin: false,
      }),
    ).toBe(false);

    expect(
      matcher({
        url: new URL("https://xt-ml.github.io/api/control/events"),
        sameOrigin: true,
      }),
    ).toBe(false);
  });

  it("caches regular same-origin app assets on both local IPs and public domains", () => {
    const matcher = workboxConfig.runtimeCaching[0]?.urlPattern;
    // Running locally on loopback
    expect(
      matcher({
        url: new URL("http://localhost:8888/index.js"),
        sameOrigin: true,
      }),
    ).toBe(true);

    // Running locally on LAN IP
    expect(
      matcher({
        url: new URL("http://192.168.1.50:8888/index.js"),
        sameOrigin: true,
      }),
    ).toBe(true);

    // Running on public domain (e.g. GitHub Pages)
    expect(
      matcher({
        url: new URL("https://xt-ml.github.io/shadow-claw/index.js"),
        sameOrigin: true,
      }),
    ).toBe(true);

    // Cross-origin assets should not be cached
    expect(
      matcher({
        url: new URL("https://10.9.8.226:8888/index.js"),
        sameOrigin: false,
      }),
    ).toBe(false);
  });

  it("does not include unmatched globPatterns that trigger Workbox warnings", () => {
    expect(workboxConfig.globPatterns).not.toContain("**/*.svg");
    expect(workboxConfig.globPatterns).not.toContain("**/*.webp");
  });
});
