import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("../config.js", () => ({
  CONFIG_KEYS: { STORAGE_HANDLE: "storageHandle" },
  OPFS_ROOT: "sc-root",
}));

jest.unstable_mockModule("../db/deleteConfig.js", () => ({
  deleteConfig: jest.fn(),
}));

jest.unstable_mockModule("../db/getConfig.js", () => ({
  getConfig: jest.fn(),
}));

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.js", () => ({
  parsePath: jest.fn(),
}));

const { getGroupDir } = await import("./getGroupDir.js");
const { listGroupFiles } = await import("./listGroupFiles.js");
const { parsePath } = await import("./parsePath.js");
const { readGroupFile } = await import("./readGroupFile.js");
const { writeGroupFile } = await import("./writeGroupFile.js");

// Mock FileSystemDirectoryHandle globally
class MockFileSystemDirectoryHandle {
  name;
  kind = "directory";

  constructor(name = "mock-dir") {
    this.name = name;
  }

  async queryPermission() {
    return "granted";
  }

  async getDirectoryHandle() {
    return new MockFileSystemDirectoryHandle();
  }
}

(global as any).FileSystemDirectoryHandle = MockFileSystemDirectoryHandle;

// Mock navigator.storage
const mockOpfsRoot = new MockFileSystemDirectoryHandle("opfs-root");
Object.defineProperty(global, "navigator", {
  value: {
    storage: {
      getDirectory: (jest.fn() as any).mockResolvedValue(mockOpfsRoot),
    },
  },
  configurable: true,
});

describe("storage.js", () => {
  let deleteConfig;
  let getConfig;
  let mockDirHandle;
  let mockFileHandle;
  let mockWritable;
  let storage;

  beforeEach(async () => {
    jest.resetModules();

    deleteConfig = (await import("../db/deleteConfig.js")).deleteConfig;
    getConfig = (await import("../db/getConfig.js")).getConfig;
    storage = await import("./storage.js");

    mockWritable = {
      write: jest.fn(),
      close: jest.fn(),
    };

    mockFileHandle = {
      createWritable: (jest.fn() as any).mockResolvedValue(mockWritable),

      getFile: (jest.fn() as any).mockResolvedValue({
        text: (jest.fn() as any).mockResolvedValue("file content"),
      }),
    };

    mockDirHandle = {
      getDirectoryHandle: jest.fn().mockReturnThis(),

      getFileHandle: (jest.fn() as any).mockResolvedValue(mockFileHandle),
    };

    (getGroupDir as any).mockResolvedValue(mockDirHandle);

    (parsePath as any).mockReturnValue({
      dirs: ["subdir"],
      filename: "test.txt",
    });

    // Reset internal explicitRoot
    storage.resetStorageDirectory({} as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const db: any = {} as any;

  describe("getStorageRoot", () => {
    it("should return OPFS root by default", async () => {
      (getConfig as any).mockResolvedValueOnce(null);

      const root = await storage.getStorageRoot(db);

      expect(root.name).toBe("mock-dir"); // From OPFS fallback
      expect((global as any).navigator.storage.getDirectory).toHaveBeenCalled();
    });

    it("should return explicit root if set", async () => {
      const explicit = new MockFileSystemDirectoryHandle("explicit");
      storage.setStorageRoot(explicit);

      const root = await storage.getStorageRoot(db);
      expect(root.name).toBe("explicit");
    });

    it("should return handle from DB if valid", async () => {
      const dbHandle = new MockFileSystemDirectoryHandle("db-handle");
      (getConfig as any).mockResolvedValueOnce(dbHandle);

      const root = await storage.getStorageRoot(db);
      expect(root.name).toBe("db-handle");
    });

    it("does not silently fallback to OPFS when a local handle exists", async () => {
      const dbHandle: any = {
        name: "local-no-writable-probe",

        queryPermission: (jest.fn() as any).mockResolvedValue("granted"),
        getDirectoryHandle: jest.fn(),
        getFileHandle: jest.fn(),
      };

      (getConfig as any).mockResolvedValueOnce(dbHandle);

      const root = await storage.getStorageRoot(db);
      expect(root).toBe(dbHandle);
    });
  });

  describe("getStorageStatus", () => {
    it("should return opfs status by default", async () => {
      (getConfig as any).mockResolvedValueOnce(null);
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
      await writeGroupFile(
        {} as any,
        "group1",
        "subdir/test.txt",
        "new content",
      );

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
      const content = await readGroupFile(
        {} as any,
        "group1",
        "subdir/test.txt",
      );

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

      const entries = await listGroupFiles({} as any, "group1", "subdir");
      expect(entries).toEqual(["dir1/", "file1.txt"]);
    });
  });

  describe("getStorageRoot edge cases", () => {
    it("should handle permission denied by falling back (implicit check)", async () => {
      const dbHandle = new MockFileSystemDirectoryHandle("db-handle");

      dbHandle.queryPermission = (jest.fn() as any).mockResolvedValue("denied");
      (getConfig as any).mockResolvedValueOnce(dbHandle);

      const root = await storage.getStorageRoot(db);
      expect(root.name).toBe("db-handle");
    });

    it("should call requestPermission when queryPermission returns prompt", async () => {
      const dbHandle: any = new MockFileSystemDirectoryHandle("local-handle");

      dbHandle.queryPermission = (jest.fn() as any).mockResolvedValue("prompt");

      dbHandle.requestPermission = (jest.fn() as any).mockResolvedValue(
        "granted",
      );
      (getConfig as any).mockResolvedValueOnce(dbHandle);

      const root = await storage.getStorageRoot(db);
      expect(root.name).toBe("local-handle");

      expect(dbHandle.requestPermission).toHaveBeenCalledWith({
        mode: "readwrite",
      });
    });

    it("should log warning and fallback to OPFS on getConfig error", async () => {
      const consoleSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      (getConfig as any).mockRejectedValueOnce(new Error("DB Error"));

      const root = await storage.getStorageRoot(db);
      expect(root.name).toBe("mock-dir");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to retrieve local storage handle from DB:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getStorageStatus edge cases", () => {
    it("should handle handle queryPermission in getStorageStatus", async () => {
      const dbHandle = new MockFileSystemDirectoryHandle("db-handle");

      dbHandle.queryPermission = (jest.fn() as any).mockResolvedValue("prompt");
      (getConfig as any).mockResolvedValueOnce(dbHandle);

      const status = await storage.getStorageStatus(db);
      // No entries() method on mock, so probe fails → keeps "prompt"
      expect(status.permission).toBe("prompt");
    });

    it("should upgrade prompt to granted when handle entries() works", async () => {
      const dbHandle: any = new MockFileSystemDirectoryHandle(
        "functional-handle",
      );

      dbHandle.queryPermission = (jest.fn() as any).mockResolvedValue("prompt");

      dbHandle.entries = async function* () {
        yield ["test.txt", { kind: "file" }];
      };
      (getConfig as any).mockResolvedValueOnce(dbHandle);

      const status = await storage.getStorageStatus(db);
      expect(status.type).toBe("local");
      expect(status.permission).toBe("granted");
    });

    it("should handle error in getStorageStatus", async () => {
      const consoleSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      (getConfig as any).mockRejectedValueOnce(new Error("DB Error"));

      const status = await storage.getStorageStatus(db);
      expect(status.type).toBe("opfs");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
