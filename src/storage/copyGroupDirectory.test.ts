import { jest } from "@jest/globals";

const mockGetGroupDir = jest.fn() as any;
const mockWriteFileHandle = jest.fn() as any;
const mockWriteOpfsPathViaWorker = jest.fn() as any;
const mockGetStorageStatus = jest.fn() as any;

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: mockGetGroupDir,
}));

jest.unstable_mockModule("./writeFileHandle.js", () => ({
  writeFileHandle: mockWriteFileHandle,
  writeOpfsPathViaWorker: mockWriteOpfsPathViaWorker,
}));

jest.unstable_mockModule("./storage.js", () => ({
  getOpfsRootDirName: jest.fn(() => "shadowclaw"),
  getStorageStatus: mockGetStorageStatus,
}));

const { copyGroupDirectory } = await import("./copyGroupDirectory.js");

describe("copyGroupDirectory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("copies nested files into the target group directory", async () => {
    const copiedFile = new File(["hello"], "photo.png", {
      type: "image/png",
    });

    const sourceAttachmentsDir: any = {
      entries: async function* () {
        yield [
          "photo.png",
          {
            kind: "file",
            getFile: jest.fn(async () => copiedFile),
          },
        ];
      },
    };

    const sourceRoot: any = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "attachments") {
          return sourceAttachmentsDir;
        }

        throw new Error(`Unexpected source dir: ${name}`);
      }),
    };

    const targetAttachmentsDir: any = {
      getFileHandle: jest.fn(async () => ({ id: "target-file" })),
    };

    const targetRoot: any = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "attachments") {
          return targetAttachmentsDir;
        }

        throw new Error(`Unexpected target dir: ${name}`);
      }),
    };

    mockGetGroupDir
      .mockResolvedValueOnce(sourceRoot)
      .mockResolvedValueOnce(targetRoot);

    await copyGroupDirectory({} as any, "tg:src", "tg:dst", "attachments");

    expect(targetRoot.getDirectoryHandle).toHaveBeenCalledWith("attachments", {
      create: true,
    });
    expect(targetAttachmentsDir.getFileHandle).toHaveBeenCalledWith(
      "photo.png",
      { create: true },
    );
    expect(mockWriteFileHandle).toHaveBeenCalledTimes(1);
  });

  it("falls back to worker if file write fails with writable unsupported error on OPFS", async () => {
    const copiedFile = new File(["hello"], "photo.png", {
      type: "image/png",
    });

    const sourceAttachmentsDir: any = {
      entries: async function* () {
        yield [
          "photo.png",
          {
            kind: "file",
            getFile: jest.fn(async () => copiedFile),
          },
        ];
      },
    };

    const sourceRoot: any = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "attachments") {
          return sourceAttachmentsDir;
        }
        throw new Error(`Unexpected source dir: ${name}`);
      }),
    };

    const targetAttachmentsDir: any = {
      getFileHandle: jest.fn(async () => ({ id: "target-file" })),
    };

    const targetRoot: any = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "attachments") {
          return targetAttachmentsDir;
        }
        throw new Error(`Unexpected target dir: ${name}`);
      }),
      removeEntry: jest.fn(async () => {}),
    };

    mockGetGroupDir
      .mockResolvedValueOnce(sourceRoot)
      .mockResolvedValueOnce(targetRoot);

    mockWriteFileHandle.mockRejectedValue(
      new Error("Writable file streams are not supported"),
    );
    mockGetStorageStatus.mockResolvedValue({ type: "opfs" });

    await copyGroupDirectory({} as any, "tg:src", "tg:dst", "attachments");

    expect(mockWriteFileHandle).toHaveBeenCalledTimes(1);
    expect(mockWriteOpfsPathViaWorker).toHaveBeenCalledWith(
      ["shadowclaw", "groups", "tg-dst", "attachments", "photo.png"],
      copiedFile,
    );
    expect(targetRoot.removeEntry).not.toHaveBeenCalled();
  });

  it("removes partially created target directory if copying fails", async () => {
    const copiedFile = new File(["hello"], "photo.png", {
      type: "image/png",
    });

    const sourceAttachmentsDir: any = {
      entries: async function* () {
        yield [
          "photo.png",
          {
            kind: "file",
            getFile: jest.fn(async () => copiedFile),
          },
        ];
      },
    };

    const sourceRoot: any = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "attachments") {
          return sourceAttachmentsDir;
        }
        throw new Error(`Unexpected source dir: ${name}`);
      }),
    };

    const targetAttachmentsDir: any = {
      getFileHandle: jest.fn(async () => ({ id: "target-file" })),
    };

    const targetRoot: any = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "attachments") {
          return targetAttachmentsDir;
        }
        throw new Error(`Unexpected target dir: ${name}`);
      }),
      removeEntry: jest.fn(async () => {}),
    };

    mockGetGroupDir
      .mockResolvedValueOnce(sourceRoot)
      .mockResolvedValueOnce(targetRoot);

    const error = new Error("Fatal write error");
    mockWriteFileHandle.mockRejectedValue(error);
    mockGetStorageStatus.mockResolvedValue({ type: "opfs" });

    await expect(
      copyGroupDirectory({} as any, "tg:src", "tg:dst", "attachments"),
    ).rejects.toThrow(error);

    expect(targetRoot.removeEntry).toHaveBeenCalledWith("attachments", {
      recursive: true,
    });
  });
});
