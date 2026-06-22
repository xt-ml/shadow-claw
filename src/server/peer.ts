import http from "node:http";
import { ExpressPeerServer } from "peer";
import type { Express } from "express";

/**
 * Attach a PeerJS signaling server to the given HTTP server and Express app.
 *
 * The PeerJS client constructs URLs as `{path}{key}` (default key is "peerjs"),
 * so with the default client path "/" the WebSocket connects at "/peerjs".
 * We mount the middleware at "/" and set internal path to "/" so routes land
 * at /peerjs/* as expected.
 *
 * @param httpServer - The underlying http.Server (needed for WebSocket upgrade).
 * @param app - The Express app to mount the PeerJS REST routes on.
 */
export function attachPeerServer(httpServer: http.Server, app: Express): void {
  const peerServer = ExpressPeerServer(httpServer, {
    path: "/",
    allow_discovery: false,
  });

  app.use(peerServer);

  peerServer.on("connection", (client) => {
    console.log(`PeerJS: client connected — ${client.getId()}`);
  });

  peerServer.on("disconnect", (client) => {
    console.log(`PeerJS: client disconnected — ${client.getId()}`);
  });
}
