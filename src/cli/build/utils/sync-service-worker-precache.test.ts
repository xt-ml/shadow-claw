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

  it("merges core shell/sidebar/settings chunks with revision null, drops stale chunks, stamps index revision, and is idempotent", async () => {
    const distDir = await createTempDist();
    await mkdir(path.join(distDir, ".agents/scripts"), { recursive: true });

    const indexHtml = "<html><body>DAW</body></html>";
    await writeFile(path.join(distDir, "index.html"), indexHtml, "utf8");
    await writeFile(
      path.join(distDir, "index.js"),
      `import "./boot-Aa11Bb22.js"; import("./shadow-claw-BMxsR6dl.js");`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "boot-Aa11Bb22.js"),
      "export const b = 1;",
      "utf8",
    );
    await writeFile(
      path.join(distDir, "shadow-claw-BMxsR6dl.js"),
      `const tabs = { chat: () => import("./shadow-claw-chat-iwjLtwb7.js"), settings: () => import("./shadow-claw-settings-Dt6nG327.js") };`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "shadow-claw-chat-iwjLtwb7.js"),
      `const heavy = () => import("./webllm-C-1-BIAR.js");`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "shadow-claw-settings-Dt6nG327.js"),
      `import("./shadow-claw-llm-CFi3QXIo.js");`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "shadow-claw-llm-CFi3QXIo.js"),
      "export const llm = 1;",
      "utf8",
    );
    await writeFile(
      path.join(distDir, "webllm-C-1-BIAR.js"),
      "export const heavy = 1;",
      "utf8",
    );
    await writeFile(
      path.join(distDir, "agent.worker.js"),
      "export const worker = 1;",
      "utf8",
    );
    await writeFile(
      path.join(distDir, ".agents/scripts/scdaw-synth.js"),
      "export const v = 1;",
      "utf8",
    );

    const swPath = path.join(distDir, "service-worker.js");
    await writeFile(
      swPath,
      'define(["./workbox-123"],function(e){e.precacheAndRoute([{url:"index.html",revision:"old"},{url:"index.js",revision:"oldjs"},{url:"stale-chunk-Zz99Yy88.js",revision:null}],{})});',
      "utf8",
    );

    expect(await syncServiceWorkerPrecacheRevisions(distDir, swPath)).toBe(
      true,
    );

    const swAfterFirstSync = await readFile(swPath, "utf8");
    const entries = extractPrecacheEntries(swAfterFirstSync);
    const digest = await computeDistWorkspaceDigest(distDir);
    const expectedIndexRev = crypto
      .createHash("md5")
      .update(indexHtml)
      .update(digest)
      .digest("hex");

    expect(entries).toEqual([
      { url: "index.html", revision: expectedIndexRev },
      {
        url: "index.js",
        revision: md5(
          `import "./boot-Aa11Bb22.js"; import("./shadow-claw-BMxsR6dl.js");`,
        ),
      },
      { url: "boot-Aa11Bb22.js", revision: null },
      { url: "shadow-claw-BMxsR6dl.js", revision: null },
      { url: "shadow-claw-chat-iwjLtwb7.js", revision: null },
      { url: "shadow-claw-llm-CFi3QXIo.js", revision: null },
      { url: "shadow-claw-settings-Dt6nG327.js", revision: null },
    ]);
    expect(swAfterFirstSync).toContain(
      `self.__SHADOWCLAW_PRECACHE_INDEX_REVISION__="${expectedIndexRev}";`,
    );

    // Second run on unchanged dist must be idempotent
    expect(await syncServiceWorkerPrecacheRevisions(distDir, swPath)).toBe(
      false,
    );
    expect(await readFile(swPath, "utf8")).toBe(swAfterFirstSync);

    // Updating a workspace script updates __SHADOWCLAW_PRECACHE_INDEX_REVISION__ in place
    await writeFile(
      path.join(distDir, ".agents/scripts/scdaw-synth.js"),
      "export const v = 2;",
      "utf8",
    );
    expect(await syncServiceWorkerPrecacheRevisions(distDir, swPath)).toBe(
      true,
    );
    const swAfterScriptUpdate = await readFile(swPath, "utf8");
    const updatedDigest = await computeDistWorkspaceDigest(distDir);
    const updatedIndexRev = crypto
      .createHash("md5")
      .update(indexHtml)
      .update(updatedDigest)
      .digest("hex");
    expect(swAfterScriptUpdate).toContain(
      `self.__SHADOWCLAW_PRECACHE_INDEX_REVISION__="${updatedIndexRev}";`,
    );
    expect(
      swAfterScriptUpdate.match(/__SHADOWCLAW_PRECACHE_INDEX_REVISION__/g)
        ?.length,
    ).toBe(1);
  });
});
