import { exit } from "node:process";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tcpPortUsed from "tcp-port-used";

import { DEFAULT_DEV_IP } from "../config/config.js";
import { createApp } from "./app.js";
import { attachPeerServer } from "./peer.js";
import { createControlPlane } from "./control-plane.js";
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
    verbose: config.verbose,
    allowedOrigins: config.allowedOrigins,
    corsMode: config.corsMode,
  });

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

  return new Promise<http.Server | https.Server>((resolve) => {
    httpServer.listen(config.port, config.bindHost, () => {
      const protocol = config.https ? "https" : "http";
      const wsProtocol = config.https ? "wss" : "ws";

      console.log(
        `Server running at ${protocol}://${config.bindHost}:${config.port}`,
      );

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

if (isMainModule) {
  startServer().catch((error) => {
    console.error(error);
    exit(1);
  });
}
