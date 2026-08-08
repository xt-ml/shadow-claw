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

const { copyGroupEntry } = await import("./copyGroupEntry.js");

describe("copyGroupEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("copies a file to another directory", async () => {
    const sourceFile = new File(["hello"], "old.txt", { type: "text/plain" });

    const srcParentDir: any = {
      getDirectoryHandle: jest.fn(async () => {
        throw new Error("Not a directory");
      }),
      getFileHandle: jest.fn(async (name: string) => {
        if (name === "old.txt") {
          return { getFile: jest.fn(async () => sourceFile) };
        }

        throw new Error("missing");
      }),
    };

    const tgtParentDir: any = {
      getDirectoryHandle: jest.fn(async () => {
        throw new Error("missing");
      }),
      getFileHandle: jest.fn(
        async (name: string, options?: { create?: boolean }) => {
          if (name === "new.txt" && !options?.create) {
            throw new Error("missing");
          }

          if (name === "new.txt" && options?.create) {
            return { id: "target" };
          }

          throw new Error("missing");
        },
      ),
    };

    const rootDir: any = {
      getDirectoryHandle: jest.fn(
        async (name: string, _options?: { create?: boolean }) => {
          if (name === "src") {
            return srcParentDir;
          }

          if (name === "tgt") {
            return tgtParentDir;
          }

          throw new Error("missing");
        },
      ),
    };

    mockGetGroupDir.mockResolvedValue(rootDir);
    mockParsePath.mockImplementation((path: string) => {
      if (path === "src/old.txt") {
        return { dirs: ["src"], filename: "old.txt" };
      }

      if (path === "tgt/new.txt") {
        return { dirs: ["tgt"], filename: "new.txt" };
      }

      return { dirs: [], filename: "" };
    });

    await copyGroupEntry({} as any, "g", "g", "src/old.txt", "tgt/new.txt");

    expect(rootDir.getDirectoryHandle).toHaveBeenCalledWith("src");
    expect(rootDir.getDirectoryHandle).toHaveBeenCalledWith("tgt", {
      create: true,
    });
    expect(mockWriteFileHandle).toHaveBeenCalledTimes(1);
  });

  it("copies a directory and falls back to worker if file write fails with writable unsupported error on OPFS", async () => {
    const copiedFile = new File(["hello"], "old.txt", { type: "text/plain" });

    const srcDir: any = {
      entries: async function* () {
        yield [
          "old.txt",
          {
            kind: "file",
            getFile: jest.fn(async () => copiedFile),
          },
        ];
      },
    };

    const srcParentDir: any = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "srcDir") return srcDir;
        throw new Error("missing");
      }),
      getFileHandle: jest.fn(async () => {
        throw new Error("not a file");
      }),
    };

    const tgtDir: any = {
      getFileHandle: jest.fn(async () => ({ id: "target-file" })),
    };

    const tgtParentDir: any = {
      getDirectoryHandle: jest.fn(
        async (name: string, options?: { create?: boolean }) => {
          if (name === "tgtDir" && options?.create) {
            return tgtDir;
          }
          throw new Error("missing");
        },
      ),
      getFileHandle: jest.fn(async () => {
        throw new Error("missing");
      }),
      removeEntry: jest.fn(async () => {}),
    };

    const rootDir: any = {
      getDirectoryHandle: jest.fn(
        async (name: string, _options?: { create?: boolean }) => {
          if (name === "src") return srcParentDir;
          if (name === "tgt") return tgtParentDir;
          throw new Error("missing");
        },
      ),
    };

    mockGetGroupDir.mockResolvedValue(rootDir);
    mockParsePath.mockImplementation((path: string) => {
      if (path === "src/srcDir") return { dirs: ["src"], filename: "srcDir" };
      if (path === "tgt/tgtDir") return { dirs: ["tgt"], filename: "tgtDir" };
      return { dirs: [], filename: "" };
    });

    mockWriteFileHandle.mockRejectedValue(
      new Error("Writable file streams are not supported"),
    );
    mockGetStorageStatus.mockResolvedValue({ type: "opfs" });

    await copyGroupEntry({} as any, "g", "g", "src/srcDir", "tgt/tgtDir");

    expect(mockWriteFileHandle).toHaveBeenCalledTimes(1);
    expect(mockWriteOpfsPathViaWorker).toHaveBeenCalledWith(
      ["shadowclaw", "groups", "g", "tgt", "tgtDir", "old.txt"],
      copiedFile,
    );
    expect(tgtParentDir.removeEntry).not.toHaveBeenCalled();
  });

  it("removes partially created target directory if copying fails", async () => {
    const copiedFile = new File(["hello"], "old.txt", { type: "text/plain" });

    const srcDir: any = {
      entries: async function* () {
        yield [
          "old.txt",
          {
            kind: "file",
            getFile: jest.fn(async () => copiedFile),
          },
        ];
      },
    };

    const srcParentDir: any = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "srcDir") return srcDir;
        throw new Error("missing");
      }),
      getFileHandle: jest.fn(async () => {
        throw new Error("not a file");
      }),
    };

    const tgtDir: any = {
      getFileHandle: jest.fn(async () => ({ id: "target-file" })),
    };

    const tgtParentDir: any = {
      getDirectoryHandle: jest.fn(
        async (name: string, options?: { create?: boolean }) => {
          if (name === "tgtDir" && options?.create) {
            return tgtDir;
          }
          throw new Error("missing");
        },
      ),
      getFileHandle: jest.fn(async () => {
        throw new Error("missing");
      }),
      removeEntry: jest.fn(async () => {}),
    };

    const rootDir: any = {
      getDirectoryHandle: jest.fn(
        async (name: string, _options?: { create?: boolean }) => {
          if (name === "src") return srcParentDir;
          if (name === "tgt") return tgtParentDir;
          throw new Error("missing");
        },
      ),
    };

    mockGetGroupDir.mockResolvedValue(rootDir);
    mockParsePath.mockImplementation((path: string) => {
      if (path === "src/srcDir") return { dirs: ["src"], filename: "srcDir" };
      if (path === "tgt/tgtDir") return { dirs: ["tgt"], filename: "tgtDir" };
      return { dirs: [], filename: "" };
    });

    const error = new Error("Some fatal write error");
    mockWriteFileHandle.mockRejectedValue(error);
    mockGetStorageStatus.mockResolvedValue({ type: "opfs" });

    await expect(
      copyGroupEntry({} as any, "g", "g", "src/srcDir", "tgt/tgtDir"),
    ).rejects.toThrow(error);

    expect(tgtParentDir.removeEntry).toHaveBeenCalledWith("tgtDir", {
      recursive: true,
    });
  });
});
