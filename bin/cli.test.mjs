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
    expect(stdout).toContain("server");
    expect(stdout).toContain("init");
    expect(stdout).toContain("clients");
    expect(stdout).toContain("send");
    expect(stdout).toContain("backup");
    expect(stdout).toContain("tasks");
    expect(stdout).toContain("peer-id");
    expect(stdout).toContain("webrtc");
    expect(stdout).toContain("mcp");
  });

  it("outputs server command help with server --help and aliases", async () => {
    const { stdout: outServer } = await execFileAsync(process.execPath, [
      cliPath,
      "server",
      "--help",
    ]);
    expect(outServer).toContain("Usage: shadow-claw server");
    expect(outServer).toContain("services");
    expect(outServer).toContain("api");

    const { stdout: outServices } = await execFileAsync(process.execPath, [
      cliPath,
      "services",
      "--help",
    ]);
    expect(outServices).toContain("Usage: shadow-claw server");

    const { stdout: outApi } = await execFileAsync(process.execPath, [
      cliPath,
      "api",
      "--help",
    ]);
    expect(outApi).toContain("Usage: shadow-claw server");

    const { stdout: outServe } = await execFileAsync(process.execPath, [
      cliPath,
      "serve",
      "--help",
    ]);
    expect(outServe).toContain("--no-static");
  });

  it("outputs MCP command help with mcp --help", async () => {
    const { stdout } = await execFileAsync(process.execPath, [
      cliPath,
      "mcp",
      "--help",
    ]);
    expect(stdout).toContain("Usage: shadow-claw mcp");
    expect(stdout).toContain("--mcp-transport");
    expect(stdout).toContain("--relay-client-tools");
  });

  it("executes mcp server in stdio mode and handles JSON-RPC discovery", async () => {
    const { spawn } = await import("node:child_process");
    const child = spawn(process.execPath, [cliPath, "mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    const discoverRequest =
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
      }) + "\n";

    child.stdin.write(discoverRequest);

    // Wait for response line
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(
          new Error("Timeout waiting for MCP response from child process"),
        );
      }, 5000);

      const check = setInterval(() => {
        if (output.includes("\n")) {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
      }, 50);
    });

    child.stdin.end();
    child.kill();

    const line = output.trim().split("\n")[0];
    const parsed = JSON.parse(line);
    expect(parsed.jsonrpc).toBe("2.0");
    expect(parsed.id).toBe(1);
    expect(parsed.result.protocolVersion).toBe("2026-07-28");
    expect(parsed.result.serverInfo.name).toBe("shadow-claw");
  });

  it("manages WebRTC CLI peer ID with peer-id command", async () => {
    const cacheDir = path.join(tempDir, ".cache");

    // 1. Get/generate new peer ID
    const { stdout: out1 } = await execFileAsync(process.execPath, [
      cliPath,
      "peer-id",
      "--cache-dir",
      cacheDir,
      "--json",
    ]);
    const json1 = JSON.parse(out1);
    expect(json1.peerId).toMatch(/^cli-[0-9a-z]+$/);
    expect(json1.renewed).toBe(true);

    // 2. Subsequent call returns existing peer ID
    const { stdout: out2 } = await execFileAsync(process.execPath, [
      cliPath,
      "peer-id",
      "--cache-dir",
      cacheDir,
      "-q",
    ]);
    expect(out2.trim()).toBe(json1.peerId);

    // 3. Renew peer ID
    const { stdout: out3 } = await execFileAsync(process.execPath, [
      cliPath,
      "peer-id",
      "--renew",
      "--cache-dir",
      cacheDir,
      "--json",
    ]);
    const json3 = JSON.parse(out3);
    expect(json3.peerId).not.toBe(json1.peerId);
    expect(json3.renewed).toBe(true);

    // 4. Set custom peer ID
    const { stdout: out4 } = await execFileAsync(process.execPath, [
      cliPath,
      "peer-id",
      "--set",
      "my-custom-cli-peer",
      "--cache-dir",
      cacheDir,
      "-q",
    ]);
    expect(out4.trim()).toBe("my-custom-cli-peer");

    const saved = await readFile(path.join(cacheDir, "cli-peer-id"), "utf8");
    expect(saved.trim()).toBe("my-custom-cli-peer");
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

  it("launches headless services with server command without requiring a dist folder", async () => {
    const { spawn } = await import("node:child_process");
    const http = (await import("node:http")).default;
    const headlessDir = path.join(tempDir, "no-dist-project");
    await mkdir(headlessDir, { recursive: true });

    const serverPort = "19888";
    const child = spawn(
      process.execPath,
      [cliPath, "server", "--port", serverPort, "--content-root", headlessDir],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    try {
      // Wait for server ready message
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timeout waiting for server to start. Output so far: ${output}`,
            ),
          );
        }, 10_000);

        const check = setInterval(() => {
          if (output.includes("Services-only mode active")) {
            clearInterval(check);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });

      expect(output).toContain("Services-only mode active");
      expect(output).toContain(
        `Server running at http://127.0.0.1:${serverPort}`,
      );

      // Verify GET / returns 404
      const getRes = await new Promise((resolve, reject) => {
        http
          .get(`http://127.0.0.1:${serverPort}/`, (res) => {
            let body = "";
            res.on("data", (c) => (body += c));
            res.on("end", () => resolve({ status: res.statusCode, body }));
          })
          .on("error", reject);
      });

      expect(getRes.status).toBe(404);
      expect(JSON.parse(getRes.body)).toEqual({ error: "Not found" });

      // Verify POST /mcp endpoint responds
      const mcpRes = await new Promise((resolve, reject) => {
        const req = http.request(
          `http://127.0.0.1:${serverPort}/mcp`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "MCP-Protocol-Version": "2026-07-28",
            },
          },
          (res) => {
            let body = "";
            res.on("data", (c) => (body += c));
            res.on("end", () => resolve({ status: res.statusCode, body }));
          },
        );
        req.on("error", reject);
        req.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "server/discover",
          }),
        );
        req.end();
      });

      expect(mcpRes.status).toBe(200);
      const mcpData = JSON.parse(mcpRes.body);
      expect(mcpData.result.serverInfo.name).toBe("shadow-claw");
    } finally {
      child.kill("SIGTERM");
    }
  }, 15_000);
});
