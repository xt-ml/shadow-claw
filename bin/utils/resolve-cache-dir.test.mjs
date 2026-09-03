import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";

import {
  detectExistingCache,
  getSystemTmpCacheDir,
  promptForCacheDir,
  readConfigFileCacheDir,
  resolveCacheDir,
} from "./resolve-cache-dir.mjs";

describe("resolve-cache-dir utility", () => {
  let tempDir;

  let savedCI;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "shadow-claw-test-cache-"));
    savedCI = process.env.CI;
    delete process.env.SHADOWCLAW_TMP;
    delete process.env.SHADOWCLAW_TEMP;
    delete process.env.SHADOWCLAW_CACHE_DIR;
    delete process.env.SHADOWCLAW_DATABASE_DIR;
    delete process.env.SHADOWCLAW_YES;
  });

  afterEach(async () => {
    if (savedCI !== undefined) {
      process.env.CI = savedCI;
    } else {
      delete process.env.CI;
    }
    delete process.env.SHADOWCLAW_TMP;
    delete process.env.SHADOWCLAW_TEMP;
    delete process.env.SHADOWCLAW_CACHE_DIR;
    delete process.env.SHADOWCLAW_DATABASE_DIR;
    delete process.env.SHADOWCLAW_YES;
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("returns system tmp cache dir via getSystemTmpCacheDir", () => {
    expect(getSystemTmpCacheDir()).toBe(path.join(tmpdir(), "shadow-claw"));
  });

  it("detects existing .cache directory and files", async () => {
    expect(detectExistingCache(tempDir)).toBe(false);

    const cacheDir = path.join(tempDir, ".cache");
    await fs.mkdir(cacheDir, { recursive: true });
    expect(detectExistingCache(tempDir)).toBe(true);
  });

  it("reads cacheDir from native shadow-claw.config.json", async () => {
    const configPath = path.join(tempDir, "shadow-claw.config.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({ cacheDir: ".my-custom-cache" }),
      "utf8",
    );

    const resolved = readConfigFileCacheDir(tempDir);
    expect(resolved).toBe(path.resolve(tempDir, ".my-custom-cache"));

    const result = await resolveCacheDir({ contentRoot: tempDir });
    expect(result.cacheDir).toBe(path.resolve(tempDir, ".my-custom-cache"));
    expect(result.databaseDir).toBe(
      path.join(path.resolve(tempDir, ".my-custom-cache"), "database"),
    );
  });

  it("reads server.cacheDir from shadow-claw.config.json", async () => {
    const configPath = path.join(tempDir, "shadow-claw.config.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({ server: { cacheDir: "/var/tmp/sc-cache" } }),
      "utf8",
    );

    const resolved = readConfigFileCacheDir(tempDir);
    expect(resolved).toBe(path.resolve("/var/tmp/sc-cache"));
  });

  it("falls back to legacy site-config.json for backward compatibility", async () => {
    const siteConfigPath = path.join(tempDir, "site-config.json");
    await fs.writeFile(
      siteConfigPath,
      JSON.stringify({ cacheDir: ".legacy-cache" }),
      "utf8",
    );

    const resolved = readConfigFileCacheDir(tempDir);
    expect(resolved).toBe(path.resolve(tempDir, ".legacy-cache"));
  });

  it("respects explicit --tmp option", async () => {
    const result = await resolveCacheDir({
      contentRoot: tempDir,
      tmp: true,
    });
    expect(result.cacheDir).toBe(path.join(tmpdir(), "shadow-claw"));
    expect(result.databaseDir).toBe(
      path.join(tmpdir(), "shadow-claw", "database"),
    );
  });

  it("respects SHADOWCLAW_TMP environment variable", async () => {
    process.env.SHADOWCLAW_TMP = "1";
    const result = await resolveCacheDir({
      contentRoot: tempDir,
    });
    expect(result.cacheDir).toBe(path.join(tmpdir(), "shadow-claw"));
  });

  it("respects explicit --cache-dir option", async () => {
    const result = await resolveCacheDir({
      contentRoot: tempDir,
      cacheDir: "custom/cache/dir",
    });
    expect(result.cacheDir).toBe(path.resolve(tempDir, "custom/cache/dir"));
    expect(result.databaseDir).toBe(
      path.resolve(tempDir, "custom/cache/dir/database"),
    );
  });

  it("respects SHADOWCLAW_CACHE_DIR environment variable", async () => {
    process.env.SHADOWCLAW_CACHE_DIR = "/opt/custom-cache";
    const result = await resolveCacheDir({
      contentRoot: tempDir,
    });
    expect(result.cacheDir).toBe(path.resolve("/opt/custom-cache"));
    expect(result.databaseDir).toBe(path.resolve("/opt/custom-cache/database"));
  });

  it("uses .cache without prompting when .cache already exists", async () => {
    await fs.mkdir(path.join(tempDir, ".cache"), { recursive: true });

    const result = await resolveCacheDir({
      contentRoot: tempDir,
      isTTY: true,
    });
    expect(result.cacheDir).toBe(path.join(tempDir, ".cache"));
    expect(result.databaseDir).toBe(path.join(tempDir, ".cache", "database"));
  });

  it("uses .cache without prompting when --yes is specified", async () => {
    const result = await resolveCacheDir({
      contentRoot: tempDir,
      yes: true,
      isTTY: true,
    });
    expect(result.cacheDir).toBe(path.join(tempDir, ".cache"));
  });

  it("uses .cache safely in non-interactive / non-TTY mode", async () => {
    const result = await resolveCacheDir({
      contentRoot: tempDir,
      isTTY: false,
    });
    expect(result.cacheDir).toBe(path.join(tempDir, ".cache"));
  });

  it("uses .cache safely when isCI is explicitly enabled", async () => {
    const result = await resolveCacheDir({
      contentRoot: tempDir,
      isCI: true,
      isTTY: true,
    });
    expect(result.cacheDir).toBe(path.join(tempDir, ".cache"));
  });

  it("uses .cache safely when CI environment variable is set and isTTY is not forced", async () => {
    process.env.CI = "true";
    const result = await resolveCacheDir({
      contentRoot: tempDir,
      isTTY: false,
    });
    expect(result.cacheDir).toBe(path.join(tempDir, ".cache"));
  });

  it("prompts user and selects current directory (choice 1) on empty input", async () => {
    const stdin = Readable.from(["\n"]);
    let output = "";
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    const result = await resolveCacheDir({
      contentRoot: tempDir,
      isTTY: true,
      stdin,
      stdout,
    });

    expect(output).toContain("Where would you like to store these files?");
    expect(output).toContain("Using current directory cache");
    expect(result.cacheDir).toBe(path.join(tempDir, ".cache"));
  });

  it("prompts user and selects temporary directory (choice 2)", async () => {
    const stdin = Readable.from(["2\n"]);
    let output = "";
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    const result = await resolveCacheDir({
      contentRoot: tempDir,
      isTTY: true,
      stdin,
      stdout,
    });

    expect(output).toContain("Using temporary directory");
    expect(result.cacheDir).toBe(path.join(tmpdir(), "shadow-claw"));
    expect(result.databaseDir).toBe(
      path.join(tmpdir(), "shadow-claw", "database"),
    );
  });

  it("prompts user and selects custom path (choice 3)", async () => {
    const { PassThrough } = await import("node:stream");
    const stdin = new PassThrough();
    let output = "";
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    const promise = resolveCacheDir({
      contentRoot: tempDir,
      isTTY: true,
      stdin,
      stdout,
    });

    stdin.write("3\n");
    setTimeout(() => {
      stdin.write("my-custom-subfolder\n");
    }, 20);

    const result = await promise;

    expect(output).toContain("Using custom directory");
    expect(result.cacheDir).toBe(path.join(tempDir, "my-custom-subfolder"));
    expect(result.databaseDir).toBe(
      path.join(tempDir, "my-custom-subfolder", "database"),
    );
  });

  it("accepts direct path typed into the choice prompt", async () => {
    const stdin = Readable.from(["/tmp/direct-cache-path\n"]);
    let output = "";
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    const result = await resolveCacheDir({
      contentRoot: tempDir,
      isTTY: true,
      stdin,
      stdout,
    });

    expect(output).toContain("Using directory: /tmp/direct-cache-path");
    expect(result.cacheDir).toBe("/tmp/direct-cache-path");
  });

  it("displays the skip prompt tip upfront with env vars and flags", async () => {
    const stdin = Readable.from(["1\n"]);
    let output = "";
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    await resolveCacheDir({
      contentRoot: tempDir,
      isTTY: true,
      stdin,
      stdout,
    });

    expect(output).toContain(
      'Tip: You can pass --tmp, --cache-dir <dir>, set SHADOWCLAW_TMP=1, SHADOWCLAW_CACHE_DIR=<dir>, or configure "cacheDir" in shadow-claw.config.json to skip this prompt.',
    );
  });

  it("handles SIGINT gracefully when user presses Ctrl+C during prompt", async () => {
    const { PassThrough } = await import("node:stream");
    const stdin = new PassThrough();
    let output = "";
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    let exitCode = null;
    const onExit = (code) => {
      exitCode = code;
    };

    const promise = promptForCacheDir({
      contentRoot: tempDir,
      stdin,
      stdout,
      onExit,
    });

    // Simulate SIGINT via stream
    stdin.emit("SIGINT");

    // Wait a tick
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(exitCode).toBe(130);
    expect(output).toContain("Operation cancelled.");
  });
});
