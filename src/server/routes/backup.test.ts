import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";
import { openClientStore, closeClientStore } from "../client-registry.js";
import { registerBackupRoutes } from "./backup.js";
import type { AddressInfo } from "node:net";

function makeHttpRequest(options: {
  method?: string;
  path: string;
  port: number;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: options.port,
        path: options.path,
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let parsed = body;
          try {
            parsed = JSON.parse(body);
          } catch (_) {}
          resolve({
            status: res.statusCode || 0,
            data: parsed,
            headers: res.headers,
          });
        });
      },
    );
    req.on("error", reject);
    if (options.body) {
      req.write(
        typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
      );
    }
    req.end();
  });
}

describe("backup routes", () => {
  let app: express.Express;
  let server: http.Server;
  let port: number;
  let token: string;
  let testBackupsDir: string;

  beforeEach(async () => {
    openClientStore(":memory:");
    token = "backup-test-token";
    testBackupsDir = path.join(
      process.cwd(),
      ".cache",
      "test-backups-" + Date.now(),
    );

    app = express();
    app.use(express.json({ limit: "50mb" }));
    registerBackupRoutes(app, {
      backupsDir: testBackupsDir,
      token,
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    closeClientStore();
    try {
      if (fs.existsSync(testBackupsDir)) {
        fs.rmSync(testBackupsDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  it("rejects unauthorized external requests without token", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/api/backup/list",
      headers: { host: "127.0.0.1", origin: "https://attacker.com" },
    });

    expect(res.status).toBe(401);
  });

  it("allows same-origin browser requests without explicit token header", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/api/backup/list",
      headers: {
        host: `127.0.0.1:${port}`,
        origin: `http://127.0.0.1:${port}`,
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.backups).toBeDefined();
  });

  it("allows GitHub Pages origin requests without explicit token header", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/api/backup/list",
      headers: {
        host: `127.0.0.1:${port}`,
        origin: "https://xt-ml.github.io",
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.backups).toBeDefined();
  });

  it("uploads a file and verifies on disk", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/api/backup/upload",
      method: "POST",
      headers: { "x-control-token": token },
      body: {
        clientId: "client-ipad",
        backupId: "bk-01",
        path: "workspace/MEMORY.md",
        content: "# Client Memory\nHello from iPad",
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);

    const savedFilePath = path.join(
      testBackupsDir,
      "client-ipad",
      "bk-01",
      "workspace",
      "MEMORY.md",
    );
    expect(fs.existsSync(savedFilePath)).toBe(true);
    expect(fs.readFileSync(savedFilePath, "utf-8")).toBe(
      "# Client Memory\nHello from iPad",
    );
  });

  it("prevents directory traversal in backup upload paths", async () => {
    const res = await makeHttpRequest({
      port,
      path: "/api/backup/upload",
      method: "POST",
      headers: { "x-control-token": token },
      body: {
        clientId: "client-ipad",
        backupId: "bk-01",
        path: "../../../etc/passwd",
        content: "malicious content",
      },
    });

    expect(res.status).toBe(400);
    expect(res.data.error).toContain("Invalid path");
  });

  it("finalizes backup and records in SQLite database", async () => {
    // 1. Upload a file
    await makeHttpRequest({
      port,
      path: "/api/backup/upload",
      method: "POST",
      headers: { "x-control-token": token },
      body: {
        clientId: "client-ipad",
        backupId: "bk-01",
        path: "notes.txt",
        content: "note content",
      },
    });

    // 2. Complete backup
    const completeRes = await makeHttpRequest({
      port,
      path: "/api/backup/complete",
      method: "POST",
      headers: { "x-control-token": token },
      body: {
        clientId: "client-ipad",
        backupId: "bk-01",
        fileCount: 1,
        totalBytes: 12,
      },
    });

    expect(completeRes.status).toBe(200);
    expect(completeRes.data.success).toBe(true);
    expect(completeRes.data.backupId).toBe("bk-01");

    // 3. List backups
    const listRes = await makeHttpRequest({
      port,
      path: "/api/backup/list?clientId=client-ipad",
      headers: { "x-control-token": token },
    });

    expect(listRes.status).toBe(200);
    expect(listRes.data.backups).toHaveLength(1);
    expect(listRes.data.backups[0].id).toBe("bk-01");
    expect(listRes.data.backups[0].fileCount).toBe(1);
  });

  it("deletes a backup from disk and registry", async () => {
    await makeHttpRequest({
      port,
      path: "/api/backup/upload",
      method: "POST",
      headers: { "x-control-token": token },
      body: {
        clientId: "client-del",
        backupId: "bk-del-01",
        path: "file.txt",
        content: "to be deleted",
      },
    });

    await makeHttpRequest({
      port,
      path: "/api/backup/complete",
      method: "POST",
      headers: { "x-control-token": token },
      body: {
        clientId: "client-del",
        backupId: "bk-del-01",
        fileCount: 1,
        totalBytes: 13,
      },
    });

    const delRes = await makeHttpRequest({
      port,
      path: "/api/backup/bk-del-01?clientId=client-del",
      method: "DELETE",
      headers: { "x-control-token": token },
    });

    expect(delRes.status).toBe(200);
    expect(delRes.data.success).toBe(true);

    const listRes = await makeHttpRequest({
      port,
      path: "/api/backup/list?clientId=client-del",
      headers: { "x-control-token": token },
    });

    expect(listRes.data.backups).toHaveLength(0);
  });
});
