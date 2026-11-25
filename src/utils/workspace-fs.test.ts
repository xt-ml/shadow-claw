import { jest } from "@jest/globals";
import {
  DEFAULT_GROUP_ID,
  DEFAULT_GROUP_NAME,
  LEGACY_DB_NAME,
  LEGACY_OPFS_ROOT,
  sanitizeGroupId,
  unsanitizeGroupId,
  sanitizeWorkspaceFilename,
  formatFileSize,
  getOpfsRootName,
  getDbName,
  getAppBasePath,
  getDeploymentNamespace,
  isOpfsAvailable,
  setMockWorkspaceFsStorage,
  resetMockWorkspaceFsStorage,
  listConversations,
  listWorkspaceFiles,
  readWorkspaceFile,
  saveWorkspaceFile,
  deleteWorkspaceFile,
  writeOpfsPathViaWorker,
} from "./workspace-fs.js";
import { resetAppBasePathCache } from "../core/app-routes.js";

describe("workspace-fs", () => {
  afterEach(() => {
    resetMockWorkspaceFsStorage();
    delete (globalThis as any).__SHADOWCLAW_DEPLOY_ID__;
    resetAppBasePathCache();
    jest.restoreAllMocks();
  });

  it("sanitizes and unsanitizes groupIds across br/server/peer/room prefixes", () => {
    expect(sanitizeGroupId("br:main")).toBe("br-main");
    expect(sanitizeGroupId(" server:abc ")).toBe("server-abc");
    expect(sanitizeGroupId("")).toBe("br-main");

    expect(unsanitizeGroupId("br-main")).toBe("br:main");
    expect(unsanitizeGroupId("server-1")).toBe("server:1");
    expect(unsanitizeGroupId("peer-xyz")).toBe("peer:xyz");
    expect(unsanitizeGroupId("room-dev")).toBe("room:dev");
    expect(unsanitizeGroupId("custom")).toBe("custom");
    expect(unsanitizeGroupId("")).toBe(DEFAULT_GROUP_ID);
  });

  it("sanitizes workspace filenames and rejects invalid paths", () => {
    expect(sanitizeWorkspaceFilename("foo/bar/my:song?.json")).toBe(
      "my_song_.json",
    );
    expect(() => sanitizeWorkspaceFilename("")).toThrow();
    expect(() => sanitizeWorkspaceFilename(".")).toThrow();
    expect(() => sanitizeWorkspaceFilename("..")).toThrow();
  });

  it("formats file sizes cleanly", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(-10)).toBe("0 B");
    expect(formatFileSize(Number.NaN)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  it("derives OPFS root and DB names from canonical ShadowClaw deployment namespace", () => {
    expect(getAppBasePath()).toBe("/");
    expect(getDeploymentNamespace()).toBe("");
    expect(getOpfsRootName()).toBe(LEGACY_OPFS_ROOT);
    expect(getDbName()).toBe(LEGACY_DB_NAME);

    (globalThis as any).__SHADOWCLAW_DEPLOY_ID__ = "daw-prod";
    expect(getDeploymentNamespace()).toBe("daw-prod");
    expect(getOpfsRootName()).toBe("shadowclaw-daw-prod");
    expect(getDbName()).toBe("shadowclaw-daw-prod");
  });

  it("supports mock storage CRUD for conversations and files with optional classify hook", async () => {
    setMockWorkspaceFsStorage({
      clearAll: true,
      forceMock: true,
      conversations: [
        { groupId: "br:studio", name: "Studio" },
        { groupId: "br:alpha", name: "Alpha" },
      ],
      files: {
        "br:main": {
          "demo.json": '{"ok":true}',
        },
      },
    });

    expect(isOpfsAvailable()).toBe(false);

    const convs = await listConversations();
    expect(convs[0]).toEqual({
      groupId: DEFAULT_GROUP_ID,
      name: DEFAULT_GROUP_NAME,
      createdAt: 0,
      isDefault: true,
    });
    expect(convs.slice(1).map((c) => c.name)).toEqual(["Alpha", "Studio"]);

    const classify = (name: string) => ({
      ext: name.split(".").pop(),
      isProject: name.endsWith(".json"),
    });

    const initialFiles = await listWorkspaceFiles("br:main", { classify });
    expect(initialFiles).toHaveLength(1);
    expect(initialFiles[0]).toMatchObject({
      name: "demo.json",
      ext: "json",
      isProject: true,
    });

    const saved = await saveWorkspaceFile(
      "br:studio",
      "track.wav",
      new Uint8Array([1, 2, 3, 4]),
    );
    expect(saved).toMatchObject({
      ok: true,
      name: "track.wav",
      bytes: 4,
      groupId: "br:studio",
      path: "groups/br-studio/track.wav",
      storageType: "memory",
    });

    const readBack = await readWorkspaceFile("br:studio", "track.wav", {
      classify,
    });
    expect(readBack.uint8Array).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(readBack.ext).toBe("wav");

    await deleteWorkspaceFile("br:studio", "track.wav");
    await expect(readWorkspaceFile("br:studio", "track.wav")).rejects.toThrow(
      /not found/i,
    );
  });

  it("reads, writes, lists, and deletes via OPFS handles and dispatches save event", async () => {
    const storedBytes = new Map<string, Uint8Array>();

    const makeFileHandle = (name: string) => ({
      kind: "file" as const,
      name,
      async getFile() {
        const data = storedBytes.get(name) || new Uint8Array(0);
        return {
          size: data.byteLength,
          lastModified: 12345,
          async arrayBuffer() {
            return data.buffer.slice(
              data.byteOffset,
              data.byteOffset + data.byteLength,
            );
          },
        };
      },
      async createWritable() {
        return {
          async write(bytes: Uint8Array) {
            storedBytes.set(name, new Uint8Array(bytes));
          },
          async close() {},
        };
      },
    });

    const brMainDir = {
      kind: "directory" as const,
      async *entries() {
        for (const key of storedBytes.keys()) {
          yield [key, makeFileHandle(key)] as const;
        }
      },
      async getFileHandle(name: string, opts?: { create?: boolean }) {
        if (!storedBytes.has(name) && !opts?.create) {
          throw new Error("NotFoundError");
        }
        if (!storedBytes.has(name) && opts?.create) {
          storedBytes.set(name, new Uint8Array(0));
        }
        return makeFileHandle(name);
      },
      async removeEntry(name: string) {
        storedBytes.delete(name);
      },
    };

    const groupsDir = {
      kind: "directory" as const,
      async *entries() {
        yield ["br-main", brMainDir] as const;
      },
      async getDirectoryHandle(name: string) {
        if (name === "br-main") return brMainDir;
        throw new Error("Dir not found");
      },
    };

    const appDir = {
      kind: "directory" as const,
      async getDirectoryHandle(name: string) {
        if (name === "groups") return groupsDir;
        throw new Error("Groups dir not found");
      },
    };

    const rootDir = {
      async getDirectoryHandle(name: string) {
        if (name === LEGACY_OPFS_ROOT) return appDir;
        throw new Error("App dir not found");
      },
    };

    Object.defineProperty(navigator, "storage", {
      value: { getDirectory: async () => rootDir },
      configurable: true,
    });

    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("test-fs-saved", listener);

    try {
      expect(isOpfsAvailable()).toBe(true);
      const saveRes = await saveWorkspaceFile(
        DEFAULT_GROUP_ID,
        "notes.txt",
        "hello opfs",
        { eventName: "test-fs-saved" },
      );
      expect(saveRes).toMatchObject({
        ok: true,
        name: "notes.txt",
        storageType: "opfs",
      });
      expect(events).toHaveLength(1);
      expect(events[0].detail).toEqual({
        groupId: DEFAULT_GROUP_ID,
        filename: "notes.txt",
        path: "groups/br-main/notes.txt",
      });

      const files = await listWorkspaceFiles(DEFAULT_GROUP_ID);
      expect(files.map((f) => f.name)).toEqual(["notes.txt"]);

      const readRes = await readWorkspaceFile(DEFAULT_GROUP_ID, "notes.txt");
      expect(readRes.text).toBe("hello opfs");

      await deleteWorkspaceFile(DEFAULT_GROUP_ID, "notes.txt");
      expect(await listWorkspaceFiles(DEFAULT_GROUP_ID)).toEqual([]);
    } finally {
      window.removeEventListener("test-fs-saved", listener);
    }
  });

  it("writeOpfsPathViaWorker throws clearly when Worker is unavailable", async () => {
    const origWorker = (globalThis as any).Worker;
    delete (globalThis as any).Worker;
    try {
      await expect(
        writeOpfsPathViaWorker(
          ["shadowclaw", "groups", "br-main", "a.txt"],
          "hi",
        ),
      ).rejects.toThrow(/Worker/i);
    } finally {
      (globalThis as any).Worker = origWorker;
    }
  });
});
