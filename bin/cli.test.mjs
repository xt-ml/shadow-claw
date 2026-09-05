import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolchainRoot = path.resolve(__dirname, "..");
const cliPath = path.join(__dirname, "cli.mjs");

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

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
    expect(stdout).toContain("Development:");
    expect(stdout).toContain("Server:");
    expect(stdout).toContain("Control Plane & Client Bridge:");
    expect(stdout).toContain("WebRTC:");
    expect(stdout).toContain("Project:");
    expect(stdout).toContain("Help & Utility:");
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

  it("groups subcommand options into logical categories in help", async () => {
    const { stdout: devHelp } = await execFileAsync(process.execPath, [
      cliPath,
      "dev",
      "--help",
    ]);
    expect(devHelp).toContain("Server & Network Options:");
    expect(devHelp).toContain("Site & Build Options:");
    expect(devHelp).toContain("Security & Proxy Options:");
    expect(devHelp).toContain("TLS / HTTPS Options:");
    expect(devHelp).toContain("Storage & Database Options:");

    const { stdout: webrtcHelp } = await execFileAsync(process.execPath, [
      cliPath,
      "webrtc",
      "--help",
    ]);
    expect(webrtcHelp).toContain("Identity Options:");
    expect(webrtcHelp).toContain("Signaling & Listener Options");
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
      path.join(targetDir, "shadow-claw-config.json"),
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

  it("does not litter .cache in working directory when launched with --tmp", async () => {
    const { spawn } = await import("node:child_process");
    const cleanDir = path.join(tempDir, "clean-tmp-project");
    await mkdir(cleanDir, { recursive: true });

    const serverPort = "19889";
    const child = spawn(
      process.execPath,
      [
        cliPath,
        "server",
        "--port",
        serverPort,
        "--content-root",
        cleanDir,
        "--tmp",
      ],
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
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for server. Output: ${output}`));
        }, 10_000);

        const check = setInterval(() => {
          if (output.includes("Services-only mode active")) {
            clearInterval(check);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });

      // Verify that cleanDir does NOT have a .cache directory
      const hasCache = await pathExists(path.join(cleanDir, ".cache"));
      expect(hasCache).toBe(false);

      // Verify that files were written to system tmpdir/shadow-claw
      const { tmpdir } = await import("node:os");
      const systemTmp = path.join(tmpdir(), "shadow-claw");
      const tmpCacheExists = await pathExists(systemTmp);
      expect(tmpCacheExists).toBe(true);
    } finally {
      child.kill("SIGTERM");
    }
  }, 15_000);

  it("stores cache and database files in custom --cache-dir without littering content root", async () => {
    const { spawn } = await import("node:child_process");
    const cleanDir = path.join(tempDir, "clean-custom-project");
    const customCache = path.join(tempDir, "my-external-cache");
    await mkdir(cleanDir, { recursive: true });

    const serverPort = "19890";
    const child = spawn(
      process.execPath,
      [
        cliPath,
        "server",
        "--port",
        serverPort,
        "--content-root",
        cleanDir,
        "--cache-dir",
        customCache,
      ],
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
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for server. Output: ${output}`));
        }, 10_000);

        const check = setInterval(() => {
          if (output.includes("Services-only mode active")) {
            clearInterval(check);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });

      // cleanDir has NO .cache directory
      const hasCache = await pathExists(path.join(cleanDir, ".cache"));
      expect(hasCache).toBe(false);

      // customCache contains the token and database
      const hasToken = await pathExists(
        path.join(customCache, "control-token.json"),
      );
      const hasDb = await pathExists(
        path.join(customCache, "database", "clients.db"),
      );
      expect(hasToken).toBe(true);
      expect(hasDb).toBe(true);
    } finally {
      child.kill("SIGTERM");
    }
  }, 15_000);

  it("reads cacheDir from shadow-claw.config.json when launching server", async () => {
    const { spawn } = await import("node:child_process");
    const projectDir = path.join(tempDir, "config-cache-project");
    await mkdir(projectDir, { recursive: true });

    await writeFile(
      path.join(projectDir, "shadow-claw.config.json"),
      JSON.stringify({ cacheDir: "my-configured-cache" }),
      "utf8",
    );

    const serverPort = "19891";
    const child = spawn(
      process.execPath,
      [cliPath, "server", "--port", serverPort, "--content-root", projectDir],
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
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for server. Output: ${output}`));
        }, 10_000);

        const check = setInterval(() => {
          if (output.includes("Services-only mode active")) {
            clearInterval(check);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });

      // Default .cache was NOT created
      const hasDefaultCache = await pathExists(path.join(projectDir, ".cache"));
      expect(hasDefaultCache).toBe(false);

      // Configured cache contains the token and database
      const configuredCache = path.join(projectDir, "my-configured-cache");
      const hasToken = await pathExists(
        path.join(configuredCache, "control-token.json"),
      );
      const hasDb = await pathExists(
        path.join(configuredCache, "database", "clients.db"),
      );
      expect(hasToken).toBe(true);
      expect(hasDb).toBe(true);
    } finally {
      child.kill("SIGTERM");
    }
  }, 15_000);

  it("reads cacheDir from legacy site-config.json for backward compatibility", async () => {
    const { spawn } = await import("node:child_process");
    const projectDir = path.join(tempDir, "legacy-config-cache-project");
    await mkdir(projectDir, { recursive: true });

    await writeFile(
      path.join(projectDir, "site-config.json"),
      JSON.stringify({ cacheDir: "legacy-cache-folder" }),
      "utf8",
    );

    const serverPort = "19892";
    const child = spawn(
      process.execPath,
      [cliPath, "server", "--port", serverPort, "--content-root", projectDir],
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
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for server. Output: ${output}`));
        }, 10_000);

        const check = setInterval(() => {
          if (output.includes("Services-only mode active")) {
            clearInterval(check);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });

      // Default .cache was NOT created
      const hasDefaultCache = await pathExists(path.join(projectDir, ".cache"));
      expect(hasDefaultCache).toBe(false);

      // Legacy configured cache contains token and database
      const legacyCache = path.join(projectDir, "legacy-cache-folder");
      const hasToken = await pathExists(
        path.join(legacyCache, "control-token.json"),
      );
      const hasDb = await pathExists(
        path.join(legacyCache, "database", "clients.db"),
      );
      expect(hasToken).toBe(true);
      expect(hasDb).toBe(true);
    } finally {
      child.kill("SIGTERM");
    }
  }, 15_000);
});
