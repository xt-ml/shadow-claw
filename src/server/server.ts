import { exit } from "node:process";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import tcpPortUsed from "tcp-port-used";

import { DEFAULT_DEV_IP } from "../config/config.js";
import { createApp } from "./app.js";
import { attachPeerServer } from "./peer.js";
import { createControlPlane } from "./control-plane.js";
import { registerMcpRoutes } from "./routes/mcp.js";
import { registerA2ARoutes } from "./a2a/routes.js";
import { A2AHttpServer } from "./a2a/a2a-http-server.js";
import { buildHttpAgentCard } from "./a2a/agent-card-builder.js";
import { discoverServerSkills } from "./a2a/discover-server-skills.js";
import { createA2ATaskExecutor } from "./a2a/a2a-task-executor.js";
import { ServerPeer } from "./server-peer.js";
import { parseConfig, ServerConfig } from "./config.js";
import { ensureTlsCredentials } from "./tls.js";

export async function startServer(
  customConfig?: ServerConfig,
): Promise<http.Server | https.Server> {
  const config = customConfig || parseConfig();
  const { app, scheduler } = createApp(config);

  const isPortUsed = await tcpPortUsed.check(config.port, config.bindHost);
  if (isPortUsed) {
    console.error(
      `Port ${config.port} is currently being used. Try passing a different port as the first argument.`,
    );
    exit(1);
  }

  scheduler.start();

  const httpServer: http.Server | https.Server = config.https
    ? https.createServer(ensureTlsCredentials(config), app)
    : http.createServer(app);

  const controlPlane = createControlPlane({
    httpServer,
    app,
    token: config.controlToken,
    cacheDir: config.cacheDir,
    verbose: config.verbose,
    allowedOrigins: config.allowedOrigins,
    corsMode: config.corsMode,
  });

  const upgradedSockets = new Set<any>();
  if (typeof (httpServer as any).on === "function") {
    httpServer.on("upgrade", (_req, socket) => {
      upgradedSockets.add(socket);
      socket.once?.("close", () => {
        upgradedSockets.delete(socket);
      });
    });
  }

  if (typeof (httpServer as any).on === "function") {
    httpServer.on("close", () => {
      try {
        scheduler.stop();
      } catch (_) {}
      try {
        controlPlane.close();
      } catch (_) {}
      if (serverPeer) {
        try {
          serverPeer.close();
        } catch (_) {}
      }
    });
  }

  registerMcpRoutes(app, {
    controlPlane,
    token: config.controlToken,
    allowedOrigins: config.allowedOrigins,
    corsMode: config.corsMode,
  });

  if (config.a2aEnabled) {
    const protocol = config.https ? "https" : "http";
    const host =
      config.bindHost === "0.0.0.0" || config.bindHost === "::"
        ? "127.0.0.1"
        : config.bindHost;
    const baseUrl = `${protocol}://${host}:${config.port}`;

    // Discover skills from the workspace using the same path as the CLI agent
    const skills = await discoverServerSkills(config.rootPath).catch(() => []);

    const agentCard = buildHttpAgentCard({
      baseUrl,
      name: `ShadowClaw Server (${config.bindHost}:${config.port})`,
      skills,
    });

    const taskExecutor = createA2ATaskExecutor({
      workspace: config.rootPath,
      quiet: !config.verbose,
      verbose: config.verbose,
    });

    const a2aHttpServer = new A2AHttpServer({
      agentCard,
      taskExecutor,
    });
    registerA2ARoutes(app, {
      httpServer: a2aHttpServer,
      token: config.controlToken,
    });
  }

  let serverPeer: ServerPeer | null = null;
  if (config.peerjs) {
    attachPeerServer(httpServer, app);
    serverPeer = new ServerPeer({
      host: config.bindHost,
      port: config.port,
      path: "/peerjs",
      verbose: config.verbose,
    });
  }

  if (typeof (httpServer as any).close === "function") {
    const originalClose = httpServer.close.bind(httpServer);
    (httpServer as any).close = function (
      callback?: (err?: Error) => void,
    ): http.Server | https.Server {
      try {
        scheduler.stop();
      } catch (_) {}
      try {
        controlPlane.close();
      } catch (_) {}
      if (serverPeer) {
        try {
          serverPeer.close();
        } catch (_) {}
      }
      for (const socket of upgradedSockets) {
        try {
          socket.destroy();
        } catch (_) {}
      }
      upgradedSockets.clear();
      return originalClose(callback);
    };
  }

  if (config.serveStatic === false) {
    app.use((_req, res) => {
      res.status(404).json({ error: "Not found" });
    });
  }

  return new Promise<http.Server | https.Server>((resolve) => {
    httpServer.listen(config.port, config.bindHost, () => {
      const protocol = config.https ? "https" : "http";
      const wsProtocol = config.https ? "wss" : "ws";

      console.log(
        `Server running at ${protocol}://${config.bindHost}:${config.port}`,
      );

      if (config.serveStatic === false) {
        console.log("Services-only mode active (UI static serving disabled)");
      }

      if (config.https) {
        const certLocation =
          config.certPath || path.join(config.sslDir, "cert.pem");
        console.log(`TLS enabled (cert: ${certLocation})`);
      }

      if (config.bindHost === DEFAULT_DEV_IP) {
        console.log(
          `Bind host source: default (${DEFAULT_DEV_IP}). Use --host/--ip or SHADOWCLAW_DEV_IP to override.`,
        );
      } else {
        console.log(`Bind host source: inferred (${config.bindHost})`);
      }

      console.log(
        `CORS mode: ${config.corsMode}${config.allowedOrigins.size > 0 ? " (with explicit allowlist)" : ""}`,
      );

      if (config.allowedOrigins.size > 0) {
        console.log(
          `CORS allowlist origins: ${Array.from(config.allowedOrigins).join(", ")}`,
        );
      }

      console.log(
        `Control plane active at ${protocol}://${config.bindHost}:${config.port}/api/control/events (SSE) and ${wsProtocol}://${config.bindHost}:${config.port}/ws/control (WebSocket)`,
      );
      console.log(`Control token: ${controlPlane.getToken()}`);
      try {
        const tmpDir = path.join(tmpdir(), "shadow-claw");
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        const tokenFilePayload =
          JSON.stringify(
            {
              token: controlPlane.getToken(),
              port: config.port,
              bindHost: config.bindHost,
              createdAt: Date.now(),
              createdAtIso: new Date().toISOString(),
            },
            null,
            2,
          ) + "\n";
        fs.writeFileSync(
          path.join(tmpDir, `control-token-${config.port}.json`),
          tokenFilePayload,
          "utf8",
        );
        fs.writeFileSync(
          path.join(tmpDir, "control-token.json"),
          tokenFilePayload,
          "utf8",
        );
      } catch (_) {}
      console.log(
        `MCP endpoint active at ${protocol}://${config.bindHost}:${config.port}/mcp`,
      );

      if (config.peerjs) {
        console.log("PeerJS signaling server enabled (routes at /peerjs/*)");
        if (serverPeer) {
          serverPeer
            .start()
            .then((id) => {
              console.log(`Server WebRTC peer active with ID: ${id}`);
            })
            .catch((err) => {
              if (config.verbose) {
                console.warn(
                  `[server] ServerPeer start notice: ${err.message || String(err)}`,
                );
              }
            });
        }
      }

      if (config.verbose) {
        console.log("Verbose logging enabled.");
      }

      resolve(httpServer);
    });
  });
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

export function installServerTerminationHandlers(
  server: http.Server | https.Server,
  exitProcess: (code: number) => never = exit,
): void {
  let shuttingDown = false;

  const shutdown = (exitCode: number) => {
    if (shuttingDown) {
      exitProcess(exitCode);
      return;
    }
    shuttingDown = true;

    const forceTimer = setTimeout(() => {
      exitProcess(exitCode);
    }, 1500);
    if (typeof forceTimer.unref === "function") {
      forceTimer.unref();
    }

    try {
      server.closeAllConnections?.();
    } catch (_) {}

    server.close?.(() => {
      clearTimeout(forceTimer);
      exitProcess(exitCode);
    });
  };

  process.on("SIGINT", () => shutdown(130));
  process.on("SIGTERM", () => shutdown(143));
}

if (isMainModule) {
  startServer()
    .then((server) => {
      installServerTerminationHandlers(server);
    })
    .catch((error) => {
      console.error(error);
      exit(1);
    });
}
