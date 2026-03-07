import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("../config.mjs", () => ({
  CONFIG_KEYS: { STORAGE_HANDLE: "storageHandle" },
  OPFS_ROOT: "sc-root",
}));

jest.unstable_mockModule("../db/deleteConfig.mjs", () => ({
  deleteConfig: jest.fn(),
}));

jest.unstable_mockModule("../db/getConfig.mjs", () => ({
  getConfig: jest.fn(),
}));

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.mjs", () => ({
  parsePath: jest.fn(),
}));

const { getGroupDir } = await import("./getGroupDir.mjs");
const { listGroupFiles } = await import("./listGroupFiles.mjs");
const { parsePath } = await import("./parsePath.mjs");
const { readGroupFile } = await import("./readGroupFile.mjs");
const { writeGroupFile } = await import("./writeGroupFile.mjs");

// Mock FileSystemDirectoryHandle globally
class MockFileSystemDirectoryHandle {
  constructor(name = "mock-dir") {
    this.name = name;
    this.kind = "directory";
  }

  async queryPermission() {
    return "granted";
  }

  async getDirectoryHandle() {
    return new MockFileSystemDirectoryHandle();
  }
}

global.FileSystemDirectoryHandle = MockFileSystemDirectoryHandle;

// Mock navigator.storage
const mockOpfsRoot = new MockFileSystemDirectoryHandle("opfs-root");
Object.defineProperty(global, "navigator", {
  value: {
    storage: {
      getDirectory: jest.fn().mockResolvedValue(mockOpfsRoot),
    },
  },
  configurable: true,
});

describe("storage.mjs", () => {
  let deleteConfig;
  let getConfig;
  let mockDirHandle;
  let mockFileHandle;
  let mockWritable;
  let storage;

  beforeEach(async () => {
    jest.resetModules();

    deleteConfig = (await import("../db/deleteConfig.mjs")).deleteConfig;
    getConfig = (await import("../db/getConfig.mjs")).getConfig;
    storage = await import("./storage.mjs");

    mockWritable = {
      write: jest.fn(),
      close: jest.fn(),
    };

    mockFileHandle = {
      createWritable: jest.fn().mockResolvedValue(mockWritable),
      getFile: jest.fn().mockResolvedValue({
        text: jest.fn().mockResolvedValue("file content"),
      }),
    };

    mockDirHandle = {
      getDirectoryHandle: jest.fn().mockReturnThis(),
      getFileHandle: jest.fn().mockResolvedValue(mockFileHandle),
    };

    getGroupDir.mockResolvedValue(mockDirHandle);
    parsePath.mockReturnValue({ dirs: ["subdir"], filename: "test.txt" });

    // Reset internal explicitRoot
    storage.resetStorageDirectory({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const db = {};

  describe("getStorageRoot", () => {
    it("should return OPFS root by default", async () => {
      getConfig.mockResolvedValueOnce(null);

      const root = await storage.getStorageRoot(db);

      expect(root.name).toBe("mock-dir"); // From OPFS fallback
      expect(global.navigator.storage.getDirectory).toHaveBeenCalled();
    });

    it("should return explicit root if set", async () => {
      const explicit = new MockFileSystemDirectoryHandle("explicit");
      storage.setStorageRoot(explicit);

      const root = await storage.getStorageRoot(db);
      expect(root.name).toBe("explicit");
    });

    it("should return handle from DB if valid", async () => {
      const dbHandle = new MockFileSystemDirectoryHandle("db-handle");
      getConfig.mockResolvedValueOnce(dbHandle);

      const root = await storage.getStorageRoot(db);
      expect(root.name).toBe("db-handle");
    });
  });

  describe("getStorageStatus", () => {
    it("should return opfs status by default", async () => {
      getConfig.mockResolvedValueOnce(null);
      const status = await storage.getStorageStatus(db);

      expect(status.type).toBe("opfs");
      expect(status.name).toBe("OPFS");
    });

    it("should return local status if explicit root set", async () => {
      storage.setStorageRoot(new MockFileSystemDirectoryHandle("local-root"));
      const status = await storage.getStorageStatus(db);

      expect(status.type).toBe("local");
      expect(status.name).toBe("local-root");
    });
  });

  describe("writeGroupFile", () => {
    it("should write content to file", async () => {
      await writeGroupFile({}, "group1", "subdir/test.txt", "new content");

      expect(mockDirHandle.getDirectoryHandle).toHaveBeenCalledWith("subdir", {
        create: true,
      });

      expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith("test.txt", {
        create: true,
      });

      expect(mockWritable.write).toHaveBeenCalledWith("new content");
      expect(mockWritable.close).toHaveBeenCalled();
    });
  });

  describe("readGroupFile", () => {
    it("should read content from file", async () => {
      const content = await readGroupFile({}, "group1", "subdir/test.txt");

      expect(content).toBe("file content");
      expect(mockDirHandle.getDirectoryHandle).toHaveBeenCalledWith("subdir");
      expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith("test.txt");
    });
  });

  describe("listGroupFiles", () => {
    it("should list entries with / for directories", async () => {
      mockDirHandle.entries = async function* () {
        yield ["file1.txt", { kind: "file" }];
        yield ["dir1", { kind: "directory" }];
      };

      const entries = await listGroupFiles({}, "group1", "subdir");
      expect(entries).toEqual(["dir1/", "file1.txt"]);
    });
  });

  describe("getStorageRoot edge cases", () => {
    it("should handle permission denied by falling back (implicit check)", async () => {
      const dbHandle = new MockFileSystemDirectoryHandle("db-handle");
      dbHandle.queryPermission = jest.fn().mockResolvedValue("denied");
      getConfig.mockResolvedValueOnce(dbHandle);

      const root = await storage.getStorageRoot(db);
      expect(root.name).toBe("db-handle");
    });

    it("should log warning and fallback to OPFS on getConfig error", async () => {
      const consoleSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      getConfig.mockRejectedValueOnce(new Error("DB Error"));

      const root = await storage.getStorageRoot(db);
      expect(root.name).toBe("mock-dir");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to retrieve local storage handle:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getStorageStatus edge cases", () => {
    it("should handle handle queryPermission in getStorageStatus", async () => {
      const dbHandle = new MockFileSystemDirectoryHandle("db-handle");
      dbHandle.queryPermission = jest.fn().mockResolvedValue("prompt");
      getConfig.mockResolvedValueOnce(dbHandle);

      const status = await storage.getStorageStatus(db);
      expect(status.permission).toBe("prompt");
    });

    it("should handle error in getStorageStatus", async () => {
      const consoleSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      getConfig.mockRejectedValueOnce(new Error("DB Error"));

      const status = await storage.getStorageStatus(db);
      expect(status.type).toBe("opfs");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
