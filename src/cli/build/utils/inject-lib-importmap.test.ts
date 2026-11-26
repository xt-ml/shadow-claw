import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildCdnLibImportMap,
  buildLocalLibImportMap,
  collectLibEntryPaths,
  copyLibToPublic,
  injectLibImportMap,
} from "./inject-lib-importmap.js";

describe("inject-lib-importmap", () => {
  it("buildLocalLibImportMap builds root-relative mappings for basePath '/'", () => {
    const map = buildLocalLibImportMap("/", [
      "index.js",
      "components/index.js",
      "components/shadow-claw-element.js",
      "components/shadow-claw-resize-handle.js",
      "components/base-styles.js",
      "utils/index.js",
      "utils/signals.js",
    ]);

    expect(map).toMatchObject({
      "shadow-claw": "/lib/index.js",
      "shadow-claw/": "/lib/",
      "shadow-claw/components": "/lib/components/index.js",
      "shadow-claw/components/": "/lib/components/",
      "shadow-claw/components/shadow-claw-element":
        "/lib/components/shadow-claw-element.js",
      "shadow-claw/components/shadow-claw-element.js":
        "/lib/components/shadow-claw-element.js",
      "shadow-claw/components/shadow-claw-resize-handle":
        "/lib/components/shadow-claw-resize-handle.js",
      "shadow-claw/components/base-styles": "/lib/components/base-styles.js",
      "shadow-claw/utils": "/lib/utils/index.js",
      "shadow-claw/utils/": "/lib/utils/",
      "shadow-claw/utils/signals": "/lib/utils/signals.js",
      "shadow-claw/utils/signals.js": "/lib/utils/signals.js",
      "shadow-claw/signals": "/lib/utils/signals.js",
    });
  });

  it("buildLocalLibImportMap prefixes all URLs with custom basePath", () => {
    const map = buildLocalLibImportMap("/my-app/", [
      "components/shadow-claw-element.js",
      "utils/signals.js",
    ]);

    expect(map["shadow-claw"]).toBe("/my-app/lib/index.js");
    expect(map["shadow-claw/"]).toBe("/my-app/lib/");
    expect(map["shadow-claw/components/"]).toBe("/my-app/lib/components/");
    expect(map["shadow-claw/components/shadow-claw-element"]).toBe(
      "/my-app/lib/components/shadow-claw-element.js",
    );
    expect(map["shadow-claw/signals"]).toBe("/my-app/lib/utils/signals.js");
  });

  it("buildCdnLibImportMap generates CDN mappings preserving dist/lib/index.js", () => {
    const map = buildCdnLibImportMap(
      "https://cdn.example.com/shadow-claw@1.0.0",
    );

    expect(map["shadow-claw"]).toBe(
      "https://cdn.example.com/shadow-claw@1.0.0/dist/lib/index.js",
    );
    expect(map["shadow-claw/"]).toBe(
      "https://cdn.example.com/shadow-claw@1.0.0/",
    );
    expect(map["shadow-claw/components"]).toBe(
      "https://cdn.example.com/shadow-claw@1.0.0/dist/lib/components/index.js",
    );
    expect(map["shadow-claw/signals"]).toBe(
      "https://cdn.example.com/shadow-claw@1.0.0/dist/lib/utils/signals.js",
    );
  });

  it("collectLibEntryPaths collects non-hashed .js files and skips hashed chunks, .d.ts, and .map files", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sc-lib-entries-"));
    try {
      await mkdir(path.join(tmpDir, "components/common"), { recursive: true });
      await mkdir(path.join(tmpDir, "utils"), { recursive: true });
      await writeFile(path.join(tmpDir, "index.js"), "export {};");
      await writeFile(path.join(tmpDir, "index.d.ts"), "export {};");
      await writeFile(path.join(tmpDir, "index.js.map"), "{}");
      await writeFile(path.join(tmpDir, "chunk-Ab12Cd34.js"), "export {};");
      await writeFile(path.join(tmpDir, "effect-DL6j9HJp.js"), "export {};");
      await writeFile(
        path.join(tmpDir, "components/shadow-claw-element.js"),
        "export {};",
      );
      await writeFile(
        path.join(tmpDir, "components/common/shadow-claw-resize-handle.js"),
        "export {};",
      );
      await writeFile(path.join(tmpDir, "utils/signals.js"), "export {};");

      const entries = await collectLibEntryPaths(tmpDir);
      expect(entries).toEqual([
        "components/common/shadow-claw-resize-handle.js",
        "components/shadow-claw-element.js",
        "index.js",
        "utils/signals.js",
      ]);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('injectLibImportMap inserts before first <script type="module"> and updates idempotently', () => {
    const html = `<!doctype html><html><head><title>Test</title><script type="module" src="index.js"></script></head><body></body></html>`;
    const imports = {
      "shadow-claw": "/lib/index.js",
      "shadow-claw/signals": "/lib/utils/signals.js",
    };

    const first = injectLibImportMap(html, imports);
    const importMapIdx = first.indexOf('<script type="importmap"');
    const moduleIdx = first.indexOf('<script type="module"');
    expect(importMapIdx).toBeGreaterThan(-1);
    expect(moduleIdx).toBeGreaterThan(-1);
    expect(importMapIdx).toBeLessThan(moduleIdx);
    expect(first).toContain('data-shadow-claw-importmap="local"');
    expect(first).toContain('"shadow-claw/signals": "/lib/utils/signals.js"');

    // Calling again updates in place without duplicating
    const updated = injectLibImportMap(first, {
      "shadow-claw": "/sub/lib/index.js",
    });
    expect(updated.match(/<script type="importmap"/g)).toHaveLength(1);
    expect(updated).toContain('"shadow-claw": "/sub/lib/index.js"');
    expect(updated).not.toContain('"/lib/index.js"');
  });

  it('injectLibImportMap inserts before first <link rel="modulepreload"> in <head>', () => {
    const html = `<!doctype html><html><head><title>Test</title><link rel="modulepreload" href="index.js" /></head><body><script type="module" src="index.js"></script></body></html>`;
    const imports = {
      "shadow-claw": "/lib/index.js",
    };

    const result = injectLibImportMap(html, imports);
    const importMapIdx = result.indexOf('<script type="importmap"');
    const preloadIdx = result.indexOf('<link rel="modulepreload"');
    expect(importMapIdx).toBeGreaterThan(-1);
    expect(preloadIdx).toBeGreaterThan(-1);
    expect(importMapIdx).toBeLessThan(preloadIdx);
  });

  it("copyLibToPublic copies JS bundles and excludes .d.ts and production source maps", async () => {
    const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "sc-lib-copy-"));
    const srcLib = path.join(tmpRoot, "dist/lib");
    const destLib = path.join(tmpRoot, "dist/public/lib");

    try {
      await mkdir(path.join(srcLib, "utils"), { recursive: true });
      await writeFile(path.join(srcLib, "index.js"), "export {};");
      await writeFile(path.join(srcLib, "index.d.ts"), "export {};");
      await writeFile(path.join(srcLib, "index.d.ts.map"), "{}");
      await writeFile(path.join(srcLib, "utils/signals.js"), "export {};");
      await writeFile(path.join(srcLib, "utils/signals.js.map"), "{}");

      await copyLibToPublic(srcLib, destLib, { isProduction: true });

      const copiedJs = await readFile(
        path.join(destLib, "utils/signals.js"),
        "utf8",
      );
      expect(copiedJs).toBe("export {};");

      await expect(
        readFile(path.join(destLib, "index.d.ts"), "utf8"),
      ).rejects.toThrow();
      await expect(
        readFile(path.join(destLib, "index.d.ts.map"), "utf8"),
      ).rejects.toThrow();
      await expect(
        readFile(path.join(destLib, "utils/signals.js.map"), "utf8"),
      ).rejects.toThrow();
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
