import crypto from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "@jest/globals";

import {
  computeDistWorkspaceDigest,
  syncServiceWorkerPrecacheRevisions,
} from "./sync-service-worker-precache.js";

function md5(content: string | Buffer): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

function extractPrecacheEntries(swSource: string): Array<{
  url: string;
  revision: string | null;
}> {
  const match = swSource.match(
    /precacheAndRoute\((\[[\s\S]*?\])(?:\s*,|\s*\))/,
  );
  if (!match) {
    throw new Error("Missing precacheAndRoute in service worker");
  }
  return JSON.parse(match[1]);
}

describe("syncServiceWorkerPrecacheRevisions", () => {
  const tempDirs: string[] = [];

  async function createTempDist(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sc-sw-sync-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rewrites precacheAndRoute entries with actual MD5 hashes of files in distPublicDir", async () => {
    const distDir = await createTempDist();
    await mkdir(path.join(distDir, "assets/icons"), { recursive: true });

    const indexContent = "<html><body>Updated DAW</body></html>";
    const notFoundContent = "<html><body>404</body></html>";
    const manifestContent = '{"name":"ShadowClaw DAW"}';
    const iconBytes = Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]);

    await writeFile(path.join(distDir, "index.html"), indexContent, "utf8");
    await writeFile(path.join(distDir, "404.html"), notFoundContent, "utf8");
    await writeFile(
      path.join(distDir, "manifest.json"),
      manifestContent,
      "utf8",
    );
    await writeFile(path.join(distDir, "assets/icons/96.png"), iconBytes);

    // Workbox emits unquoted JS object keys in precacheAndRoute([...])
    const swSource =
      'define(["./workbox-123"],function(e){e.precacheAndRoute([' +
      '{url:"index.html",revision:"stale_index_rev"},' +
      '{url:"404.html",revision:"stale_404_rev"},' +
      '{url:"manifest.json",revision:"stale_manifest_rev"},' +
      '{url:"assets/icons/96.png",revision:"stale_icon_rev"}' +
      "],{})});";
    const swPath = path.join(distDir, "service-worker.js");
    await writeFile(swPath, swSource, "utf8");

    const updated = await syncServiceWorkerPrecacheRevisions(distDir);
    expect(updated).toBe(true);

    const nextSw = await readFile(swPath, "utf8");
    const entries = extractPrecacheEntries(nextSw);
    expect(entries).toEqual([
      { url: "index.html", revision: md5(indexContent) },
      { url: "404.html", revision: md5(notFoundContent) },
      { url: "manifest.json", revision: md5(manifestContent) },
      { url: "assets/icons/96.png", revision: md5(iconBytes) },
    ]);
  });

  it("changes index.html precache revision when .agents/scripts/ or static-main-manifest.json change", async () => {
    const distDir = await createTempDist();
    await mkdir(path.join(distDir, ".agents/scripts/components"), {
      recursive: true,
    });
    await writeFile(
      path.join(distDir, "index.html"),
      "<html>v1</html>",
      "utf8",
    );
    await writeFile(
      path.join(distDir, ".agents/scripts/components/scdaw-synth.js"),
      "export const v = 1;",
      "utf8",
    );
    await writeFile(
      path.join(distDir, "static-main-manifest.json"),
      '{"pages":[{"displayPath":"index.html"}]}',
      "utf8",
    );

    const baseSw =
      'define(["./workbox-123"],function(e){e.precacheAndRoute([{url:"index.html",revision:"old"}],{})});';
    const swPath = path.join(distDir, "service-worker.js");
    await writeFile(swPath, baseSw, "utf8");

    await syncServiceWorkerPrecacheRevisions(distDir);
    const rev1 = extractPrecacheEntries(await readFile(swPath, "utf8"))[0]
      .revision;
    const digest1 = await computeDistWorkspaceDigest(distDir);
    expect(digest1).not.toBe("");

    // Modify script without changing index.html
    await writeFile(
      path.join(distDir, ".agents/scripts/components/scdaw-synth.js"),
      "export const v = 2;",
      "utf8",
    );
    await syncServiceWorkerPrecacheRevisions(distDir);
    const rev2 = extractPrecacheEntries(await readFile(swPath, "utf8"))[0]
      .revision;
    expect(rev2).not.toBe(rev1);

    // Modify static-main-manifest.json without changing index.html or scripts
    await writeFile(
      path.join(distDir, "static-main-manifest.json"),
      '{"pages":[{"displayPath":"index.html"},{"displayPath":"synth.md"}]}',
      "utf8",
    );
    await syncServiceWorkerPrecacheRevisions(distDir);
    const rev3 = extractPrecacheEntries(await readFile(swPath, "utf8"))[0]
      .revision;
    expect(rev3).not.toBe(rev2);
  });

  it("removes precache entries whose target files do not exist in distPublicDir", async () => {
    const distDir = await createTempDist();
    await writeFile(
      path.join(distDir, "index.html"),
      "<html>ok</html>",
      "utf8",
    );
    const swPath = path.join(distDir, "service-worker.js");
    await writeFile(
      swPath,
      'e.precacheAndRoute([{url:"index.html",revision:"old"},{url:"missing-asset.png",revision:"abc"}],{})',
      "utf8",
    );

    const updated = await syncServiceWorkerPrecacheRevisions(distDir);
    expect(updated).toBe(true);

    const entries = extractPrecacheEntries(await readFile(swPath, "utf8"));
    expect(entries).toEqual([
      { url: "index.html", revision: md5("<html>ok</html>") },
    ]);
  });

  it("returns false without throwing when service-worker.js is missing or has no precacheAndRoute", async () => {
    const distDir = await createTempDist();
    expect(await syncServiceWorkerPrecacheRevisions(distDir)).toBe(false);

    const swPath = path.join(distDir, "service-worker.js");
    await writeFile(swPath, "// custom worker without precache", "utf8");
    expect(await syncServiceWorkerPrecacheRevisions(distDir, swPath)).toBe(
      false,
    );
  });
});
