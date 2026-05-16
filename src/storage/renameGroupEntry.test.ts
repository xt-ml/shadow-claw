import { jest } from "@jest/globals";

const mockGetGroupDir = jest.fn() as any;
const mockParsePath = jest.fn() as any;
const mockWriteFileHandle = jest.fn() as any;
const mockWriteOpfsPathViaWorker = jest.fn() as any;
const mockGetStorageStatus = jest.fn() as any;

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: mockGetGroupDir,
}));

jest.unstable_mockModule("./parsePath.js", () => ({
  parsePath: mockParsePath,
}));

jest.unstable_mockModule("./writeFileHandle.js", () => ({
  writeFileHandle: mockWriteFileHandle,
  writeOpfsPathViaWorker: mockWriteOpfsPathViaWorker,
}));

jest.unstable_mockModule("./storage.js", () => ({
  getStorageStatus: mockGetStorageStatus,
  invalidateStorageRoot: jest.fn(),
  isStaleHandleError: jest.fn(() => false),
}));

const { renameGroupEntry } = await import("./renameGroupEntry.js");

describe("renameGroupEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renames a file within the same directory", async () => {
    const sourceFile = new File(["hello"], "old.txt", { type: "text/plain" });

    const parentDir: any = {
      getDirectoryHandle: jest.fn(async () => {
        throw new Error("Not a directory");
      }),
      getFileHandle: jest.fn(
        async (name: string, options?: { create?: boolean }) => {
          if (name === "new.txt" && !options?.create) {
            throw new Error("missing");
          }

          if (name === "old.txt" && !options?.create) {
            return { getFile: jest.fn(async () => sourceFile) };
          }

          if (name === "new.txt" && options?.create) {
            return { id: "target" };
          }

          throw new Error(`Unexpected file lookup: ${name}`);
        },
      ),
      removeEntry: jest.fn(async () => undefined),
    };

    const rootDir: any = {
      getDirectoryHandle: jest.fn(async () => parentDir),
    };

    mockGetGroupDir.mockResolvedValue(rootDir);
    mockParsePath.mockReturnValue({ dirs: ["nested"], filename: "old.txt" });

    await renameGroupEntry({} as any, "g", "nested/old.txt", "new.txt");

    expect(rootDir.getDirectoryHandle).toHaveBeenCalledWith("nested");
    expect(mockWriteFileHandle).toHaveBeenCalledTimes(1);
    expect(parentDir.removeEntry).toHaveBeenCalledWith("old.txt");
  });

  it("renames a directory recursively", async () => {
    const sourceDir: any = {
      entries: async function* () {
        yield [
          "notes.txt",
          {
            kind: "file",
            getFile: jest.fn(async () => new File(["x"], "notes.txt")),
          },
        ];
      },
    };

    const targetDir: any = {
      getFileHandle: jest.fn(async () => ({ id: "target" })),
      getDirectoryHandle: jest.fn(async () => ({ id: "nested-target" })),
    };

    const parentDir: any = {
      getDirectoryHandle: jest.fn(
        async (name: string, options?: { create?: boolean }) => {
          if (name === "renamed" && !options?.create) {
            throw new Error("missing");
          }

          if (name === "docs" && !options?.create) {
            return sourceDir;
          }

          if (name === "renamed" && options?.create) {
            return targetDir;
          }

          throw new Error(`Unexpected directory lookup: ${name}`);
        },
      ),
      getFileHandle: jest.fn(async () => {
        throw new Error("missing");
      }),
      removeEntry: jest.fn(async () => undefined),
    };

    mockGetGroupDir.mockResolvedValue(parentDir);
    mockParsePath.mockReturnValue({ dirs: [], filename: "docs" });

    await renameGroupEntry({} as any, "g", "docs", "renamed");

    expect(targetDir.getFileHandle).toHaveBeenCalledWith("notes.txt", {
      create: true,
    });
    expect(parentDir.removeEntry).toHaveBeenCalledWith("docs", {
      recursive: true,
    });
  });

  it("throws when the target already exists", async () => {
    const parentDir: any = {
      getDirectoryHandle: jest.fn(
        async (name: string, options?: { create?: boolean }) => {
          if (name === "existing" && !options?.create) {
            return { id: "existing-dir" };
          }

          throw new Error("missing");
        },
      ),
      getFileHandle: jest.fn(async () => {
        throw new Error("missing");
      }),
    };

    mockGetGroupDir.mockResolvedValue(parentDir);
    mockParsePath.mockReturnValue({ dirs: [], filename: "old" });

    await expect(
      renameGroupEntry({} as any, "g", "old", "existing"),
    ).rejects.toThrow(/Target already exists/);
  });

  it("falls back to OPFS worker when writeFileHandle is unsupported (iOS)", async () => {
    const sourceFile = new File(["content"], "old.txt", {
      type: "text/plain",
    });
    const removedEntries: string[] = [];
    const createdFiles: string[] = [];

    const parentDir: any = {
      getDirectoryHandle: jest.fn(async () => {
        throw new Error("Not a directory");
      }),
      getFileHandle: jest.fn(
        async (name: string, options?: { create?: boolean }) => {
          if (name === "new.txt" && !options?.create) {
            throw new Error("missing");
          }

          if (name === "old.txt" && !options?.create) {
            return { getFile: jest.fn(async () => sourceFile) };
          }

          if (name === "new.txt" && options?.create) {
            createdFiles.push(name);
            return { id: "target" };
          }

          throw new Error(`Unexpected file lookup: ${name}`);
        },
      ),
      removeEntry: jest.fn(async (name: string) => {
        removedEntries.push(name);
      }),
    };

    mockGetGroupDir.mockResolvedValue(parentDir);
    mockParsePath.mockReturnValue({ dirs: [], filename: "old.txt" });
    mockWriteFileHandle.mockRejectedValue(
      new Error(
        "Writable file streams are not supported by this browser/storage backend.",
      ),
    );
    mockGetStorageStatus.mockResolvedValue({ type: "opfs" });
    mockWriteOpfsPathViaWorker.mockResolvedValue(undefined);

    await renameGroupEntry({} as any, "br:g", "old.txt", "new.txt");

    expect(mockWriteOpfsPathViaWorker).toHaveBeenCalledWith(
      ["shadowclaw", "groups", "br-g", "new.txt"],
      sourceFile,
    );
    expect(removedEntries).toContain("old.txt");
    expect(removedEntries).not.toContain("new.txt");
  });

  it("cleans up empty target file and rethrows when write fails on non-OPFS storage", async () => {
    const sourceFile = new File(["content"], "old.txt", {
      type: "text/plain",
    });
    const removedEntries: string[] = [];

    const parentDir: any = {
      getDirectoryHandle: jest.fn(async () => {
        throw new Error("Not a directory");
      }),
      getFileHandle: jest.fn(
        async (name: string, options?: { create?: boolean }) => {
          if (name === "new.txt" && !options?.create) {
            throw new Error("missing");
          }

          if (name === "old.txt" && !options?.create) {
            return { getFile: jest.fn(async () => sourceFile) };
          }

          if (name === "new.txt" && options?.create) {
            return { id: "target" };
          }

          throw new Error(`Unexpected file lookup: ${name}`);
        },
      ),
      removeEntry: jest.fn(async (name: string) => {
        removedEntries.push(name);
      }),
    };

    mockGetGroupDir.mockResolvedValue(parentDir);
    mockParsePath.mockReturnValue({ dirs: [], filename: "old.txt" });
    mockWriteFileHandle.mockRejectedValue(
      new Error(
        "Writable file streams are not supported by this browser/storage backend.",
      ),
    );
    mockGetStorageStatus.mockResolvedValue({ type: "local" });

    await expect(
      renameGroupEntry({} as any, "g", "old.txt", "new.txt"),
    ).rejects.toThrow(/Writable file streams are not supported/);

    // The empty target file must be cleaned up so retries don't hit "Target already exists".
    expect(removedEntries).toContain("new.txt");
  });
});
