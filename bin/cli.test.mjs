import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolchainRoot = path.resolve(__dirname, "..");
const cliPath = path.join(__dirname, "cli.mjs");

describe("shadow-claw CLI", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "shadow-claw-cli-test-"));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("outputs version with --version", async () => {
    const pkgStr = await readFile(
      path.join(toolchainRoot, "package.json"),
      "utf8",
    );
    const pkg = JSON.parse(pkgStr);

    const { stdout } = await execFileAsync(process.execPath, [
      cliPath,
      "--version",
    ]);
    expect(stdout.trim()).toBe(pkg.version);
  });

  it("outputs command help with --help", async () => {
    const { stdout } = await execFileAsync(process.execPath, [
      cliPath,
      "--help",
    ]);
    expect(stdout).toContain("Usage: shadow-claw");
    expect(stdout).toContain("build");
    expect(stdout).toContain("dev");
    expect(stdout).toContain("run");
    expect(stdout).toContain("serve");
    expect(stdout).toContain("init");
  });

  it("initializes a new template with init command", async () => {
    const targetDir = path.join(tempDir, "my-template");
    await execFileAsync(process.execPath, [cliPath, "init", targetDir]);

    const siteConfigStr = await readFile(
      path.join(targetDir, "site-config.json"),
      "utf8",
    );
    expect(siteConfigStr).toContain("My ShadowClaw Site");

    const indexHtmlStr = await readFile(
      path.join(targetDir, "pages/main/index.html"),
      "utf8",
    );
    expect(indexHtmlStr).toContain("Welcome to ShadowClaw");

    const gitignoreStr = await readFile(
      path.join(targetDir, ".gitignore"),
      "utf8",
    );
    expect(gitignoreStr).toContain("dist/");
  });

  it("builds a template content root to dist/public", async () => {
    const targetDir = path.join(tempDir, "test-site");
    await mkdir(path.join(targetDir, "pages/main"), { recursive: true });
    await writeFile(
      path.join(targetDir, "site-config.json"),
      JSON.stringify({
        site: { title: "Custom Test Hub" },
        branding: { titleText: "Custom Test Hub" },
      }),
      "utf8",
    );
    await writeFile(
      path.join(targetDir, "pages/main/index.html"),
      `---
title: "Custom Test Page"
created: "2026-01-01T00:00:00Z"
slug: "custom-test"
---
<article><h1>Hello from Custom Test</h1></article>`,
      "utf8",
    );

    await execFileAsync(process.execPath, [
      cliPath,
      "build",
      "--content-root",
      targetDir,
    ]);

    const builtIndexHtml = await readFile(
      path.join(targetDir, "dist/public/index.html"),
      "utf8",
    );
    expect(builtIndexHtml).toContain("Custom Test Hub");
    expect(builtIndexHtml).toContain("Hello from Custom Test");
  }, 30_000);
});
