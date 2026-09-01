import {
  openClientStore,
  closeClientStore,
  registerClient,
  updateClientHeartbeat,
  unregisterClient,
  getClient,
  getAllClients,
  pruneStaleClients,
  generateControlToken,
  getOrCreateControlToken,
  saveControlTokenFile,
  readControlTokenFile,
  getControlTokenFilePath,
} from "./client-registry.js";
import fs from "node:fs";
import path from "node:path";

beforeEach(() => {
  openClientStore(":memory:");
});

afterEach(() => {
  closeClientStore();
});

const MOCK_CLIENT_1 = {
  clientId: "sc-client-alpha",
  deviceLabel: "iPad Safari",
  capabilities: ["opfs", "webmcp", "push"],
  version: "1.23.4",
};

const MOCK_CLIENT_2 = {
  clientId: "sc-client-beta",
  deviceLabel: "Desktop Chrome",
  capabilities: ["opfs", "webmcp", "peerjs"],
  version: "1.23.4",
};

describe("client-registry", () => {
  describe("openClientStore", () => {
    it("creates tables on first open", () => {
      const db = openClientStore(":memory:");
      const clients = db.prepare("SELECT * FROM clients").all();
      expect(clients).toEqual([]);
    });

    it("returns the existing database instance if already opened", () => {
      const db1 = openClientStore(":memory:");
      const db2 = openClientStore(":memory:");
      expect(db1).toBe(db2);
    });
  });

  describe("registerClient", () => {
    it("registers a new client with timestamps", () => {
      const client = registerClient(MOCK_CLIENT_1);
      expect(client.clientId).toBe(MOCK_CLIENT_1.clientId);
      expect(client.deviceLabel).toBe(MOCK_CLIENT_1.deviceLabel);
      expect(client.capabilities).toEqual(MOCK_CLIENT_1.capabilities);
      expect(client.version).toBe(MOCK_CLIENT_1.version);
      expect(typeof client.connectedAt).toBe("number");
      expect(typeof client.lastSeen).toBe("number");

      const fetched = getClient(MOCK_CLIENT_1.clientId);
      expect(fetched).toEqual(client);
    });

    it("updates existing client registration when re-registered", () => {
      registerClient(MOCK_CLIENT_1);
      const updated = registerClient({
        ...MOCK_CLIENT_1,
        deviceLabel: "iPad Pro Safari (Updated)",
        capabilities: ["opfs", "webmcp", "push", "peerjs"],
      });

      expect(updated.deviceLabel).toBe("iPad Pro Safari (Updated)");
      expect(updated.capabilities).toEqual([
        "opfs",
        "webmcp",
        "push",
        "peerjs",
      ]);

      const all = getAllClients();
      expect(all).toHaveLength(1);
      expect(all[0].deviceLabel).toBe("iPad Pro Safari (Updated)");
    });
  });

  describe("updateClientHeartbeat", () => {
    it("updates lastSeen timestamp for an existing client", () => {
      registerClient(MOCK_CLIENT_1);
      const before = getClient(MOCK_CLIENT_1.clientId)!;

      const targetTime = before.lastSeen + 5000;
      const updated = updateClientHeartbeat(MOCK_CLIENT_1.clientId, targetTime);
      expect(updated).toBe(true);

      const after = getClient(MOCK_CLIENT_1.clientId)!;
      expect(after.lastSeen).toBe(targetTime);
      expect(after.connectedAt).toBe(before.connectedAt);
    });

    it("returns false when updating a nonexistent client", () => {
      const updated = updateClientHeartbeat("nonexistent-client");
      expect(updated).toBe(false);
    });
  });

  describe("unregisterClient", () => {
    it("removes a registered client", () => {
      registerClient(MOCK_CLIENT_1);
      registerClient(MOCK_CLIENT_2);
      expect(getAllClients()).toHaveLength(2);

      const removed = unregisterClient(MOCK_CLIENT_1.clientId);
      expect(removed).toBe(true);

      expect(getClient(MOCK_CLIENT_1.clientId)).toBeNull();
      expect(getAllClients()).toHaveLength(1);
      expect(getAllClients()[0].clientId).toBe(MOCK_CLIENT_2.clientId);
    });

    it("returns false when unregistering a nonexistent client", () => {
      const removed = unregisterClient("nonexistent-client");
      expect(removed).toBe(false);
    });
  });

  describe("getAllClients", () => {
    it("returns all registered clients ordered by lastSeen descending", () => {
      registerClient(MOCK_CLIENT_1);
      registerClient(MOCK_CLIENT_2);

      updateClientHeartbeat(MOCK_CLIENT_1.clientId, 1000);
      updateClientHeartbeat(MOCK_CLIENT_2.clientId, 2000);

      const clients = getAllClients();
      expect(clients).toHaveLength(2);
      expect(clients[0].clientId).toBe(MOCK_CLIENT_2.clientId);
      expect(clients[1].clientId).toBe(MOCK_CLIENT_1.clientId);
    });
  });

  describe("pruneStaleClients", () => {
    it("prunes clients whose lastSeen is older than maxAgeMs", () => {
      const now = 100_000;
      registerClient(MOCK_CLIENT_1);
      registerClient(MOCK_CLIENT_2);

      // Client 1 was seen 50s ago, Client 2 was seen 10s ago
      updateClientHeartbeat(MOCK_CLIENT_1.clientId, now - 50_000);
      updateClientHeartbeat(MOCK_CLIENT_2.clientId, now - 10_000);

      // Prune anything older than 30s
      const prunedCount = pruneStaleClients(30_000, now);
      expect(prunedCount).toBe(1);

      const remaining = getAllClients();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].clientId).toBe(MOCK_CLIENT_2.clientId);
    });
  });

  describe("generateControlToken", () => {
    it("generates a high-entropy random hex token (64 characters / 256-bit)", () => {
      const token1 = generateControlToken();
      const token2 = generateControlToken();
      expect(typeof token1).toBe("string");
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
      expect(/^[0-9a-f]{64}$/.test(token1)).toBe(true);
    });

    it("supports custom byte lengths", () => {
      const token = generateControlToken(16);
      expect(token).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/.test(token)).toBe(true);
    });
  });

  describe("getOrCreateControlToken", () => {
    let tempCacheDir: string;

    beforeEach(() => {
      tempCacheDir = path.join(
        process.cwd(),
        ".cache",
        "test-token-unit-" +
          Date.now() +
          "-" +
          Math.random().toString(36).slice(2),
      );
    });

    afterEach(() => {
      try {
        fs.rmSync(tempCacheDir, { recursive: true, force: true });
      } catch (_) {}
    });

    it("generates a new token if none exists", () => {
      const token = getOrCreateControlToken(undefined, tempCacheDir);
      expect(typeof token).toBe("string");
      expect(token).toHaveLength(64);
    });

    it("returns the existing token on subsequent calls", () => {
      const token1 = getOrCreateControlToken(undefined, tempCacheDir);
      const token2 = getOrCreateControlToken(undefined, tempCacheDir);
      expect(token1).toBe(token2);
    });

    it("persists a custom configured token if provided", () => {
      closeClientStore();
      openClientStore(":memory:");
      const customToken = "custom-secret-token-123456";
      const token = getOrCreateControlToken(customToken, tempCacheDir);
      expect(token).toBe(customToken);

      const fetched = getOrCreateControlToken(undefined, tempCacheDir);
      expect(fetched).toBe(customToken);
    });

    it("saves and reads token to .cache/control-token.json with timestamps", () => {
      const saved = saveControlTokenFile(
        "my-secret-test-token",
        tempCacheDir,
        1700000000000,
      );

      expect(saved.token).toBe("my-secret-test-token");
      expect(saved.createdAt).toBe(1700000000000);
      expect(saved.createdAtIso).toBe(new Date(1700000000000).toISOString());

      const read = readControlTokenFile(tempCacheDir);
      expect(read).toEqual(saved);

      const filePath = getControlTokenFilePath(tempCacheDir);
      expect(fs.existsSync(filePath)).toBe(true);

      const rawJson = JSON.parse(fs.readFileSync(filePath, "utf8"));
      expect(rawJson.token).toBe("my-secret-test-token");
      expect(rawJson.createdAt).toBe(1700000000000);
    });
  });
});
