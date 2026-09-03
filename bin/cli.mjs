#!/usr/bin/env node

import { exec } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

import { runBuild } from "./build/build.mjs";
import { runClientsCommand } from "./commands/clients.mjs";
import { runSendCommand } from "./commands/send.mjs";
import { runBackupCommand } from "./commands/backup.mjs";
import { runTasksCommand } from "./commands/tasks.mjs";
import { runPeerIdCommand } from "./commands/peer-id.mjs";
import { runWebRtcListenCommand } from "./commands/webrtc-listen.mjs";
import { runMcpCommand } from "./commands/mcp.mjs";
import { resolveCacheDir } from "./utils/resolve-cache-dir.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolchainRoot = path.resolve(__dirname, "..");

async function getPackageVersion() {
  try {
    const pkgPath = path.join(toolchainRoot, "package.json");
    const pkgStr = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(pkgStr);
    return pkg.version || "1.0.0";
  } catch {
    return "1.0.0";
  }
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function openBrowser(url) {
  const start =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  try {
    exec(`${start} ${url}`);
  } catch {}
}

const version = await getPackageVersion();
const program = new Command();

program
  .name("shadow-claw")
  .description("Browser-native personal AI assistant and static site publisher")
  .version(version, "-v, --version", "Output the current version");

// ---------------------------------------------------------------------------
// BUILD COMMAND
// ---------------------------------------------------------------------------
program
  .command("build")
  .description("Build the static site bundle for production or staging")
  .option(
    "--prod, --production",
    "Build in production mode with minification and optimizations",
    false,
  )
  .option(
    "--origin <url>",
    "Canonical origin URL (e.g. https://user.github.io/repo/)",
  )
  .option("--base-path <path>", "URL base path prefix (e.g. /repo/)")
  .option(
    "--out-dir <dir>",
    "Output directory relative to content root",
    "dist/public",
  )
  .option("--content-root <dir>", "Content root directory", process.cwd())
  .option(
    "--prerender-pages <mode>",
    "Prerender page mode (all, auto, none)",
    "auto",
  )
  .option(
    "--copy-all-assets",
    "Copy entire assets/ directory into output",
    false,
  )
  .action(async (options) => {
    try {
      const contentRoot = path.resolve(options.contentRoot || process.cwd());
      const isProduction = Boolean(
        options.prod ||
        options.production ||
        process.env.NODE_ENV === "production",
      );

      console.log(`Building ShadowClaw site from ${contentRoot}...`);
      await runBuild({
        contentRoot,
        toolchainRoot,
        outDir: options.outDir || "dist/public",
        isProduction,
        pagesOrigin: options.origin || process.env.PAGES_ORIGIN,
        basePath: options.basePath || process.env.PAGES_BASE_PATH,
        prerenderPages: options.prerenderPages,
        copyAllAssets: options.copyAllAssets,
      });
    } catch (err) {
      console.error("Build failed:", err);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// DEV / RUN COMMAND
// ---------------------------------------------------------------------------
async function handleDev(portArg, options) {
  try {
    const contentRoot = path.resolve(options.contentRoot || process.cwd());
    const port = parseInt(
      portArg || options.port || process.env.PORT || "8888",
      10,
    );
    const host =
      options.host ||
      options.ip ||
      process.env.SHADOWCLAW_DEV_IP ||
      "127.0.0.1";
    const outDir = options.outDir || "dist/public";
    const distPublicDir = path.resolve(contentRoot, outDir);
    const resolvedCache = await resolveCacheDir({
      contentRoot,
      cacheDir: options.cacheDir,
      databaseDir: options.databaseDir,
      tmp: options.tmp || options.temp,
      yes: options.yes,
    });
    const cacheDir = resolvedCache.cacheDir;
    const databaseDir = resolvedCache.databaseDir;

    console.log(`Preparing ShadowClaw dev build for ${contentRoot}...`);
    await runBuild({
      contentRoot,
      toolchainRoot,
      outDir,
      isProduction: false,
      pagesOrigin: options.origin || process.env.PAGES_ORIGIN,
      basePath: options.basePath || process.env.PAGES_BASE_PATH,
      prerenderPages: options.prerenderPages || "auto",
      copyAllAssets: options.copyAllAssets,
    });

    const isDist = await pathExists(path.join(toolchainRoot, "dist/server.js"));
    const serverModulePath = isDist
      ? path.join(toolchainRoot, "dist/server.js")
      : path.join(toolchainRoot, "src/server/server.ts");

    process.env.SHADOWCLAW_ROOT_PATH = distPublicDir;
    process.env.SHADOWCLAW_CACHE_DIR = cacheDir;
    process.env.SHADOWCLAW_DATABASE_DIR = databaseDir;
    process.env.SHADOWCLAW_DEV_IP = host;

    const { startServer } = await import(serverModulePath);

    const allowedOrigins = new Set(
      (
        options.corsAllowOrigin ||
        process.env.SHADOWCLAW_CORS_ALLOWED_ORIGINS ||
        "https://xt-ml.github.io"
      )
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );

    const isHttps = Boolean(
      options.https ||
      ["1", "true", "yes"].includes(
        (process.env.SHADOWCLAW_HTTPS || "").toLowerCase().trim(),
      ),
    );
    const certPath =
      options.cert ||
      (
        process.env.SHADOWCLAW_TLS_CERT ||
        process.env.SHADOWCLAW_CERT ||
        ""
      ).trim() ||
      undefined;
    const keyPath =
      options.key ||
      (
        process.env.SHADOWCLAW_TLS_KEY ||
        process.env.SHADOWCLAW_KEY ||
        ""
      ).trim() ||
      undefined;
    const sslDir = path.resolve(
      contentRoot,
      options.sslDir ||
        process.env.SHADOWCLAW_SSL_DIR ||
        process.env.SHADOWCLAW_TLS_DIR ||
        path.join(cacheDir, "tls"),
    );

    await startServer({
      port,
      bindHost: host,
      corsMode: options.corsMode || "localhost",
      allowedOrigins,
      verbose: Boolean(options.verbose),
      peerjs: Boolean(options.peerjs),
      rootPath: distPublicDir,
      cacheDir,
      databaseDir,
      allowPrivateProxy: Boolean(options.allowPrivateProxy),
      https: isHttps,
      certPath,
      keyPath,
      sslDir,
    });

    const protocol = isHttps ? "https" : "http";
    const localUrl = `${protocol}://${host}:${port}`;
    if (options.open) {
      openBrowser(localUrl);
    }
  } catch (err) {
    console.error("Dev server error:", err);
    process.exit(1);
  }
}

program
  .command("dev [port]")
  .description("Build and launch the development server")
  .option("-p, --port <port>", "Port to listen on (default: 8888)")
  .option("--host <host>", "Bind host/IP", "127.0.0.1")
  .option("--ip <host>", "Bind host/IP (alias)")
  .option("--content-root <dir>", "Content root directory", process.cwd())
  .option(
    "--out-dir <dir>",
    "Output directory relative to content root",
    "dist/public",
  )
  .option(
    "--cors-mode <mode>",
    "CORS policy: localhost | private | all",
    "localhost",
  )
  .option("--peerjs", "Enable built-in PeerJS signaling server", false)
  .option(
    "--allow-private-proxy",
    "Allow proxy to reach private/loopback addresses",
    false,
  )
  .option("--https", "Enable HTTPS dev server", false)
  .option("--cert <path>", "Path to existing TLS certificate file")
  .option("--key <path>", "Path to existing TLS private key file")
  .option(
    "--ssl-dir <path>",
    "Directory for TLS certificate generation/storage",
  )
  .option("--database-dir <dir>", "Directory where SQLite databases are stored")
  .option(
    "--cache-dir <dir>",
    "Custom cache directory for databases, tokens, and logs",
  )
  .option(
    "--tmp, --temp",
    "Store cache and databases in system temporary directory",
    false,
  )
  .option(
    "-y, --yes",
    "Skip interactive cache directory prompt and use default .cache",
    false,
  )
  .option("-v, --verbose", "Enable verbose request/proxy logging", false)
  .option("--open", "Automatically open default browser", false)
  .action(handleDev);

program
  .command("run [port]")
  .description("Alias for dev: build and launch the development server")
  .option("-p, --port <port>", "Port to listen on (default: 8888)")
  .option("--host <host>", "Bind host/IP", "127.0.0.1")
  .option("--ip <host>", "Bind host/IP (alias)")
  .option("--content-root <dir>", "Content root directory", process.cwd())
  .option(
    "--out-dir <dir>",
    "Output directory relative to content root",
    "dist/public",
  )
  .option(
    "--cors-mode <mode>",
    "CORS policy: localhost | private | all",
    "localhost",
  )
  .option("--peerjs", "Enable built-in PeerJS signaling server", false)
  .option(
    "--allow-private-proxy",
    "Allow proxy to reach private/loopback addresses",
    false,
  )
  .option("--https", "Enable HTTPS dev server", false)
  .option("--cert <path>", "Path to existing TLS certificate file")
  .option("--key <path>", "Path to existing TLS private key file")
  .option(
    "--ssl-dir <path>",
    "Directory for TLS certificate generation/storage",
  )
  .option("--database-dir <dir>", "Directory where SQLite databases are stored")
  .option(
    "--cache-dir <dir>",
    "Custom cache directory for databases, tokens, and logs",
  )
  .option(
    "--tmp, --temp",
    "Store cache and databases in system temporary directory",
    false,
  )
  .option(
    "-y, --yes",
    "Skip interactive cache directory prompt and use default .cache",
    false,
  )
  .option("-v, --verbose", "Enable verbose request/proxy logging", false)
  .option("--open", "Automatically open default browser", false)
  .action(handleDev);

// ---------------------------------------------------------------------------
// SERVE COMMAND
// ---------------------------------------------------------------------------
program
  .command("serve [port]")
  .description(
    "Serve an existing static site build and start the backend proxy",
  )
  .option("-p, --port <port>", "Port to listen on (default: 8888)")
  .option("--host <host>", "Bind host/IP", "127.0.0.1")
  .option("--content-root <dir>", "Content root directory", process.cwd())
  .option(
    "--out-dir <dir>",
    "Output directory relative to content root",
    "dist/public",
  )
  .option(
    "--cors-mode <mode>",
    "CORS policy: localhost | private | all",
    "localhost",
  )
  .option("--peerjs", "Enable built-in PeerJS signaling server", false)
  .option(
    "--allow-private-proxy",
    "Allow proxy to reach private/loopback addresses",
    false,
  )
  .option("--https", "Enable HTTPS dev server", false)
  .option("--cert <path>", "Path to existing TLS certificate file")
  .option("--key <path>", "Path to existing TLS private key file")
  .option(
    "--ssl-dir <path>",
    "Directory for TLS certificate generation/storage",
  )
  .option("--database-dir <dir>", "Directory where SQLite databases are stored")
  .option(
    "--cache-dir <dir>",
    "Custom cache directory for databases, tokens, and logs",
  )
  .option(
    "--tmp, --temp",
    "Store cache and databases in system temporary directory",
    false,
  )
  .option(
    "-y, --yes",
    "Skip interactive cache directory prompt and use default .cache",
    false,
  )
  .option(
    "--no-static",
    "Disable static file and UI serving (services-only mode)",
  )
  .option("-v, --verbose", "Enable verbose request/proxy logging", false)
  .option("--open", "Automatically open default browser", false)
  .action(async (portArg, options) => {
    try {
      const contentRoot = path.resolve(options.contentRoot || process.cwd());
      const port = parseInt(
        portArg || options.port || process.env.PORT || "8888",
        10,
      );
      const host =
        options.host ||
        options.ip ||
        process.env.SHADOWCLAW_DEV_IP ||
        "127.0.0.1";
      const outDir = options.outDir || "dist/public";
      const distPublicDir = path.resolve(contentRoot, outDir);
      const resolvedCache = await resolveCacheDir({
        contentRoot,
        cacheDir: options.cacheDir,
        databaseDir: options.databaseDir,
        tmp: options.tmp || options.temp,
        yes: options.yes,
      });
      const cacheDir = resolvedCache.cacheDir;
      const databaseDir = resolvedCache.databaseDir;
      const serveStatic = options.static !== false;

      if (
        serveStatic &&
        !(await pathExists(path.join(distPublicDir, "index.html")))
      ) {
        console.error(
          `Error: No index.html found in ${distPublicDir}. Run "shadow-claw build" first.`,
        );
        process.exit(1);
      }

      const isDist = await pathExists(
        path.join(toolchainRoot, "dist/server.js"),
      );
      const serverModulePath = isDist
        ? path.join(toolchainRoot, "dist/server.js")
        : path.join(toolchainRoot, "src/server/server.ts");

      process.env.SHADOWCLAW_ROOT_PATH = distPublicDir;
      process.env.SHADOWCLAW_CACHE_DIR = cacheDir;
      process.env.SHADOWCLAW_DATABASE_DIR = databaseDir;
      process.env.SHADOWCLAW_DEV_IP = host;

      const { startServer } = await import(serverModulePath);

      const allowedOrigins = new Set(
        (
          options.corsAllowOrigin ||
          process.env.SHADOWCLAW_CORS_ALLOWED_ORIGINS ||
          "https://xt-ml.github.io"
        )
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );

      const isHttps = Boolean(
        options.https ||
        ["1", "true", "yes"].includes(
          (process.env.SHADOWCLAW_HTTPS || "").toLowerCase().trim(),
        ),
      );
      const certPath =
        options.cert ||
        (
          process.env.SHADOWCLAW_TLS_CERT ||
          process.env.SHADOWCLAW_CERT ||
          ""
        ).trim() ||
        undefined;
      const keyPath =
        options.key ||
        (
          process.env.SHADOWCLAW_TLS_KEY ||
          process.env.SHADOWCLAW_KEY ||
          ""
        ).trim() ||
        undefined;
      const sslDir = path.resolve(
        contentRoot,
        options.sslDir ||
          process.env.SHADOWCLAW_SSL_DIR ||
          process.env.SHADOWCLAW_TLS_DIR ||
          path.join(cacheDir, "tls"),
      );

      await startServer({
        port,
        bindHost: host,
        corsMode: options.corsMode || "localhost",
        allowedOrigins,
        verbose: Boolean(options.verbose),
        peerjs: Boolean(options.peerjs),
        rootPath: distPublicDir,
        cacheDir,
        databaseDir,
        allowPrivateProxy: Boolean(options.allowPrivateProxy),
        https: isHttps,
        certPath,
        keyPath,
        sslDir,
        serveStatic,
      });

      const protocol = isHttps ? "https" : "http";
      const localUrl = `${protocol}://${host}:${port}`;
      if (serveStatic && options.open) {
        openBrowser(localUrl);
      }
    } catch (err) {
      console.error("Serve error:", err);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// SERVER / SERVICES / API COMMAND (Services-only mode)
// ---------------------------------------------------------------------------
async function handleServer(portArg, options) {
  try {
    const contentRoot = path.resolve(options.contentRoot || process.cwd());
    const port = parseInt(
      portArg || options.port || process.env.PORT || "8888",
      10,
    );
    const host =
      options.host ||
      options.ip ||
      process.env.SHADOWCLAW_DEV_IP ||
      "127.0.0.1";
    const resolvedCache = await resolveCacheDir({
      contentRoot,
      cacheDir: options.cacheDir,
      databaseDir: options.databaseDir,
      tmp: options.tmp || options.temp,
      yes: options.yes,
    });
    const cacheDir = resolvedCache.cacheDir;
    const databaseDir = resolvedCache.databaseDir;

    const isDist = await pathExists(path.join(toolchainRoot, "dist/server.js"));
    const serverModulePath = isDist
      ? path.join(toolchainRoot, "dist/server.js")
      : path.join(toolchainRoot, "src/server/server.ts");

    process.env.SHADOWCLAW_CACHE_DIR = cacheDir;
    process.env.SHADOWCLAW_DATABASE_DIR = databaseDir;
    process.env.SHADOWCLAW_DEV_IP = host;
    process.env.SHADOWCLAW_SERVE_STATIC = "false";

    const { startServer } = await import(serverModulePath);

    const allowedOrigins = new Set(
      (
        options.corsAllowOrigin ||
        process.env.SHADOWCLAW_CORS_ALLOWED_ORIGINS ||
        "https://xt-ml.github.io"
      )
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );

    const isHttps = Boolean(
      options.https ||
      ["1", "true", "yes"].includes(
        (process.env.SHADOWCLAW_HTTPS || "").toLowerCase().trim(),
      ),
    );
    const certPath =
      options.cert ||
      (
        process.env.SHADOWCLAW_TLS_CERT ||
        process.env.SHADOWCLAW_CERT ||
        ""
      ).trim() ||
      undefined;
    const keyPath =
      options.key ||
      (
        process.env.SHADOWCLAW_TLS_KEY ||
        process.env.SHADOWCLAW_KEY ||
        ""
      ).trim() ||
      undefined;
    const sslDir = path.resolve(
      contentRoot,
      options.sslDir ||
        process.env.SHADOWCLAW_SSL_DIR ||
        process.env.SHADOWCLAW_TLS_DIR ||
        path.join(cacheDir, "tls"),
    );

    await startServer({
      port,
      bindHost: host,
      corsMode: options.corsMode || "localhost",
      allowedOrigins,
      verbose: Boolean(options.verbose),
      peerjs: Boolean(options.peerjs),
      rootPath: "",
      cacheDir,
      databaseDir,
      controlToken:
        options.controlToken ||
        process.env.SHADOWCLAW_CONTROL_TOKEN ||
        undefined,
      allowPrivateProxy: Boolean(options.allowPrivateProxy),
      https: isHttps,
      certPath,
      keyPath,
      sslDir,
      serveStatic: false,
    });
  } catch (err) {
    console.error("Server error:", err);
    process.exit(1);
  }
}

program
  .command("server [port]")
  .aliases(["services", "api"])
  .description(
    "Start backend services (Express, MCP, control plane) without building or serving the UI (aliases: services, api)",
  )
  .option("-p, --port <port>", "Port to listen on (default: 8888)")
  .option("--host <host>", "Bind host/IP", "127.0.0.1")
  .option("--ip <host>", "Bind host/IP (alias)")
  .option("--content-root <dir>", "Content root directory", process.cwd())
  .option("--database-dir <dir>", "Directory where SQLite databases are stored")
  .option(
    "--cache-dir <dir>",
    "Custom cache directory for databases, tokens, and logs",
  )
  .option(
    "--tmp, --temp",
    "Store cache and databases in system temporary directory",
    false,
  )
  .option(
    "-y, --yes",
    "Skip interactive cache directory prompt and use default .cache",
    false,
  )
  .option(
    "--cors-mode <mode>",
    "CORS policy: localhost | private | all",
    "localhost",
  )
  .option(
    "--cors-allow-origin <origin>",
    "Explicit allowed origins (comma-separated)",
  )
  .option(
    "--control-token <token>",
    "Secret token for control-plane authentication",
  )
  .option("--peerjs", "Enable built-in PeerJS signaling server", false)
  .option(
    "--allow-private-proxy",
    "Allow proxy to reach private/loopback addresses",
    false,
  )
  .option("--https", "Enable HTTPS server", false)
  .option("--cert <path>", "Path to existing TLS certificate file")
  .option("--key <path>", "Path to existing TLS private key file")
  .option(
    "--ssl-dir <path>",
    "Directory for TLS certificate generation/storage",
  )
  .option("-v, --verbose", "Enable verbose request/proxy logging", false)
  .action(handleServer);

// ---------------------------------------------------------------------------
// INIT COMMAND
// ---------------------------------------------------------------------------
program
  .command("init [dir]")
  .description(
    "Initialize a new ShadowClaw content template in the specified directory",
  )
  .action(async (dirArg) => {
    try {
      const targetDir = path.resolve(dirArg || process.cwd());
      await mkdir(path.join(targetDir, "pages/main"), { recursive: true });

      const configPath = path.join(targetDir, "shadow-claw-config.json");
      const legacyConfigPath1 = path.join(targetDir, "shadow-claw.config.json");
      const legacyConfigPath2 = path.join(targetDir, "site-config.json");
      if (
        !(await pathExists(configPath)) &&
        !(await pathExists(legacyConfigPath1)) &&
        !(await pathExists(legacyConfigPath2))
      ) {
        const defaultSiteConfig = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          site: {
            title: "My ShadowClaw Site",
            description:
              "Personal AI assistant and knowledge hub powered by ShadowClaw.",
          },
          branding: {
            titleText: "My ShadowClaw Site",
          },
          pages: {
            sortOrder: "asc",
            defaultPinnedPage: "/pages/main/index.html",
          },
        };
        await writeFile(
          configPath,
          JSON.stringify(defaultSiteConfig, null, 2) + "\n",
          "utf8",
        );
        console.log(`Created ${configPath}`);
      }

      const indexPath = path.join(targetDir, "pages/main/index.html");
      if (!(await pathExists(indexPath))) {
        const defaultIndexHtml = `---
title: "Welcome to ShadowClaw"
created: "${new Date().toISOString()}"
updated: "${new Date().toISOString()}"
slug: "home"
---

<article>
  <h1>Welcome to ShadowClaw</h1>
  <p>Your browser-native personal AI assistant and static site publisher.</p>
</article>
`;
        await writeFile(indexPath, defaultIndexHtml, "utf8");
        console.log(`Created ${indexPath}`);
      }

      const gitignorePath = path.join(targetDir, ".gitignore");
      if (!(await pathExists(gitignorePath))) {
        await writeFile(
          gitignorePath,
          "dist/\n.cache/\nnode_modules/\n",
          "utf8",
        );
        console.log(`Created ${gitignorePath}`);
      }

      console.log(
        `\nShadowClaw template successfully initialized in ${targetDir}`,
      );
      console.log(`To start developing, run:`);
      console.log(`  npx shadow-claw dev\n`);
    } catch (err) {
      console.error("Init failed:", err);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// PEER-ID / WEBRTC COMMAND
// ---------------------------------------------------------------------------
program
  .command("peer-id [action] [customId]")
  .alias("webrtc-peer-id")
  .description(
    "Get, generate, or renew the WebRTC CLI peer ID stored in .cache/cli-peer-id",
  )
  .option(
    "-r, --renew",
    "Force renewal / generation of a new WebRTC CLI peer ID",
  )
  .option("--set <id>", "Set a specific custom WebRTC CLI peer ID")
  .option("--cache-dir <dir>", "Custom cache directory (defaults to .cache)")
  .option("-q, --quiet", "Output only the peer ID string")
  .option("--json", "Output peer ID and file path as JSON")
  .action(async (action, customId, options) => {
    const opts = { ...options };
    if (customId && !opts.set) {
      opts.set = customId;
    }
    await runPeerIdCommand(action, opts);
  });

program
  .command("webrtc [action] [customId]")
  .description(
    "Manage WebRTC CLI configuration and peer identity (.cache/cli-peer-id)\n\n" +
      "  Actions:\n" +
      "    (default)  Show or generate the CLI peer ID\n" +
      "    listen     Register as a live PeerJS peer — browser tabs can then\n" +
      "               connect directly without a control-plane connection",
  )
  .option(
    "-r, --renew",
    "Force renewal / generation of a new WebRTC CLI peer ID",
  )
  .option("--set <id>", "Set a specific custom WebRTC CLI peer ID")
  .option("--cache-dir <dir>", "Custom cache directory (defaults to .cache)")
  .option("-q, --quiet", "Output only the peer ID string")
  .option("--json", "Output peer ID and file path as JSON")
  // listen-specific options
  .option("--host <host>", "PeerJS signaling server host (for listen)")
  .option("--port <port>", "PeerJS signaling server port (for listen)", "8888")
  .option("--path <path>", "PeerJS signaling server path (for listen)", "/")
  .option(
    "--secure",
    "Use TLS (wss://) for the signaling server (for listen)",
    false,
  )
  .option(
    "--https",
    "Alias for --secure: use TLS (wss://) for the signaling server",
    false,
  )
  .option(
    "--trusted-peer <id>",
    "Accept connections only from this peer ID (repeatable, for listen)",
    (v, prev) => (prev ? [...prev, v] : [v]),
    [],
  )
  .option("--verbose", "Verbose connection logging (for listen)", false)
  .option("--renew-peer-id", "Renew CLI peer ID before listening", false)
  .option(
    "-k, --insecure",
    "Allow self-signed TLS certificates for the signaling server (wss://)",
    true,
  )
  .action(async (action, customId, options) => {
    if (action === "listen") {
      await runWebRtcListenCommand(options);
      return;
    }
    const opts = { ...options };
    if (customId && !opts.set) {
      opts.set = customId;
    }
    await runPeerIdCommand(action, opts);
  });

// ---------------------------------------------------------------------------
// CLIENTS COMMAND
// ---------------------------------------------------------------------------
program
  .command("clients")
  .description("List connected / registered browser and Electron clients")
  .option("--host <host>", "Control plane host")
  .option("--port <port>", "Control plane port")
  .option("--token <token>", "Control token")
  .option("--https", "Connect to server via HTTPS", false)
  .option("-k, --insecure", "Allow self-signed TLS certificates", true)
  .option("--transport <transport>", "Transport to use: http | webrtc", "http")
  .option("--peer-id <id>", "Custom WebRTC CLI peer ID")
  .option(
    "--renew-peer-id",
    "Renew WebRTC CLI peer ID before connecting",
    false,
  )
  .option("--cache-dir <dir>", "Custom cache directory")
  .action(async (options) => {
    await runClientsCommand(options);
  });

// ---------------------------------------------------------------------------
// SEND COMMAND
// ---------------------------------------------------------------------------
program
  .command("send <message>")
  .description("Send a message/prompt to a connected client")
  .option("--client <id>", "Target client ID (defaults to first available)")
  .option("--group <groupId>", "Target conversation group ID")
  .option("--host <host>", "Control plane host")
  .option("--port <port>", "Control plane port")
  .option("--token <token>", "Control token")
  .option("--https", "Connect to server via HTTPS", false)
  .option("-k, --insecure", "Allow self-signed TLS certificates", true)
  .option("--transport <transport>", "Transport to use: http | webrtc", "http")
  .option("--peer-id <id>", "Custom WebRTC CLI peer ID")
  .option("--renew-peer-id", "Renew WebRTC CLI peer ID before sending", false)
  .option("--cache-dir <dir>", "Custom cache directory")
  .action(async (message, options) => {
    await runSendCommand(message, options);
  });

// ---------------------------------------------------------------------------
// BACKUP COMMAND
// ---------------------------------------------------------------------------
program
  .command("backup [action]")
  .description(
    "Trigger or manage client workspace backups (trigger | list | delete)",
  )
  .option("--client <id>", "Client ID")
  .option("--backup-id <id>", "Backup ID (for delete)")
  .option("--group <groupId>", "Specific workspace group ID")
  .option("--host <host>", "Control plane host")
  .option("--port <port>", "Control plane port")
  .option("--token <token>", "Control token")
  .option("--https", "Connect to server via HTTPS", false)
  .option("-k, --insecure", "Allow self-signed TLS certificates", true)
  .option("--transport <transport>", "Transport to use: http | webrtc", "http")
  .option("--peer-id <id>", "Custom WebRTC CLI peer ID")
  .option(
    "--renew-peer-id",
    "Renew WebRTC CLI peer ID before connecting",
    false,
  )
  .option("--cache-dir <dir>", "Custom cache directory")
  .action(async (action, options) => {
    await runBackupCommand(action || "trigger", options);
  });

// ---------------------------------------------------------------------------
// TASKS COMMAND
// ---------------------------------------------------------------------------
program
  .command("tasks")
  .description("List scheduled tasks on a connected client")
  .option("--client <id>", "Target client ID")
  .option("--group <groupId>", "Filter tasks by conversation group ID")
  .option("--host <host>", "Control plane host")
  .option("--port <port>", "Control plane port")
  .option("--token <token>", "Control token")
  .option("--https", "Connect to server via HTTPS", false)
  .option("-k, --insecure", "Allow self-signed TLS certificates", true)
  .option("--transport <transport>", "Transport to use: http | webrtc", "http")
  .option("--peer-id <id>", "Custom WebRTC CLI peer ID")
  .option(
    "--renew-peer-id",
    "Renew WebRTC CLI peer ID before connecting",
    false,
  )
  .option("--cache-dir <dir>", "Custom cache directory")
  .action(async (options) => {
    await runTasksCommand(options);
  });

// ---------------------------------------------------------------------------
// MCP COMMAND
// ---------------------------------------------------------------------------
program
  .command("mcp")
  .description(
    "Run the official Stateless Model Context Protocol (MCP 2026-07-28) server",
  )
  .option("--mcp-transport <transport>", "MCP transport: stdio | http", "stdio")
  .option("--client <id>", "Target client ID (defaults to first active client)")
  .option("--host <host>", "Control plane host")
  .option("--port <port>", "Control plane port or HTTP MCP port")
  .option("--token <token>", "Control token")
  .option("--https", "Connect to server via HTTPS", false)
  .option("-k, --insecure", "Allow self-signed TLS certificates", true)
  .option(
    "--transport <transport>",
    "Control plane client transport: http | webrtc",
    "http",
  )
  .option("--peer-id <id>", "Custom WebRTC CLI peer ID")
  .option(
    "--relay-client-tools",
    "Discover and relay tools from connected browser clients",
    true,
  )
  .option("--no-relay-client-tools", "Disable relaying browser client tools")
  .action(async (options) => {
    await runMcpCommand(options);
  });

program.parse(process.argv);
