import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "@jest/globals";

import {
  collectPrecacheShellChunks,
  extractDynamicLocalJsImports,
  extractStaticLocalJsImports,
  isExcludedPrecacheChunk,
  isHashedJsChunk,
} from "./collect-precache-shell-chunks.js";

describe("collectPrecacheShellChunks", () => {
  const tempDirs: string[] = [];

  async function createTempDist(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sc-collect-chunks-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("identifies top-level Rolldown hashed JS chunks while ignoring workbox bundles and subpath scripts", () => {
    expect(isHashedJsChunk("shadow-claw-BMxsR6dl.js")).toBe(true);
    expect(isHashedJsChunk("/custom_chunk-aB3_dE-9.js")).toBe(true);
    expect(isHashedJsChunk("workbox-e4022e15.js")).toBe(false);
    expect(isHashedJsChunk("index.js")).toBe(false);
    expect(isHashedJsChunk("assets/shadow-claw-BMxsR6dl.js")).toBe(false);
    expect(isHashedJsChunk(".agents/scripts/scdaw-recorder.js")).toBe(false);
  });

  it("excludes heavy, worker, and workbox chunks from precaching", () => {
    expect(isExcludedPrecacheChunk("webllm-C-1-BIAR.js")).toBe(true);
    expect(isExcludedPrecacheChunk("transformers-DnF9S860.js")).toBe(true);
    expect(isExcludedPrecacheChunk("pdf.worker.js")).toBe(true);
    expect(isExcludedPrecacheChunk("agent.worker.js")).toBe(true);
    expect(isExcludedPrecacheChunk("transformers-js.worker.js")).toBe(true);
    expect(isExcludedPrecacheChunk("workbox-e4022e15.js")).toBe(true);
    expect(isExcludedPrecacheChunk("shadow-claw-pdf-viewer-Dvv3J54L.js")).toBe(
      true,
    );
    expect(isExcludedPrecacheChunk("shadow-claw-terminal-lUjkkJvP.js")).toBe(
      true,
    );
    expect(isExcludedPrecacheChunk("v86-core-AbCdEf12.js")).toBe(true);

    expect(isExcludedPrecacheChunk("shadow-claw-BMxsR6dl.js")).toBe(false);
    expect(isExcludedPrecacheChunk("shadow-claw-chat-iwjLtwb7.js")).toBe(false);
  });

  it("extracts unique static and dynamic local JS imports from both minified and formatted ESM", () => {
    const source = `
      import { T as install } from "./custom-element-security-DMTp2Ruy.js";
      import{a as b,c}from"./foo-12345678.js";
      import "./bar-ABCDEFGH.js";
      export { x } from "./baz-aB3_dE-9.js";
      export*from"./qux-00001111.js";
      export * from "./foo-12345678.js";
      const shell = await import("./shadow-claw-BMxsR6dl.js");
      const minShell = await import(\`./shadow-claw-DaxuU1bn.js\`);
      const chat = import( "./shadow-claw-chat-iwjLtwb7.js" );
      const dup = import("./shadow-claw-chat-iwjLtwb7.js");
    `;

    expect(extractStaticLocalJsImports(source)).toEqual([
      "custom-element-security-DMTp2Ruy.js",
      "foo-12345678.js",
      "bar-ABCDEFGH.js",
      "baz-aB3_dE-9.js",
      "qux-00001111.js",
    ]);

    expect(extractDynamicLocalJsImports(source)).toEqual([
      "shadow-claw-BMxsR6dl.js",
      "shadow-claw-DaxuU1bn.js",
      "shadow-claw-chat-iwjLtwb7.js",
    ]);
  });

  it("returns an empty array when index.js is absent", async () => {
    const distDir = await createTempDist();
    expect(await collectPrecacheShellChunks(distDir)).toEqual([]);
  });

  it("walks transitive static imports and dynamic imports from core shell, settings, and pages roots", async () => {
    const distDir = await createTempDist();

    await writeFile(
      path.join(distDir, "index.js"),
      `import { a } from "./boot-helper-Aa11Bb22.js";
       import "./missing-file-12345678.js";
       async function loadAppShell() { await import("./shadow-claw-BMxsR6dl.js"); }`,
      "utf8",
    );

    // Circular static import between boot-helper and shared-util
    await writeFile(
      path.join(distDir, "boot-helper-Aa11Bb22.js"),
      `import{u}from"./shared-util-Cc33Dd44.js";export const a = u;`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "shared-util-Cc33Dd44.js"),
      `import { a } from "./boot-helper-Aa11Bb22.js"; export const u = 1;`,
      "utf8",
    );

    // Shell root: dynamic imports for orchestrator, sidebar tabs, and excluded terminal
    await writeFile(
      path.join(distDir, "shadow-claw-BMxsR6dl.js"),
      `import "./shell-dep-Ee55Ff66.js";
       const loaders = {
         pages: () => import("./shadow-claw-pages-D7CCkze3.js"),
         chat: () => import("./shadow-claw-chat-iwjLtwb7.js"),
         settings: () => import("./shadow-claw-settings-Dt6nG327.js"),
         fileViewer: () => import("./shadow-claw-file-viewer-C1cWZsai.js"),
         terminal: () => import("./shadow-claw-terminal-lUjkkJvP.js"),
       };
       const { Orchestrator } = await import("./orchestrator-DwMXKSE3.js");`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "shell-dep-Ee55Ff66.js"),
      "export const dep = true;",
      "utf8",
    );

    // Pages root: dynamic import of markdown should be included
    await writeFile(
      path.join(distDir, "shadow-claw-pages-D7CCkze3.js"),
      `const { renderMd } = await import("./markdown-Dv1sfNwq.js");`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "markdown-Dv1sfNwq.js"),
      `import "./markdown-helper-Gg77Hh88.js";`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "markdown-helper-Gg77Hh88.js"),
      "export const h = 1;",
      "utf8",
    );

    // Settings root: dynamic import of settings sub-panel should be included
    await writeFile(
      path.join(distDir, "shadow-claw-settings-Dt6nG327.js"),
      `import("./shadow-claw-llm-CFi3QXIo.js");`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "shadow-claw-llm-CFi3QXIo.js"),
      `import "./llm-shared-Ii99Jj00.js";`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "llm-shared-Ii99Jj00.js"),
      "export const l = 1;",
      "utf8",
    );

    // Non-root chat chunk: static import included, dynamic import of heavy chunk NOT followed
    await writeFile(
      path.join(distDir, "shadow-claw-chat-iwjLtwb7.js"),
      `import "./chat-helper-Kk11Ll22.js";
       const loadHeavy = () => import("./webllm-C-1-BIAR.js");`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "chat-helper-Kk11Ll22.js"),
      "export const c = 1;",
      "utf8",
    );

    // Non-root file-viewer chunk: dynamic import of pdf-viewer NOT followed
    await writeFile(
      path.join(distDir, "shadow-claw-file-viewer-C1cWZsai.js"),
      `import("./shadow-claw-pdf-viewer-Dvv3J54L.js");`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "shadow-claw-pdf-viewer-Dvv3J54L.js"),
      `import "./pdf-only-helper-Mm33Nn44.js";`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "pdf-only-helper-Mm33Nn44.js"),
      "export const p = 1;",
      "utf8",
    );

    // Non-root orchestrator chunk: dynamic import of execute-tool NOT followed
    await writeFile(
      path.join(distDir, "orchestrator-DwMXKSE3.js"),
      `import "./orch-static-Oo55Pp66.js";
       async function run() { return import("./execute-tool-9EpeDorK.js"); }`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "orch-static-Oo55Pp66.js"),
      "export const o = 1;",
      "utf8",
    );
    await writeFile(
      path.join(distDir, "execute-tool-9EpeDorK.js"),
      `import "./tool-only-helper-Qq77Rr88.js";`,
      "utf8",
    );
    await writeFile(
      path.join(distDir, "tool-only-helper-Qq77Rr88.js"),
      "export const t = 1;",
      "utf8",
    );

    // Excluded files sitting on disk
    await writeFile(
      path.join(distDir, "shadow-claw-terminal-lUjkkJvP.js"),
      "export const term = 1;",
      "utf8",
    );
    await writeFile(
      path.join(distDir, "webllm-C-1-BIAR.js"),
      "export const w = 1;",
      "utf8",
    );
    await writeFile(
      path.join(distDir, "agent.worker.js"),
      "export const aw = 1;",
      "utf8",
    );
    await writeFile(
      path.join(distDir, "workbox-e4022e15.js"),
      "export const wb = 1;",
      "utf8",
    );

    // Subdirectory JS should never be included via ./filename.js
    await mkdir(path.join(distDir, "sub"), { recursive: true });
    await writeFile(
      path.join(distDir, "sub/nested-12345678.js"),
      "export const n = 1;",
      "utf8",
    );

    const chunks = await collectPrecacheShellChunks(distDir);

    expect(chunks).toEqual([
      "boot-helper-Aa11Bb22.js",
      "chat-helper-Kk11Ll22.js",
      "llm-shared-Ii99Jj00.js",
      "markdown-Dv1sfNwq.js",
      "markdown-helper-Gg77Hh88.js",
      "orch-static-Oo55Pp66.js",
      "orchestrator-DwMXKSE3.js",
      "shadow-claw-BMxsR6dl.js",
      "shadow-claw-chat-iwjLtwb7.js",
      "shadow-claw-file-viewer-C1cWZsai.js",
      "shadow-claw-llm-CFi3QXIo.js",
      "shadow-claw-pages-D7CCkze3.js",
      "shadow-claw-settings-Dt6nG327.js",
      "shared-util-Cc33Dd44.js",
      "shell-dep-Ee55Ff66.js",
    ]);
  });
});
