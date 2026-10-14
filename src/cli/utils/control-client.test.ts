import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import express from "express";
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import {
  openClientStore,
  closeClientStore,
} from "../../server/client-registry.js";
import { createControlPlane } from "../../server/control-plane.js";
import { registerBackupRoutes } from "../../server/routes/backup.js";
import { CliControlClient, resolveControlToken } from "./control-client.js";

describe("src/cli/utils/control-client.ts", () => {
  let app: any;
  let server: any;
  let port: number;
  let token: string;
  let controlPlane: any;

  beforeEach(async () => {
    openClientStore(":memory:");
    token = "cli-test-token";

    app = express();
    app.use(express.json());
    server = http.createServer(app);

    controlPlane = createControlPlane({
      httpServer: server,
      app,
      token,
    });

    registerBackupRoutes(app, {
      backupsDir: "/tmp/test-cli-backups",
      token,
    });

    app.post("/push/broadcast", (req: any, res: any) => {
      res.json({ sent: 1, failed: 0, received: req.body });
    });

    app.post("/api/control/command", (req: any, res: any) => {
      res.json({ ok: true, result: "command-executed", body: req.body });
    });

    app.delete("/api/backup/:id", (req: any, res: any) => {
      res.json({ ok: true, deleted: req.params.id });
    });

    app.get("/push/subscriptions", (_req: any, res: any) => {
      res.json([
        { client_id: "client-sub-1", device_label: "Device 1" },
        { client_id: "client-sub-2" },
      ]);
    });

    app.get("/push/clients", (_req: any, res: any) => {
      res.json({
        clients: [{ clientId: "client-push-1", deviceLabel: "Push 1" }],
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    controlPlane.close();
    await new Promise((resolve) => server.close(resolve));
    closeClientStore();
  });

  it("lists clients via CLI control client", async () => {
    const client = new CliControlClient({
      host: "127.0.0.1",
      port,
      token,
    });

    const clients = await client.listClients();
    expect(Array.isArray(clients)).toBe(true);
  });

  it("handles authentication failure when listing clients with wrong token", async () => {
    const client = new CliControlClient({
      host: "127.0.0.1",
      port,
      token: "wrong-token",
    });

    await expect(client.listClients()).rejects.toThrow(/Unauthorized/i);
  });

  it("lists backups via CLI control client", async () => {
    const client = new CliControlClient({
      host: "127.0.0.1",
      port,
      token,
    });

    const backups = await client.listBackups();
    expect(Array.isArray(backups)).toBe(true);
  });

  it("detects HTTPS protocol from options and environment", () => {
    const client1 = new CliControlClient({ https: true });
    expect(client1.protocol).toBe("https");

    process.env.SHADOWCLAW_HTTPS = "1";
    const client2 = new CliControlClient();
    expect(client2.protocol).toBe("https");
    delete process.env.SHADOWCLAW_HTTPS;
  });

  it("broadcasts push notifications via broadcastNotification", async () => {
    const client = new CliControlClient({
      host: "127.0.0.1",
      port,
      token,
    });

    const result = await client.broadcastNotification({
      title: "Test Title",
      body: "Test Body",
    });

    expect(result).toBeDefined();
    expect(result.sent).toBe(1);
    expect(result.received).toEqual({
      title: "Test Title",
      body: "Test Body",
    });
  });

  it("sends targeted push notification with clientId via sendNotification", async () => {
    const client = new CliControlClient({
      host: "127.0.0.1",
      port,
      token,
    });

    const result = await client.sendNotification({
      title: "Targeted Alert",
      body: "Hello specific client",
      clientId: "client-target-42",
    });

    expect(result).toBeDefined();
    expect(result.sent).toBe(1);
    expect(result.received).toEqual({
      title: "Targeted Alert",
      body: "Hello specific client",
      clientId: "client-target-42",
    });
  });

  it("automatically falls back to secondary candidate tokens on 401 Unauthorized", async () => {
    const client = new CliControlClient({
      host: "127.0.0.1",
      port,
      token: "initial-wrong-token",
    });
    client.candidateTokens = ["initial-wrong-token", token];

    const clients = await client.listClients();
    expect(Array.isArray(clients)).toBe(true);
    expect(client.token).toBe(token);
  });

  it("deletes a backup via deleteBackup", async () => {
    const client = new CliControlClient({
      host: "127.0.0.1",
      port,
      token,
    });
    const res = await client.deleteBackup("backup-123", "client-1");
    expect(res).toEqual({ success: true, deleted: "backup-123" });
  });

  it("lists push subscriptions and clients", async () => {
    const client = new CliControlClient({
      host: "127.0.0.1",
      port,
      token,
    });
    const subs = await client.listPushSubscriptions();
    expect(subs).toHaveLength(2);

    const pushClients = await client.listPushClients();
    expect(pushClients).toHaveLength(1);
    expect(pushClients[0].clientId).toBe("client-push-1");
  });

  it("sends commands and files via sendCommand and sendFile", async () => {
    const client = new CliControlClient({
      host: "127.0.0.1",
      port,
      token,
    });
    await expect(
      client.sendCommand("client-1", "ping", { foo: "bar" }),
    ).rejects.toThrow("Client not connected: client-1");

    // sendFile error: file not found
    await expect(
      client.sendFile("client-1", "/non/existent/file.txt"),
    ).rejects.toThrow("File not found");

    // sendFile error: directory
    await expect(client.sendFile("client-1", os.tmpdir())).rejects.toThrow(
      "Cannot send directory",
    );

    // sendFile success attempt
    const tmpFile = path.join(os.tmpdir(), `test-file-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, "hello shadow-claw", "utf8");
    try {
      await expect(
        client.sendFile("client-1", tmpFile, { prompt: "Read this" }),
      ).rejects.toThrow("Client not connected: client-1");
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("supports WebRTC transport delegation and fallbacks", async () => {
    const client = new CliControlClient({
      host: "127.0.0.1",
      port,
      token,
      transport: "webrtc",
    });
    expect(client._webrtcClient).not.toBeNull();

    // 1. listClients with webrtc clients
    client._webrtcClient!.listClients = jest
      .fn()
      .mockResolvedValue([
        { clientId: "client-peer-ok", peerId: "peer-ok-id" },
        { clientId: "client-no-peer" },
      ]);
    client._webrtcClient!.sendCommand = jest
      .fn()
      .mockResolvedValue({ ok: true, webrtc: true });

    const clients = await client.listClients();
    expect(clients[0].clientId).toBe("client-peer-ok");

    // 2. sendCommand with matching peerId
    const cmdRes = await client.sendCommand(
      "client-peer-ok",
      "test-action",
      {},
    );
    expect(cmdRes).toEqual({ ok: true, webrtc: true });
    expect(client._webrtcClient!.sendCommand).toHaveBeenCalledWith(
      "peer-ok-id",
      "test-action",
      {},
      30000,
    );

    // 3. sendCommand with matching client that has NO peerId (triggers warn)
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await client.sendCommand("client-no-peer", "test-action", {});
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("has no PeerJS peer ID registered"),
      );
    } finally {
      warnSpy.mockRestore();
    }

    // 4. listClients fallback to control plane when webrtc listClients returns empty
    client._webrtcClient!.listClients = jest.fn().mockResolvedValue([]);
    const cpClients = await client.listClients();
    expect(Array.isArray(cpClients)).toBe(true);
  });

  it("resolves control token from cacheDir and custom options", () => {
    expect(resolveControlToken("custom-tok-123")).toBe("custom-tok-123");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrl-tok-test-"));
    try {
      const tokFile = path.join(tempDir, "control-token.json");
      fs.writeFileSync(
        tokFile,
        JSON.stringify({ token: "cached-file-tok" }),
        "utf8",
      );
      const resolved = resolveControlToken(undefined, tempDir);
      expect(resolved).toBe("cached-file-tok");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("falls back to listPushSubscriptions when /push/clients fails", async () => {
    const client = new CliControlClient({
      host: "127.0.0.1",
      port,
      token,
    });
    jest
      .spyOn(client as any, "_request")
      .mockImplementation(async (opts: any) => {
        if (opts.path === "/push/clients") {
          throw new Error("404 Not Found");
        }
        if (opts.path === "/push/subscriptions") {
          return [
            { client_id: "client-sub-1", device_label: "Device 1" },
            { client_id: "client-sub-1", device_label: "Device 1 duplicate" },
            { id: 42, device_label: "Device ID Only" },
          ];
        }
        return {};
      });

    const pushClients = await client.listPushClients();
    expect(pushClients).toHaveLength(2);
    expect(pushClients[0]).toEqual({
      clientId: "client-sub-1",
      deviceLabel: "Device 1",
    });
    expect(pushClients[1]).toEqual({
      clientId: "42",
      deviceLabel: "Device ID Only",
    });
  });

  it("falls back to sqlite push-subscriptions.db when both endpoints fail", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "control-client-sqlite-"),
    );
    try {
      const sqlite = (process as any).getBuiltinModule?.("node:sqlite");
      if (sqlite && sqlite.DatabaseSync) {
        const dbFile = path.join(tempDir, "push-subscriptions.db");
        const db = new sqlite.DatabaseSync(dbFile);
        db.exec(
          "CREATE TABLE subscriptions (id INTEGER PRIMARY KEY, client_id TEXT, device_label TEXT, created_at INTEGER);",
        );
        db.prepare(
          "INSERT INTO subscriptions (id, client_id, device_label, created_at) VALUES (?, ?, ?, ?)",
        ).run(1, "sql-client-1", "Desk 1", Date.now());
        db.prepare(
          "INSERT INTO subscriptions (id, client_id, device_label, created_at) VALUES (?, ?, ?, ?)",
        ).run(2, "", "No CID", Date.now());
        db.close();

        const client = new CliControlClient({
          host: "127.0.0.1",
          port,
          token,
          cacheDir: tempDir,
        });
        jest
          .spyOn(client as any, "_request")
          .mockRejectedValue(new Error("Network failure"));

        const clients = await client.listPushClients();
        expect(clients.length).toBe(2);
        const c1 = clients.find((c) => c.clientId === "sql-client-1");
        expect(c1).toBeDefined();
        expect(c1?.deviceLabel).toBe("Desk 1");
        const c2 = clients.find((c) => c.clientId === "2");
        expect(c2).toBeDefined();
        expect(c2?.deviceLabel).toBe("No CID");
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
