import http from "node:http";
import https from "node:https";
import path from "node:path";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { CliWebRtcControlClient } from "./webrtc-control-client.js";

export interface ControlClientOptions {
  host?: string;
  port?: number;
  token?: string;
  cacheDir?: string;
  https?: boolean;
  protocol?: string;
  rejectUnauthorized?: boolean;
  insecure?: boolean;
  transport?: "http" | "webrtc";
  peerPath?: string;
  peerId?: string;
  renewPeerId?: boolean;
}

export function resolveControlTokens(
  customToken?: string,
  cacheDir?: string,
  port?: number,
): string[] {
  if (customToken && typeof customToken === "string" && customToken.trim()) {
    return [customToken.trim()];
  }

  if (process.env.SHADOWCLAW_CONTROL_TOKEN) {
    return [process.env.SHADOWCLAW_CONTROL_TOKEN.trim()];
  }

  const explicitCacheDir =
    cacheDir || (process.env.SHADOWCLAW_CACHE_DIR || "").trim();
  const tmpCacheDir = path.join(tmpdir(), "shadow-claw");
  const home = typeof process.env.HOME === "string" ? process.env.HOME : "";

  const candidatesWithTime: Array<{
    token: string;
    timestamp: number;
    filePath: string;
  }> = [];

  const checkTokenFile = (filePath: string) => {
    try {
      if (filePath && fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.token === "string" && parsed.token.trim()) {
          const timestamp = Number(parsed.createdAt) || stat.mtimeMs || 0;
          candidatesWithTime.push({
            token: parsed.token.trim(),
            timestamp,
            filePath,
          });
        }
      }
    } catch (_) {}
  };

  const checkDbFile = (dbPath: string) => {
    try {
      let sqlite: any;
      if (typeof (process as any).getBuiltinModule === "function") {
        sqlite = (process as any).getBuiltinModule("node:sqlite");
      }
      if (sqlite && sqlite.DatabaseSync && fs.existsSync(dbPath)) {
        const stat = fs.statSync(dbPath);
        const db = new sqlite.DatabaseSync(dbPath);
        const row = db
          .prepare("SELECT value FROM metadata WHERE key = 'control_token'")
          .get();
        db.close();
        if (row && row.value) {
          candidatesWithTime.push({
            token: `${row.value}`.trim(),
            timestamp: stat.mtimeMs || 0,
            filePath: dbPath,
          });
        }
      }
    } catch (_) {}
  };

  if (explicitCacheDir) {
    checkTokenFile(path.join(explicitCacheDir, "control-token.json"));
    checkDbFile(path.join(explicitCacheDir, "database", "clients.db"));
    checkDbFile(path.join(explicitCacheDir, "clients.db"));
  } else {
    if (port) {
      checkTokenFile(path.join(tmpCacheDir, `control-token-${port}.json`));
    }
    checkTokenFile(path.join(tmpCacheDir, "control-token.json"));
    checkDbFile(path.join(tmpCacheDir, "database", "clients.db"));

    checkTokenFile(path.join(process.cwd(), ".cache", "control-token.json"));
    checkTokenFile(path.join(process.cwd(), "control-token.json"));
    checkDbFile(path.join(process.cwd(), ".cache", "database", "clients.db"));
    checkDbFile(path.join(process.cwd(), "database", "clients.db"));

    try {
      const entries = fs.readdirSync(process.cwd(), { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith("node_modules") &&
          !entry.name.startsWith(".")
        ) {
          const subDir = path.join(process.cwd(), entry.name);
          checkTokenFile(path.join(subDir, ".cache", "control-token.json"));
          checkTokenFile(path.join(subDir, "control-token.json"));
          checkDbFile(path.join(subDir, ".cache", "database", "clients.db"));
        }
      }
    } catch (_) {}

    try {
      let cur = process.cwd();
      for (let i = 0; i < 4; i++) {
        const parent = path.dirname(cur);
        if (!parent || parent === cur) break;
        checkTokenFile(path.join(parent, ".cache", "control-token.json"));
        checkTokenFile(path.join(parent, "control-token.json"));
        checkDbFile(path.join(parent, ".cache", "database", "clients.db"));
        try {
          const subEntries = fs.readdirSync(parent, { withFileTypes: true });
          for (const sub of subEntries) {
            if (
              sub.isDirectory() &&
              !sub.name.startsWith("node_modules") &&
              !sub.name.startsWith(".")
            ) {
              const subDir = path.join(parent, sub.name);
              checkTokenFile(path.join(subDir, ".cache", "control-token.json"));
              checkTokenFile(path.join(subDir, "control-token.json"));
              checkDbFile(
                path.join(subDir, ".cache", "database", "clients.db"),
              );
            }
          }
        } catch (_) {}
        cur = parent;
      }
    } catch (_) {}

    if (home) {
      checkTokenFile(
        path.join(home, ".config", "shadow-claw", "control-token.json"),
      );
      checkTokenFile(
        path.join(home, ".cache", "shadow-claw", "control-token.json"),
      );
    }
  }

  candidatesWithTime.sort((a, b) => b.timestamp - a.timestamp);
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const item of candidatesWithTime) {
    if (item.token && !seen.has(item.token)) {
      seen.add(item.token);
      tokens.push(item.token);
    }
  }

  return tokens;
}

