import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.js", () => ({ parsePath: jest.fn() }));

jest.unstable_mockModule("./storage.js", () => ({
  getOpfsRootDirName: jest.fn().mockReturnValue("shadowclaw"),
  getStorageStatus: (jest.fn() as any).mockResolvedValue({
    type: "opfs",
    permission: "granted",
    name: "OPFS",
  }),
  invalidateStorageRoot: jest.fn(),
  isStaleHandleError: jest.fn(),
}));

jest.unstable_mockModule("./writeFileHandle.js", () => ({
  writeFileHandle: (jest.fn() as any).mockResolvedValue(undefined),
  writeOpfsPathViaWorker: (jest.fn() as any).mockResolvedValue(undefined),
}));

const { writeGroupFileBytes } = await import("./writeGroupFileBytes.js");
const { getGroupDir } = await import("./getGroupDir.js");
const { parsePath } = await import("./parsePath.js");
const { getStorageStatus, invalidateStorageRoot, isStaleHandleError } =
  await import("./storage.js");
const { writeFileHandle, writeOpfsPathViaWorker } =
  await import("./writeFileHandle.js");

describe("writeGroupFileBytes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isStaleHandleError as any).mockReturnValue(false);
  });

  it("writes binary Uint8Array content to target file", async () => {
    const fileHandle: any = {};
    const nested: any = {
      getFileHandle: (jest.fn() as any).mockResolvedValue(fileHandle),
    };
    const root: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(nested),
    };

    (getGroupDir as any).mockResolvedValue(root);
    (parsePath as any).mockReturnValue({
      dirs: ["images"],
      filename: "photo.png",
    });

    const content = new Uint8Array([1, 2, 3, 4]);
    await writeGroupFileBytes({} as any, "g1", "images/photo.png", content);

    expect(root.getDirectoryHandle).toHaveBeenCalledWith("images", {
      create: true,
    });
    expect(nested.getFileHandle).toHaveBeenCalledWith("photo.png", {
      create: true,
    });
    expect(writeFileHandle).toHaveBeenCalledWith(fileHandle, content);
  });

  it("falls back to OPFS worker write when stream writing is unsupported in OPFS", async () => {
    const fileHandle: any = {};
    const nested: any = {
      getFileHandle: (jest.fn() as any).mockResolvedValue(fileHandle),
    };
    const root: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(nested),
    };

    (getGroupDir as any).mockResolvedValue(root);
    (parsePath as any).mockReturnValue({ dirs: ["sub"], filename: "bin.dat" });

    (writeFileHandle as any).mockRejectedValueOnce(
      new Error(
        "Writable file streams are not supported by this browser/storage backend.",
      ),
    );

    const content = new Uint8Array([10, 20]);
    await writeGroupFileBytes(
      {} as any,
      "peer:abc:123",
      "sub/bin.dat",
      content,
    );

    expect(getStorageStatus).toHaveBeenCalled();
    expect(writeOpfsPathViaWorker).toHaveBeenCalledWith(
      ["shadowclaw", "groups", "peer-abc-123", "sub", "bin.dat"],
      content,
    );
  });

  it("retries on stale handle error", async () => {
    const fileHandle: any = {};
    const root: any = {
      getFileHandle: (jest.fn() as any).mockResolvedValue(fileHandle),
    };

    (parsePath as any).mockReturnValue({ dirs: [], filename: "file.txt" });
    (isStaleHandleError as any)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);

    (getGroupDir as any)
      .mockRejectedValueOnce(new Error("Stale handle"))
      .mockResolvedValueOnce(root);

    const content = new Uint8Array([5, 6]);
    await writeGroupFileBytes({} as any, "g1", "file.txt", content);

    expect(invalidateStorageRoot).toHaveBeenCalledTimes(1);
    expect(writeFileHandle).toHaveBeenCalledWith(fileHandle, content);
  });

  it("throws error when non-OPFS storage backend fails with unsupported stream error", async () => {
    const fileHandle: any = {};
    const root: any = {
      getFileHandle: (jest.fn() as any).mockResolvedValue(fileHandle),
    };

    (getGroupDir as any).mockResolvedValue(root);
    (parsePath as any).mockReturnValue({ dirs: [], filename: "file.txt" });
    (getStorageStatus as any).mockResolvedValueOnce({
      type: "local",
      permission: "granted",
      name: "Folder",
    });

    (writeFileHandle as any).mockRejectedValueOnce(
      new Error("Writable file streams are not supported"),
    );

    await expect(
      writeGroupFileBytes({} as any, "g1", "file.txt", new Uint8Array([1])),
    ).rejects.toThrow("Writable file streams are not supported");
  });
});
