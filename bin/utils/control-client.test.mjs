import http from "node:http";
import express from "express";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  openClientStore,
  closeClientStore,
} from "../../src/server/client-registry.js";
import { createControlPlane } from "../../src/server/control-plane.js";
import { registerBackupRoutes } from "../../src/server/routes/backup.js";
import { CliControlClient } from "./control-client.mjs";

describe("CliControlClient", () => {
  let app;
  let server;
  let port;
  let token;
  let controlPlane;

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

    await new Promise((resolve) => {
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
});