export function resolveControlToken(
  customToken?: string,
  cacheDir?: string,
  port?: number,
): string {
  const tokens = resolveControlTokens(customToken, cacheDir, port);
  return tokens[0] || "";
}

export class CliControlClient {
  host: string;
  port: number;
  candidateTokens: string[];
  token: string;
  protocol: string;
  rejectUnauthorized: boolean;
  transport: string;
  cacheDir?: string;
  _webrtcClient: CliWebRtcControlClient | null;

  constructor(options: ControlClientOptions = {}) {
    this.host = options.host || process.env.SHADOWCLAW_HOST || "127.0.0.1";
    this.port =
      options.port || parseInt(process.env.SHADOWCLAW_PORT || "8888", 10);
    this.candidateTokens = resolveControlTokens(
      options.token,
      options.cacheDir,
      this.port,
    );
    this.token = options.token || this.candidateTokens[0] || "";
    this.cacheDir = options.cacheDir;
    const isHttps = Boolean(
      options.https ||
      ["1", "true", "yes"].includes(
        (process.env.SHADOWCLAW_HTTPS || "").toLowerCase().trim(),
      ),
    );
    this.protocol = options.protocol || (isHttps ? "https" : "http");
    this.rejectUnauthorized =
      options.rejectUnauthorized !== undefined
        ? Boolean(options.rejectUnauthorized)
        : Boolean(options.insecure === false);
    this.transport = options.transport || "http";
    this._webrtcClient =
      this.transport === "webrtc"
        ? new CliWebRtcControlClient({
            host: this.host,
            port: this.port,
            path: options.peerPath || "/",
            secure: this.protocol === "https",
            rejectUnauthorized: this.rejectUnauthorized,
            peerId: options.peerId,
            cacheDir: options.cacheDir,
            renewPeerId: Boolean(options.renewPeerId),
          })
        : null;
  }

