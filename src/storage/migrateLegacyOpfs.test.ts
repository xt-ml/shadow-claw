import { jest } from "@jest/globals";
import { CONFIG_KEYS, LEGACY_OPFS_ROOT } from "../config/config.js";
import type { ShadowClawDatabase } from "../db/types.js";

const mockGetConfig = jest.fn() as any;
const mockSetConfig = jest.fn() as any;
const mockGetOpfsRootDirName = jest.fn() as any;
const mockWriteFileHandle = jest.fn() as any;
const mockWriteOpfsPathViaWorker = jest.fn() as any;

jest.unstable_mockModule("../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

jest.unstable_mockModule("./storage.js", () => ({
  getOpfsRootDirName: mockGetOpfsRootDirName,
}));

jest.unstable_mockModule("./writeFileHandle.js", () => ({
  writeFileHandle: mockWriteFileHandle,
  writeOpfsPathViaWorker: mockWriteOpfsPathViaWorker,
}));

const { migrateLegacyOpfs } = await import("./migrateLegacyOpfs.js");

describe("migrateLegacyOpfs", () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfig.mockResolvedValue(null);
    mockSetConfig.mockResolvedValue(undefined);
    mockGetOpfsRootDirName.mockReturnValue("shadowclaw-shadow-claw");
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it("skips migration if already completed", async () => {
    mockGetConfig.mockResolvedValue("true");
    const mockDb = {} as ShadowClawDatabase;

    await migrateLegacyOpfs(mockDb);

    expect(mockGetConfig).toHaveBeenCalledWith(
      mockDb,
      CONFIG_KEYS.OPFS_MIGRATED_FROM_LEGACY,
    );
    expect(mockSetConfig).not.toHaveBeenCalled();
  });

  it("skips migration if target root is the legacy root", async () => {
    mockGetOpfsRootDirName.mockReturnValue(LEGACY_OPFS_ROOT);
    const mockDb = {} as ShadowClawDatabase;

    await migrateLegacyOpfs(mockDb);

    expect(mockSetConfig).not.toHaveBeenCalled();
  });

  it("handles when navigator.storage is undefined", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });
    const mockDb = {} as ShadowClawDatabase;

    await expect(migrateLegacyOpfs(mockDb)).resolves.toBeUndefined();
    expect(mockSetConfig).not.toHaveBeenCalled();
  });

  it("handles when legacy OPFS directory does not exist and sets flag", async () => {
    const mockOpfsRoot: any = {
      getDirectoryHandle: (jest.fn() as any).mockImplementation(
        (name: string) => {
          if (name === LEGACY_OPFS_ROOT) {
            throw new DOMException("Directory not found", "NotFoundError");
          }
          return Promise.resolve({});
        },
      ),
    };

    Object.defineProperty(globalThis, "navigator", {
      value: {
        storage: {
          getDirectory: (jest.fn() as any).mockResolvedValue(mockOpfsRoot),
        },
      },
      configurable: true,
      writable: true,
    });

    const mockDb = {} as ShadowClawDatabase;
    await migrateLegacyOpfs(mockDb);

    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      CONFIG_KEYS.OPFS_MIGRATED_FROM_LEGACY,
      "true",
    );
  });

  it("recursively copies legacy files and directories into the namespaced target root", async () => {
    const mockFile1 = new File(["notes content"], "note.md", {
      type: "text/markdown",
    });
    const mockFile2 = new File(["memory content"], "MEMORY.md", {
      type: "text/markdown",
    });

    const mockNotesWorkspaceDir = {
      entries: async function* () {
        yield [
          "note.md",
          {
            kind: "file",
            getFile: jest.fn(async () => mockFile1),
          },
        ];
      },
    };

    const mockNotesGroupDir = {
      entries: async function* () {
        yield [
          "workspace",
          {
            kind: "directory",
            ...mockNotesWorkspaceDir,
          },
        ];
      },
    };

    const mockMainWorkspaceDir = {
      entries: async function* () {
        yield [
          "MEMORY.md",
          {
            kind: "file",
            getFile: jest.fn(async () => mockFile2),
          },
        ];
      },
    };

    const mockMainGroupDir = {
      entries: async function* () {
        yield [
          "workspace",
          {
            kind: "directory",
            ...mockMainWorkspaceDir,
          },
        ];
      },
    };

    const mockLegacyGroupsDir = {
      entries: async function* () {
        yield [
          "br-notes",
          {
            kind: "directory",
            ...mockNotesGroupDir,
          },
        ];
        yield [
          "br-main",
          {
            kind: "directory",
            ...mockMainGroupDir,
          },
        ];
      },
    };

    const mockLegacyRoot = {
      entries: async function* () {
        yield [
          "groups",
          {
            kind: "directory",
            ...mockLegacyGroupsDir,
          },
        ];
      },
    };

    const createdDirs = new Map<string, any>();
    const createdFiles = new Map<string, any>();

    function createMockTargetDir(path: string) {
      const dirHandle = {
        name: path.split("/").pop() || "",
        getDirectoryHandle: (jest.fn() as any).mockImplementation(
          async (name: string) => {
            const childPath = `${path}/${name}`;
            if (!createdDirs.has(childPath)) {
              createdDirs.set(childPath, createMockTargetDir(childPath));
            }
            return createdDirs.get(childPath);
          },
        ),
        getFileHandle: (jest.fn() as any).mockImplementation(
          async (name: string) => {
            const filePath = `${path}/${name}`;
            if (!createdFiles.has(filePath)) {
              createdFiles.set(filePath, { name, path: filePath });
            }
            return createdFiles.get(filePath);
          },
        ),
      };
      return dirHandle;
    }

    const mockTargetRoot = createMockTargetDir("shadowclaw-shadow-claw");

    const mockOpfsRoot = {
      getDirectoryHandle: (jest.fn() as any).mockImplementation(
        async (name: string) => {
          if (name === LEGACY_OPFS_ROOT) {
            return mockLegacyRoot;
          }
          if (name === "shadowclaw-shadow-claw") {
            return mockTargetRoot;
          }
          throw new DOMException("Not found", "NotFoundError");
        },
      ),
    };

    Object.defineProperty(globalThis, "navigator", {
      value: {
        storage: {
          getDirectory: (jest.fn() as any).mockResolvedValue(mockOpfsRoot),
        },
      },
      configurable: true,
      writable: true,
    });

    const mockDb = {} as ShadowClawDatabase;
    await migrateLegacyOpfs(mockDb);

    expect(mockWriteFileHandle).toHaveBeenCalledTimes(2);
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      CONFIG_KEYS.OPFS_MIGRATED_FROM_LEGACY,
      "true",
    );
  });

  it("falls back to writeOpfsPathViaWorker on Safari/iPad when writeFileHandle throws unsupported", async () => {
    const mockFile = new File(["test content"], "doc.txt", {
      type: "text/plain",
    });

    const mockLegacyRoot = {
      entries: async function* () {
        yield [
          "doc.txt",
          {
            kind: "file",
            getFile: jest.fn(async () => mockFile),
          },
        ];
      },
    };

    const mockTargetFile = { name: "doc.txt" };
    const mockTargetRoot = {
      getDirectoryHandle: jest.fn(),
      getFileHandle: (jest.fn() as any).mockResolvedValue(mockTargetFile),
    };

    const mockOpfsRoot = {
      getDirectoryHandle: (jest.fn() as any).mockImplementation(
        async (name: string) => {
          if (name === LEGACY_OPFS_ROOT) return mockLegacyRoot;
          if (name === "shadowclaw-shadow-claw") return mockTargetRoot;
          throw new DOMException("Not found", "NotFoundError");
        },
      ),
    };

    Object.defineProperty(globalThis, "navigator", {
      value: {
        storage: {
          getDirectory: (jest.fn() as any).mockResolvedValue(mockOpfsRoot),
        },
      },
      configurable: true,
      writable: true,
    });

    mockWriteFileHandle.mockRejectedValueOnce(
      new Error("Writable file streams are not supported"),
    );

    const mockDb = {} as ShadowClawDatabase;
    await migrateLegacyOpfs(mockDb);

    expect(mockWriteFileHandle).toHaveBeenCalledTimes(1);
    expect(mockWriteOpfsPathViaWorker).toHaveBeenCalledWith(
      ["shadowclaw-shadow-claw", "doc.txt"],
      mockFile,
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      CONFIG_KEYS.OPFS_MIGRATED_FROM_LEGACY,
      "true",
    );
  });
});
