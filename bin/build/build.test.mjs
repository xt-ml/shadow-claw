import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { jest } from "@jest/globals";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(new URL("../..", import.meta.url).pathname);

jest.setTimeout(120_000);

describe("build without and with pages", () => {
  let tempProjectRoot;

  beforeAll(async () => {
    tempProjectRoot = await mkdtemp(
      path.join(os.tmpdir(), "shadow-claw-build-"),
    );
    await cp(projectRoot, tempProjectRoot, {
      recursive: true,
      filter(source) {
        return !new Set([
          ".cache",
          ".git",
          "cache",
          "coverage",
          "database",
          "dist",
          "dist-electron",
          "e2e-results",
          "node_modules",
          "out",
        ]).has(path.basename(source));
      },
    });
    await symlink(
      path.join(projectRoot, "node_modules"),
      path.join(tempProjectRoot, "node_modules"),
      "dir",
    );
  });

  afterAll(async () => {
    await rm(tempProjectRoot, { recursive: true, force: true });
  });

  async function runBuild() {
    await execFileAsync(process.execPath, ["bin/build/build.mjs"], {
      cwd: tempProjectRoot,
      env: { ...process.env, NODE_ENV: "test" },
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  it("builds with the normal pages tree", async () => {
    await mkdir(path.join(tempProjectRoot, "skills/main/example"), {
      recursive: true,
    });
    await writeFile(
      path.join(tempProjectRoot, "skills/main/example/SKILL.md"),
      "---\nname: example\ndescription: Example skill for build tests\n---\nUse the example workflow.",
      "utf8",
    );
    await runBuild();

    const manifest = JSON.parse(
      await readFile(
        path.join(tempProjectRoot, "dist/public/static-main-manifest.json"),
        "utf8",
      ),
    );
    expect(manifest.pages.length).toBeGreaterThan(0);
    expect(manifest.skills).toEqual([
      {
        displayPath: "example/SKILL.md",
        content: expect.stringContaining("name: example"),
      },
    ]);
  });

  it("builds with no pages directory and keeps default pages", async () => {
    await rm(path.join(tempProjectRoot, "pages"), {
      recursive: true,
      force: true,
    });
    await runBuild();

    const manifest = JSON.parse(
      await readFile(
        path.join(tempProjectRoot, "dist/public/static-main-manifest.json"),
        "utf8",
      ),
    );
    expect(manifest.pages.map(({ displayPath }) => displayPath)).toEqual([
      "index.html",
      "MEMORY.md",
    ]);
    expect(
      await readFile(path.join(tempProjectRoot, "site-config.json"), "utf8"),
    ).toContain("ShadowClaw");
  });
});