  async _request({
    method = "GET",
    path: reqPath,
    body = null,
    timeout = 30000,
  }: {
    method?: string;
    path: string;
    body?: any;
    timeout?: number;
  }): Promise<any> {
    const makeReq = (
      tokenToUse: string,
    ): Promise<{
      ok: boolean;
      statusCode?: number;
      data?: any;
      error?: string;
    }> => {
      return new Promise((resolve, reject) => {
        const client = this.protocol === "https" ? https : http;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (tokenToUse) {
          headers["x-control-token"] = tokenToUse;
        }

        const reqOptions: any = {
          hostname: this.host,
          port: this.port,
          path: reqPath,
          method,
          headers,
          timeout,
        };

        if (this.protocol === "https") {
          reqOptions.rejectUnauthorized = this.rejectUnauthorized;
        }

        const req = client.request(reqOptions, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            let parsed = data;
            try {
              parsed = JSON.parse(data);
            } catch (_) {}

            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              resolve({ ok: true, statusCode: res.statusCode, data: parsed });
            } else {
              const errMsg =
                (parsed as any)?.error ||
                `HTTP request failed with status ${res.statusCode}: ${data}`;
              resolve({
                ok: false,
                statusCode: res.statusCode,
                error: errMsg,
                data: parsed,
              });
            }
          });
        });

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
    };

    let res = await makeReq(this.token);
    if (res.ok) {
      return res.data;
    }

    if (
      res.statusCode === 401 &&
      Array.isArray(this.candidateTokens) &&
      this.candidateTokens.length > 1
    ) {
      for (const fallbackToken of this.candidateTokens) {
        if (fallbackToken === this.token) continue;
        const retryRes = await makeReq(fallbackToken);
        if (retryRes.ok) {
          this.token = fallbackToken;
          return retryRes.data;
        }
      }
    }

    throw new Error(
      res.error || `HTTP request failed with status ${res.statusCode}`,
    );
  }

  async listClients(): Promise<any[]> {
    if (this._webrtcClient) {
      try {
        const webrtcClients = await this._webrtcClient.listClients();
        if (webrtcClients && webrtcClients.length > 0) {
          return webrtcClients;
        }
      } catch (_) {}

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

  async sendCommand(
    clientId: string,
    action: string,
    args: any = {},
    timeoutMs: number = 30000,
  ): Promise<any> {
    if (this._webrtcClient) {
      let targetPeerId = clientId;
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
        } catch (_) {}
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

  async listBackups(clientId?: string): Promise<any[]> {
    const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
    const data = await this._request({
      path: `/api/backup/list${query}`,
      method: "GET",
    });
    return data.backups || [];
  }

  async deleteBackup(backupId: string, clientId?: string): Promise<any> {
    const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
    const data = await this._request({
      path: `/api/backup/${encodeURIComponent(backupId)}${query}`,
      method: "DELETE",
    });
    return data;
  }

  async broadcastNotification({
    title = "ShadowClaw",
    body,
    clientId,
  }: {
    title?: string;
    body?: string;
    clientId?: string;
  } = {}): Promise<any> {
    const data = await this._request({
      path: "/push/broadcast",
      method: "POST",
      body: {
        title,
        body,
        ...(clientId ? { clientId } : {}),
      },
    });
    return data;
  }

  async sendNotification(options: any): Promise<any> {
    return this.broadcastNotification(options);
  }

  async listPushSubscriptions(): Promise<any[]> {
    try {
      const data = await this._request({
        path: "/push/subscriptions",
        method: "GET",
      });
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  async listPushClients(): Promise<any[]> {
    try {
      const clientsData = await this._request({
        path: "/push/clients",
        method: "GET",
      });
      if (clientsData && Array.isArray(clientsData.clients)) {
        return clientsData.clients;
      }
    } catch (_) {}

    try {
      const subs = await this.listPushSubscriptions();
      if (Array.isArray(subs) && subs.length > 0) {
        const map = new Map<string, any>();
        for (const sub of subs) {
          const cid =
            (sub.client_id || "").trim() || (sub.id ? String(sub.id) : "");
          if (!cid) continue;
          const existing = map.get(cid);
          if (!existing) {
            map.set(cid, {
              clientId: cid,
              deviceLabel: sub.device_label || undefined,
            });
          } else if (!existing.deviceLabel && sub.device_label) {
            existing.deviceLabel = sub.device_label;
          }
        }
        return Array.from(map.values());
      }
    } catch (_) {}

    try {
      let sqlite: any;
      if (typeof (process as any).getBuiltinModule === "function") {
        sqlite = (process as any).getBuiltinModule("node:sqlite");
      }
      if (sqlite && sqlite.DatabaseSync) {
        const dbPaths = [
          path.join(
            process.cwd(),
            ".cache",
            "database",
            "push-subscriptions.db",
          ),
          path.join(process.cwd(), "database", "push-subscriptions.db"),
          path.join(
            tmpdir(),
            "shadow-claw",
            "database",
            "push-subscriptions.db",
          ),
          path.join(tmpdir(), "shadow-claw", "push-subscriptions.db"),
        ];
        if (this.cacheDir) {
          dbPaths.unshift(
            path.join(this.cacheDir, "database", "push-subscriptions.db"),
            path.join(this.cacheDir, "push-subscriptions.db"),
          );
        }
        for (const p of dbPaths) {
          if (fs.existsSync(p)) {
            const db = new sqlite.DatabaseSync(p);
            const rows = db
              .prepare(
                "SELECT client_id, device_label, id FROM subscriptions ORDER BY created_at DESC, id DESC",
              )
              .all();
            db.close();
            if (rows && rows.length > 0) {
              const map = new Map<string, any>();
              for (const r of rows) {
                const cid =
                  (r.client_id ? `${r.client_id}`.trim() : "") ||
                  (r.id ? String(r.id) : "");
                if (!cid) continue;
                if (!map.has(cid)) {
                  map.set(cid, {
                    clientId: cid,
                    deviceLabel: r.device_label
                      ? `${r.device_label}`.trim()
                      : undefined,
                  });
                }
              }
              return Array.from(map.values());
            }
          }
        }
      }
    } catch (_) {}

    return [];
  }
}
