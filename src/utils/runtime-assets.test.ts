import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import {
  getRuntimeAssetBase,
  resolveRuntimeAsset,
  isCrossOriginAsset,
  createModuleWorker,
  resetRuntimeAssetBaseCache,
} from "./runtime-assets.js";

describe("runtime-assets", () => {
  beforeEach(() => {
    resetRuntimeAssetBaseCache();
    document.head.innerHTML = "";
  });

  afterEach(() => {
    resetRuntimeAssetBaseCache();
    document.head.innerHTML = "";
  });

  describe("getRuntimeAssetBase", () => {
    it("returns base from meta tag if present", () => {
      const meta = document.createElement("meta");
      meta.name = "shadow-claw-asset-base";
      meta.content = "https://unpkg.com/shadow-claw@1.59.2/dist/public/";
      document.head.appendChild(meta);

      expect(getRuntimeAssetBase()).toBe(
        "https://unpkg.com/shadow-claw@1.59.2/dist/public/",
      );
    });

    it("ensures trailing slash on meta tag asset base", () => {
      const meta = document.createElement("meta");
      meta.name = "shadow-claw-asset-base";
      meta.content = "https://cdn.example.com/sc/assets";
      document.head.appendChild(meta);

      expect(getRuntimeAssetBase()).toBe("https://cdn.example.com/sc/assets/");
    });

    it("returns base from site config if present and no meta tag", () => {
      const script = document.createElement("script");
      script.id = "shadow-claw-site-config";
      script.type = "application/json";
      script.textContent = JSON.stringify({
        runtime: {
          assetBase: "https://my-cdn.org/shadow-claw/public",
        },
      });
      document.head.appendChild(script);

      expect(getRuntimeAssetBase()).toBe(
        "https://my-cdn.org/shadow-claw/public/",
      );
    });

    it("falls back to applyBasePath('/') when no meta or config is present", () => {
      const base = getRuntimeAssetBase();
      expect(base).toBeDefined();
      expect(base.endsWith("/")).toBe(true);
    });
  });

  describe("resolveRuntimeAsset", () => {
    it("redirects dist/lib/ URLs to dist/public/ for bundled workers/assets", () => {
      expect(
        resolveRuntimeAsset(
          "https://unpkg.com/shadow-claw@1.59.2/dist/lib/agent.worker.js",
        ),
      ).toBe(
        "https://unpkg.com/shadow-claw@1.59.2/dist/public/agent.worker.js",
      );
    });

    it("preserves absolute HTTP/HTTPS/data/blob URLs", () => {
      expect(resolveRuntimeAsset("https://cdn.com/lib.js")).toBe(
        "https://cdn.com/lib.js",
      );
      expect(resolveRuntimeAsset("http://cdn.com/lib.js")).toBe(
        "http://cdn.com/lib.js",
      );
      expect(resolveRuntimeAsset("data:text/plain,hello")).toBe(
        "data:text/plain,hello",
      );
      expect(resolveRuntimeAsset("blob:http://localhost/123")).toBe(
        "blob:http://localhost/123",
      );
    });

    it("resolves relative path against asset base", () => {
      const meta = document.createElement("meta");
      meta.name = "shadow-claw-asset-base";
      meta.content = "https://unpkg.com/shadow-claw@1.59.2/dist/public/";
      document.head.appendChild(meta);

      expect(resolveRuntimeAsset("assets/iframe-storage-bridge.js")).toBe(
        "https://unpkg.com/shadow-claw@1.59.2/dist/public/assets/iframe-storage-bridge.js",
      );
      expect(resolveRuntimeAsset("/assets/file-viewer-preview-bridge.js")).toBe(
        "https://unpkg.com/shadow-claw@1.59.2/dist/public/assets/file-viewer-preview-bridge.js",
      );
      expect(resolveRuntimeAsset("agent.worker.js")).toBe(
        "https://unpkg.com/shadow-claw@1.59.2/dist/public/agent.worker.js",
      );
    });
  });

  describe("isCrossOriginAsset", () => {
    it("identifies cross-origin URLs correctly", () => {
      expect(
        isCrossOriginAsset("https://unpkg.com/shadow-claw/dist/worker.js"),
      ).toBe(true);
      expect(isCrossOriginAsset("blob:http://localhost/xyz")).toBe(false);
      expect(isCrossOriginAsset("/assets/file.js")).toBe(false);
    });
  });

  describe("createModuleWorker", () => {
    it("wraps cross-origin worker script in blob import", () => {
      const meta = document.createElement("meta");
      meta.name = "shadow-claw-asset-base";
      meta.content = "https://unpkg.com/shadow-claw@1.59.2/dist/public/";
      document.head.appendChild(meta);

      const capturedUrls: string[] = [];
      const originalWorker = window.Worker;
      const originalCreateObjectURL = URL.createObjectURL;

      (window as any).Worker = class MockWorker {
        url: string;
        options: any;
        constructor(url: string, options: any) {
          this.url = url;
          this.options = options;
          capturedUrls.push(url);
        }
      };

      URL.createObjectURL = jest.fn((_blob: Blob) => {
        return "blob:fake-worker-url";
      }) as any;

      try {
        const worker = createModuleWorker("agent.worker.js");
        expect(worker).toBeDefined();
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        expect(capturedUrls[0]).toBe("blob:fake-worker-url");
      } finally {
        window.Worker = originalWorker;
        URL.createObjectURL = originalCreateObjectURL;
      }
    });

    it("passes same-origin worker script directly without blob wrapper", () => {
      const capturedUrls: string[] = [];
      const originalWorker = window.Worker;
      const originalCreateObjectURL = URL.createObjectURL;

      (window as any).Worker = class MockWorker {
        url: string;
        options: any;
        constructor(url: string, options: any) {
          this.url = url;
          this.options = options;
          capturedUrls.push(url);
        }
      };

      URL.createObjectURL = jest.fn() as any;

      try {
        const worker = createModuleWorker("/agent.worker.js");
        expect(worker).toBeDefined();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(capturedUrls[0]).toContain("agent.worker.js");
      } finally {
        window.Worker = originalWorker;
        URL.createObjectURL = originalCreateObjectURL;
      }
    });
  });
});
