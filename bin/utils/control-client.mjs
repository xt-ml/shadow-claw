/**
 * ShadowClaw CLI — Shared Control Client
 *
 * Provides a client library for CLI commands to interact with the ShadowClaw
 * server control plane and backup REST endpoints.
 */

import http from "node:http";
import https from "node:https";
import path from "node:path";
import fs from "node:fs";
import { CliWebRtcControlClient } from "./webrtc-control-client.mjs";

export function resolveControlToken(customToken) {
  if (customToken && typeof customToken === "string") {
    return customToken.trim();
  }

  if (process.env.SHADOWCLAW_CONTROL_TOKEN) {
    return process.env.SHADOWCLAW_CONTROL_TOKEN.trim();
  }

  // 1. Try reading from .cache/control-token.json
  try {
    const candidates = [
      path.join(process.cwd(), ".cache", "control-token.json"),
      path.join(process.cwd(), "control-token.json"),
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.token === "string" && parsed.token.trim()) {
          return parsed.token.trim();
        }
      }
    }
  } catch (_) {}

  // 2. Try reading from SQLite clients.db if available locally
  try {
    let sqlite;
    if (typeof process.getBuiltinModule === "function") {
      sqlite = process.getBuiltinModule("node:sqlite");
    }
    if (sqlite && sqlite.DatabaseSync) {
      const candidates = [
        path.join(process.cwd(), "database", "clients.db"),
        path.join(process.cwd(), ".cache", "database", "clients.db"),
      ];
      for (const dbPath of candidates) {
        if (fs.existsSync(dbPath)) {
          const db = new sqlite.DatabaseSync(dbPath);
          const row = db
            .prepare("SELECT value FROM metadata WHERE key = 'control_token'")
            .get();
          db.close();
          if (row && row.value) {
            return `${row.value}`;
          }
        }
      }
    }
  } catch (_) {}

  return "";
}

export class CliControlClient {
  constructor(options = {}) {
    this.host = options.host || process.env.SHADOWCLAW_HOST || "127.0.0.1";
    this.port =
      options.port || parseInt(process.env.SHADOWCLAW_PORT || "8888", 10);
    this.token = options.token || resolveControlToken(options.token);
    this.protocol = options.protocol || "http";
    this.transport = options.transport || "http";
    this._webrtcClient =
      this.transport === "webrtc"
        ? new CliWebRtcControlClient({
            host: this.host,
            port: this.port,
            path: options.peerPath || "/",
            secure: this.protocol === "https",
            peerId: options.peerId,
            cacheDir: options.cacheDir,
            renewPeerId: Boolean(options.renewPeerId),
          })
        : null;
  }

  _request({ method = "GET", path: reqPath, body = null, timeout = 30000 }) {
    return new Promise((resolve, reject) => {
      const client = this.protocol === "https" ? https : http;
      const headers = {
        "Content-Type": "application/json",
      };

      if (this.token) {
        headers["x-control-token"] = this.token;
      }

      const req = client.request(
        {
          hostname: this.host,
          port: this.port,
          path: reqPath,
          method,
          headers,
          timeout,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            let parsed = data;
            try {
              parsed = JSON.parse(data);
            } catch (_) {}

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              const errMsg =
                parsed?.error ||
                `HTTP request failed with status ${res.statusCode}: ${data}`;
              reject(new Error(errMsg));
            }
          });
        },
      );

      req.on("error", (err) => {
        reject(
          new Error(
            `Failed to connect to ShadowClaw server at ${this.host}:${this.port}: ${err.message}`,
          ),
        );
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timed out after ${timeout}ms`));
      });

      if (body) {
        req.write(typeof body === "string" ? body : JSON.stringify(body));
      }
      req.end();
    });
  }

  async listClients() {
    if (this._webrtcClient) {
      try {
        const webrtcClients = await this._webrtcClient.listClients();
        if (webrtcClients && webrtcClients.length > 0) {
          return webrtcClients;
        }
      } catch (_) {}

      // Fallback: query HTTP control plane registry if available
      try {
        const data = await this._request({
          path: "/api/control/clients",
          method: "GET",
        });
        return data.clients || [];
      } catch (_) {
        return [];
      }
    }

    const data = await this._request({
      path: "/api/control/clients",
      method: "GET",
    });
    return data.clients || [];
  }

  async sendCommand(clientId, action, args = {}, timeoutMs = 30000) {
    if (this._webrtcClient) {
      let targetPeerId = clientId;
      // If the target looks like a control-plane client ID ("client-*"), try to
      // resolve the PeerJS peer ID via the HTTP registry. Otherwise treat it
      // directly as a PeerJS peer ID so WebRTC works without a control plane.
      if (clientId && clientId.startsWith("client-")) {
        try {
          const clients = await this.listClients();
          const match = clients.find((c) => c.clientId === clientId);
          if (match && match.peerId) {
            targetPeerId = match.peerId;
          } else if (match && !match.peerId) {
            console.warn(
              `Warning: client "${clientId}" has no PeerJS peer ID registered.\n` +
                `Ensure the browser has PeerJS enabled in Settings → WebRTC/PeerJS and has connected to the signaling server at least once.\n` +
                `Alternatively, pass the browser's PeerJS peer ID directly with --client <peerId>.`,
            );
          }
        } catch (_) {
          // Control plane unreachable — fall through and attempt direct connection
          // (will fail if clientId is truly a client-* and not a PeerJS peer ID)
        }
      }
      return this._webrtcClient.sendCommand(
        targetPeerId,
        action,
        args,
        timeoutMs,
      );
    }

    const data = await this._request({
      path: "/api/control/command",
      method: "POST",
      body: {
        clientId,
        action,
        args,
        timeoutMs,
      },
      timeout: timeoutMs + 5000,
    });
    return data;
  }

  async listBackups(clientId) {
    const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
    const data = await this._request({
      path: `/api/backup/list${query}`,
      method: "GET",
    });
    return data.backups || [];
  }

  async deleteBackup(backupId, clientId) {
    const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
    const data = await this._request({
      path: `/api/backup/${encodeURIComponent(backupId)}${query}`,
      method: "DELETE",
    });
    return data;
  }
}
