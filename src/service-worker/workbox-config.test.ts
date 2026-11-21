import { beforeAll, describe, expect, it, jest } from "@jest/globals";

type RuntimeCachingPlugin = {
  fetchDidSucceed?: (ctx: {
    request: Request;
    response: Response;
  }) => Promise<Response>;
};

type WorkboxConfigShape = {
  globPatterns?: string[];
  navigateFallback?: string;
  navigateFallbackAllowlist?: RegExp[];
  runtimeCaching: Array<{
    urlPattern: (ctx: { url: URL; sameOrigin?: boolean }) => boolean;
    handler: string;
    options?: {
      cacheName?: string;
      expiration?: {
        maxEntries?: number;
        maxAgeSeconds?: number;
      };
      plugins?: RuntimeCachingPlugin[];
    };
  }>;
};

let workboxConfig: WorkboxConfigShape;

function getChunksRule() {
  return workboxConfig.runtimeCaching.find(
    (rule) => rule.options?.cacheName === "shadow-claw-chunks-cache",
  )!;
}

function getRuntimeAssetRule() {
  return workboxConfig.runtimeCaching.find(
    (rule) => rule.options?.cacheName === "shadow-claw-cache",
  )!;
}

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

  it("cleans up outdated precaches so stale assets are not served", () => {
    expect((workboxConfig as any).cleanupOutdatedCaches).toBe(true);
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
    for (const rule of workboxConfig.runtimeCaching) {
      expect(
        rule.urlPattern({
          url: new URL(
            "http://localhost:8888/telegram/bot123456:getUpdates?offset=0&timeout=30",
          ),
        }),
      ).toBe(false);
    }
  });

  it("does not cache control plane endpoints regardless of origin", () => {
    for (const rule of workboxConfig.runtimeCaching) {
      expect(
        rule.urlPattern({
          url: new URL("https://10.9.8.226:8888/api/control/events"),
          sameOrigin: true,
        }),
      ).toBe(false);

      expect(
        rule.urlPattern({
          url: new URL("https://192.168.1.50:8888/api/control/health"),
          sameOrigin: true,
        }),
      ).toBe(false);

      expect(
        rule.urlPattern({
          url: new URL("https://172.20.0.5:8888/api/control/messages"),
          sameOrigin: false,
        }),
      ).toBe(false);

      expect(
        rule.urlPattern({
          url: new URL("https://xt-ml.github.io/api/control/events"),
          sameOrigin: true,
        }),
      ).toBe(false);
    }
  });

  it("caches regular same-origin app assets on both local IPs and public domains", () => {
    const matcher = getRuntimeAssetRule()?.urlPattern;
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

    // Cross-origin assets should not be cached by either rule
    for (const rule of workboxConfig.runtimeCaching) {
      expect(
        rule.urlPattern({
          url: new URL("https://10.9.8.226:8888/index.js"),
          sameOrigin: false,
        }),
      ).toBe(false);
      expect(
        rule.urlPattern({
          url: new URL("https://10.9.8.226:8888/shadow-claw-chat-BsJHQZ0R.js"),
          sameOrigin: false,
        }),
      ).toBe(false);
    }
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

  it("uses CacheFirst in shadow-claw-chunks-cache for root hashed JS chunks and excludes unhashed/consumer scripts", () => {
    const chunksRule = getChunksRule();
    expect(chunksRule).toBeDefined();
    expect(chunksRule.handler).toBe("CacheFirst");

    const matcher = chunksRule.urlPattern;
    for (const chunk of [
      "shadow-claw-chat-BsJHQZ0R.js",
      "git-W12NbH-9.js",
      "execute-tool-9EpeDorK.js",
    ]) {
      expect(
        matcher({
          url: new URL(`https://xt-ml.github.io/shadow-claw-daw/${chunk}`),
          sameOrigin: true,
        }),
      ).toBe(true);
    }

    for (const excluded of [
      ".agents/scripts/scdaw-recorder.js",
      ".agents/scripts/scdaw-compress.js",
      "files/main/foo-12345678.js",
      "pages/main/bar-12345678.js",
      "assets/lib-12345678.js",
      "service-worker/fetch-proxy.js",
      "index.js",
      "agent.worker.js",
      "workbox-e4022e15.js",
    ]) {
      expect(
        matcher({
          url: new URL(`https://xt-ml.github.io/shadow-claw-daw/${excluded}`),
          sameOrigin: true,
        }),
      ).toBe(false);
    }
  });

  it("ensures runtimeCaching matches on-demand component chunks (shadow-claw-chat, tasks, files, conversations)", () => {
    const chunksMatcher = getChunksRule()?.urlPattern;
    const runtimeMatcher = getRuntimeAssetRule()?.urlPattern;
    const components = [
      "shadow-claw-chat-abc12345.js",
      "shadow-claw-tasks-def45678.js",
      "shadow-claw-files-ghi78901.js",
      "shadow-claw-conversations-jkl01234.js",
      "shadow-claw-pages-mno34567.js",
    ];

    for (const chunk of components) {
      expect(
        chunksMatcher({
          url: new URL(`https://xt-ml.github.io/shadow-claw/${chunk}`),
          sameOrigin: true,
        }),
      ).toBe(true);
      expect(
        runtimeMatcher({
          url: new URL(`https://xt-ml.github.io/shadow-claw/${chunk}`),
          sameOrigin: true,
        }),
      ).toBe(true);
    }
  });

  it("ensures NetworkFirst runtimeCaching rule matches agent.worker.js and consumer scripts", () => {
    const matcher = getRuntimeAssetRule()?.urlPattern;
    expect(
      matcher({
        url: new URL("https://xt-ml.github.io/shadow-claw/agent.worker.js"),
        sameOrigin: true,
      }),
    ).toBe(true);
    expect(
      matcher({
        url: new URL(
          "https://xt-ml.github.io/shadow-claw-daw/.agents/scripts/scdaw-recorder.js",
        ),
        sameOrigin: true,
      }),
    ).toBe(true);
  });

  it("verifies NetworkFirst shadow-claw-cache rule falls back to cache on HTTP 404 or 5xx responses", async () => {
    const rule = getRuntimeAssetRule();
    expect(rule).toBeDefined();
    expect(rule.handler).toBe("NetworkFirst");
    expect(rule.options?.cacheName).toBe("shadow-claw-cache");

    const plugin = rule.options?.plugins?.find(
      (p) => typeof p.fetchDidSucceed === "function",
    );
    expect(plugin).toBeDefined();

    const cachedOk = new Response("cached-body", { status: 200 });
    const matchMock = jest.fn(async (_req: Request) => cachedOk);
    const openMock = jest.fn(async (_cacheName: string) => ({
      match: matchMock,
    }));
    const originalCaches = (globalThis as any).caches;
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      writable: true,
      value: { open: openMock },
    });

    try {
      const req = {
        url: "https://xt-ml.github.io/shadow-claw/index.js",
      } as Request;

      // 200 response returns without reading cache
      const okNet = new Response("fresh-body", { status: 200 });
      expect(
        await plugin!.fetchDidSucceed!({ request: req, response: okNet }),
      ).toBe(okNet);
      expect(openMock).not.toHaveBeenCalled();

      // 404 with cached copy returns cached 200 response
      const notFound = new Response("Not Found", { status: 404 });
      expect(
        await plugin!.fetchDidSucceed!({ request: req, response: notFound }),
      ).toBe(cachedOk);
      expect(openMock).toHaveBeenCalledWith("shadow-claw-cache");

      // 503 with cached copy returns cached 200 response
      const serverErr = new Response("Service Unavailable", { status: 503 });
      expect(
        await plugin!.fetchDidSucceed!({ request: req, response: serverErr }),
      ).toBe(cachedOk);

      // 404 without cached copy returns original 404
      matchMock.mockResolvedValueOnce(undefined as any);
      expect(
        await plugin!.fetchDidSucceed!({ request: req, response: notFound }),
      ).toBe(notFound);
    } finally {
      if (originalCaches === undefined) {
        delete (globalThis as any).caches;
      } else {
        Object.defineProperty(globalThis, "caches", {
          configurable: true,
          writable: true,
          value: originalCaches,
        });
      }
    }
  });
});
