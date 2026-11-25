import { jest } from "@jest/globals";
import { resetAppBasePathCache } from "../../../core/app-routes.js";
import {
  LEGACY_TRANSFORMERS_CACHE_NAME,
  buildModelFetchInit,
  clearBrowserModelCaches,
  exportBrowserModelsToSharedDir,
  findLegacyTransformersCacheEntry,
  getBrowserModelCacheStats,
  getFallbackModelCacheNames,
  hasModelInSharedDir,
  loadSharedModelCacheConfig,
  migrateBrowserModelCache,
  modelUrlToCacheSegments,
  normalizeSharedModelMirrorUrl,
  readModelFromSharedDir,
  resetSharedModelCacheConfigCache,
  resolveMirrorModelUrl,
  resolveModelCacheName,
  setSharedModelCacheConfigOverride,
  writeModelToSharedDir,
} from "./shared-model-cache.js";

function createMockDirectoryHandle() {
  const dirs = new Map<string, any>();
  const files = new Map<string, Uint8Array>();

  const makeDir = (prefix: string, perm: "granted" | "prompt" = "granted") => ({
    kind: "directory" as const,
    name: prefix || "root",
    queryPermission: jest.fn(async () => perm),
    requestPermission: jest.fn(async () => perm),
    getDirectoryHandle: jest.fn(
      async (name: string, opts?: { create?: boolean }) => {
        const key = prefix ? `${prefix}/${name}` : name;
        if (!dirs.has(key)) {
          if (!opts?.create) {
            throw new DOMException("Not found", "NotFoundError");
          }
          dirs.set(key, makeDir(key, perm));
        }
        return dirs.get(key);
      },
    ),
    getFileHandle: jest.fn(
      async (name: string, opts?: { create?: boolean }) => {
        const key = prefix ? `${prefix}/${name}` : name;
        if (!files.has(key)) {
          if (!opts?.create) {
            throw new DOMException("Not found", "NotFoundError");
          }
          files.set(key, new Uint8Array(0));
        }
        return {
          kind: "file" as const,
          name,
          getFile: async () => {
            const bytes = files.get(key) || new Uint8Array(0);
            return {
              size: bytes.byteLength,
              arrayBuffer: async () =>
                bytes.buffer.slice(
                  bytes.byteOffset,
                  bytes.byteOffset + bytes.byteLength,
                ),
            };
          },
          createWritable: async () => {
            const chunks: Uint8Array[] = [];
            return {
              write: async (chunk: Uint8Array) => {
                chunks.push(new Uint8Array(chunk));
              },
              close: async () => {
                const total = chunks.reduce((s, c) => s + c.byteLength, 0);
                const out = new Uint8Array(total);
                let off = 0;
                for (const c of chunks) {
                  out.set(c, off);
                  off += c.byteLength;
                }
                files.set(key, out);
              },
            };
          },
        };
      },
    ),
  });

  return {
    root: makeDir("", "granted"),
    deniedRoot: makeDir("", "prompt"),
    files,
  };
}

