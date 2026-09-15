import http from "node:http";
import express from "express";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  openClientStore,
  closeClientStore,
} from "../../server/client-registry.js";
import { createControlPlane } from "../../server/control-plane.js";
import { registerBackupRoutes } from "../../server/routes/backup.js";
import { CliControlClient } from "./control-client.js";

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
});
