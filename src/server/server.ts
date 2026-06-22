import { exit } from "node:process";
import http from "node:http";
import tcpPortUsed from "tcp-port-used";

import { DEFAULT_DEV_IP } from "../config.js";
import { createApp } from "./app.js";
import { attachPeerServer } from "./peer.js";
import { parseConfig } from "./config.js";

const config = parseConfig();
const { app, scheduler } = createApp(config);

const isPortUsed = await tcpPortUsed.check(config.port, config.bindHost);
if (isPortUsed) {
  console.error(
    `Port ${config.port} is currently being used. Try passing a different port as the first argument.`,
  );
  exit(1);
}

scheduler.start();

const httpServer = http.createServer(app);

if (config.peerjs) {
  attachPeerServer(httpServer, app);
}

httpServer.listen(config.port, config.bindHost, () => {
  console.log(`Server running at http://${config.bindHost}:${config.port}`);

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

  if (config.peerjs) {
    console.log("PeerJS signaling server enabled (routes at /peerjs/*)");
  }

  if (config.verbose) {
    console.log("Verbose logging enabled.");
  }
});
