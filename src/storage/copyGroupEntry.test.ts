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

    await copyGroupEntry({} as any, "g", "src/old.txt", "tgt/new.txt");

    expect(rootDir.getDirectoryHandle).toHaveBeenCalledWith("src");
    expect(rootDir.getDirectoryHandle).toHaveBeenCalledWith("tgt", {
      create: true,
    });
    expect(mockWriteFileHandle).toHaveBeenCalledTimes(1);
  });
});