describe("shared-model-cache", () => {
  afterEach(() => {
    setSharedModelCacheConfigOverride(null);
    resetSharedModelCacheConfigCache();
    delete (globalThis as any).__SHADOWCLAW_DEPLOY_ID__;
    resetAppBasePathCache();
    jest.restoreAllMocks();
  });

  it("resolves same-origin vs per-deployment CacheStorage names", () => {
    (globalThis as any).__SHADOWCLAW_DEPLOY_ID__ = "shadow-claw-draw";
    expect(resolveModelCacheName("shadow-claw-browser-models", "origin")).toBe(
      "shadow-claw-browser-models",
    );
    expect(
      resolveModelCacheName("shadow-claw-browser-models", "deployment"),
    ).toBe("shadow-claw-browser-models-shadow-claw-draw");

    delete (globalThis as any).__SHADOWCLAW_DEPLOY_ID__;
    expect(
      resolveModelCacheName("shadow-claw-browser-models", "deployment"),
    ).toBe("shadow-claw-browser-models");
  });

  it("normalizes mirror URLs and rewrites Hugging Face URLs safely", () => {
    expect(
      normalizeSharedModelMirrorUrl(
        " http://localhost:8888/model-cache/hf/// ",
      ),
    ).toBe("http://localhost:8888/model-cache/hf");
    expect(normalizeSharedModelMirrorUrl("ftp://invalid.example")).toBe("");
    expect(normalizeSharedModelMirrorUrl("not-a-url")).toBe("");

    expect(
      resolveMirrorModelUrl(
        "https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX/resolve/main/model.onnx?download=true",
        "http://localhost:8888/model-cache/hf/",
      ),
    ).toBe(
      "http://localhost:8888/model-cache/hf/onnx-community/Qwen3-0.6B-ONNX/resolve/main/model.onnx?download=true",
    );

    expect(
      resolveMirrorModelUrl(
        "https://hf-mirror.com/org/repo/resolve/main/config.json",
        "https://models.internal.local/hf",
      ),
    ).toBe(
      "https://models.internal.local/hf/org/repo/resolve/main/config.json",
    );

    expect(
      resolveMirrorModelUrl(
        "https://cdn.example.com/other/model.onnx",
        "http://localhost:8888/model-cache/hf",
      ),
    ).toBeNull();
    expect(
      resolveMirrorModelUrl(
        "https://huggingface.co/org/../secret/resolve/main/a.bin",
        "http://localhost:8888/model-cache/hf",
      ),
    ).toBeNull();
  });

  it("adds targetAddressSpace for loopback and private mirror URLs", () => {
    expect(
      (buildModelFetchInit("http://localhost:8888/model-cache/hf/a") as any)
        .targetAddressSpace,
    ).toBe("loopback");
    expect(
      (buildModelFetchInit("http://192.168.1.50:8888/model-cache/hf/a") as any)
        .targetAddressSpace,
    ).toBe("private");
    expect(
      (buildModelFetchInit("https://huggingface.co/a/b") as any)
        .targetAddressSpace,
    ).toBeUndefined();
  });

  it("maps model URLs into safe nested cache segments", () => {
    expect(
      modelUrlToCacheSegments(
        "https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX/resolve/main/onnx/model_q4.onnx",
      ),
    ).toEqual([
      "hf",
      "onnx-community",
      "Qwen3-0.6B-ONNX",
      "resolve",
      "main",
      "onnx",
      "model_q4.onnx",
    ]);

    expect(
      modelUrlToCacheSegments(
        "https://storage.googleapis.com/models/gemma/weights.bin",
      ),
    ).toEqual([
      "url",
      "storage.googleapis.com",
      "models",
      "gemma",
      "weights.bin",
    ]);
  });

  it("reads and writes models to a granted shared directory handle and ignores ungranted handles", async () => {
    const mockDir = createMockDirectoryHandle();
    const url =
      "https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX/resolve/main/tokenizer.json";
    const payload = new Uint8Array([11, 22, 33, 44]);

    expect(await readModelFromSharedDir(mockDir.root, url)).toBeNull();
    expect(await writeModelToSharedDir(mockDir.deniedRoot, url, payload)).toBe(
      false,
    );

    expect(await writeModelToSharedDir(mockDir.root, url, payload)).toBe(true);
    const hit = await readModelFromSharedDir(mockDir.root, url);
    expect(hit).not.toBeNull();
    expect(hit!.size).toBe(4);

    const reader = hit!.stream.getReader();
    const collected: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(...value);
    }
    expect(collected).toEqual([11, 22, 33, 44]);
  });

  it("respects config overrides cleanly in Node/Jest", async () => {
    setSharedModelCacheConfigOverride({
      scope: "deployment",
      mirrorEnabled: true,
      mirrorUrl: "http://127.0.0.1:8888/model-cache/hf/",
    });
    const cfg = await loadSharedModelCacheConfig();
    expect(cfg.scope).toBe("deployment");
    expect(cfg.mirrorEnabled).toBe(true);
    expect(cfg.mirrorUrl).toBe("http://127.0.0.1:8888/model-cache/hf");
  });

  it("reports stats and clears browser model caches across CacheStorage buckets", async () => {
    const bucketEntries = new Map<string, Map<string, Uint8Array>>([
      [
        "shadow-claw-browser-models",
        new Map([
          ["https://huggingface.co/a?__sc_meta=1", new Uint8Array([1, 2])],
          ["https://huggingface.co/a?__sc_chunk=0", new Uint8Array([3, 4, 5])],
        ]),
      ],
    ]);

    const originalCaches = (globalThis as any).caches;
    (globalThis as any).caches = {
      open: jest.fn(async (name: string) => {
        if (!bucketEntries.has(name)) {
          bucketEntries.set(name, new Map());
        }
        const entries = bucketEntries.get(name)!;
        return {
          keys: async () =>
            Array.from(entries.keys()).map((u) => ({ url: u }) as Request),
          match: async (req: any) => {
            const bytes = entries.get(typeof req === "string" ? req : req.url);
            if (!bytes) return undefined;
            return {
              headers: new Headers({
                "content-length": String(bytes.byteLength),
              }),
              arrayBuffer: async () => bytes.buffer,
            };
          },
        };
      }),
      delete: jest.fn(async (name: string) => bucketEntries.delete(name)),
    };

    try {
      const stats = await getBrowserModelCacheStats("origin");
      expect(stats.cacheNames).toContain("shadow-claw-browser-models");
      expect(stats.entryCount).toBe(2);
      expect(stats.totalBytes).toBe(5);

      await clearBrowserModelCaches("origin");
      expect(bucketEntries.has("shadow-claw-browser-models")).toBe(false);
    } finally {
      (globalThis as any).caches = originalCaches;
    }
  });

  it("computes fallback cache names and checks/migrates/exports existing browser caches without redownloading", async () => {
    (globalThis as any).__SHADOWCLAW_DEPLOY_ID__ = "my-app";
    expect(
      getFallbackModelCacheNames("shadow-claw-browser-models", "origin"),
    ).toEqual(["shadow-claw-browser-models-my-app"]);
    expect(
      getFallbackModelCacheNames("shadow-claw-browser-models", "deployment"),
    ).toEqual(["shadow-claw-browser-models"]);
    delete (globalThis as any).__SHADOWCLAW_DEPLOY_ID__;
    expect(
      getFallbackModelCacheNames("shadow-claw-browser-models", "origin"),
    ).toEqual([]);

    const mockDir = createMockDirectoryHandle();
    const modelUrl =
      "https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX/resolve/main/model.onnx";
    const legacyUrl =
      "https://huggingface.co/onnx-community/legacy/resolve/main/tokenizer.json";
    expect(await hasModelInSharedDir(mockDir.root, modelUrl)).toBe(false);

    (globalThis as any).__SHADOWCLAW_DEPLOY_ID__ = "my-app";
    const buckets = new Map<string, Map<string, Uint8Array>>([
      [
        "shadow-claw-browser-models-my-app",
        new Map([
          [
            `${modelUrl}?__sc_meta=1`,
            new TextEncoder().encode(
              JSON.stringify({
                chunks: 1,
                received: 3,
                total: 3,
                acceptsRanges: true,
                complete: true,
              }),
            ),
          ],
          [`${modelUrl}?__sc_chunk=0`, new Uint8Array([10, 20, 30])],
        ]),
      ],
      [
        LEGACY_TRANSFORMERS_CACHE_NAME,
        new Map([[legacyUrl, new Uint8Array([99, 100])]]),
      ],
    ]);

    const originalCaches = (globalThis as any).caches;
    (globalThis as any).caches = {
      open: jest.fn(async (name: string) => {
        if (!buckets.has(name)) buckets.set(name, new Map());
        const map = buckets.get(name)!;
        return {
          keys: async () =>
            Array.from(map.keys()).map((u) => ({ url: u }) as Request),
          match: async (req: any) => {
            const k = typeof req === "string" ? req : req.url;
            const bytes = map.get(k);
            if (!bytes) return undefined;
            return {
              headers: new Headers({
                "content-length": String(bytes.byteLength),
              }),
              body: new ReadableStream<Uint8Array>({
                start(c) {
                  c.enqueue(bytes);
                  c.close();
                },
              }),
              text: async () => new TextDecoder().decode(bytes),
              arrayBuffer: async () => bytes.buffer,
            };
          },
          put: async (req: any, resp: any) => {
            const k = typeof req === "string" ? req : req.url;
            const ab = await resp.arrayBuffer();
            map.set(k, new Uint8Array(ab));
          },
        };
      }),
      delete: jest.fn(async (name: string) => buckets.delete(name)),
    };

    try {
      // Legacy fallback lookup
      const legacyHit = await findLegacyTransformersCacheEntry(legacyUrl);
      expect(legacyHit).not.toBeNull();
      expect(legacyHit!.size).toBe(2);

      // Migrate deployment -> origin with deleteSource: true
      const mig1 = await migrateBrowserModelCache("deployment", "origin", {
        deleteSource: true,
      });
      expect(mig1.migratedEntries).toBe(2);
      expect(mig1.migratedCaches).toContain("shadow-claw-browser-models");
      expect(buckets.has("shadow-claw-browser-models-my-app")).toBe(false);
      expect(
        buckets
          .get("shadow-claw-browser-models")
          ?.has(`${modelUrl}?__sc_chunk=0`),
      ).toBe(true);

      // Even if deleteSource: true is passed with fromScope="origin", shared origin cache is NEVER deleted
      const mig2 = await migrateBrowserModelCache("origin", "deployment", {
        deleteSource: true,
      });
      expect(mig2.migratedEntries).toBe(2);
      expect(buckets.has("shadow-claw-browser-models")).toBe(true);

      // Export browser models to shared folder (both chunked and legacy)
      const exp1 = await exportBrowserModelsToSharedDir(mockDir.root, "origin");
      expect(exp1.exportedFiles).toBe(2);
      expect(exp1.skippedFiles).toBe(0);
      expect(exp1.totalBytes).toBe(5);
      expect(await hasModelInSharedDir(mockDir.root, modelUrl)).toBe(true);
      expect(await hasModelInSharedDir(mockDir.root, legacyUrl)).toBe(true);

      // Second export is idempotent (skips already exported files)
      const exp2 = await exportBrowserModelsToSharedDir(mockDir.root, "origin");
      expect(exp2.exportedFiles).toBe(0);
      expect(exp2.skippedFiles).toBe(2);
    } finally {
      (globalThis as any).caches = originalCaches;
      delete (globalThis as any).__SHADOWCLAW_DEPLOY_ID__;
    }
  });
});
