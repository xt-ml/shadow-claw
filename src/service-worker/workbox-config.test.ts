import { beforeAll, describe, expect, it } from "@jest/globals";

type WorkboxConfigShape = {
  globPatterns?: string[];
  navigateFallback?: string;
  navigateFallbackAllowlist?: RegExp[];
  runtimeCaching: Array<{
    urlPattern: (ctx: { url: URL; sameOrigin?: boolean }) => boolean;
    handler: string;
    options?: {
      cacheName?: string;
    };
  }>;
};

let workboxConfig: WorkboxConfigShape;

beforeAll(async () => {
  const imported = (await import("./workbox-config.cjs")) as
    WorkboxConfigShape | { default: WorkboxConfigShape };
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

    // Subpath deployments (e.g. GitHub Pages /shadow-claw/)
    expect(
      allowlist.some((pattern) =>
        pattern.test("/shadow-claw/files/main/README.md"),
      ),
    ).toBe(true);
    expect(
      allowlist.some((pattern) =>
        pattern.test("/shadow-claw/files/main/~/docs/example/article.html"),
      ),
    ).toBe(true);
    expect(allowlist.some((pattern) => pattern.test("/shadow-claw/"))).toBe(
      true,
    );
    expect(
      allowlist.some((pattern) => pattern.test("/shadow-claw/chat/main/")),
    ).toBe(true);
  });

  it("excludes files/** from precache glob patterns so user files are not treated as core app assets", () => {
    const globIgnores = (workboxConfig as any).globIgnores ?? [];
    expect(globIgnores).toContain("files/**");
  });

  it("excludes heavy optional bundles, workers, model caches, and screenshots from precache", () => {
    const globIgnores = (workboxConfig as any).globIgnores ?? [];
    expect(globIgnores).toContain("assets/screenshots/**");
    expect(globIgnores).toContain("assets/cache/**");
    expect(globIgnores).toContain("webllm-*.js");
    expect(globIgnores).toContain("transformers-*.js");
    expect(globIgnores).toContain("pdf.worker.js");
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

  it("precaches only core shell assets and does not wildcard all chunk files into precache", () => {
    expect(workboxConfig.globPatterns).not.toContain("**/*.js");
    expect(workboxConfig.globPatterns).not.toContain("**/*.css");
    expect(workboxConfig.globPatterns).toContain("index.html");
    expect(workboxConfig.globPatterns).toContain("index.js");
  });

  it("ensures runtimeCaching rule matches on-demand component chunks (shadow-claw-chat, tasks, files, conversations)", () => {
    const matcher = workboxConfig.runtimeCaching[0]?.urlPattern;
    const components = [
      "shadow-claw-chat-abc123.js",
      "shadow-claw-tasks-def456.js",
      "shadow-claw-files-ghi789.js",
      "shadow-claw-conversations-jkl012.js",
      "shadow-claw-pages-mno345.js",
    ];

    for (const chunk of components) {
      expect(
        matcher({
          url: new URL(`https://xt-ml.github.io/shadow-claw/${chunk}`),
          sameOrigin: true,
        }),
      ).toBe(true);
    }
  });

  it("ensures runtimeCaching rule matches agent.worker.js", () => {
    const matcher = workboxConfig.runtimeCaching[0]?.urlPattern;
    expect(
      matcher({
        url: new URL("https://xt-ml.github.io/shadow-claw/agent.worker.js"),
        sameOrigin: true,
      }),
    ).toBe(true);
  });

  it("verifies handler is NetworkFirst and cacheName is shadow-claw-cache", () => {
    const rule = workboxConfig.runtimeCaching[0];
    expect(rule.handler).toBe("NetworkFirst");
    expect(rule.options?.cacheName).toBe("shadow-claw-cache");
  });
});
